import type { Severity } from '@/components';
import { checklistProgress, toggleChecklistItem } from '@/features/maintenance/checklist';
import { applyProgressUpdate, type ProgressUpdateInput } from '@/features/maintenance/progress';
import { reviewRecord, submitForReview, type ReviewInput, type SubmitInput } from '@/features/maintenance/review';
import { applyAssignment, computeWorkloads, initialAssignForm, planBulkAssign, type AssignForm } from '@/features/maintenance/assign';
import { addNoteRecord, advanceRecord, cancelRecord } from '@/features/maintenance/workflow';
import { linkedMaintenance } from '@/features/alerts/workflow';
import { DuplicateFromAlertError } from './maintenanceApi';
import { currentMaintenance, insertMaintenance, maintenanceReady, mutateMaintenance } from './maintenanceStore';
import { appNow } from '@/lib/demoNow';
import { plantDateTimeKey } from '@/lib/plantTime';
import {
  CHECKLIST_TEMPLATES,
  MAINTENANCE_ASSIGNEES,
  PEOPLE,
  ASSIGNABLE_STAFF,
  REVIEWERS,
  SOURCE_OPTIONS,
  isoDay,
  staffByName,
} from '@/mocks/maintenance';
import { DEPARTMENTS, SHIFTS } from '@/features/staff/org';
import type {
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
} from '@/features/maintenance/types';

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
export { ASSIGNABLE_STAFF, CHECKLIST_TEMPLATES, DEPARTMENTS, MAINTENANCE_ASSIGNEES, PEOPLE, REVIEWERS, SHIFTS, SOURCE_OPTIONS, staffByName };

// ============================================================================
// Ngày & hạn
// ============================================================================

// "Hôm nay" tính theo giờ nhà máy (Asia/Bangkok – src/lib/plantTime.ts), không theo múi giờ máy người xem.
// Mọi hàm nhận `now` từ nơi gọi (trang dùng useNow) → test được, không gọi Date.now() bên trong.

/** Áp `fn` lên các bản ghi `ids` (mock server – khi có API: PATCH rồi refetch). */
const patch = (ids: readonly string[], fn: (r: MaintenanceRecord) => MaintenanceRecord) => mutateMaintenance(ids, fn);

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

export { DuplicateFromAlertError };

/** Hạn chỉ có ngày ("2026-11-20") → cuối ngày, đánh dấu không có giờ. */
const dueFields = (dueAt: string) => (dueAt.length === 10 ? { dueAt: `${dueAt}T23:59`, dueHasTime: false } : { dueAt, dueHasTime: undefined });

/** Trường tuỳ chọn: chuỗi rỗng / danh sách rỗng → bỏ (undefined) để bản ghi gọn như dữ liệu API. */
function optionalCreateFields(input: NewMaintenanceInput, checklist: NonNullable<NewMaintenanceInput['checklist']>, createdBy: string, at: string) {
  const note = input.notes?.trim();
  return {
    description: input.description?.trim() || undefined,
    referenceCode: input.referenceCode?.trim() || undefined,
    startAt: input.startAt || undefined,
    collaborators: input.collaborators?.length ? input.collaborators : undefined,
    checklist: checklist.length ? checklist : undefined,
    attachments: input.attachments?.length ? input.attachments.map(({ id, name, size }) => ({ id, name, size })) : undefined,
    notes: note ? [{ id: 'n1', author: createdBy, at, text: note }] : undefined,
    requiresPermit: input.requiresPermit || undefined,
  };
}

/** Lịch sử lúc tạo: "Tạo yêu cầu" (+ từ cảnh báo) và "Phân công" nếu có người phụ trách. */
function creationHistory(input: NewMaintenanceInput, createdBy: string, at: string): MaintenanceHistoryEntry[] {
  const history: MaintenanceHistoryEntry[] = [
    { id: 'h1', at, kind: 'create', text: input.sourceAlertId ? `Tạo yêu cầu từ cảnh báo ${input.sourceAlertId}` : 'Tạo yêu cầu', actor: createdBy },
  ];
  if (input.assignee) history.push({ id: 'h2', at, kind: 'assign', text: `Phân công: ${input.assignee}`, actor: createdBy });
  return history;
}

/**
 * POST /maintenance – tạo yêu cầu mới; có người phụ trách → "Đã phân công", không → "Chờ tiếp nhận".
 * Một cảnh báo chỉ có MỘT yêu cầu đang hiệu lực (`linkedMaintenance`, bỏ yêu cầu đã hủy) – trùng → `DuplicateFromAlertError`.
 */
export async function createMaintenance(input: NewMaintenanceInput): Promise<MaintenanceRecord> {
  await maintenanceReady();
  const db = currentMaintenance();
  if (input.sourceAlertId) {
    const existing = linkedMaintenance(input.sourceAlertId, db);
    if (existing) throw new DuplicateFromAlertError(existing);
  }
  const at = plantDateTimeKey(appNow());
  const maxNo = Math.max(0, ...db.map((r) => Number(r.code.replace(/\D/g, '')) || 0));
  const code = `MT-${String(maxNo + 1).padStart(5, '0')}`;
  const createdBy = input.createdBy ?? 'Admin';
  const checklist = (input.checklist ?? []).filter((c) => c.text.trim());
  const record: MaintenanceRecord = {
    id: code,
    code,
    title: input.title.trim().slice(0, 160),
    device: input.device,
    area: input.area || 'Khác',
    type: input.type,
    priority: input.priority,
    status: input.assignee ? 'assigned' : 'pending',
    assignee: input.assignee,
    createdAt: isoDay(0),
    createdBy,
    ...dueFields(input.dueAt),
    completedAt: null,
    progress: checklistProgress(checklist).percent,
    sourceAlertId: input.sourceAlertId,
    source: input.source,
    department: input.department,
    shift: input.shift,
    ...optionalCreateFields(input, checklist, createdBy, at),
    history: creationHistory(input, createdBy, at),
  };
  await insertMaintenance(record);
  return record;
}

/** Người thao tác: người đang đăng nhập; chưa có đăng nhập → 'Admin'. */
const DEFAULT_ACTOR = 'Admin';
const ctx = (actor?: string) => ({ actor: actor || DEFAULT_ACTOR, now: appNow() });

/**
 * Modal "Phân công người xử lý": phân công (Chờ tiếp nhận → Đã phân công) hoặc đổi người (Đã phân công / Đang thực hiện,
 * lý do bắt buộc) – `applyAssignment` (features/maintenance/assign.ts).
 */
const assignMaintenance = async (id: string, form: AssignForm, actor?: string) =>
  patch([id], (r) => applyAssignment(r, form, ctx(actor), staffByName));

/**
 * Phân công hàng loạt: CHỈ dòng Chờ tiếp nhận (không đổi người hàng loạt), mỗi dòng qua `validateAssign` với hạn sẵn có.
 * Trả số đã phân công / bỏ qua + cảnh báo gộp khi người được chọn sẽ thành Bận sau cả lô.
 */
async function bulkAssignMaintenance(ids: readonly string[], assignee: string, actor?: string) {
  await maintenanceReady();
  const db = currentMaintenance();
  const c = ctx(actor);
  const set = new Set(ids);
  const plan = planBulkAssign(
    db.filter((r) => set.has(r.id)),
    assignee,
    computeWorkloads(db, c.now),
  );
  await patch(plan.ids, (r) => applyAssignment(r, { ...initialAssignForm(r), assignee }, c, staffByName));
  return { assigned: plan.ids.length, skipped: plan.skipped, skippedBy: plan.skippedBy, busyAfter: plan.busyAfter, activeAfter: plan.activeAfter };
}

/** Sang bước kế tiếp – đúng một bước (Tiếp nhận → Bắt đầu → Nghiệm thu → Hoàn thành), ghi lịch sử. */
const advanceMaintenance = async (id: string, actor?: string) => patch([id], (r) => advanceRecord(r, ctx(actor)));

/** Hủy yêu cầu (chưa hoàn thành), lý do không bắt buộc – ghi lịch sử. */
const cancelMaintenance = async (id: string, reason?: string, actor?: string) => patch([id], (r) => cancelRecord(r, { ...ctx(actor), reason }));

/** Modal "Cập nhật tiến độ": trạng thái công việc + tiến độ báo cáo + nội dung + tệp tạm → một dòng lịch sử. */
const updateMaintenanceProgress = async (id: string, input: ProgressUpdateInput, actor?: string) =>
  patch([id], (r) => applyProgressUpdate(r, input, ctx(actor)));

/** Modal "Gửi yêu cầu nghiệm thu": in-progress → review (đủ điều kiện), lưu hồ sơ + ảnh chụp số liệu. */
const submitMaintenanceForReview = async (id: string, input: SubmitInput, actor?: string) =>
  patch([id], (r) => submitForReview(r, input, ctx(actor)));

/** Modal "Nghiệm thu yêu cầu bảo trì": Đạt → done · Cần bổ sung / Không đạt → in-progress. Người thao tác = người nghiệm thu. */
const reviewMaintenance = async (id: string, input: ReviewInput) => patch([id], (r) => reviewRecord(r, input, { now: appNow() }));

/** Tick / bỏ tick một mục checklist; tiến độ bản ghi tính lại từ checklist. */
const toggleMaintenanceChecklist = async (id: string, itemId: string) =>
  patch([id], (r) => {
    if (!r.checklist) return r;
    const checklist = toggleChecklistItem(r.checklist, itemId, appNow());
    return { ...r, checklist, progress: checklistProgress(checklist).percent };
  });

/** Thêm ghi chú kỹ thuật. */
const addMaintenanceNote = async (id: string, text: string, actor?: string) => patch([id], (r) => addNoteRecord(r, text, ctx(actor)));

/**
 * Thao tác ghi bảo trì (KHÔNG tải danh sách – đọc qua `data/maintenanceApi.ts`: trang, tóm tắt, theo mã / thiết bị). Xong thao
 * tác → store tăng phiên bản → các truy vấn đang hiện tải lại ngầm.
 */
export function useMaintenance() {
  return {
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

// Điểm import chung của lớp dữ liệu bảo trì.
export * from './maintenanceView';
export * from './maintenanceForm';
