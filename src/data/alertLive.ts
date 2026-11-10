/** Số liệu trực tiếp của cảnh báo: giá trị hiện tại, đồng hồ, cảm biến khu vực, báo cháy. Tách từ alertDetail.ts. */
import { gaugeScale, type GaugeScale } from '@/features/alerts/gauge';
import { tagSignal } from '@/features/live/signal';
import type { AlertRecord } from '@/features/alerts/types';
import { GAS_BANDS } from '@/mocks/alertKinds';
import type { AlertKindConfig } from '@/features/alerts/kinds';
import { AREA_EQUIPMENT, AREA_FIRE_SIGNALS, HEAT_DETECTORS, sensorsInArea, type HeatDetector } from '@/mocks/sensors';
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
import { useLiveData } from './live';
import { alertMetric, alertPlaybook } from './alertBase';

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
export function liveReading(live: LiveData | undefined, tag: string, now: number): AlertLiveReading {
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

export type SensorReading = {
  tag: string;
  state: 'pending' | 'lost' | 'ok';
  value?: number;
  label?: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
};

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

// ---- Báo cháy (panel fire) ----

export function readingOf(live: LiveData | undefined, tag: string | undefined, now: number): TagReading & { ts?: number } {
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
  const signals = sigCfg.map((s) => ({
    id: s.id,
    label: s.label,
    kind: s.kind,
    ...fireSignalView(s.kind, s.label, readingOf(live, s.tag, now), { bands: GAS_BANDS, unit: '% LEL' }),
  }));
  const stamps = [tempR.ts, alarmR.ts].filter((t): t is number => t !== undefined);
  return {
    detector,
    temp: numberOf(tempTag),
    updatedAt: stamps.length ? Math.max(...stamps) : undefined,
    device: st.device,
    alarm: st.alarm,
    signals,
    equipment: eqCfg.map((e) => ({
      id: e.id,
      name: e.name,
      temp: e.tempTag ? numberOf(e.tempTag) : undefined,
      state: equipmentStateView(readingOf(live, e.stateTag, now)),
    })),
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
