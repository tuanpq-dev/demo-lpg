/** Dữ liệu modal cập nhật xử lý: dòng thông số trước/sau, ngưỡng, theo dõi sau xử lý, nháp. Tách từ alertDetail.ts. */
import { formatGaugeNumber, isBreached, withUnit } from '@/features/alerts/gauge';
import type { AlertRecord } from '@/features/alerts/types';
import { DEFAULT_FOLLOW_UP, GAS_BANDS, REGULATORS, fillPlaybookText } from '@/mocks/alertKinds';
import type { AlertKindConfig, AlertUpdateConfig, FollowUpConfig } from '@/features/alerts/kinds';
import { ASSET_TAGS, REGULATOR_TAGS } from '@/features/live/tags';
import { parseUpdateDraft, type UpdateDraft } from '@/features/alerts/update';
import { AREA_FIRE_SIGNALS, HEAT_DETECTORS, sensorsInArea } from '@/mocks/sensors';
import type { Area } from '@/features/plant/areas';
import { levelStart } from '@/features/alerts/bands';
import { createSessionDraft } from '@/lib/sessionDraft';
import { alertKind, alertMetric, configFor } from './alertBase';

/**
 * "Lúc cảnh báo: 11.8 bar / 10.5 bar" (thẻ đầu modal phân công) – giá trị CỦA BẢN GHI (không phải số trực tiếp) / ngưỡng
 * (cấu hình tag, thiếu → bản ghi). null = ẩn ô: loại cảnh báo `numericValue: false` hoặc giá trị không phải số.
 */
export function alertRecordedValue(a: AlertRecord): { value: string; threshold: string; breached: boolean } | null {
  if (alertKind(a).numericValue === false) return null;
  const m = alertMetric(a);
  if (!Number.isFinite(m.value) || !Number.isFinite(m.threshold)) return null;
  return {
    value: withUnit(formatGaugeNumber(m.value), m.unit),
    threshold: withUnit(formatGaugeNumber(m.threshold), m.unit),
    breached: isBreached(m.value, m.threshold, m.direction),
  };
}

// ---- Modal "Cập nhật xử lý" (khung chung theo loại – docs/guide/alerts.md (4o)) ----

/** Cấu hình cập nhật của loại cảnh báo; loại `resolve-note` → null (drawer giữ nút "Đánh dấu đã xử lý"). */
export function updateConfig(a: Pick<AlertRecord, 'kind'>): AlertUpdateConfig | null {
  const u = alertKind(a).update;
  return u.kind === 'alert-update' ? u : null;
}

/** Cấu hình theo dõi sau xử lý của loại (loại không có modal cập nhật → mặc định không theo dõi). */
export const followUpConfig = (a: Pick<AlertRecord, 'kind'>): FollowUpConfig => updateConfig(a)?.followUp ?? DEFAULT_FOLLOW_UP;

/** Ngưỡng của tag trong cấu hình tài sản (null = không có cấu hình). */
const tagThresholds = (tag: string | undefined) => configFor(tag) ?? null;

export type UpdateReadingRow = {
  id: string;
  label: string;
  unit: string;
  tag?: string;
  /** Số lúc cảnh báo (dòng chính = giá trị bản ghi; khác = `readingsAtAlert`); thiếu → "–". */
  before?: number;
  warn?: number;
  danger?: number;
  /** Dòng quyết định điều kiện "Đã xử lý". */
  primary: boolean;
  /** Tag trạng thái chuỗi (đầu báo khói 'alarm' | 'normal') – không có số, không nhập tay. */
  alarm?: boolean;
};

const gasLimits = (cfg: AlertKindConfig) => ({
  warn: levelStart(cfg.bands ?? GAS_BANDS, 'level-1'),
  danger: levelStart(cfg.bands ?? GAS_BANDS, 'level-2'),
});

/**
 * Ngưỡng ĐÓNG của tag chính: áp suất / loại khác = "Ngưỡng cho phép" (`alertMetric`) · gas = đầu mức `closeBelow` (cấp 1) ·
 * cháy = nhiệt độ báo động của đầu báo (`HEAT_DETECTORS`, thiếu → ngưỡng bản ghi).
 */
export function closeLimit(a: AlertRecord): number {
  const u = updateConfig(a);
  const kindCfg = alertKind(a);
  if (u?.close.rule === 'gas') return levelStart(kindCfg.bands ?? GAS_BANDS, u.close.closeBelow) ?? Number(a.threshold);
  if (u?.close.rule === 'fire') return HEAT_DETECTORS[a.device]?.alarmAt ?? Number(a.threshold);
  return alertMetric(a).threshold;
}

/**
 * Dòng "Thông số trước và sau xử lý" theo cấu hình loại: tra tag + ngưỡng theo thiết bị. Chính = tag của cảnh báo (cháy:
 * nhiệt độ đầu báo) + ngưỡng đóng; sau bộ điều áp = `REGULATOR_TAGS` (PT-103 GIẢ ĐỊNH, chưa có ngưỡng); nhiệt độ bồn = tag
 * tài sản; cảm biến cùng khu (gas) + khói / gas của khu (cháy) – màu theo bands gas.
 */
export function updateReadingRows(a: AlertRecord, cfg: AlertUpdateConfig): UpdateReadingRow[] {
  const assetTags = ASSET_TAGS[a.device as keyof typeof ASSET_TAGS] as { pressure?: string; temperature?: string } | undefined;
  const kindCfg = alertKind(a);
  const detector = HEAT_DETECTORS[a.device];
  const signals = AREA_FIRE_SIGNALS[(detector?.area ?? a.area) as Area] ?? [];
  const signal = (k: 'smoke' | 'gas') => signals.find((x) => x.kind === k);
  const vars = { tag: a.tag, smoke: signal('smoke')?.id, gas: signal('gas')?.id };
  const fill = (t: string, extra: { sensor?: string } = {}) => fillPlaybookText(t, a.device, { ...vars, ...extra });
  const gl = gasLimits(kindCfg);
  return cfg.readings.flatMap((r): UpdateReadingRow[] => {
    if (r.field === 'primary') {
      const m = alertMetric(a);
      const limit = closeLimit(a);
      const tag = cfg.close.rule === 'fire' ? (detector?.tempTag ?? a.tag) : (a.tag ?? assetTags?.pressure);
      const danger = cfg.close.rule === 'gas' ? gl.danger : cfg.close.rule === 'fire' ? undefined : m.danger;
      return [
        {
          id: r.id,
          label: fill(r.label),
          unit: a.unit,
          tag,
          before: Number.isFinite(m.value) ? m.value : undefined,
          warn: limit,
          danger,
          primary: true,
        },
      ];
    }
    if (r.field === 'areaSensors') {
      return sensorsInArea(a.area)
        .filter((x) => x.tag !== a.tag)
        .map((x) => ({
          id: `${r.id}-${x.tag}`,
          label: fill(r.label, { sensor: x.tag }),
          unit: '% LEL',
          tag: x.tag,
          warn: gl.warn,
          danger: gl.danger,
          primary: false,
        }));
    }
    if (r.field === 'smoke' || r.field === 'gas') {
      const sg = signal(r.field);
      if (!sg) return [];
      return r.field === 'smoke'
        ? [{ id: r.id, label: fill(r.label), unit: '', tag: sg.tag, primary: false, alarm: true }]
        : [{ id: r.id, label: fill(r.label), unit: '% LEL', tag: sg.tag, warn: gl.warn, danger: gl.danger, primary: false }];
    }
    const tag = r.field === 'regulatorOut' ? REGULATOR_TAGS[REGULATORS[a.device] ?? '']?.outletPressure : assetTags?.temperature;
    const th = tagThresholds(tag);
    return [
      {
        id: r.id,
        label: fill(r.label),
        unit: r.field === 'temperature' ? '°C' : 'bar',
        tag,
        before: a.readingsAtAlert?.[r.id],
        warn: th?.warn,
        danger: th?.danger,
        primary: false,
      },
    ];
  });
}

/** Mục "Kết quả xác minh" đã điền chữ. */
export function verificationItems(a: Pick<AlertRecord, 'device' | 'tag'>, cfg: AlertUpdateConfig) {
  return cfg.verification.map((v) => ({ ...v, text: fillPlaybookText(v.text, a.device, { tag: a.tag }) }));
}

/** Nháp modal cập nhật xử lý – sessionStorage theo mã (try/catch trong `createSessionDraft`). */
export const updateDraft = createSessionDraft<UpdateDraft>('demo-lpg:alert-update-draft:', parseUpdateDraft);

// ---- Modal "Xác nhận đóng cảnh báo" – 3 điều kiện hệ thống (features/alerts/close.ts) ----
