import { SIGNAL_LOST_LABEL, tagSignal } from '@/features/live/signal';
import type { LiveSourceStatus, TagValue } from '@/features/live/types';
import { plantDayKey, plantTimeOfDay, formatDayVi, dayNumber } from '@/lib/plantTime';
import type { DeviceParam, OperationLogEntry, ParamLimits } from '@/features/operations/types';

/*
 * Logic thuần màn Vận hành – chi tiết thiết bị (ảnh `scratch/figma-ref/op-device-*.png`). `now` luôn truyền vào.
 */

export type ViewTone = 'success' | 'warning' | 'danger' | 'neutral';

// ============================================================================
// Tham số theo ngưỡng
// ============================================================================

/** normal · low (≤ biên dưới) · high (≥ biên trên) · danger (vượt ngưỡng nguy hiểm, cả hai phía). */
export type ParamStatus = 'normal' | 'low' | 'high' | 'danger';

export function paramStatus(value: number, l: ParamLimits): ParamStatus {
  if ((l.danger !== undefined && value >= l.danger) || (l.lowDanger !== undefined && value <= l.lowDanger)) return 'danger';
  if (l.warn !== undefined && value >= l.warn) return 'high';
  if (l.lowWarn !== undefined && value <= l.lowWarn) return 'low';
  return 'normal';
}

/** Cột "Ngưỡng cảnh báo": "2.0 - 6.0" · "< 75" · "> 85" · "-" (không có ngưỡng). */
export function limitText(l: ParamLimits, digits: number): string {
  const f = (v: number) => v.toFixed(digits);
  if (l.lowWarn !== undefined && l.warn !== undefined) return `${f(l.lowWarn)} - ${f(l.warn)}`;
  if (l.warn !== undefined) return `< ${f(l.warn)}`;
  if (l.lowWarn !== undefined) return `> ${f(l.lowWarn)}`;
  return '-';
}

/** "1s trước" · "45s trước" · "3 phút trước" · "2 giờ trước" (ts tương lai do lệch đồng hồ → "0s trước"). */
function ageText(ts: number, now: number): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 60) return `${s}s trước`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} phút trước`;
  return `${Math.floor(m / 60)} giờ trước`;
}

export type ParamReading = {
  /** pending = chưa nhận ảnh chụp đầu · lost = mất tín hiệu (KHÔNG có `value`) · ok. */
  state: 'pending' | 'lost' | 'ok';
  value?: number;
  status?: ParamStatus;
  /** Nhãn cột "Trạng thái" / dòng phụ KPI. */
  label: string;
  tone: ViewTone;
  /** "1s trước"; undefined khi chưa có số liệu. */
  updated?: string;
};

/**
 * Đọc một tham số từ tag: mất tín hiệu (bad / quá 10 s / thiếu tag) → "Mất tín hiệu" xám, không giữ số cũ.
 * Trong ngưỡng → `okLabel`/`okTone` của tham số; thấp/cao → "Thấp"/"Cao" vàng; nguy hiểm → đỏ.
 */
export function readParam(p: Pick<DeviceParam, 'limits' | 'okLabel' | 'okTone'>, tv: TagValue | undefined, live: boolean, now: number): ParamReading {
  if (!live) return { state: 'pending', label: '—', tone: 'neutral' };
  if (tagSignal(tv, now) === 'lost' || typeof tv?.value !== 'number') {
    return { state: 'lost', label: SIGNAL_LOST_LABEL, tone: 'neutral', updated: tv ? ageText(tv.ts, now) : undefined };
  }
  const status = paramStatus(tv.value, p.limits);
  const view: Record<ParamStatus, Pick<ParamReading, 'label' | 'tone'>> = {
    normal: { label: p.okLabel, tone: p.okTone },
    low: { label: 'Thấp', tone: 'warning' },
    high: { label: 'Cao', tone: 'warning' },
    danger: { label: 'Nguy hiểm', tone: 'danger' },
  };
  return { state: 'ok', value: tv.value, status, ...view[status], updated: ageText(tv.ts, now) };
}

/** Số tag mất tín hiệu (không trùng tag) – "Cảm biến lỗi". Chưa có số liệu → undefined. */
export function lostSensorCount(tags: readonly string[], live: Record<string, TagValue> | undefined, now: number): number | undefined {
  if (!live) return undefined;
  return new Set(tags.filter((t) => tagSignal(live[t], now) === 'lost')).size;
}

// ============================================================================
// Trạng thái máy, máy dự phòng, kết nối
// ============================================================================

const RUN_STATE: Record<string, { label: string; short: string; tone: ViewTone }> = {
  running: { label: 'Đang hoạt động', short: 'đang chạy', tone: 'success' },
  standby: { label: 'Dự phòng', short: 'dự phòng', tone: 'neutral' },
  fault: { label: 'Sự cố', short: 'sự cố', tone: 'danger' },
  stopped: { label: 'Đã dừng', short: 'đã dừng', tone: 'neutral' },
};

export type RunStateView = { label: string; short: string; tone: ViewTone };

/** Trạng thái chạy từ tag chuỗi; mất tín hiệu / giá trị lạ → "Mất tín hiệu" / "Không xác định" xám. */
export function runState(tv: TagValue | undefined, live: boolean, now: number): RunStateView {
  if (!live) return { label: '—', short: '—', tone: 'neutral' };
  if (tagSignal(tv, now) === 'lost') return { label: SIGNAL_LOST_LABEL, short: 'mất tín hiệu', tone: 'neutral' };
  return RUN_STATE[String(tv?.value)] ?? { label: 'Không xác định', short: 'không xác định', tone: 'neutral' };
}

/** "Thiết bị dự phòng": standby = "Sẵn sàng" (máy chờ chạy được), các trạng thái khác theo `runState`. */
export function standbyReadiness(view: RunStateView, raw: TagValue | undefined): { label: string; tone: ViewTone } {
  if (raw?.value === 'standby' && view.label === RUN_STATE.standby?.label) return { label: 'Sẵn sàng', tone: 'neutral' };
  return { label: view.label, tone: view.tone };
}

/** Kết nối SCADA / PLC theo trạng thái nguồn dữ liệu trực tiếp. */
export function connectionView(status: LiveSourceStatus): { scada: string; plc: string; tone: ViewTone } {
  if (status === 'connected') return { scada: 'Trực tuyến', plc: 'Online', tone: 'success' };
  if (status === 'connecting') return { scada: 'Đang kết nối lại', plc: 'Đang kết nối', tone: 'warning' };
  return { scada: 'Mất kết nối', plc: 'Offline', tone: 'danger' };
}

// ============================================================================
// Xu hướng (lịch sử mock – thay bằng API lịch sử tag)
// ============================================================================

/** Nhãn trục X của điểm cách hiện tại `k` phút: "Bây giờ" · "-15m". */
export const trendLabel = (k: number) => (k === 0 ? 'Bây giờ' : `-${k}m`);

/** Các mốc trục X: 4 khoảng đều + "Bây giờ" ("-60m", "-45m", "-30m", "-15m", "Bây giờ"). */
export function trendTicks(minutes: number, parts = 4): string[] {
  return Array.from({ length: parts + 1 }, (_, i) => trendLabel(Math.round((minutes * (parts - i)) / parts)));
}

/**
 * Lịch sử giả lập theo phút: dao động mượt quanh `base` (biên độ `amplitude`), XÁC ĐỊNH theo phút tuyệt đối nên hai lần
 * render trong cùng phút giống nhau và đường "trôi" theo thời gian. Trả `minutes + 1` giá trị, cũ → mới; phần tử cuối
 * (hiện tại) do trang thay bằng số trực tiếp.
 */
export function mockHistory(base: number, amplitude: number, seed: number, minutes: number, now: number): number[] {
  const nowMin = Math.floor(now / 60_000);
  return Array.from({ length: minutes + 1 }, (_, i) => {
    const m = nowMin - (minutes - i);
    const v = base + amplitude * (0.65 * Math.sin(m / 9 + seed) + 0.35 * Math.sin(m / 4.3 + seed * 2.1));
    return Math.round(v * 100) / 100;
  });
}

/** Hạt giống ổn định từ tên tag (đường của các tag khác nhau không trùng pha). */
export function tagSeed(tag: string): number {
  let h = 0;
  for (const ch of tag) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return h / 97;
}

// ============================================================================
// Nhật ký
// ============================================================================

/** "18:03:42 - Hôm nay" · "23:10:05 - Hôm qua" · "12:00:00 - 28/10/2026" (giờ nhà máy). */
export function logTimeLabel(entry: Pick<OperationLogEntry, 'minutesAgo'>, now: Date): string {
  const at = new Date(now.getTime() - entry.minutesAgo * 60_000);
  const diff = dayNumber(plantDayKey(now)) - dayNumber(plantDayKey(at));
  const day = diff === 0 ? 'Hôm nay' : diff === 1 ? 'Hôm qua' : formatDayVi(plantDayKey(at));
  return `${plantTimeOfDay(at)} - ${day}`;
}
