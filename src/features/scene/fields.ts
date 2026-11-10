import { freshValue, SIGNAL_LOST_LABEL, tagSignal } from '@/features/live/signal';
import type { Binding, LiveData, ObjectStatus, SceneObject, TagValue, Thresholds } from './types';

type StateMeta = { label: string; status: ObjectStatus };

/** Ý nghĩa hiển thị của trường dữ liệu. Ngưỡng KHÔNG nằm ở đây – lấy từ config/bindings. */
export type FieldMeta = {
  label: string;
  unit?: string;
  digits?: number;
  /** Trường dạng trạng thái (chuỗi) → nhãn + trạng thái. */
  states?: Record<string, StateMeta>;
};

export const FIELD_META: Record<string, FieldMeta> = {
  level: { label: 'Mức', unit: '%', digits: 1 },
  pressure: { label: 'Áp suất', unit: 'bar', digits: 2 },
  temperature: { label: 'Nhiệt độ', unit: '°C', digits: 1 },
  flow: { label: 'Lưu lượng', unit: 'm³/h', digits: 0 },
  position: { label: 'Độ mở', unit: '%', digits: 0 },
  state: {
    label: 'Trạng thái',
    states: {
      running: { label: 'Hoạt động', status: 'normal' },
      standby: { label: 'Dự phòng', status: 'normal' },
      loading: { label: 'Đang nạp', status: 'normal' },
      idle: { label: 'Chờ', status: 'normal' },
      fault: { label: 'Sự cố', status: 'danger' },
      offline: { label: 'Mất kết nối', status: 'offline' },
    },
  },
};

const RANK: Record<ObjectStatus, number> = { normal: 0, offline: 1, warning: 2, danger: 3 };

export type ResolvedBinding = { field: string; tag: string; thresholds: Thresholds };

/** Bindings của object → (trường, tag, ngưỡng). Ngưỡng: binding > `defaults[field]`. */
export function resolveBindings(obj: SceneObject, defaults: Record<string, Thresholds> = {}): ResolvedBinding[] {
  return Object.entries(obj.bindings ?? {}).map(([field, b]: [string, Binding]) => {
    if (typeof b === 'string') return { field, tag: b, thresholds: defaults[field] ?? {} };
    const { tag, ...own } = b;
    return { field, tag, thresholds: { ...defaults[field], ...own } };
  });
}

export function bindingTag(obj: SceneObject | undefined, field: string): string | undefined {
  const b = obj?.bindings?.[field];
  return typeof b === 'string' ? b : b?.tag;
}

/**
 * Chữ hiển thị của một trường. `tv` undefined khi chưa có liveData (Editor/không nguồn) → "—";
 * mất tín hiệu (bad / quá 10 s / không có tag) → "Mất tín hiệu", KHÔNG hiện số cũ.
 */
export function formatField(field: string, tv: TagValue | undefined, now: number = Date.now()): string {
  if (tagSignal(tv, now) === 'lost') return SIGNAL_LOST_LABEL;
  const value = tv!.value;
  const meta = FIELD_META[field];
  if (typeof value === 'string') return meta?.states?.[value]?.label ?? value;
  const d = meta?.digits ?? 1;
  const n = value.toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d });
  return meta?.unit ? `${n} ${meta.unit}` : n;
}

/** Trạng thái theo ngưỡng; mất tín hiệu → offline. */
export function fieldStatus(field: string, tv: TagValue | undefined, t: Thresholds = {}, now: number = Date.now()): ObjectStatus {
  const value = freshValue(tv, now);
  if (value === undefined) return 'offline';
  if (typeof value === 'string') return FIELD_META[field]?.states?.[value]?.status ?? 'normal';
  if ((t.danger !== undefined && value >= t.danger) || (t.lowDanger !== undefined && value <= t.lowDanger)) return 'danger';
  if ((t.warn !== undefined && value >= t.warn) || (t.lowWarn !== undefined && value <= t.lowWarn)) return 'warning';
  return 'normal';
}

/**
 * Trạng thái xấu nhất của các binding (danger > warning > offline > normal). Chưa có liveData → normal.
 * Một binding mất tín hiệu → ít nhất offline (thiết bị xám) – cảnh báo/sự cố của binding khác vẫn ưu tiên hiển thị.
 */
export function objectStatus(
  obj: SceneObject | undefined,
  live: LiveData | undefined,
  defaults?: Record<string, Thresholds>,
  now: number = Date.now(),
): ObjectStatus {
  const bindings = obj ? resolveBindings(obj, defaults) : [];
  if (!live || bindings.length === 0) return 'normal';
  return bindings
    .map((b) => fieldStatus(b.field, live[b.tag], b.thresholds, now))
    .reduce<ObjectStatus>((a, s) => (RANK[s] > RANK[a] ? s : a), 'normal');
}

/** Danh sách "nhãn: giá trị" của một object để hiển thị tooltip. */
export function objectReadings(obj: SceneObject, live: LiveData | undefined, defaults?: Record<string, Thresholds>, now: number = Date.now()) {
  return resolveBindings(obj, defaults).map(({ field, tag, thresholds }) => ({
    field,
    tag,
    label: FIELD_META[field]?.label ?? field,
    text: live ? formatField(field, live[tag], now) : '—',
    status: live ? fieldStatus(field, live[tag], thresholds, now) : ('normal' as ObjectStatus),
    lost: !!live && tagSignal(live[tag], now) === 'lost',
  }));
}
