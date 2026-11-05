/*
 * Quy trình yêu cầu bảo trì – thuần (không React, không gọi Date.now()). Mỗi thao tác trả bản ghi MỚI + một dòng lịch sử.
 *
 *   pending ──Tiếp nhận──▶ assigned ──Bắt đầu──▶ in-progress ──Gửi nghiệm thu──▶ review ──Nghiệm thu (Đạt)──▶ done
 *   (in-progress → review và review → done/in-progress CHỈ qua `review.ts`: submitForReview / reviewRecord – cần hồ sơ riêng.)
 *      └──────────────┴──────────────┴──────────────────┴──── Hủy ────▶ cancelled (giữ bước đã tới ở cancelledFrom)
 *
 * Không nhảy bước: chỉ đi tới bước kế tiếp. Hủy được khi chưa hoàn thành / chưa hủy.
 */
import { plantDateTimeKey } from '@/lib/plantTime';
import type { ApiMaintenanceStatus, MaintenanceHistoryEntry, MaintenanceHistoryKind, MaintenanceNote, MaintenanceRecord, MaintenanceStatus, ShiftId } from '@/features/maintenance/types';

/** 5 bước của stepper – thứ tự = thứ tự trạng thái API. */
export const WORKFLOW_STEPS: readonly { status: ApiMaintenanceStatus; label: string }[] = [
  { status: 'pending', label: 'Tạo yêu cầu' },
  { status: 'assigned', label: 'Tiếp nhận' },
  { status: 'in-progress', label: 'Đang thực hiện' },
  { status: 'review', label: 'Chờ nghiệm thu' },
  { status: 'done', label: 'Hoàn thành' },
];

const STEP_INDEX = Object.fromEntries(WORKFLOW_STEPS.map((s, i) => [s.status, i])) as Record<ApiMaintenanceStatus, number>;

export type WorkflowPosition = {
  /** Số bước đã xong (✓): trạng thái X = đã tới bước X. */
  completed: number;
  /** Bước đang chờ (aria-current="step"); null khi đã hoàn thành hoặc đã hủy. */
  current: number | null;
  cancelled: boolean;
};

/** Vị trí trên stepper. Đã hủy → dừng ở bước đã tới trước khi hủy (`cancelledFrom`, thiếu → bước 1). */
export function workflowPosition(r: Pick<MaintenanceRecord, 'status' | 'cancelledFrom'>): WorkflowPosition {
  if (r.status === 'cancelled') return { completed: STEP_INDEX[r.cancelledFrom ?? 'pending'] + 1, current: null, cancelled: true };
  const completed = STEP_INDEX[r.status] + 1;
  return { completed, current: completed < WORKFLOW_STEPS.length ? completed : null, cancelled: false };
}

/** Trạng thái kế tiếp (null = không còn bước). */
export const NEXT_STATUS: Record<MaintenanceStatus, ApiMaintenanceStatus | null> = {
  pending: 'assigned',
  assigned: 'in-progress',
  'in-progress': 'review',
  review: 'done',
  done: null,
  cancelled: null,
};

/**
 * Nhãn bước kế tiếp. Thanh hành động trang chi tiết: pending → "Tiếp nhận ngay"; assigned / in-progress → nút "Cập nhật tiến độ"
 * (modal – `progress.ts`) + "Gửi nghiệm thu" (in-progress); review → "Nghiệm thu" (modal – `review.ts`).
 */
export const NEXT_ACTION_LABEL: Partial<Record<MaintenanceStatus, string>> = {
  pending: 'Tiếp nhận ngay',
  assigned: 'Bắt đầu thực hiện',
  'in-progress': 'Gửi nghiệm thu',
  review: 'Nghiệm thu',
};

export const canCancel = (s: MaintenanceStatus) => s !== 'done' && s !== 'cancelled';

/** Chỉ cho đi đúng bước kế tiếp, hoặc hủy khi chưa xong. */
export function canTransition(from: MaintenanceStatus, to: MaintenanceStatus): boolean {
  if (to === 'cancelled') return canCancel(from);
  return NEXT_STATUS[from] === to;
}

export type ActionContext = { actor: string; now: Date };

function withHistory(r: MaintenanceRecord, kind: MaintenanceHistoryKind, text: string, { actor, now }: ActionContext): MaintenanceRecord {
  const history = r.history ?? [];
  const entry: MaintenanceHistoryEntry = { id: `h${history.length + 1}`, at: plantDateTimeKey(now), kind, text, actor };
  return { ...r, history: [...history, entry] };
}

/**
 * Tiếp nhận / Bắt đầu – đúng một bước. Đang thực hiện / Chờ nghiệm thu → trả nguyên bản ghi (phải qua modal Gửi nghiệm thu /
 * Nghiệm thu: `submitForReview` / `reviewRecord` trong `review.ts`, vì cần hồ sơ + người nghiệm thu).
 * - Tiếp nhận: người phụ trách = người đang có, hoặc người thao tác (`actor`).
 * - Bắt đầu: bản ghi không có checklist → tiến độ tối thiểu 10%.
 */
export function advanceRecord(r: MaintenanceRecord, ctx: ActionContext): MaintenanceRecord {
  const next = NEXT_STATUS[r.status];
  if (!next || next === 'review' || next === 'done') return r;
  const hasChecklist = !!r.checklist?.length;
  switch (next) {
    case 'assigned': {
      const assignee = r.assignee ?? ctx.actor;
      return withHistory({ ...r, status: next, assignee }, 'accept', `Tiếp nhận yêu cầu – phụ trách: ${assignee}`, ctx);
    }
    case 'in-progress':
      return withHistory({ ...r, status: next, progress: hasChecklist ? r.progress : Math.max(r.progress, 10) }, 'start', 'Bắt đầu thực hiện', ctx);
    default:
      return r;
  }
}

/** Hủy (chưa hoàn thành / chưa hủy); lý do không bắt buộc, ghi vào lịch sử. */
export function cancelRecord(r: MaintenanceRecord, ctx: ActionContext & { reason?: string }): MaintenanceRecord {
  if (!canCancel(r.status)) return r;
  const reason = ctx.reason?.trim() || undefined;
  return withHistory(
    { ...r, status: 'cancelled', cancelledFrom: r.status as ApiMaintenanceStatus, cancelReason: reason },
    'cancel',
    reason ? `Hủy yêu cầu – lý do: ${reason}` : 'Hủy yêu cầu',
    ctx,
  );
}

export type AssignInput = { assignee: string; department?: string; shift?: ShiftId };

/**
 * Phân công: gán người (+ phòng ban, ca). "Chờ tiếp nhận" → "Đã phân công" (đúng một bước); các bước sau giữ trạng thái.
 * Đã hoàn thành / đã hủy → không đổi.
 */
export function assignRecord(r: MaintenanceRecord, input: AssignInput, ctx: ActionContext): MaintenanceRecord {
  if (r.status === 'done' || r.status === 'cancelled') return r;
  const assignee = input.assignee.trim();
  if (!assignee) return r;
  const next: MaintenanceRecord = {
    ...r,
    assignee,
    department: input.department ?? r.department,
    shift: input.shift ?? r.shift,
    status: r.status === 'pending' ? 'assigned' : r.status,
  };
  return withHistory(next, 'assign', `Phân công: ${assignee}`, ctx);
}

/** Thêm ghi chú kỹ thuật (nội dung trống → không đổi). */
export function addNoteRecord(r: MaintenanceRecord, text: string, { actor, now }: ActionContext): MaintenanceRecord {
  const t = text.trim();
  if (!t) return r;
  const notes = r.notes ?? [];
  const note: MaintenanceNote = { id: `n${notes.length + 1}`, author: actor, at: plantDateTimeKey(now), text: t };
  return { ...r, notes: [...notes, note] };
}
