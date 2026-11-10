import type { MapMarkerData, MapMarkerTone } from '@/components/PlantMap/MapMarker';
import { tagSignal } from '@/features/live/signal';
import { bindingTag, formatField, objectStatus } from './fields';
import type { LiveData, ObjectStatus, SceneObject, Thresholds } from './types';

const STATUS_TONE: Partial<Record<ObjectStatus, MapMarkerTone>> = {
  warning: 'warning',
  danger: 'danger',
  offline: 'neutral',
};

/** Giá trị trên nhãn: không hiện (variant tag / không có trường) · "—" khi chưa có liveData · số đã định dạng. */
function markerValue(shows: boolean, field: string | undefined, live: LiveData | undefined, reading: LiveData[string] | undefined, now: number) {
  if (!shows || !field) return undefined;
  return live ? formatField(field, reading, now) : '—';
}

/**
 * Nhãn tự sinh cho object có `marker`:
 * - Tiêu đề = `marker.title ?? label ?? id`; giá trị = trường `marker.field` (mặc định binding đầu tiên) từ liveData.
 * - Trạng thái warning/danger → tone tương ứng + icon ⚠; offline (mất tín hiệu ở một binding) → tone neutral (xám);
 *   giá trị mất tín hiệu → "Mất tín hiệu" + icon mất tín hiệu; normal → tone khai báo (success kèm chấm trạng thái).
 * Không có liveData → chỉ tiêu đề + giá trị "—".
 */
export function objectMarker(
  obj: SceneObject,
  live: LiveData | undefined,
  thresholds?: Record<string, Thresholds>,
  now: number = Date.now(),
): MapMarkerData | null {
  const m = obj.marker;
  if (!m) return null;
  const variant = m.variant ?? 'callout';
  const tone = m.tone ?? 'accent';
  const field = m.field ?? Object.keys(obj.bindings ?? {})[0];
  const reading = field && live ? live[bindingTag(obj, field) ?? ''] : undefined;
  const showsValue = variant !== 'tag' && !!field;
  const base: MapMarkerData = {
    id: obj.id,
    variant,
    tone,
    title: m.title ?? obj.label ?? obj.id,
    value: markerValue(showsValue, field, live, reading, now),
    showDot: tone === 'success',
    x: 0,
    y: 0,
  };
  if (!live) return base;
  const lost = showsValue && tagSignal(reading, now) === 'lost';
  const alarmTone = STATUS_TONE[objectStatus(obj, live, thresholds, now)];
  if (lost && alarmTone !== 'danger' && alarmTone !== 'warning') return { ...base, tone: 'neutral', showDot: false, showSignalLostIcon: true };
  return alarmTone ? { ...base, tone: alarmTone, showDot: false, showWarningIcon: alarmTone !== 'neutral', showSignalLostIcon: lost } : base;
}
