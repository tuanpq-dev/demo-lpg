import { alertStore, currentAlerts, fetchAlerts, mutateAlerts } from './alertStore';
import type { AlertCardData, AlertHandling, SelectOption, Severity } from '@/components';
import {
  acknowledgeAlert,
  addAlertNote,
  fireUpdate,
  gasUpdate,
  requestSupport,
  type FireUpdateInput,
  type FireUpdateResult,
  type GasUpdateInput,
  type GasUpdateResult,
  canAcknowledge,
  canResolve,
  planBulk,
  recordMaintenanceCreated,
  resolveAlert,
  toggleGuideStep,
  type ResolveResult,
} from '@/features/alerts/workflow';
import {
  applyAlertAssignment,
  bulkAlertAssignMessage,
  bulkRowForm,
  bulkSkippedCount,
  planBulkAlertAssign,
  validateAlertAssign,
  validateBulkAlertAssign,
  type AlertAssignForm,
} from '@/features/alerts/assign';
import { appNow } from '@/lib/demoNow';
import { withUnit } from '@/features/alerts/gauge';
import type { AlertRecord, AlertStatus } from '@/mocks/alerts';
import type { KpiMock } from '@/mocks/types';

export type { AlertRecord, AlertStatus };


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

export { fetchAlerts };

const ctxOf = (by: string) => ({ by, at: appNow() });

export type BulkResult = { done: number; skipped: number };

/** Xác nhận: chỉ dòng Chưa xác nhận → Đang xử lý (người xác nhận nhận xử lý nếu chưa có người phụ trách). */
export async function acknowledgeAlerts(ids: readonly string[], by = 'Admin'): Promise<BulkResult> {
  const { eligible, skipped } = planBulk(currentAlerts(), ids, canAcknowledge);
  const ctx = ctxOf(by);
  mutateAlerts(eligible, (a) => acknowledgeAlert(a, ctx));
  return { done: eligible.length, skipped };
}

/**
 * Phân công một cảnh báo (drawer) – KHÔNG tự xác nhận. Đổi người cần lý do; cùng người chỉ sửa phối hợp/ghi chú =
 * "Cập nhật phân công". Không hợp lệ → false (modal đã kiểm tra trước, hàm thuần kiểm lại).
 */
export async function assignOneAlert(id: string, form: AlertAssignForm, by = 'Admin'): Promise<boolean> {
  const a = currentAlerts().find((x) => x.id === id);
  if (!a || validateAlertAssign(a, form).length) return false;
  const ctx = ctxOf(by);
  mutateAlerts([id], (cur) => applyAlertAssignment(cur, form, ctx));
  return true;
}

export type BulkAssignResult = BulkResult & { reassigned: number; message: string };

/**
 * Phân công hàng loạt (bảng /alerts) – cùng quy tắc với drawer: không tự xác nhận; dòng Hoàn thành / đã giao đúng người
 * bị bỏ qua; dòng đang giao cho người khác = đổi người với MỘT lý do chung (bắt buộc); người phối hợp gộp với người cũ.
 */
export async function assignAlerts(ids: readonly string[], form: AlertAssignForm, by = 'Admin'): Promise<BulkAssignResult> {
  const plan = planBulkAlertAssign(currentAlerts(), ids, form.assignee);
  if (validateBulkAlertAssign(plan, form).length) return { done: 0, skipped: ids.length, reassigned: 0, message: 'Chưa phân công – thiếu thông tin.' };
  const ctx = ctxOf(by);
  const rows = [...plan.assign, ...plan.reassign];
  mutateAlerts(
    rows.map((a) => a.id),
    (a) => applyAlertAssignment(a, bulkRowForm(a, form), ctx),
  );
  return { done: rows.length, skipped: bulkSkippedCount(plan), reassigned: plan.reassign.length, message: bulkAlertAssignMessage(plan) };
}

/**
 * Hoàn thành hàng loạt: chỉ dòng Đang xử lý, MỘT ghi chú chung cho cả lô (bắt buộc). Dòng khác bỏ qua – không còn đường
 * nào nhảy từ Chưa xác nhận sang Hoàn thành.
 */
export async function completeAlerts(ids: readonly string[], note: string, by = 'Admin'): Promise<BulkResult> {
  if (!note.trim()) throw new Error('Cần ghi chú kết quả xử lý.');
  const { eligible, skipped } = planBulk(currentAlerts(), ids, canResolve);
  const ctx = ctxOf(by);
  mutateAlerts(eligible, (a) => {
    const r = resolveAlert(a, note, ctx);
    return r.ok ? r.record : a;
  });
  return { done: eligible.length, skipped };
}

/** Đánh dấu đã xử lý một cảnh báo (drawer) – trả lý do khi bị chặn. */
export async function resolveOneAlert(id: string, note: string, by = 'Admin'): Promise<ResolveResult> {
  const a = currentAlerts().find((x) => x.id === id);
  if (!a) return { ok: false, reason: 'status' };
  const res = resolveAlert(a, note, ctxOf(by));
  if (res.ok) mutateAlerts([id], () => res.record);
  return res;
}

/** "Cập nhật xử lý" cảnh báo gas – `check` = số live hiện tại + ngưỡng đóng (UI đọc live, hàm thuần kiểm lại). */
export async function updateGasAlert(
  id: string,
  input: GasUpdateInput,
  check: { live: number | undefined; limit: number; unit: string },
  by = 'Admin',
): Promise<GasUpdateResult> {
  const a = currentAlerts().find((x) => x.id === id);
  if (!a) return { ok: false, reason: 'status' };
  const res = gasUpdate(a, input, check, ctxOf(by));
  if (res.ok) mutateAlerts([id], () => res.record);
  return res;
}

/** "Cập nhật xử lý" báo cháy – `check` = trạng thái đầu báo đọc từ live lúc gửi (hàm thuần kiểm lại điều kiện đóng). */
export async function updateFireAlert(
  id: string,
  input: FireUpdateInput,
  check: Parameters<typeof fireUpdate>[2],
  by = 'Admin',
): Promise<FireUpdateResult> {
  const a = currentAlerts().find((x) => x.id === id);
  if (!a) return { ok: false, reason: 'status' };
  const res = fireUpdate(a, input, check, ctxOf(by));
  if (res.ok) mutateAlerts([id], () => res.record);
  return res;
}

/** Yêu cầu hỗ trợ: thêm người phối hợp + lịch sử. TODO(backend): gửi thông báo thật (đẩy/SMS) – UI ghi rõ "chưa gửi". */
export async function requestAlertSupport(id: string, input: { people: readonly string[]; reason: string }, by = 'Admin') {
  const ctx = ctxOf(by);
  mutateAlerts([id], (a) => requestSupport(a, input, ctx));
}

export async function toggleAlertGuide(id: string, step: { id: string; text: string }, by = 'Admin') {
  const ctx = ctxOf(by);
  mutateAlerts([id], (a) => toggleGuideStep(a, step, ctx));
}

export async function addNoteToAlert(id: string, text: string, by = 'Admin') {
  const ctx = ctxOf(by);
  mutateAlerts([id], (a) => addAlertNote(a, text, ctx));
}

/** Ghi lịch sử sau khi tạo yêu cầu bảo trì từ cảnh báo (liên kết = `sourceAlertId` của yêu cầu). */
export async function noteMaintenanceCreated(id: string, code: string, by = 'Admin') {
  const ctx = ctxOf(by);
  mutateAlerts([id], (a) => recordMaintenanceCreated(a, code, ctx));
}

/** Hook dữ liệu cảnh báo: `{ status, data, error, refetch, acknowledge, complete, assign, resolve, toggleGuide, addNote, noteMaintenance }`. */
export function useAlerts() {
  return {
    ...alertStore.useCollection(),
    acknowledge: acknowledgeAlerts,
    complete: completeAlerts,
    assign: assignAlerts,
    assignOne: assignOneAlert,
    resolve: resolveOneAlert,
    toggleGuide: toggleAlertGuide,
    addNote: addNoteToAlert,
    noteMaintenance: noteMaintenanceCreated,
    gasUpdate: updateGasAlert,
    fireUpdate: updateFireAlert,
    requestSupport: requestAlertSupport,
  };
}
