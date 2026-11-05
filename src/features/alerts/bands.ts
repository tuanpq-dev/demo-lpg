/*
 * Mức theo giá trị (bands) cho cảnh báo nhiều mức – khí gas (% LEL), sau này hóa khí. Thuần, có test (bands.test.ts).
 * Bands + banner + điều kiện đóng lấy từ cấu hình loại (`ALERT_KINDS` ở mocks/alertKinds.ts) – không viết cứng ở UI.
 */
import type { AlertBand, AlertKindConfig, AlertLevel } from '@/features/alerts/kinds';
import { formatMeasure } from './gauge';

export const LEVEL_ORDER: readonly AlertLevel[] = ['normal', 'level-1', 'level-2', 'esd'];
export const levelRank = (l: AlertLevel) => LEVEL_ORDER.indexOf(l);

/** Đoạn chứa giá trị: đoạn cuối có `from ≤ value` (đúng bằng mốc = mức cao hơn); dưới đoạn đầu → đoạn đầu. */
export function bandOf(value: number, bands: readonly AlertBand[]): AlertBand {
  let hit = bands[0]!;
  for (const b of bands) if (value >= b.from) hit = b;
  return hit;
}

/** Giá trị bắt đầu của một mức (undefined nếu bands không có mức đó). */
export const levelStart = (bands: readonly AlertBand[], level: AlertLevel) => bands.find((b) => b.level === level)?.from;

export type BannerView = { stage: 'before-esd' | 'after-esd'; title: string; text: string };

/**
 * Banner khẩn cấp: hiện khi giá trị ≥ đầu mức `fromLevel`; ≥ đầu mức `esdLevel` → câu "đã vượt ESD". `value` undefined
 * (mất tín hiệu) → null: drawer tự quyết dùng số nào (hiện tại: giá trị lúc cảnh báo – thận trọng).
 */
export function bannerFor(value: number | undefined, cfg: Pick<AlertKindConfig, 'bands' | 'banner'>, unit: string): BannerView | null {
  const { bands, banner } = cfg;
  if (value === undefined || !bands || !banner) return null;
  const from = levelStart(bands, banner.fromLevel);
  const esd = levelStart(bands, banner.esdLevel);
  if (from === undefined || value < from) return null;
  const esdText = esd !== undefined ? formatMeasure(esd, unit) : '';
  const after = esd !== undefined && value >= esd;
  return { stage: after ? 'after-esd' : 'before-esd', title: banner.title, text: (after ? banner.afterEsd : banner.beforeEsd).replace('{esd}', esdText) };
}

export type GaugeTick = { value: number; label: string; level?: AlertLevel };

/** Mốc trục: đầu thang · đầu mỗi đoạn (trừ đoạn đầu) · cuối thang. Mốc ESD ghi "40 (ESD)". */
export function bandTicks(bands: readonly AlertBand[], scale: { min: number; max: number }): GaugeTick[] {
  const ticks: GaugeTick[] = [{ value: scale.min, label: String(scale.min) }];
  for (const b of bands.slice(1)) {
    if (b.from > scale.min && b.from < scale.max) ticks.push({ value: b.from, label: b.level === 'esd' ? `${b.from} (ESD)` : String(b.from), level: b.level });
  }
  ticks.push({ value: scale.max, label: String(scale.max) });
  return ticks;
}

export type OverThreshold = { state: 'over'; minutes: number } | { state: 'below' } | { state: 'unknown' };

/**
 * Thời gian vượt ngưỡng = bây giờ − lúc phát sinh cảnh báo (cảnh báo phát sinh khi vượt ngưỡng), khi số live CÒN ≥ ngưỡng.
 * Live < ngưỡng → below ("Đã về dưới ngưỡng"); mất tín hiệu → unknown.
 */
export function overThreshold(occurredAt: Date, live: number | undefined, threshold: number, now: Date): OverThreshold {
  if (live === undefined) return { state: 'unknown' };
  if (live < threshold) return { state: 'below' };
  return { state: 'over', minutes: Math.max(0, Math.floor((now.getTime() - occurredAt.getTime()) / 60_000)) };
}

/** "dưới 1 phút" · "6 phút" · "1 giờ 5 phút" · "2 giờ". */
export function formatMinutes(min: number): string {
  if (min < 1) return 'dưới 1 phút';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} phút`;
  return m ? `${h} giờ ${m} phút` : `${h} giờ`;
}

export type CloseCheck =
  | { ok: true; value: number; source: 'live' | 'measured' }
  | { ok: false; reason: 'above' | 'need-measure' | 'measured-above' | 'invalid-measure'; message: string };

/**
 * Điều kiện "Đã xử lý xong" (bổ sung an toàn ngoài Figma): số live < `limit` (đầu mức cấp 1). Mất tín hiệu → BẮT BUỘC số
 * đo lại tại chỗ < `limit`. Có nhập số đo lại thì số đó cũng phải < `limit` (dù live đã dưới).
 */
export function canCloseGas({ live, measured, limit, unit }: { live: number | undefined; measured?: number; limit: number; unit: string }): CloseCheck {
  const lim = formatMeasure(limit, unit);
  if (measured !== undefined && (!Number.isFinite(measured) || measured < 0)) return { ok: false, reason: 'invalid-measure', message: 'Nồng độ đo lại không hợp lệ.' };
  if (live === undefined) {
    if (measured === undefined) return { ok: false, reason: 'need-measure', message: `Cảm biến mất tín hiệu – nhập nồng độ đo lại tại chỗ (phải dưới ${lim}).` };
    if (measured >= limit) return { ok: false, reason: 'measured-above', message: `Nồng độ đo lại ${formatMeasure(measured, unit)} vẫn trên ngưỡng (${lim}).` };
    return { ok: true, value: measured, source: 'measured' };
  }
  if (live >= limit) return { ok: false, reason: 'above', message: `Nồng độ hiện tại ${formatMeasure(live, unit)} vẫn trên ngưỡng (${lim}).` };
  if (measured !== undefined && measured >= limit) return { ok: false, reason: 'measured-above', message: `Nồng độ đo lại ${formatMeasure(measured, unit)} vẫn trên ngưỡng (${lim}).` };
  return measured !== undefined ? { ok: true, value: measured, source: 'measured' } : { ok: true, value: live, source: 'live' };
}
