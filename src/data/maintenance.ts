import type { Severity } from '@/components';
import { checklistProgress, toggleChecklistItem } from '@/features/maintenance/checklist';
import { applyProgressUpdate, type ProgressUpdateInput } from '@/features/maintenance/progress';
import { reviewRecord, submitForReview, type ReviewInput, type SubmitInput } from '@/features/maintenance/review';
import { applyAssignment, computeWorkloads, initialAssignForm, planBulkAssign, type AssignForm } from '@/features/maintenance/assign';
import { addNoteRecord, advanceRecord, cancelRecord } from '@/features/maintenance/workflow';
import { linkedMaintenance } from '@/features/alerts/workflow';
import { createCollectionStore } from '@/lib/createCollectionStore';
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
  maintenanceRecords,
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

let db: MaintenanceRecord[] = maintenanceRecords.map((r) => ({ ...r }));

/** GET /maintenance – thay bằng fetch thật khi có API. */
async function fetchMaintenance(): Promise<MaintenanceRecord[]> {
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
async function createMaintenance(input: NewMaintenanceInput): Promise<MaintenanceRecord> {
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
const assignMaintenance = async (id: string, form: AssignForm, actor?: string) =>
  patch([id], (r) => applyAssignment(r, form, ctx(actor), staffByName));

/**
 * Phân công hàng loạt: CHỈ dòng Chờ tiếp nhận (không đổi người hàng loạt), mỗi dòng qua `validateAssign` với hạn sẵn có.
 * Trả số đã phân công / bỏ qua + cảnh báo gộp khi người được chọn sẽ thành Bận sau cả lô.
 */
async function bulkAssignMaintenance(ids: readonly string[], assignee: string, actor?: string) {
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

// Tách file (10/11/2026) – điểm import chung vẫn là `@/data/maintenance`.
export * from './maintenanceView';
export * from './maintenanceForm';
