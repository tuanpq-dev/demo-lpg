import { createCollectionStore } from '@/lib/createCollectionStore';
import type { AlertCardData, AlertHandling, SelectOption, Severity } from '@/components';
import { ALERT_ASSIGNEES, alertRecords, type AlertRecord, type AlertStatus } from '@/mocks/alerts';
import type { KpiMock } from '@/mocks/types';

export type { AlertRecord, AlertStatus };
export { ALERT_ASSIGNEES };

// ============================================================================
// Bộ lọc
// ============================================================================

export type AlertTab = 'all' | AlertStatus;
export type AlertRange = 'today' | '7d' | '30d';
/** Ca làm việc – dùng cho Select "Thời gian". */
export type AlertShift = 'night' | 'morning' | 'afternoon';

export type AlertFilters = {
  tab: AlertTab;
  q: string;
  severity: Severity | null;
  area: string | null;
  device: string | null;
  shift: AlertShift | null;
  range: AlertRange;
};

export const DEFAULT_FILTERS: AlertFilters = {
  tab: 'all',
  q: '',
  severity: null,
  area: null,
  device: null,
  shift: null,
  range: 'today',
};

export const RANGE_OPTIONS: SelectOption<AlertRange>[] = [
  { value: 'today', label: 'Hôm nay' },
  { value: '7d', label: '7 ngày qua' },
  { value: '30d', label: '30 ngày qua' },
];

export const SEVERITY_OPTIONS: SelectOption<Severity>[] = [
  { value: 'critical', label: 'Nghiêm trọng' },
  { value: 'high', label: 'Cao' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'low', label: 'Thấp' },
];

export const SHIFT_OPTIONS: SelectOption<AlertShift>[] = [
  { value: 'night', label: 'Ca đêm (22h–6h)' },
  { value: 'morning', label: 'Ca sáng (6h–14h)' },
  { value: 'afternoon', label: 'Ca chiều (14h–22h)' },
];

const RANGE_DAYS: Record<AlertRange, number> = { today: 0, '7d': 6, '30d': 29 };

export function shiftOf(time: string): AlertShift {
  const h = Number(time.slice(0, 2));
  if (h >= 6 && h < 14) return 'morning';
  if (h >= 14 && h < 22) return 'afternoon';
  return 'night';
}

export const inRange = (a: AlertRecord, range: AlertRange) => a.daysAgo <= RANGE_DAYS[range];

/**
 * Tham số lọc trên URL cho bảng cảnh báo (dùng với useTableFilters).
 * ?tab=&q=&severity=&area=&device=&shift=&range=&page=&alert=
 */
export const ALERT_PARAMS = {
  tab: { values: ['all', 'unacknowledged', 'in-progress', 'done'], default: 'all' },
  q: { default: '' },
  severity: { values: ['critical', 'high', 'medium', 'low'] },
  area: {},
  device: {},
  shift: { values: ['night', 'morning', 'afternoon'] },
  range: { values: ['today', '7d', '30d'], default: 'today' },
} as const;

/** Một cảnh báo có khớp bộ lọc không. */
export function matchAlert(a: AlertRecord, f: AlertFilters) {
  const q = f.q.trim().toLowerCase();
  return (
    inRange(a, f.range) &&
    (f.tab === 'all' || a.status === f.tab) &&
    (!q || [a.code, a.message, a.device, a.area, a.assignee ?? ''].some((s) => s.toLowerCase().includes(q))) &&
    (!f.severity || a.severity === f.severity) &&
    (!f.area || a.area === f.area) &&
    (!f.device || a.device === f.device) &&
    (!f.shift || shiftOf(a.time) === f.shift)
  );
}

/** Lọc kết hợp. `ignoreTab` để tính số đếm trên Tabs (đếm theo các bộ lọc còn lại). */
export function filterAlerts(alerts: readonly AlertRecord[], f: AlertFilters, opts: { ignoreTab?: boolean } = {}) {
  return alerts.filter((a) => matchAlert(a, opts.ignoreTab ? { ...f, tab: 'all' } : f));
}

/** Mới nhất trước: theo ngày rồi theo giờ. */
export const byNewest = (a: AlertRecord, b: AlertRecord) => a.daysAgo - b.daysAgo || b.time.localeCompare(a.time);

export function countByStatus(alerts: readonly AlertRecord[]) {
  const c = { all: alerts.length, unacknowledged: 0, 'in-progress': 0, done: 0 } satisfies Record<AlertTab, number>;
  alerts.forEach((a) => (c[a.status] += 1));
  return c;
}

export const uniqueOptions = (values: string[]): SelectOption[] =>
  [...new Set(values)].sort((a, b) => a.localeCompare(b, 'vi')).map((v) => ({ value: v, label: v }));

// ============================================================================
// Hiển thị
// ============================================================================

const unitGlued = (unit: string) => /^[%°]/.test(unit);
const withUnit = (v: string, unit: string) => (unitGlued(unit) ? `${v}${unit}` : `${v} ${unit}`);

/** Thẻ ưu tiên: "11.8 bar" / "10.5 bar", "25% LEL" / "20% LEL" (70:2923). */
export const cardValue = (a: AlertRecord) => ({ value: withUnit(a.value, a.unit), threshold: withUnit(a.threshold, a.unit) });

/** Bảng: "11.8 / 10.5 bar", "25% / 20% LEL", "45 / 50°C" (70:3075). */
export function tableValue(a: AlertRecord) {
  const lead = a.unit.startsWith('%') ? '%' : '';
  return `${a.value}${lead} / ${withUnit(a.threshold, a.unit)}`;
}

/** Trạng thái xử lý trên thẻ: chưa xác nhận + nghiêm trọng → "Cần xử lý". */
export function handlingOf(a: AlertRecord): AlertHandling {
  if (a.status === 'unacknowledged') return a.severity === 'critical' ? 'action-required' : 'unacknowledged';
  return a.status;
}

/** 3 cảnh báo ưu tiên = mới nhất, chưa hoàn thành, mức Nghiêm trọng/Cao (khớp Figma 70:2910). */
export function derivePriorityCards(alerts: readonly AlertRecord[], limit = 3): AlertCardData[] {
  return alerts
    .filter((a) => a.status !== 'done' && (a.severity === 'critical' || a.severity === 'high'))
    .sort(byNewest)
    .slice(0, limit)
    .map((a) => ({
      id: a.id,
      severity: a.severity,
      code: a.code,
      device: a.device,
      message: a.message,
      ...cardValue(a),
      handling: handlingOf(a),
    }));
}

/** 5 KPI (70:2957) tính trên khoảng thời gian đang chọn. */
export function deriveAlertKpis(alerts: readonly AlertRecord[], range: AlertRange = 'today'): KpiMock[] {
  const scoped = alerts.filter((a) => inRange(a, range));
  const c = countByStatus(scoped);
  const critical = scoped.filter((a) => a.severity === 'critical').length;
  const totalLabel = range === 'today' ? 'Tổng cảnh báo hôm nay' : `Tổng cảnh báo ${RANGE_OPTIONS.find((r) => r.value === range)?.label.toLowerCase()}`;
  const base = { variant: 'compact', iconBox: 18, iconPosition: 'start', toneLabel: true } as const;
  return [
    { id: 'total', label: totalLabel, value: String(c.all), variant: 'compact' },
    { ...base, id: 'critical', label: 'Cảnh báo nghiêm trọng', icon: 'kpiAlertCritical', value: String(critical), tone: 'danger' },
    { ...base, id: 'unacknowledged', label: 'Chưa xác nhận', icon: 'kpiAlertUnack', value: String(c.unacknowledged), tone: 'warning' },
    { ...base, id: 'in-progress', label: 'Đang xử lý', icon: 'kpiAlertProgress', value: String(c['in-progress']), tone: 'info' },
    { ...base, id: 'done', label: 'Đã hoàn thành', icon: 'kpiAlertDone', value: String(c.done), tone: 'success' },
  ];
}

// ============================================================================
// Nguồn dữ liệu (mock hôm nay, API sau này) – store dùng chung giữa các trang
// ============================================================================

let db: AlertRecord[] = alertRecords.map((a) => ({ ...a }));

/** GET /alerts – thay bằng fetch thật khi có API. */
export async function fetchAlerts(): Promise<AlertRecord[]> {
  return db.map((a) => ({ ...a }));
}

const store = createCollectionStore(fetchAlerts);

async function mutate(ids: readonly string[], patch: (a: AlertRecord) => AlertRecord) {
  const set = new Set(ids);
  db = db.map((a) => (set.has(a.id) ? patch(a) : a));
  // Cập nhật ngay (optimistic); khi có API: gọi POST rồi refetch.
  store.commit(db.map((a) => ({ ...a })));
}

/** Xác nhận: Chưa xác nhận → Đang xử lý, người xử lý mặc định là người thao tác. */
export const acknowledgeAlerts = (ids: readonly string[], by = 'Admin') =>
  mutate(ids, (a) => (a.status === 'unacknowledged' ? { ...a, status: 'in-progress', assignee: a.assignee ?? by } : a));

export const completeAlerts = (ids: readonly string[], by = 'Admin') =>
  mutate(ids, (a) => (a.status === 'done' ? a : { ...a, status: 'done', assignee: a.assignee ?? by }));

/** Phân công: gán người xử lý; cảnh báo chưa xác nhận chuyển sang Đang xử lý. */
export const assignAlerts = (ids: readonly string[], assignee: string) =>
  mutate(ids, (a) => ({ ...a, assignee, status: a.status === 'unacknowledged' ? 'in-progress' : a.status }));

/** Hook dữ liệu cảnh báo: `{ status, data, error, refetch, acknowledge, complete, assign }`. */
export function useAlerts() {
  return { ...store.useCollection(), acknowledge: acknowledgeAlerts, complete: completeAlerts, assign: assignAlerts };
}
