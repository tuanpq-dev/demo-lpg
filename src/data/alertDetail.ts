/*
 * Phần CHỈ drawer chi tiết cảnh báo cần (ngưỡng theo cấu hình tag, playbook, số trực tiếp, nhân sự) – tách khỏi
 * `data/alerts.ts` vì file đó nằm trong bundle chính (`LiveAnnouncer` dùng `useAlerts`): kéo mock tài sản/nhân sự vào
 * đây thì chỉ chunk trang Cảnh báo phải tải.
 */
import { formatGaugeNumber, gaugeScale, isBreached, withUnit, type GaugeScale } from '@/features/alerts/gauge';
import { tagSignal } from '@/features/live/signal';
import { formatDayVi, parsePlantDateTime, plantDayKey } from '@/lib/plantTime';
import type { AlertDirection, AlertRecord } from '@/mocks/alerts';
import { ALERT_KINDS, DEFAULT_FOLLOW_UP, GAS_BANDS, REGULATORS, fillPlaybookText, type AlertKindConfig, type AlertUpdateConfig, type FollowUpConfig } from '@/mocks/alertKinds';
import { ASSET_TAGS, REGULATOR_TAGS } from '@/features/live/tags';
import { parseUpdateDraft, type UpdateDraft } from '@/features/alerts/update';
import { closeConditions, relatedOpenAlerts, type CloseCondition, type CloseConditionInput } from '@/features/alerts/close';
import { AREA_EQUIPMENT, AREA_FIRE_SIGNALS, HEAT_DETECTORS, nearbySensor, sensorsInArea, type HeatDetector } from '@/mocks/sensors';
import type { Area } from '@/mocks/areas';
import {
  crossConfirm,
  detectorStatus,
  equipmentStateView,
  fireSignalView,
  type CrossConfirm,
  type DetectorAlarm,
  type DetectorDevice,
  type FireSignalKind,
  type FireSignalView,
  type TagReading,
} from '@/features/alerts/fire';
import type { LiveData } from '@/features/live/types';
import { bandOf, levelStart } from '@/features/alerts/bands';
import { formatMeasure } from '@/features/alerts/gauge';
import { assetMocks } from '@/mocks/assets';
import { STAFF } from '@/mocks/maintenance';
import { useLiveData } from './live';
import type { AlertAssignForm } from '@/features/alerts/assign';
import { createSessionDraft } from '@/lib/sessionDraft';

/**
 * Người nhận xử lý cảnh báo = TOÀN BỘ `STAFF` (kể cả trưởng ca / quản lý vận hành). Khác bảo trì (chỉ technician +
 * engineer – `ASSIGNABLE_STAFF`) là CÓ CHỦ ĐÍCH: cảnh báo thuộc vận hành, trưởng ca thường là người nhận đầu tiên.
 */
export const ALERT_STAFF = STAFF;

/** Ngày giờ phát sinh "10:45:22 - 12/10/2026" (ngày = hôm nay − daysAgo theo giờ nhà máy). */
export function alertDateTimeLabel(a: Pick<AlertRecord, 'daysAgo' | 'time'>, now: Date): string {
  const [y, m, d] = plantDayKey(now).split('-').map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d! - a.daysAgo));
  return `${a.time} - ${formatDayVi(t.toISOString())}`;
}

/** "10:45 hôm nay" · "22:41 hôm qua" · "20:16 24/10/2026" – thẻ đầu modal phân công. */
export function alertShortTimeLabel(a: Pick<AlertRecord, 'daysAgo' | 'time'>, now: Date): string {
  const hm = a.time.slice(0, 5);
  if (a.daysAgo === 0) return `${hm} hôm nay`;
  if (a.daysAgo === 1) return `${hm} hôm qua`;
  return `${hm} ${alertDateTimeLabel(a, now).split(' - ')[1]}`;
}

export type AlertMetric = {
  value: number;
  /** "Ngưỡng cho phép": cấu hình tag (warn / lowWarn theo chiều) nếu có, không thì ngưỡng của bản ghi. */
  threshold: number;
  /** Mức nguy hiểm của cấu hình (đặt thang đo); undefined = không có cấu hình. */
  danger?: number;
  unit: string;
  direction: AlertDirection;
  tag?: string;
  fromConfig: boolean;
};

/** Ngưỡng của tag trong cấu hình tài sản (`mocks/assets.ts`) – tìm tài sản có tag này. */
function configFor(tag: string | undefined) {
  if (!tag) return undefined;
  for (const asset of Object.values(assetMocks)) {
    const field = (Object.keys(asset.tags) as (keyof typeof asset.tags)[]).find((k) => asset.tags[k] === tag);
    if (field && field in asset.alarms) return asset.alarms[field as keyof typeof asset.alarms] as { warn?: number; danger?: number; lowWarn?: number; lowDanger?: number };
  }
  return undefined;
}

/** Số liệu cảnh báo + ngưỡng + chiều. Giá trị là "giá trị LÚC CẢNH BÁO" của bản ghi (không phải số trực tiếp). */
export function alertMetric(a: AlertRecord): AlertMetric {
  const direction = a.direction ?? 'above';
  const cfg = configFor(a.tag);
  const cfgThreshold = direction === 'above' ? cfg?.warn : cfg?.lowWarn;
  const cfgDanger = direction === 'above' ? cfg?.danger : cfg?.lowDanger;
  return {
    value: Number(a.value),
    threshold: cfgThreshold ?? Number(a.threshold),
    danger: cfgThreshold !== undefined ? cfgDanger : undefined,
    unit: a.unit,
    direction,
    tag: a.tag,
    fromConfig: cfgThreshold !== undefined,
  };
}

export const metricText = (n: number, unit: string) => withUnit(formatGaugeNumber(n), unit);

/** Cấu hình loại của cảnh báo (`ALERT_KINDS`, thiếu → generic). */
export const alertKind = (a: Pick<AlertRecord, 'kind'>): AlertKindConfig => ALERT_KINDS[a.kind ?? 'generic'] ?? ALERT_KINDS.generic;

/** Nguyên nhân + hướng dẫn theo loại, chữ đã thay `{device}` / `{safetyValve}` / `{nearbySensor}`. */
export function alertPlaybook(a: Pick<AlertRecord, 'kind' | 'device' | 'tag'>) {
  const pb = alertKind(a);
  const vars = { nearbySensor: nearbySensor(a.tag ?? a.device), tag: a.tag };
  return {
    label: pb.label,
    gauge: pb.gauge !== false,
    causes: pb.causes.map((c) => fillPlaybookText(c, a.device, vars)),
    steps: pb.steps.map((s) => ({ id: s.id, text: fillPlaybookText(s.text, a.device, vars) })),
  };
}

/** Thời điểm phát sinh (giờ nhà máy: hôm nay − daysAgo, lúc `time`). */
export function alertOccurredAt(a: Pick<AlertRecord, 'daysAgo' | 'time'>, now: Date): Date {
  const [y, m, d] = plantDayKey(now).split('-').map(Number);
  const day = new Date(Date.UTC(y!, m! - 1, d! - a.daysAgo)).toISOString().slice(0, 10);
  return parsePlantDateTime(`${day}T${a.time}`) ?? now;
}

/** `text` = giá trị chuỗi của tag trạng thái (vd `SD-02.ALARM` 'alarm' | 'normal'); `value` chỉ khi là số. */
export type AlertLiveReading = { state: 'none' | 'pending' | 'lost' | 'ok'; value?: number; text?: string };

/** Số trực tiếp của tag cảnh báo ("Hiện tại: x bar"). Không có tag → none; mất tín hiệu theo `tagSignal` lúc render. */
export function useAlertLive(tag: string | undefined): AlertLiveReading {
  const live = useLiveData(tag ? [tag] : [], { enabled: !!tag });
  if (!tag) return { state: 'none' };
  if (!live) return { state: 'pending' };
  const tv = live[tag];
  if (tagSignal(tv, Date.now()) === 'lost' || typeof tv?.value !== 'number') return { state: 'lost' };
  return { state: 'ok', value: tv.value };
}

/** Đọc một tag từ LiveData theo quy tắc mất tín hiệu (`tagSignal` lúc gọi). Số → `value`, chuỗi trạng thái → `text`. */
function liveReading(live: LiveData | undefined, tag: string, now: number): AlertLiveReading {
  if (!live) return { state: 'pending' };
  const tv = live[tag];
  if (tagSignal(tv, now) === 'lost' || tv === undefined) return { state: 'lost' };
  if (typeof tv.value === 'number') return { state: 'ok', value: tv.value };
  return typeof tv.value === 'string' ? { state: 'ok', text: tv.value } : { state: 'lost' };
}

/** Số trực tiếp của nhiều tag cùng lúc (cùng quy tắc `useAlertLive`) – dòng thông số modal cập nhật xử lý. */
export function useTagReadings(tags: readonly (string | undefined)[]): Record<string, AlertLiveReading> {
  const list = tags.filter((t): t is string => !!t);
  const live = useLiveData(list, { enabled: list.length > 0 });
  const now = Date.now();
  return Object.fromEntries(list.map((tag) => [tag, liveReading(live, tag, now)]));
}

export type AlertGauge = { kind: 'scale'; scale: GaugeScale } | { kind: 'off' } | { kind: 'invalid' };

/**
 * Thanh đo của cảnh báo: tắt theo cấu hình loại (`ALERT_KINDS[kind].gauge === false` – cảnh báo tốc độ thay đổi) →
 * `off`; bật nhưng số không dựng được thang → `invalid`; còn lại `scale` (0 → nguy hiểm/ngưỡng × 1.2, nới × 1.05).
 */
export function alertGauge(a: AlertRecord): AlertGauge {
  if (!alertPlaybook(a).gauge) return { kind: 'off' };
  const scale = gaugeScale(alertMetric(a));
  return scale ? { kind: 'scale', scale } : { kind: 'invalid' };
}

export type SensorReading = { tag: string; state: 'pending' | 'lost' | 'ok'; value?: number; label?: string; tone: 'success' | 'warning' | 'danger' | 'neutral' };

const BAND_TONE = { success: 'success', 'warning-dim': 'warning', warning: 'warning', danger: 'danger' } as const;

/** Mức + tone của một số đo theo bands của loại (null khi loại không có bands). */
export function levelOf(cfg: AlertKindConfig, value: number) {
  if (!cfg.bands) return null;
  const b = bandOf(value, cfg.bands);
  return { band: b, label: b.label, tone: BAND_TONE[b.tone] };
}

/**
 * "Cảm biến trong khu vực": mọi cảm biến cùng loại trong khu của cảnh báo, số trực tiếp + mức theo bands của loại.
 * Mất tín hiệu theo `tagSignal` lúc render (không giữ số cũ).
 */
export function useAreaSensors(area: string, cfg: AlertKindConfig): SensorReading[] {
  const tags = sensorsInArea(area).map((s) => s.tag);
  const live = useLiveData(tags, { enabled: tags.length > 0 });
  const now = Date.now();
  return tags.map((tag) => {
    if (!live) return { tag, state: 'pending', tone: 'neutral' };
    const tv = live[tag];
    if (tagSignal(tv, now) === 'lost' || typeof tv?.value !== 'number') return { tag, state: 'lost', tone: 'neutral' };
    const lv = levelOf(cfg, tv.value);
    return { tag, state: 'ok', value: tv.value, label: lv?.label, tone: lv?.tone ?? 'neutral' };
  });
}

/** Trạng thái cảm biến của tag cảnh báo ("Trạng thái CB"): Online · Không chắc chắn · Mất tín hiệu · chưa có số. */
export function useTagSignal(tag: string | undefined): 'online' | 'uncertain' | 'lost' | 'pending' | 'none' {
  const live = useLiveData(tag ? [tag] : [], { enabled: !!tag });
  if (!tag) return 'none';
  if (!live) return 'pending';
  const s = tagSignal(live[tag], Date.now());
  return s === 'ok' ? 'online' : s;
}

export { formatMeasure };

// ---- Báo cháy (panel fire) ----

function readingOf(live: LiveData | undefined, tag: string | undefined, now: number): TagReading & { ts?: number } {
  if (!tag || !live) return { state: 'pending' };
  const tv = live[tag];
  if (tagSignal(tv, now) === 'lost') return { state: 'lost' };
  return { state: 'ok', value: tv!.value, ts: tv!.ts };
}

export type FireReadings = {
  detector: HeatDetector | undefined;
  /** Nhiệt độ ĐẦU BÁO (live). */
  temp: AlertLiveReading;
  /** ms – "Cập nhật cuối" (tag nhiệt độ hoặc báo động, cái mới hơn). */
  updatedAt?: number;
  device: DetectorDevice;
  alarm: DetectorAlarm;
  signals: (FireSignalView & { id: string; label: string; kind: FireSignalKind })[];
  equipment: { id: string; name: string; temp?: AlertLiveReading; state: ReturnType<typeof equipmentStateView> }[];
  cross: CrossConfirm;
};

/**
 * Số liệu trực tiếp của drawer báo cháy: đầu báo (theo `device` của cảnh báo trong `HEAT_DETECTORS`), tín hiệu liên quan
 * + thiết bị của khu (`AREA_FIRE_SIGNALS` / `AREA_EQUIPMENT`), xác nhận chéo. Mất tín hiệu theo `tagSignal` lúc render.
 */
export function useFireReadings(a: Pick<AlertRecord, 'device' | 'area' | 'tag'>): FireReadings {
  const detector = HEAT_DETECTORS[a.device];
  const area = (detector?.area ?? a.area) as keyof typeof AREA_FIRE_SIGNALS;
  const sigCfg = AREA_FIRE_SIGNALS[area] ?? [];
  const eqCfg = AREA_EQUIPMENT[area] ?? [];
  const tempTag = detector?.tempTag ?? a.tag;
  const tags = [
    ...(tempTag ? [tempTag] : []),
    ...(detector ? [detector.alarmTag, detector.stateTag] : []),
    ...sigCfg.map((s) => s.tag),
    ...eqCfg.flatMap((e) => (e.tempTag ? [e.stateTag, e.tempTag] : [e.stateTag])),
  ];
  const live = useLiveData(tags, { enabled: tags.length > 0 });
  const now = Date.now();
  const numberOf = (tag: string | undefined): AlertLiveReading => {
    const r = readingOf(live, tag, now);
    if (!tag) return { state: 'none' };
    if (r.state === 'pending') return { state: 'pending' };
    return r.state === 'ok' && typeof r.value === 'number' ? { state: 'ok', value: r.value } : { state: 'lost' };
  };
  const tempR = readingOf(live, tempTag, now);
  const alarmR = readingOf(live, detector?.alarmTag, now);
  const st = detectorStatus(alarmR, readingOf(live, detector?.stateTag, now));
  const signals = sigCfg.map((s) => ({ id: s.id, label: s.label, kind: s.kind, ...fireSignalView(s.kind, s.label, readingOf(live, s.tag, now), { bands: GAS_BANDS, unit: '% LEL' }) }));
  const stamps = [tempR.ts, alarmR.ts].filter((t): t is number => t !== undefined);
  return {
    detector,
    temp: numberOf(tempTag),
    updatedAt: stamps.length ? Math.max(...stamps) : undefined,
    device: st.device,
    alarm: st.alarm,
    signals,
    equipment: eqCfg.map((e) => ({ id: e.id, name: e.name, temp: e.tempTag ? numberOf(e.tempTag) : undefined, state: equipmentStateView(readingOf(live, e.stateTag, now)) })),
    cross: crossConfirm(signals),
  };
}

/** Trạng thái đầu báo (báo cháy) theo `HEAT_DETECTORS[device]`; không phải đầu báo → undefined (không đọc tag nào). */
export function useDetectorStatus(device: string): { name: string; alarm: DetectorAlarm; device: DetectorDevice } | undefined {
  const d = HEAT_DETECTORS[device];
  const tags = d ? [d.alarmTag, d.stateTag] : [];
  const live = useLiveData(tags, { enabled: tags.length > 0 });
  if (!d) return undefined;
  const now = Date.now();
  const st = detectorStatus(readingOf(live, d.alarmTag, now), readingOf(live, d.stateTag, now));
  return { name: d.id, alarm: st.alarm, device: live ? st.device : 'pending' };
}

// ---- Nháp modal "Phân công xử lý cảnh báo" (sessionStorage theo mã; chỉ một cảnh báo – hàng loạt không có nháp) ----

/** Nháp = form phân công trừ ô thông báo (mặc định lại theo mức độ khi mở). */
export type AlertAssignDraft = Omit<AlertAssignForm, 'notify'> & { /** ISO */ savedAt: string };

const alertAssignDraft = createSessionDraft<AlertAssignDraft>('demo-lpg:alert-assign-draft:', (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Partial<AlertAssignDraft>;
  const str = (v: unknown): v is string => typeof v === 'string';
  if (!str(d.note) || !str(d.reason) || !Array.isArray(d.collaborators)) return null;
  if (d.assignee !== null && !str(d.assignee)) return null;
  return { assignee: d.assignee ?? null, collaborators: d.collaborators.filter(str), note: d.note, reason: d.reason, savedAt: str(d.savedAt) ? d.savedAt : '' };
});

export const saveAlertAssignDraft = alertAssignDraft.save;
export const loadAlertAssignDraft = alertAssignDraft.load;
export const clearAlertAssignDraft = alertAssignDraft.clear;

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
export const tagThresholds = (tag: string | undefined) => configFor(tag) ?? null;

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

const gasLimits = (cfg: AlertKindConfig) => ({ warn: levelStart(cfg.bands ?? GAS_BANDS, 'level-1'), danger: levelStart(cfg.bands ?? GAS_BANDS, 'level-2') });

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
      return [{ id: r.id, label: fill(r.label), unit: a.unit, tag, before: Number.isFinite(m.value) ? m.value : undefined, warn: limit, danger, primary: true }];
    }
    if (r.field === 'areaSensors') {
      return sensorsInArea(a.area)
        .filter((x) => x.tag !== a.tag)
        .map((x) => ({ id: `${r.id}-${x.tag}`, label: fill(r.label, { sensor: x.tag }), unit: '% LEL', tag: x.tag, warn: gl.warn, danger: gl.danger, primary: false }));
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
    return [{ id: r.id, label: fill(r.label), unit: r.field === 'temperature' ? '°C' : 'bar', tag, before: a.readingsAtAlert?.[r.id], warn: th?.warn, danger: th?.danger, primary: false }];
  });
}

/** Mục "Kết quả xác minh" đã điền chữ. */
export function verificationItems(a: Pick<AlertRecord, 'device' | 'tag'>, cfg: AlertUpdateConfig) {
  return cfg.verification.map((v) => ({ ...v, text: fillPlaybookText(v.text, a.device, { tag: a.tag }) }));
}

/** Nháp modal cập nhật xử lý – sessionStorage theo mã (try/catch trong `createSessionDraft`). */
export const updateDraft = createSessionDraft<UpdateDraft>('demo-lpg:alert-update-draft:', parseUpdateDraft);

// ---- Modal "Xác nhận đóng cảnh báo" – 3 điều kiện hệ thống (features/alerts/close.ts) ----

type CloseSpec = {
  primary: { label: string; tag?: string; limit: number; unit: string; direction: AlertDirection } | null;
  secondary: { label: string; tag: string; warn?: number; alarm?: boolean }[];
  detector?: HeatDetector;
};

/** Tag cần đọc để kiểm 3 điều kiện của một cảnh báo (theo cấu hình loại). */
function closeSpec(a: AlertRecord): CloseSpec {
  const u = updateConfig(a);
  if (u) {
    const rows = updateReadingRows(a, u);
    const p = rows.find((r) => r.primary)!;
    return {
      primary: p.tag ? { label: p.label, tag: p.tag, limit: closeLimit(a), unit: p.unit, direction: 'above' } : { label: p.label, limit: closeLimit(a), unit: p.unit, direction: 'above' },
      secondary: rows.filter((r) => !r.primary && r.tag).map((r) => ({ label: r.label, tag: r.tag!, warn: r.warn, alarm: r.alarm })),
      detector: u.close.rule === 'fire' ? HEAT_DETECTORS[a.device] : undefined,
    };
  }
  const m = alertMetric(a);
  return { primary: a.tag ? { label: a.tag, tag: a.tag, limit: m.threshold, unit: a.unit, direction: m.direction } : null, secondary: [] };
}

/** Trạng thái tín hiệu phụ: số ≥ ngưỡng cảnh báo / chuỗi 'alarm' → bất thường; mất tín hiệu không chặn. */
function secondaryState(s: CloseSpec['secondary'][number], r: AlertLiveReading): 'ok' | 'abnormal' | 'lost' | 'pending' {
  if (r.state === 'pending') return 'pending';
  if (r.state !== 'ok') return 'lost';
  if (s.alarm) return r.text === 'alarm' ? 'abnormal' : 'ok';
  return s.warn !== undefined && r.value !== undefined && r.value >= s.warn ? 'abnormal' : 'ok';
}

/** Đầu vào thuần của `closeConditions` từ LiveData đã đọc (tách khỏi hook để test). */
export function closeConditionInput(a: AlertRecord, all: readonly AlertRecord[], live: LiveData | undefined, now: number): CloseConditionInput {
  const spec = closeSpec(a);
  const read = (tag: string | undefined): AlertLiveReading => (tag ? liveReading(live, tag, now) : { state: 'lost' });
  const p = spec.primary;
  const pr = p ? read(p.tag) : undefined;
  const d = spec.detector;
  const st = d ? detectorStatus(readingOf(live, d.alarmTag, now), readingOf(live, d.stateTag, now)) : undefined;
  return {
    primary: p && pr ? { label: p.label, reading: { state: pr.state === 'none' ? 'lost' : pr.state, value: pr.value }, limit: p.limit, unit: p.unit, direction: p.direction } : null,
    secondary: spec.secondary.map((s) => ({ label: s.label, state: secondaryState(s, read(s.tag)) })),
    detector: d && st ? { name: d.id, alarm: st.alarm, device: live ? st.device : 'pending' } : undefined,
    related: relatedOpenAlerts(a, all),
  };
}

/** Tag cần đọc cho danh sách cảnh báo (một lần `useLiveData` cho cả modal đóng lẫn đóng hàng loạt). */
function closeTags(alerts: readonly AlertRecord[]): string[] {
  const out = new Set<string>();
  for (const a of alerts) {
    const s = closeSpec(a);
    if (s.primary?.tag) out.add(s.primary.tag);
    s.secondary.forEach((x) => out.add(x.tag));
    if (s.detector) [s.detector.alarmTag, s.detector.stateTag].forEach((t) => out.add(t));
  }
  return [...out].sort();
}

/** 3 điều kiện hệ thống theo id cảnh báo – đọc live một lần cho cả danh sách. Mất tín hiệu theo `tagSignal` lúc render. */
export function useCloseConditions(alerts: readonly AlertRecord[], all: readonly AlertRecord[]): Record<string, CloseCondition[]> {
  const tags = closeTags(alerts);
  const live = useLiveData(tags, { enabled: tags.length > 0 });
  const now = Date.now();
  return Object.fromEntries(alerts.map((a) => [a.id, closeConditions(closeConditionInput(a, all, tags.length ? live : {}, now))]));
}

/**
 * "Kết quả kỹ thuật" (modal đóng, chỉ đọc – từ dữ liệu modal cập nhật): nguyên nhân, hành động, số trước/sau của tag chính
 * + ngưỡng đóng ("< 10.5 bar"; chiều thấp → "> …"). Cháy báo động giả → `falseAlarm` (UI thay khối thông số).
 */
export function closeSummary(a: AlertRecord) {
  const u = updateConfig(a);
  const primaryId = u ? updateReadingRows(a, u).find((r) => r.primary)?.id : undefined;
  const m = alertMetric(a);
  const after = a.readings?.rows.find((r) => r.id === primaryId)?.after ?? a.closingReading?.value;
  const lastNote = a.notes?.at(-1)?.text;
  return {
    cause: a.cause ?? null,
    action: a.actionTaken ?? lastNote ?? null,
    falseAlarm: a.resolution?.kind === 'false-alarm',
    quantity: u ? u.quantity : 'Giá trị',
    before: Number.isFinite(m.value) && alertKind(a).numericValue !== false ? m.value : undefined,
    after,
    limit: closeLimit(a),
    direction: m.direction,
    unit: a.unit,
  };
}
