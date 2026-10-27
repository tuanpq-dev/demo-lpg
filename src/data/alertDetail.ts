/*
 * Phần CHỈ drawer chi tiết cảnh báo cần (ngưỡng theo cấu hình tag, playbook, số trực tiếp, nhân sự) – tách khỏi
 * `data/alerts.ts` vì file đó nằm trong bundle chính (`LiveAnnouncer` dùng `useAlerts`): kéo mock tài sản/nhân sự vào
 * đây thì chỉ chunk trang Cảnh báo phải tải.
 */
import { formatGaugeNumber, gaugeScale, withUnit, type GaugeScale } from '@/features/alerts/gauge';
import { tagSignal } from '@/features/live/signal';
import { formatDayVi, parsePlantDateTime, plantDayKey } from '@/lib/plantTime';
import type { AlertDirection, AlertRecord } from '@/mocks/alerts';
import { ALERT_KINDS, GAS_BANDS, fillPlaybookText, type AlertKindConfig } from '@/mocks/alertKinds';
import { AREA_EQUIPMENT, AREA_FIRE_SIGNALS, HEAT_DETECTORS, nearbySensor, sensorsInArea, type HeatDetector } from '@/mocks/sensors';
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
import { bandOf } from '@/features/alerts/bands';
import { formatMeasure } from '@/features/alerts/gauge';
import { assetMocks } from '@/mocks/assets';
import { STAFF } from '@/mocks/maintenance';
import { useLiveData } from './live';

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
  const vars = { nearbySensor: nearbySensor(a.tag ?? a.device) };
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

export type AlertLiveReading = { state: 'none' | 'pending' | 'lost' | 'ok'; value?: number };

/** Số trực tiếp của tag cảnh báo ("Hiện tại: x bar"). Không có tag → none; mất tín hiệu theo `tagSignal` lúc render. */
export function useAlertLive(tag: string | undefined): AlertLiveReading {
  const live = useLiveData(tag ? [tag] : [], { enabled: !!tag });
  if (!tag) return { state: 'none' };
  if (!live) return { state: 'pending' };
  const tv = live[tag];
  if (tagSignal(tv, Date.now()) === 'lost' || typeof tv?.value !== 'number') return { state: 'lost' };
  return { state: 'ok', value: tv.value };
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
