import type { MapMarkerData, MapMarkerTone } from '@/components/PlantMap/MapMarker';
import { bindingTag, formatField, objectStatus } from './fields';
import type { LiveData, ObjectStatus, SceneObject, Thresholds } from './types';

const STATUS_TONE: Partial<Record<ObjectStatus, MapMarkerTone>> = {
  warning: 'warning',
  danger: 'danger',
  offline: 'neutral',
};

/**
 * Nhãn tự sinh cho object có `marker`:
 * - Tiêu đề = `marker.title ?? label ?? id`; giá trị = trường `marker.field` (mặc định binding đầu tiên) từ liveData.
 * - Trạng thái warning/danger/offline → tone tương ứng + icon ⚠ (trừ offline); normal → tone khai báo
 *   (success kèm chấm trạng thái).
 * Không có liveData → chỉ tiêu đề + giá trị "—".
 */
export function objectMarker(
  obj: SceneObject,
  live: LiveData | undefined,
  thresholds?: Record<string, Thresholds>,
): MapMarkerData | null {
  const m = obj.marker;
  if (!m) return null;
  const variant = m.variant ?? 'callout';
  const tone = m.tone ?? 'accent';
  const field = m.field ?? Object.keys(obj.bindings ?? {})[0];
  const tag = field ? bindingTag(obj, field) : undefined;
  const base: MapMarkerData = {
    id: obj.id,
    variant,
    tone,
    title: m.title ?? obj.label ?? obj.id,
    value: variant === 'tag' || !field ? undefined : formatField(field, tag ? live?.[tag] : undefined),
    showDot: tone === 'success',
    x: 0,
    y: 0,
  };
  if (!live) return base;
  const alarmTone = STATUS_TONE[objectStatus(obj, live, thresholds)];
  return alarmTone
    ? { ...base, tone: alarmTone, showDot: false, showWarningIcon: alarmTone !== 'neutral' }
    : base;
}
