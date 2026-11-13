import { currentAlerts, mutateAlerts } from './alertStore';
import type { AlertCardData, AlertHandling, SelectOption, Severity } from '@/components';
import {
  acknowledgeAlert,
  addAlertNote,
  requestSupport,
  canAcknowledge,
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
import { alertUpdate, type AlertUpdateInput, type AlertUpdateResult, type UpdateCheck } from '@/features/alerts/update';
import {
  bulkCloseMessage,
  closeAlert,
  continueMonitoring,
  planBulkClose,
  type CloseCondition,
  type CloseInput,
  type CloseResult,
  type MonitorResult,
} from '@/features/alerts/close';
import type { FollowUpConfig } from '@/features/alerts/kinds';
import { appNow } from '@/lib/demoNow';
import { withUnit } from '@/lib/number';
import type { AlertRecord, AlertStatus } from '@/features/alerts/types';
import type { AlertCounts, AlertFilters, AlertRange, AlertShift, AlertTab } from '@/features/alerts/query';
import type { KpiMock } from '@/mocks/types';

export type { AlertRecord, AlertStatus, AlertFilters, AlertRange, AlertShift, AlertTab };

// ============================================================================
// Bộ lọc
// ============================================================================

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

/**
 * Tham số lọc trên URL cho bảng cảnh báo (dùng với useTableFilters).
 * ?tab=&q=&severity=&area=&device=&shift=&range=&page=&alert=
 */
export const ALERT_PARAMS = {
  tab: { values: ['all', 'unacknowledged', 'in-progress', 'resolved', 'done'], default: 'all' },
  q: { default: '' },
  severity: { values: ['critical', 'high', 'medium', 'low'] },
  area: {},
  device: {},
  shift: { values: ['night', 'morning', 'afternoon'] },
  range: { values: ['today', '7d', '30d'], default: 'today' },
} as const;

export const uniqueOptions = (values: readonly string[]): SelectOption[] => values.map((v) => ({ value: v, label: v }));

// ============================================================================
// Hiển thị
// ============================================================================

/** Thẻ ưu tiên: "11.8 bar" / "10.5 bar", "25% LEL" / "20% LEL" (70:2923). */
const cardValue = (a: AlertRecord) => ({ value: withUnit(a.value, a.unit), threshold: withUnit(a.threshold, a.unit) });

/** Bảng: "11.8 / 10.5 bar", "25% / 20% LEL", "45 / 50°C" (70:3075). */
export function tableValue(a: AlertRecord) {
  const lead = a.unit.startsWith('%') ? '%' : '';
  return `${a.value}${lead} / ${withUnit(a.threshold, a.unit)}`;
}

/** Trạng thái xử lý trên thẻ: chưa xác nhận + nghiêm trọng → "Cần xử lý". */
function handlingOf(a: AlertRecord): AlertHandling {
  if (a.status === 'unacknowledged') return a.severity === 'critical' ? 'action-required' : 'unacknowledged';
  return a.status === 'resolved' ? 'done' : a.status;
}

/** Badge trạng thái của cảnh báo: Đã xử lý (chờ đóng) xanh như Figma · Hoàn thành (đã đóng) trung tính. */
export const alertBadgeStatus = (s: AlertStatus) => (s === 'done' ? 'closed' : s);

/** Thẻ cảnh báo ưu tiên (70:2910) từ bản ghi máy chủ trả về (GET /alerts/summary → `priority`). */
export function priorityCard(a: AlertRecord): AlertCardData {
  return { id: a.id, severity: a.severity, code: a.code, device: a.device, message: a.message, ...cardValue(a), handling: handlingOf(a) };
}

/** 5 KPI (70:2957) từ số đếm máy chủ trong khoảng thời gian đang chọn – giữ như Figma. */
export function alertKpis(c: AlertCounts, range: AlertRange = 'today'): KpiMock[] {
  const totalLabel =
    range === 'today' ? 'Tổng cảnh báo hôm nay' : `Tổng cảnh báo ${RANGE_OPTIONS.find((r) => r.value === range)?.label.toLowerCase()}`;
  const base = { variant: 'compact', iconBox: 18, iconPosition: 'start', toneLabel: true } as const;
  return [
    { id: 'total', label: totalLabel, value: String(c.total), variant: 'compact' },
    { ...base, id: 'critical', label: 'Cảnh báo nghiêm trọng', icon: 'kpiAlertCritical', value: String(c.critical), tone: 'danger' },
    { ...base, id: 'unacknowledged', label: 'Chưa xác nhận', icon: 'kpiAlertUnack', value: String(c.unacknowledged), tone: 'warning' },
    { ...base, id: 'in-progress', label: 'Đang xử lý', icon: 'kpiAlertProgress', value: String(c.inProgress), tone: 'info' },
    { ...base, id: 'done', label: 'Đã hoàn thành', icon: 'kpiAlertDone', value: String(c.done), tone: 'success' },
  ];
}

// ============================================================================
// Nguồn dữ liệu (mock hôm nay, API sau này) – store dùng chung giữa các trang
// ============================================================================

const ctxOf = (by: string) => ({ by, at: appNow() });

export type BulkResult = { done: number; skipped: number };

/** Xác nhận: chỉ dòng Chưa xác nhận → Đang xử lý (người xác nhận nhận xử lý nếu chưa có người phụ trách). */
async function acknowledgeAlerts(ids: readonly string[], by = 'Admin'): Promise<BulkResult> {
  const { eligible, skipped } = planBulk(currentAlerts(), ids, canAcknowledge);
  const ctx = ctxOf(by);
  mutateAlerts(eligible, (a) => acknowledgeAlert(a, ctx));
  return { done: eligible.length, skipped };
}

/**
 * Phân công một cảnh báo (drawer) – KHÔNG tự xác nhận. Đổi người cần lý do; cùng người chỉ sửa phối hợp/ghi chú =
 * "Cập nhật phân công". Không hợp lệ → false (modal đã kiểm tra trước, hàm thuần kiểm lại).
 */
async function assignOneAlert(id: string, form: AlertAssignForm, by = 'Admin'): Promise<boolean> {
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
async function assignAlerts(ids: readonly string[], form: AlertAssignForm, by = 'Admin'): Promise<BulkAssignResult> {
  const plan = planBulkAlertAssign(currentAlerts(), ids, form.assignee);
  if (validateBulkAlertAssign(plan, form).length)
    return { done: 0, skipped: ids.length, reassigned: 0, message: 'Chưa phân công – thiếu thông tin.' };
  const ctx = ctxOf(by);
  const rows = [...plan.assign, ...plan.reassign];
  mutateAlerts(
    rows.map((a) => a.id),
    (a) => applyAlertAssignment(a, bulkRowForm(a, form), ctx),
  );
  return { done: rows.length, skipped: bulkSkippedCount(plan), reassigned: plan.reassign.length, message: bulkAlertAssignMessage(plan) };
}

/**
 * Đóng hàng loạt: chỉ dòng Đã xử lý ĐỦ 3 điều kiện hệ thống (`conditions` – UI đọc live), MỘT ghi chú kết luận chung; bỏ qua
 * dòng Nghiêm trọng nếu người đóng là người xử lý. Giữ nguyên theo dõi đang có của từng dòng.
 */
async function closeAlerts(
  ids: readonly string[],
  note: string,
  conditions: Readonly<Record<string, readonly CloseCondition[]>>,
  followUpOf: (a: AlertRecord) => FollowUpConfig,
  by = 'Admin',
): Promise<{ done: number; skipped: number; message: string }> {
  if (!note.trim()) throw new Error('Cần ghi chú kết luận.');
  const plan = planBulkClose(currentAlerts(), ids, (a) => conditions[a.id] ?? [], by);
  const ctx = ctxOf(by);
  mutateAlerts(plan.eligible, (a) => {
    const r = closeAlert(a, { note, followUpMinutes: a.followUp?.minutes ?? 0, manualChecks: [] }, conditions[a.id] ?? [], followUpOf(a), ctx);
    return r.ok ? r.record : a;
  });
  return { done: plan.eligible.length, skipped: plan.skipped.length, message: bulkCloseMessage(plan.eligible.length, plan.skipped) };
}

/** "Xác nhận đóng cảnh báo" một cảnh báo – `conditions` = 3 điều kiện hệ thống đọc lúc bấm (hàm thuần kiểm lại). */
async function closeOneAlert(
  id: string,
  input: CloseInput,
  conditions: readonly CloseCondition[],
  follow: FollowUpConfig,
  by = 'Admin',
): Promise<CloseResult> {
  const a = currentAlerts().find((x) => x.id === id);
  if (!a) return { ok: false, reason: 'status', message: 'Không tìm thấy cảnh báo.' };
  const res = closeAlert(a, input, conditions, follow, ctxOf(by));
  if (res.ok) mutateAlerts([id], () => res.record);
  return res;
}

/** "Tiếp tục theo dõi" – giữ Đã xử lý + một giá trị theo dõi. */
async function monitorAlert(id: string, input: { minutes: number; note: string }, follow: FollowUpConfig, by = 'Admin'): Promise<MonitorResult> {
  const a = currentAlerts().find((x) => x.id === id);
  if (!a) return { ok: false, reason: 'status', message: 'Không tìm thấy cảnh báo.' };
  const res = continueMonitoring(a, input, follow, ctxOf(by));
  if (res.ok) mutateAlerts([id], () => res.record);
  return res;
}

/** Đánh dấu đã xử lý một cảnh báo (drawer) – trả lý do khi bị chặn. */
async function resolveOneAlert(id: string, note: string, by = 'Admin'): Promise<ResolveResult> {
  const a = currentAlerts().find((x) => x.id === id);
  if (!a) return { ok: false, reason: 'status' };
  const res = resolveAlert(a, note, ctxOf(by));
  if (res.ok) mutateAlerts([id], () => res.record);
  return res;
}

/** "Cập nhật xử lý" (modal chung theo loại) – `check` = điều kiện "Đã xử lý" tính từ live lúc lưu (hàm thuần kiểm lại toàn bộ form). */
async function updateAlert(id: string, input: AlertUpdateInput, check: UpdateCheck, by = 'Admin'): Promise<AlertUpdateResult> {
  const a = currentAlerts().find((x) => x.id === id);
  if (!a) return { ok: false, errors: { state: 'Không tìm thấy cảnh báo.' } };
  const res = alertUpdate(a, input, check, ctxOf(by));
  if (res.ok) mutateAlerts([id], () => res.record);
  return res;
}

/** Yêu cầu hỗ trợ: thêm người phối hợp + lịch sử. TODO(backend): gửi thông báo thật (đẩy/SMS) – UI ghi rõ "chưa gửi". */
async function requestAlertSupport(id: string, input: { people: readonly string[]; reason: string }, by = 'Admin') {
  const ctx = ctxOf(by);
  mutateAlerts([id], (a) => requestSupport(a, input, ctx));
}

async function toggleAlertGuide(id: string, step: { id: string; text: string }, by = 'Admin') {
  const ctx = ctxOf(by);
  mutateAlerts([id], (a) => toggleGuideStep(a, step, ctx));
}

async function addNoteToAlert(id: string, text: string, by = 'Admin') {
  const ctx = ctxOf(by);
  mutateAlerts([id], (a) => addAlertNote(a, text, ctx));
}

/** Ghi lịch sử sau khi tạo yêu cầu bảo trì từ cảnh báo (liên kết = `sourceAlertId` của yêu cầu). */
async function noteMaintenanceCreated(id: string, code: string, by = 'Admin') {
  const ctx = ctxOf(by);
  mutateAlerts([id], (a) => recordMaintenanceCreated(a, code, ctx));
}

/** Hook dữ liệu cảnh báo: `{ status, data, error, refetch, acknowledge, assign, resolve, update, close, monitor, closeMany, … }`. */
/**
 * Thao tác ghi cảnh báo (KHÔNG tải danh sách – đọc qua `data/alertApi.ts`). Xong thao tác → store tăng phiên bản → các
 * truy vấn đang hiện tải lại ngầm.
 */
export function useAlerts() {
  return {
    acknowledge: acknowledgeAlerts,
    closeMany: closeAlerts,
    assign: assignAlerts,
    assignOne: assignOneAlert,
    resolve: resolveOneAlert,
    toggleGuide: toggleAlertGuide,
    addNote: addNoteToAlert,
    noteMaintenance: noteMaintenanceCreated,
    update: updateAlert,
    close: closeOneAlert,
    monitor: monitorAlert,
    requestSupport: requestAlertSupport,
  };
}
