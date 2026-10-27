/*
 * Phân công người xử lý – thuần (không React, không gọi Date.now()). Modal "Phân công người xử lý" (ảnh thiết kế).
 *
 *   pending ──Phân công (modal / hàng loạt)──▶ assigned          (assignRecord – đúng một bước)
 *   assigned / in-progress ──Đổi người xử lý (lý do bắt buộc)──▶ giữ trạng thái, tiến độ, cờ tạm dừng/sự cố
 *   review / done / cancelled: không phân công / đổi người được.
 *
 * Tải việc (đang làm / quá hạn / Bận) TÍNH TỪ danh sách yêu cầu, không lưu.
 */
import { plantDateTimeKey } from '@/lib/plantTime';
import { SHIFTS, staffByName, type MaintenanceRecord, type MaintenanceStatus, type ShiftId } from '@/mocks/maintenance';
import { dueInstant, isPastDue } from './deadline';
import { addNoteRecord, assignRecord, type ActionContext } from './workflow';

/** Bận khi đang làm ≥ 3 việc (người xử lý chính). */
export const BUSY_THRESHOLD = 3;

/** "Đang làm" = Đã phân công + Đang thực hiện (chờ nghiệm thu không tính – đã xong phần thi công). */
const ACTIVE: readonly MaintenanceStatus[] = ['assigned', 'in-progress'];

/** Giải thích cách tính – tooltip/đọc kèm chip tải việc. */
export const WORKLOAD_HINT = `Đang làm = số yêu cầu Đã phân công + Đang thực hiện mà người này là người xử lý chính (không tính người phối hợp, không tính Chờ nghiệm thu). Quá hạn = trong số đó, đã qua hạn chót. Bận khi đang làm từ ${BUSY_THRESHOLD} việc.`;

export type StaffWorkload = { active: number; overdue: number; busy: boolean };

const EMPTY: StaffWorkload = { active: 0, overdue: 0, busy: false };

/** Tải việc của mọi người xử lý chính (Map theo tên). Người không có việc → không có khoá (dùng `workloadOf`). */
export function computeWorkloads(records: readonly MaintenanceRecord[], now: Date): Map<string, StaffWorkload> {
  const map = new Map<string, StaffWorkload>();
  for (const r of records) {
    if (!r.assignee || !ACTIVE.includes(r.status)) continue;
    const cur = map.get(r.assignee) ?? { active: 0, overdue: 0, busy: false };
    cur.active += 1;
    if (isPastDue(r.dueAt, now, r.dueHasTime !== false)) cur.overdue += 1;
    cur.busy = cur.active >= BUSY_THRESHOLD;
    map.set(r.assignee, cur);
  }
  return map;
}

export const workloadOf = (map: ReadonlyMap<string, StaffWorkload>, name: string | null | undefined): StaffWorkload =>
  (name && map.get(name)) || EMPTY;

/** "1 đang làm" · "3 đang làm (1 quá hạn)". */
export const workloadLabel = (w: StaffWorkload) => `${w.active} đang làm${w.overdue ? ` (${w.overdue} quá hạn)` : ''}`;

/** Phân công mới (Chờ tiếp nhận) / đổi người (Đã phân công, Đang thực hiện). */
export const canAssign = (s: MaintenanceStatus) => s === 'pending';
export const canReassign = (s: MaintenanceStatus) => s === 'assigned' || s === 'in-progress';
export const assignMode = (s: MaintenanceStatus): 'assign' | 'reassign' | null => (canAssign(s) ? 'assign' : canReassign(s) ? 'reassign' : null);

/** Giờ "yyyy-mm-ddTHH:mm" có nằm trong khung ca không (ca 3 qua nửa đêm 22:00 → 06:00). */
export function inShift(dateTime: string, shift: ShiftId): boolean {
  const s = SHIFTS.find((x) => x.value === shift);
  const h = Number(dateTime.slice(11, 13));
  if (!s || !Number.isFinite(h) || dateTime.length < 16) return true;
  return s.from < s.to ? h >= s.from && h < s.to : h >= s.from || h < s.to;
}

export type AssignForm = {
  assignee: string | null;
  collaborators: readonly string[];
  /** "yyyy-mm-ddTHH:mm" hoặc "" */
  startAt: string;
  /** "yyyy-mm-ddTHH:mm" (bắt buộc) */
  dueAt: string;
  shift: ShiftId | null;
  note: string;
  /** Công tắc "Gửi thông báo đẩy và SMS" – chỉ giao diện. TODO(backend): gửi thật. */
  notify: boolean;
  /** Lý do đổi người (bắt buộc khi đổi người). */
  reason: string;
};

export type AssignIssueId = 'status' | 'assignee' | 'due' | 'due-before-start' | 'reason';
export type AssignIssue = { id: AssignIssueId; label: string };

/** Form mặc định từ bản ghi: người chính chỉ điền khi đổi người (phân công mới KHÔNG chọn sẵn ai). */
export function initialAssignForm(r: MaintenanceRecord): AssignForm {
  return {
    assignee: canReassign(r.status) ? r.assignee : null,
    collaborators: r.collaborators ?? [],
    startAt: r.startAt ?? '',
    dueAt: r.dueAt.length > 10 ? r.dueAt.slice(0, 16) : `${r.dueAt}T23:59`,
    shift: r.shift ?? null,
    note: '',
    notify: true,
    reason: '',
  };
}

/** Lỗi CHẶN xác nhận ([] = hợp lệ): trạng thái · người chính · hạn · hạn trước giờ bắt đầu · lý do đổi người. */
export function validateAssign(r: MaintenanceRecord, f: AssignForm): AssignIssue[] {
  const out: AssignIssue[] = [];
  const mode = assignMode(r.status);
  if (!mode) out.push({ id: 'status', label: 'Yêu cầu không còn ở bước phân công' });
  if (!f.assignee?.trim()) out.push({ id: 'assignee', label: 'Chưa chọn người xử lý chính' });
  const due = f.dueAt ? dueInstant(f.dueAt) : null;
  if (!due) out.push({ id: 'due', label: 'Chưa nhập hạn chót' });
  const start = f.startAt ? dueInstant(f.startAt) : null;
  if (due && start && due.getTime() < start.getTime()) out.push({ id: 'due-before-start', label: 'Hạn chót sớm hơn thời gian bắt đầu dự kiến' });
  if (mode === 'reassign' && !f.reason.trim()) out.push({ id: 'reason', label: 'Chưa nhập lý do đổi người xử lý' });
  return out;
}

export type AssignWarningId = 'busy' | 'overdue' | 'shift' | 'past-due';
export type AssignWarning = {
  id: AssignWarningId;
  label: string;
  /** Lệch ca: ca mặc định của người được chọn (khác ca đang chọn) → nút "Đổi sang Ca …" (giữ ca bản ghi cho tới khi bấm). */
  suggestShift?: ShiftId;
};

/** "Ca 2" (bỏ khung giờ). */
export const shiftShortLabel = (shift: ShiftId) => SHIFTS.find((s) => s.value === shift)?.label.split(' (')[0] ?? shift;

/**
 * Cảnh báo KHÔNG chặn: người được chọn đang Bận / có việc quá hạn, ca không khớp giờ bắt đầu, hạn đã qua.
 * `workloads` tính từ danh sách hiện tại – khi đổi người, việc này đang tính cho người cũ nên không trừ/cộng gì thêm.
 */
export function assignWarnings(f: AssignForm, workloads: ReadonlyMap<string, StaffWorkload>, now: Date): AssignWarning[] {
  const out: AssignWarning[] = [];
  if (f.assignee) {
    const w = workloadOf(workloads, f.assignee);
    if (w.busy) out.push({ id: 'busy', label: `${f.assignee} đang Bận (${workloadLabel(w)})` });
    if (w.overdue) out.push({ id: 'overdue', label: `${f.assignee} đang có ${w.overdue} việc quá hạn` });
  }
  if (f.shift && f.startAt && !inShift(f.startAt, f.shift)) {
    const s = SHIFTS.find((x) => x.value === f.shift);
    const own = staffByName(f.assignee)?.defaultShift;
    out.push({
      id: 'shift',
      label: `Giờ bắt đầu ${f.startAt.slice(11, 16)} không thuộc ${s?.label ?? 'ca đã chọn'}`,
      ...(own && own !== f.shift ? { suggestShift: own } : {}),
    });
  }
  if (f.dueAt && isPastDue(f.dueAt, now)) out.push({ id: 'past-due', label: 'Hạn chót đã qua' });
  return out;
}

/**
 * Ghi phân công (không hợp lệ → trả nguyên bản ghi).
 * - Phân công mới: `assignRecord` (pending → assigned) + người phối hợp (bỏ người chính), giờ bắt đầu, hạn (có giờ), ca;
 *   phòng ban = phòng ban của người chính (tra toàn bộ STAFF). Lịch sử `assign` (một dòng).
 * - Đổi người: giữ trạng thái/tiến độ/cờ; lịch sử `reassign` "Đổi người xử lý: A → B – lý do: …".
 * - Ghi chú phân công → ghi chú kỹ thuật "Phân công: …".
 */
export function applyAssignment(r: MaintenanceRecord, f: AssignForm, ctx: ActionContext): MaintenanceRecord {
  if (validateAssign(r, f).length) return r;
  const assignee = f.assignee!.trim();
  const mode = assignMode(r.status)!;
  const department = staffByName(assignee)?.department ?? r.department;
  const shift = f.shift ?? r.shift;
  const collaborators = [...new Set(f.collaborators.filter((c) => c && c !== assignee))];
  const dueAt = f.dueAt.slice(0, 16);
  const details: string[] = [];
  if (collaborators.length) details.push(`phối hợp: ${collaborators.join(', ')}`);
  if (dueAt !== r.dueAt.slice(0, 16)) details.push(`hạn ${dueAt.slice(11, 16)} ${dueAt.slice(8, 10)}/${dueAt.slice(5, 7)}`);

  let next: MaintenanceRecord;
  if (mode === 'assign') {
    next = assignRecord(r, { assignee, department, shift }, ctx);
    const history = [...(next.history ?? [])];
    const last = history.at(-1)!;
    history[history.length - 1] = { ...last, text: [`Phân công: ${assignee}`, ...details].join(' · ') };
    next = { ...next, history };
  } else {
    const history = r.history ?? [];
    const head = r.assignee === assignee ? `Cập nhật phân công (${assignee})` : `Đổi người xử lý: ${r.assignee ?? '—'} → ${assignee}`;
    next = {
      ...r,
      assignee,
      department,
      shift,
      history: [
        ...history,
        { id: `h${history.length + 1}`, at: plantDateTimeKey(ctx.now), kind: 'reassign', text: [`${head} – lý do: ${f.reason.trim()}`, ...details].join(' · '), actor: ctx.actor },
      ],
    };
  }
  next = { ...next, collaborators: collaborators.length ? collaborators : undefined, dueAt, dueHasTime: true };
  if (f.startAt) next.startAt = f.startAt.slice(0, 16);
  else delete next.startAt;
  if (!next.collaborators) delete next.collaborators;
  if (f.note.trim()) next = addNoteRecord(next, `Phân công: ${f.note.trim()}`, ctx);
  return next;
}

/**
 * Phân công hàng loạt: chỉ dòng Chờ tiếp nhận; mỗi dòng chạy `validateAssign` với hạn/giờ bắt đầu sẵn có của dòng.
 * Không đổi người hàng loạt. `busyAfter` = người được chọn sẽ thành Bận sau cả lô (cảnh báo gộp, không chặn).
 */
export function planBulkAssign(
  rows: readonly MaintenanceRecord[],
  assignee: string,
  workloads: ReadonlyMap<string, StaffWorkload>,
): { ids: string[]; skipped: number; skippedBy: { status: number; due: number; other: number }; busyAfter: boolean; activeAfter: number } {
  const ids: string[] = [];
  const skippedBy = { status: 0, due: 0, other: 0 };
  for (const r of rows) {
    if (!canAssign(r.status)) {
      skippedBy.status++;
      continue;
    }
    const issues = validateAssign(r, { ...initialAssignForm(r), assignee }).map((i) => i.id);
    if (!issues.length) ids.push(r.id);
    else if (issues.includes('due')) skippedBy.due++;
    else skippedBy.other++;
  }
  const activeAfter = workloadOf(workloads, assignee).active + ids.length;
  return { ids, skipped: rows.length - ids.length, skippedBy, busyAfter: activeAfter >= BUSY_THRESHOLD, activeAfter };
}

/** "Đã phân công 2 · bỏ qua 3 (2 không ở Chờ tiếp nhận, 1 thiếu hạn)" – chỉ liệt kê lý do có số > 0. */
export function bulkAssignMessage(assigned: number, skippedBy: { status: number; due: number; other: number }): string {
  const skipped = skippedBy.status + skippedBy.due + skippedBy.other;
  if (!skipped) return `Đã phân công ${assigned}`;
  const why = [
    skippedBy.status && `${skippedBy.status} không ở Chờ tiếp nhận`,
    skippedBy.due && `${skippedBy.due} thiếu hạn`,
    skippedBy.other && `${skippedBy.other} hạn sớm hơn giờ bắt đầu`,
  ].filter(Boolean);
  return `Đã phân công ${assigned} · bỏ qua ${skipped} (${why.join(', ')})`;
}

/** Số bản ghi còn mở đang giao cho người KHÔNG còn chọn được để phân công (vd trưởng ca – role manager, hoặc không có trong STAFF). */
export function countUnassignableOwners(records: readonly MaintenanceRecord[], assignable: readonly { name: string }[]): number {
  const ok = new Set(assignable.map((p) => p.name));
  return records.filter((r) => r.assignee && r.status !== 'done' && r.status !== 'cancelled' && !ok.has(r.assignee)).length;
}
