import type { IconName } from '@/assets/digital-twin';
import type { PriorityTaskData, SelectOption, Severity, TimelineEvent, WorkStatus } from '@/components';
import { checklistProgress, toggleChecklistItem } from '@/features/maintenance/checklist';
import { isPastDue } from '@/features/maintenance/deadline';
import { applyProgressUpdate, type ProgressUpdateInput } from '@/features/maintenance/progress';
import { reviewRecord, submitForReview, type ReviewInput, type SubmitInput } from '@/features/maintenance/review';
import { applyAssignment, computeWorkloads, initialAssignForm, planBulkAssign, type AssignForm } from '@/features/maintenance/assign';
import { addNoteRecord, advanceRecord, cancelRecord } from '@/features/maintenance/workflow';
import { linkedMaintenance } from '@/features/alerts/workflow';
import { createCollectionStore } from '@/lib/createCollectionStore';
import { appNow } from '@/lib/demoNow';
import { daysFromToday, plantDateTimeKey, plantMonthKey } from '@/lib/plantTime';
import type { AlertRecord } from '@/features/alerts/types';
import { CHECKLIST_TEMPLATES, MAINTENANCE_ASSIGNEES, PEOPLE, ASSIGNABLE_STAFF, REVIEWERS, SOURCE_OPTIONS, STAFF, isoDay, staffByName, maintenanceRecords } from '@/mocks/maintenance';
import { DEPARTMENTS, SHIFTS } from '@/features/staff/org';
import type { MaintenanceAttachment, MaintenanceChecklistItem, MaintenanceHistoryEntry, MaintenanceHold, MaintenanceNote, MaintenanceRecord, MaintenanceSource, MaintenanceStatus, MaintenanceType, ShiftId } from '@/features/maintenance/types';
import type { KpiMock } from '@/mocks/types';

export type {
  MaintenanceAttachment,
  MaintenanceChecklistItem,
  MaintenanceHistoryEntry,
  MaintenanceHold,
  MaintenanceNote,
  MaintenanceRecord,
  MaintenanceSource,
  MaintenanceStatus,
  MaintenanceType,
  ShiftId,
};
export { ASSIGNABLE_STAFF, CHECKLIST_TEMPLATES, DEPARTMENTS, MAINTENANCE_ASSIGNEES, PEOPLE, REVIEWERS, SHIFTS, SOURCE_OPTIONS, STAFF, staffByName };

// ============================================================================
// Ngày & hạn
// ============================================================================

// "Hôm nay" tính theo giờ nhà máy (Asia/Bangkok – src/lib/plantTime.ts), không theo múi giờ máy người xem.
// Mọi hàm nhận `now` từ nơi gọi (trang dùng useNow) → test được, không gọi Date.now() bên trong.

/** Số ngày từ hôm nay (giờ nhà máy) tới hạn (âm = đã qua). */
export const daysUntilDue = (r: MaintenanceRecord, now: Date) => daysFromToday(r.dueAt, now);

/** Hạn có giờ thật (false = chỉ có ngày → "Cuối ngày", quá hạn sau 23:59:59). */
export const dueHasTime = (r: Pick<MaintenanceRecord, 'dueHasTime'>) => r.dueHasTime !== false;

/** "16:00" hoặc "Cuối ngày" (hạn chỉ có ngày). */
export const dueTimeLabel = (r: Pick<MaintenanceRecord, 'dueAt' | 'dueHasTime'>) => (dueHasTime(r) ? r.dueAt.slice(11, 16) : 'Cuối ngày');

/** Còn mở = chưa hoàn thành và chưa hủy. */
export const isOpen = (r: Pick<MaintenanceRecord, 'status'>) => r.status !== 'done' && r.status !== 'cancelled';

/**
 * Quá hạn = còn mở và now ≥ giờ hạn (giờ nhà máy; hạn chỉ có ngày = 23:59) – MỘT quy tắc cho danh sách, KPI,
 * thẻ ưu tiên, lịch và trang chi tiết (`features/maintenance/deadline.ts`). Đã xong / đã hủy → không.
 */
export const isOverdue = (r: MaintenanceRecord, now: Date) => isOpen(r) && isPastDue(r.dueAt, now, dueHasTime(r));

/**
 * "Quá hạn 2 ngày" · "Quá hạn từ 16:00" (hạn hôm nay đã qua giờ) · "Hết hạn hôm nay" (hôm nay, chưa tới giờ) ·
 * "Hết hạn ngày mai" · "Còn N ngày".
 */
export function dueLabel(r: MaintenanceRecord, now: Date) {
  const d = daysUntilDue(r, now);
  if (d < 0) return `Quá hạn ${-d} ngày`;
  if (d === 0) return isPastDue(r.dueAt, now, dueHasTime(r)) ? (dueHasTime(r) ? `Quá hạn từ ${dueTimeLabel(r)}` : 'Quá hạn hôm nay') : 'Hết hạn hôm nay';
  if (d === 1) return 'Hết hạn ngày mai';
  return `Còn ${d} ngày`;
}

/** "10/10/2023" */
export const formatDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

/** "Hôm nay, 14:00" / "Ngày mai, 08:30" / "20/10/2026, Cuối ngày" (Lịch sắp tới 70:4902). */
export function scheduleLabel(r: MaintenanceRecord, now: Date) {
  const d = daysUntilDue(r, now);
  const time = dueTimeLabel(r);
  const day = d === 0 ? 'Hôm nay' : d === 1 ? 'Ngày mai' : formatDate(r.dueAt);
  return `${day}, ${time}`;
}

// ============================================================================
// Nhãn & tuỳ chọn
// ============================================================================

export const STATUS_LABEL: Record<MaintenanceStatus, string> = {
  pending: 'Chờ tiếp nhận',
  assigned: 'Đã phân công',
  'in-progress': 'Đang thực hiện',
  review: 'Chờ nghiệm thu',
  done: 'Hoàn thành',
  cancelled: 'Đã hủy',
};

/** Trạng thái bảo trì → giá trị Badge status. */
export const STATUS_BADGE: Record<MaintenanceStatus, WorkStatus> = {
  pending: 'pending',
  assigned: 'assigned',
  'in-progress': 'in-progress',
  review: 'review',
  done: 'done',
  cancelled: 'cancelled',
};

export const TYPE_OPTIONS: SelectOption<MaintenanceType>[] = [
  { value: 'periodic', label: 'Định kỳ' },
  { value: 'incident', label: 'Sự cố' },
  { value: 'inspection', label: 'Kiểm tra' },
];
export const TYPE_LABEL = Object.fromEntries(TYPE_OPTIONS.map((o) => [o.value, o.label])) as Record<MaintenanceType, string>;

export const PRIORITY_OPTIONS: SelectOption<Severity>[] = [
  { value: 'critical', label: 'Nghiêm trọng' },
  { value: 'high', label: 'Cao' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'low', label: 'Thấp' },
];

export type MaintenanceRange = 'all' | 'today' | '7d' | '30d';
export const RANGE_OPTIONS: SelectOption<MaintenanceRange>[] = [
  { value: 'all', label: 'Tất cả thời gian' },
  { value: 'today', label: 'Hôm nay' },
  { value: '7d', label: '7 ngày qua' },
  { value: '30d', label: '30 ngày qua' },
];

/** Icon thiết bị theo tiền tố mã (70:4592, 70:4612, 70:4632). */
export function deviceIcon(device: string): IconName {
  if (/^GS-/i.test(device)) return 'mtDeviceGas';
  if (/^E-/i.test(device)) return 'mtDeviceVaporizer';
  return 'mtDeviceValve';
}

// ============================================================================
// Lọc (dùng với useTableFilters)
// ============================================================================

export type MaintenanceTab = 'all' | Exclude<MaintenanceStatus, 'cancelled'> | 'overdue';

/** ?tab=&q=&area=&priority=&type=&range=&sort=&page= (`?open=<id>` cũ → chuyển hướng /maintenance/:id). Đã hủy chỉ hiện ở tab "Tất cả". */
export const MAINTENANCE_PARAMS = {
  tab: { values: ['all', 'pending', 'assigned', 'in-progress', 'review', 'done', 'overdue'], default: 'all' },
  q: { default: '' },
  area: {},
  priority: { values: ['critical', 'high', 'medium', 'low'] },
  type: { values: ['periodic', 'incident', 'inspection'] },
  range: { values: ['all', 'today', '7d', '30d'], default: 'all' },
  sort: { values: ['created', 'due'], default: 'created' },
} as const;

type Filters = {
  tab: MaintenanceTab;
  q: string;
  area: string | null;
  priority: Severity | null;
  type: MaintenanceType | null;
  range: MaintenanceRange;
  sort: 'created' | 'due';
};

const RANGE_DAYS: Record<Exclude<MaintenanceRange, 'all'>, number> = { today: 0, '7d': 6, '30d': 29 };

export function matchMaintenance(r: MaintenanceRecord, f: Filters, now: Date) {
  const q = f.q.trim().toLowerCase();
  const age = -daysFromToday(r.createdAt, now);
  return (
    (f.range === 'all' || age <= RANGE_DAYS[f.range]) &&
    (f.tab === 'all' || (f.tab === 'overdue' ? isOverdue(r, now) : r.status === f.tab)) &&
    (!q || [r.code, r.title, r.device, r.area, r.assignee ?? ''].some((s) => s.toLowerCase().includes(q))) &&
    (!f.area || r.area === f.area) &&
    (!f.priority || r.priority === f.priority) &&
    (!f.type || r.type === f.type)
  );
}

/** created: mới tạo trước (rồi mã giảm dần) · due: hạn gần nhất trước. */
export function sortMaintenance(a: MaintenanceRecord, b: MaintenanceRecord, f: Pick<Filters, 'sort'>) {
  return f.sort === 'due'
    ? a.dueAt.localeCompare(b.dueAt)
    : b.createdAt.localeCompare(a.createdAt) || b.code.localeCompare(a.code);
}

// ============================================================================
// Suy dẫn
// ============================================================================

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/** 3 việc ưu tiên: chưa xong, mức Nghiêm trọng/Cao; quá hạn trước, rồi hạn gần nhất, rồi mức độ (70:4969). */
export function derivePriorityTasks(rows: readonly MaintenanceRecord[], now: Date, limit = 3): PriorityTaskData[] {
  return rows
    .filter((r) => isOpen(r) && (r.priority === 'critical' || r.priority === 'high'))
    .sort((a, b) => daysUntilDue(a, now) - daysUntilDue(b, now) || SEVERITY_RANK[a.priority] - SEVERITY_RANK[b.priority])
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      severity: r.priority,
      device: r.device,
      deviceIcon: deviceIcon(r.device),
      dueLabel: dueLabel(r, now),
      overdue: isOverdue(r, now),
    }));
}

/** Lịch sắp tới: việc ĐỊNH KỲ còn mở, chưa tới giờ hạn (đã quá giờ → sang "Quá hạn"), gần nhất trước (70:4889). */
export function deriveSchedule(rows: readonly MaintenanceRecord[], now: Date, limit = 3): TimelineEvent[] {
  return rows
    .filter((r) => r.type === 'periodic' && isOpen(r) && !isPastDue(r.dueAt, now, dueHasTime(r)))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, limit)
    .map((r, i) => ({ id: r.id, time: scheduleLabel(r, now), title: r.title, location: r.area, active: i === 0 }));
}

/** Ngày `iso` thuộc tháng hiện tại (giờ nhà máy) dời `monthOffset` tháng. */
const inMonth = (iso: string | null, monthOffset: number, now: Date) => !!iso && iso.slice(0, 7) === plantMonthKey(now, monthOffset);

/**
 * 6 KPI (70:5207):
 * - Tổng yêu cầu = tạo trong tháng; dòng phụ = % so với số tạo tháng trước.
 * - Đang thực hiện: thanh = đang thực hiện / (đang thực hiện + chờ nghiệm thu + hoàn thành trong tháng).
 * - Đã hoàn thành = hoàn thành trong tháng.
 * - Yêu cầu đã hủy không tính vào KPI nào.
 */
export function deriveMaintenanceKpis(all: readonly MaintenanceRecord[], now: Date): KpiMock[] {
  const rows = all.filter((r) => r.status !== 'cancelled');
  const thisMonth = rows.filter((r) => inMonth(r.createdAt, 0, now)).length;
  const lastMonth = rows.filter((r) => inMonth(r.createdAt, -1, now)).length;
  const trend = lastMonth ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : 0;
  const count = (s: MaintenanceStatus) => rows.filter((r) => r.status === s).length;
  const inProgress = count('in-progress');
  const review = count('review');
  const doneMonth = rows.filter((r) => r.status === 'done' && inMonth(r.completedAt, 0, now)).length;
  const overdue = rows.filter((r) => isOverdue(r, now)).length;
  const ratio = inProgress + review + doneMonth ? (inProgress / (inProgress + review + doneMonth)) * 100 : 0;
  const base = { variant: 'compact', strongBorder: true, iconBox: 24 } as const;
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return [
    { ...base, id: 'total', label: 'Tổng yêu cầu', icon: 'kpiMtTotal', value: String(thisMonth), sub: `${trend >= 0 ? '+' : ''}${trend}% vs tháng trước`, subTone: trend >= 0 ? 'success' : 'danger', subIcon: trend >= 0 ? 'kpiTrendUp' : undefined },
    { ...base, id: 'pending', label: 'Chờ tiếp nhận', icon: 'kpiMtPending', value: pad2(count('pending')), sub: 'Cần phân công', subTone: 'muted', tone: 'warning' },
    { ...base, id: 'in-progress', label: 'Đang thực hiện', icon: 'kpiMtTimer', value: pad2(inProgress), progress: Math.round(ratio), progressTone: 'info' },
    { ...base, id: 'review', label: 'Chờ nghiệm thu', icon: 'kpiMtReview', value: pad2(review), sub: 'Đã hoàn tất thi công', subTone: 'muted' },
    { ...base, id: 'overdue', label: 'Quá hạn', icon: 'kpiMtOverdue', value: pad2(overdue), sub: 'Cần xử lý ngay', subTone: 'danger', subIcon: 'kpiMtOverdueSm', tone: 'danger', outlined: true, strongBorder: false },
    { ...base, id: 'done', label: 'Đã hoàn thành', icon: 'kpiMtDone', value: pad2(doneMonth), sub: 'Trong tháng', subTone: 'success', subIcon: 'kpiMtDoneSm', tone: 'success' },
  ];
}

// ============================================================================
// Nguồn dữ liệu + mutation
// ============================================================================

let db: MaintenanceRecord[] = maintenanceRecords.map((r) => ({ ...r }));

/** GET /maintenance – thay bằng fetch thật khi có API. */
export async function fetchMaintenance(): Promise<MaintenanceRecord[]> {
  return db.map((r) => ({ ...r }));
}

const store = createCollectionStore(fetchMaintenance);
const commit = () => store.commit(db.map((r) => ({ ...r })));

function patch(ids: readonly string[], fn: (r: MaintenanceRecord) => MaintenanceRecord) {
  const set = new Set(ids);
  db = db.map((r) => (set.has(r.id) ? fn(r) : r));
  commit();
}

export type NewMaintenanceInput = {
  title: string;
  description?: string;
  device: string;
  /** Khu vực của thiết bị – form tự điền từ danh bạ (`deriveDeviceDirectory`). */
  area: string;
  type: MaintenanceType;
  priority: Severity;
  source?: MaintenanceSource;
  referenceCode?: string;
  /** "yyyy-mm-ddTHH:mm" */
  startAt?: string;
  /** "yyyy-mm-ddTHH:mm" (hoặc "yyyy-mm-dd" → hạn chỉ có ngày: lưu T23:59 + `dueHasTime: false`) */
  dueAt: string;
  assignee: string | null;
  collaborators?: string[];
  department?: string;
  shift?: ShiftId;
  checklist?: { id: string; text: string; done: boolean }[];
  attachments?: { id: string; name: string; size: number }[];
  /** Ghi chú của form → ghi chú đầu tiên trong luồng "Ghi chú kỹ thuật". */
  notes?: string;
  requiresPermit?: boolean;
  sourceAlertId?: string;
  /** Người tạo (người đang đăng nhập; mặc định 'Admin'). */
  createdBy?: string;
};

/** Đã có yêu cầu (chưa hủy) tạo từ cảnh báo này → tạo lại bị từ chối (drawer hiện "Xem MT-…" thay nút tạo). */
export class DuplicateFromAlertError extends Error {
  constructor(readonly existing: MaintenanceRecord) {
    super(`Cảnh báo ${existing.sourceAlertId} đã có yêu cầu bảo trì ${existing.code}.`);
  }
}

/**
 * POST /maintenance – tạo yêu cầu mới; có người phụ trách → "Đã phân công", không → "Chờ tiếp nhận".
 * Một cảnh báo chỉ có MỘT yêu cầu đang hiệu lực (`linkedMaintenance`, bỏ yêu cầu đã hủy) – trùng → `DuplicateFromAlertError`.
 */
export async function createMaintenance(input: NewMaintenanceInput): Promise<MaintenanceRecord> {
  if (input.sourceAlertId) {
    const existing = linkedMaintenance(input.sourceAlertId, db);
    if (existing) throw new DuplicateFromAlertError(existing);
  }
  const now = appNow();
  const at = plantDateTimeKey(now);
  const maxNo = Math.max(0, ...db.map((r) => Number(r.code.replace(/\D/g, '')) || 0));
  const code = `MT-${String(maxNo + 1).padStart(5, '0')}`;
  const checklist = (input.checklist ?? []).filter((c) => c.text.trim());
  const createdBy = input.createdBy ?? 'Admin';
  const note = input.notes?.trim();
  const history: MaintenanceHistoryEntry[] = [
    { id: 'h1', at, kind: 'create', text: input.sourceAlertId ? `Tạo yêu cầu từ cảnh báo ${input.sourceAlertId}` : 'Tạo yêu cầu', actor: createdBy },
  ];
  if (input.assignee) history.push({ id: 'h2', at, kind: 'assign', text: `Phân công: ${input.assignee}`, actor: createdBy });
  const record: MaintenanceRecord = {
    id: code,
    code,
    title: input.title.trim().slice(0, 160),
    description: input.description?.trim() || undefined,
    device: input.device,
    area: input.area || 'Khác',
    type: input.type,
    priority: input.priority,
    status: input.assignee ? 'assigned' : 'pending',
    assignee: input.assignee,
    createdAt: isoDay(0),
    createdBy,
    dueAt: input.dueAt.length === 10 ? `${input.dueAt}T23:59` : input.dueAt,
    dueHasTime: input.dueAt.length === 10 ? false : undefined,
    completedAt: null,
    progress: checklistProgress(checklist).percent,
    sourceAlertId: input.sourceAlertId,
    source: input.source,
    referenceCode: input.referenceCode?.trim() || undefined,
    startAt: input.startAt || undefined,
    department: input.department,
    shift: input.shift,
    collaborators: input.collaborators?.length ? input.collaborators : undefined,
    checklist: checklist.length ? checklist : undefined,
    attachments: input.attachments?.length ? input.attachments.map(({ id, name, size }) => ({ id, name, size })) : undefined,
    notes: note ? [{ id: 'n1', author: createdBy, at, text: note }] : undefined,
    history,
    requiresPermit: input.requiresPermit || undefined,
  };
  db = [record, ...db];
  commit();
  return record;
}

/** Người thao tác: người đang đăng nhập; chưa có đăng nhập → 'Admin'. */
const DEFAULT_ACTOR = 'Admin';
const ctx = (actor?: string) => ({ actor: actor || DEFAULT_ACTOR, now: appNow() });

/**
 * Modal "Phân công người xử lý": phân công (Chờ tiếp nhận → Đã phân công) hoặc đổi người (Đã phân công / Đang thực hiện,
 * lý do bắt buộc) – `applyAssignment` (features/maintenance/assign.ts).
 */
export const assignMaintenance = async (id: string, form: AssignForm, actor?: string) => patch([id], (r) => applyAssignment(r, form, ctx(actor), staffByName));

/**
 * Phân công hàng loạt: CHỈ dòng Chờ tiếp nhận (không đổi người hàng loạt), mỗi dòng qua `validateAssign` với hạn sẵn có.
 * Trả số đã phân công / bỏ qua + cảnh báo gộp khi người được chọn sẽ thành Bận sau cả lô.
 */
export async function bulkAssignMaintenance(ids: readonly string[], assignee: string, actor?: string) {
  const c = ctx(actor);
  const set = new Set(ids);
  const plan = planBulkAssign(
    db.filter((r) => set.has(r.id)),
    assignee,
    computeWorkloads(db, c.now),
  );
  patch(plan.ids, (r) => applyAssignment(r, { ...initialAssignForm(r), assignee }, c, staffByName));
  return { assigned: plan.ids.length, skipped: plan.skipped, skippedBy: plan.skippedBy, busyAfter: plan.busyAfter, activeAfter: plan.activeAfter };
}

/** Sang bước kế tiếp – đúng một bước (Tiếp nhận → Bắt đầu → Nghiệm thu → Hoàn thành), ghi lịch sử. */
export const advanceMaintenance = async (id: string, actor?: string) => patch([id], (r) => advanceRecord(r, ctx(actor)));

/** Hủy yêu cầu (chưa hoàn thành), lý do không bắt buộc – ghi lịch sử. */
export const cancelMaintenance = async (id: string, reason?: string, actor?: string) =>
  patch([id], (r) => cancelRecord(r, { ...ctx(actor), reason }));

/** Modal "Cập nhật tiến độ": trạng thái công việc + tiến độ báo cáo + nội dung + tệp tạm → một dòng lịch sử. */
export const updateMaintenanceProgress = async (id: string, input: ProgressUpdateInput, actor?: string) =>
  patch([id], (r) => applyProgressUpdate(r, input, ctx(actor)));

/** Modal "Gửi yêu cầu nghiệm thu": in-progress → review (đủ điều kiện), lưu hồ sơ + ảnh chụp số liệu. */
export const submitMaintenanceForReview = async (id: string, input: SubmitInput, actor?: string) =>
  patch([id], (r) => submitForReview(r, input, ctx(actor)));

/** Modal "Nghiệm thu yêu cầu bảo trì": Đạt → done · Cần bổ sung / Không đạt → in-progress. Người thao tác = người nghiệm thu. */
export const reviewMaintenance = async (id: string, input: ReviewInput) => patch([id], (r) => reviewRecord(r, input, { now: appNow() }));

/** Tick / bỏ tick một mục checklist; tiến độ bản ghi tính lại từ checklist. */
export const toggleMaintenanceChecklist = async (id: string, itemId: string) =>
  patch([id], (r) => {
    if (!r.checklist) return r;
    const checklist = toggleChecklistItem(r.checklist, itemId, appNow());
    return { ...r, checklist, progress: checklistProgress(checklist).percent };
  });

/** Thêm ghi chú kỹ thuật. */
export const addMaintenanceNote = async (id: string, text: string, actor?: string) =>
  patch([id], (r) => addNoteRecord(r, text, ctx(actor)));

/** Hook: `{ status, data, error, refetch, create, assign, advance, cancel, updateProgress, submitForReview, review, toggleChecklist, addNote }`. */
export function useMaintenance() {
  return {
    ...store.useCollection(),
    create: createMaintenance,
    assign: assignMaintenance,
    bulkAssign: bulkAssignMaintenance,
    advance: advanceMaintenance,
    cancel: cancelMaintenance,
    updateProgress: updateMaintenanceProgress,
    submitForReview: submitMaintenanceForReview,
    review: reviewMaintenance,
    toggleChecklist: toggleMaintenanceChecklist,
    addNote: addMaintenanceNote,
  };
}

// ============================================================================
// Hỗ trợ form "Tạo yêu cầu bảo trì" (ảnh thiết kế)
// ============================================================================

/** Loại bảo trì trong form – nhãn đầy đủ (bảng dùng nhãn ngắn TYPE_OPTIONS). */
export const FORM_TYPE_OPTIONS: SelectOption<MaintenanceType>[] = [
  { value: 'incident', label: 'Bảo trì khắc phục' },
  { value: 'periodic', label: 'Bảo trì định kỳ' },
  { value: 'inspection', label: 'Kiểm tra / Hiệu chuẩn' },
];

/** Mức độ ưu tiên trong form: 3 nút. "Thường" = medium; "Thấp" chỉ có trong dữ liệu cũ. */
export const FORM_PRIORITY_OPTIONS = [
  { id: 'critical', label: 'Nghiêm trọng', tone: 'danger' as const },
  { id: 'high', label: 'Cao', tone: 'warning' as const },
  { id: 'medium', label: 'Thường', tone: 'neutral' as const },
];

export type DeviceDirectoryEntry = { device: string; area: string };

/**
 * Danh bạ thiết bị → khu vực (ô "Thiết bị" + "Khu vực" của form tạo yêu cầu), gộp từ cảnh báo + bảo trì; trùng thiết bị
 * thì khu vực của bảo trì thắng; sắp theo mã. Thuần – trang tính bằng `useMemo` rồi truyền vào modal.
 */
export function deriveDeviceDirectory(maint: readonly MaintenanceRecord[], alerts: readonly AlertRecord[] = []): DeviceDirectoryEntry[] {
  const directory = new Map<string, string>();
  for (const a of alerts) directory.set(a.device, a.area);
  for (const r of maint) directory.set(r.device, r.area);
  return [...directory.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([device, area]) => ({ device, area }));
}

/** Phòng ban gợi ý theo tiền tố mã thiết bị. */
export function departmentFor(device: string): (typeof DEPARTMENTS)[number] {
  if (/^(GS|PT|TT|FT|LT|PI|PCV)-/i.test(device)) return 'Đo lường – Tự động hóa';
  if (/^(G|C)-/i.test(device)) return 'Bảo trì Điện';
  if (/^FS-/i.test(device)) return 'An toàn – HSE';
  return 'Bảo trì Cơ khí';
}

/** Ca vận hành chứa thời điểm "yyyy-mm-ddTHH:mm". */
export function shiftFor(dateTime: string): ShiftId {
  const h = Number(dateTime.slice(11, 13));
  return SHIFTS.find((s) => (s.from < s.to ? h >= s.from && h < s.to : h >= s.from || h < s.to))?.value ?? 'shift-1';
}

const pad = (n: number) => String(n).padStart(2, '0');
/** "yyyy-mm-ddTHH:mm" cách bây giờ `hours` giờ, làm tròn lên giờ chẵn. */
export function localDateTime(hoursFromNow = 0, base = new Date()) {
  const d = new Date(base);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1 + hoursFromNow);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}

/** Số giờ giữa hai mốc "yyyy-mm-ddTHH:mm" (làm tròn 0.5). */
export function durationHours(start?: string, end?: string) {
  if (!start || !end) return null;
  const h = (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000;
  return Number.isFinite(h) ? Math.round(h * 2) / 2 : null;
}

export type AiSuggestion = { assessment: string; checks: string[] };

/**
 * "GÓP Ý TỪ AI" – ⚠ MOCK theo quy tắc (chưa nối AI thật).
 * Khi có API: thay thân hàm bằng gọi dịch vụ AI với ngữ cảnh {device, alert, lịch sử vận hành}.
 */
export function suggestForRequest({ device, alert }: { device: string | null; alert?: AlertRecord }): AiSuggestion | null {
  if (!device && !alert) return null;
  const d = device ?? alert?.device ?? '';
  if (alert && /áp suất/i.test(alert.message)) {
    return {
      assessment: `Áp suất ${alert.device.startsWith('V-') ? 'bồn ' : ''}${alert.device} tăng bất thường trong 2 giờ gần nhất và có khả năng liên quan đến van an toàn PSV-${alert.device.replace(/\D/g, '') || '101'} hoặc hệ thống làm mát.`,
      checks: [`Kiểm tra trạng thái van PSV-${alert.device.replace(/\D/g, '') || '101'}`, 'Đối chiếu áp suất tại hiện trường', 'Kiểm tra hệ thống làm mát và tín hiệu cảm biến liên quan'],
    };
  }
  if (/^GS-/i.test(d) || (alert && /gas|LEL/i.test(alert.message + alert.unit))) {
    return {
      assessment: `Nồng độ gas tại ${d} vượt ngưỡng cảnh báo; cần loại trừ rò rỉ thật trước khi hiệu chuẩn cảm biến.`,
      checks: ['Đo nồng độ bằng máy cầm tay', 'Kiểm tra mặt bích & khớp nối lân cận', 'Hiệu chuẩn cảm biến bằng khí chuẩn'],
    };
  }
  if (/^E-/i.test(d) || (alert && /hóa hơi/i.test(alert.message))) {
    return {
      assessment: `Nhiệt độ đầu ra máy hóa hơi ${d} thấp hơn định mức; có thể do bám cặn bộ trao đổi nhiệt hoặc van điều nhiệt.`,
      checks: ['Kiểm tra van điều nhiệt', 'Đo nhiệt độ nước nóng đầu vào', 'Kiểm tra bám cặn bộ trao đổi nhiệt'],
    };
  }
  return {
    assessment: `Chưa ghi nhận bất thường lớn ở ${d} trong 24 giờ qua; đề xuất kiểm tra tổng quát theo checklist định kỳ.`,
    checks: ['Kiểm tra ngoại quan & rò rỉ', 'Đối chiếu thông số vận hành', 'Kiểm tra tín hiệu cảm biến liên quan'],
  };
}

/** Checklist mẫu phù hợp nhất với thiết bị/cảnh báo. */
export function templateFor(device: string | null, alert?: AlertRecord) {
  if (alert && /áp suất/i.test(alert.message)) return CHECKLIST_TEMPLATES.find((t) => t.id === 'pressure');
  if (device && /^GS-/i.test(device)) return CHECKLIST_TEMPLATES.find((t) => t.id === 'gas');
  if (device && /^E-/i.test(device)) return CHECKLIST_TEMPLATES.find((t) => t.id === 'vaporizer');
  return undefined;
}

// ---- Lưu nháp (localStorage, theo trình duyệt) ----
const DRAFT_KEY = 'demo-lpg:maintenance-draft';
export function saveMaintenanceDraft(draft: unknown) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: new Date().toISOString(), draft }));
  } catch {
    /* bộ nhớ không khả dụng – bỏ qua */
  }
}
export function loadMaintenanceDraft<T>(): { savedAt: string; draft: T } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function clearMaintenanceDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
