/*
 * Phân công xử lý cảnh báo – thuần (không React, không Date.now(); không import mock nhân sự để `data/alerts` – bundle
 * chính – dùng được). Modal "Phân công xử lý cảnh báo" (ảnh `scratch/figma-ref/alert-assign-modal-design.png`).
 *
 *   Chưa có người phụ trách ──Phân công──▶ có người (trạng thái GIỮ NGUYÊN – không tự xác nhận)
 *   Có người ──Đổi người xử lý (lý do bắt buộc)──▶ người mới
 *   Giữ nguyên người, sửa phối hợp / ghi chú chỉ đạo ──▶ "Cập nhật phân công" (không bắt lý do)
 *   Hoàn thành: không phân công được.
 *
 * Tải việc, Ngoài ca, sắp xếp gợi ý, cảnh báo không chặn: `assignStaff.ts` (cần danh mục nhân sự).
 */
import type { AlertRecord } from '@/mocks/alerts';
import { canAssignAlert, newNote, withHistory, type AlertActionCtx } from './workflow';

export type AlertAssignForm = {
  assignee: string | null;
  /** Người phối hợp (không trùng người chính – bỏ khi ghi). */
  collaborators: readonly string[];
  /** Ghi chú chỉ đạo → ghi chú xử lý "Chỉ đạo: …". */
  note: string;
  /** "Gửi thông báo khẩn cấp ngay" – CHỈ giao diện, chưa gửi. TODO(backend): gửi đẩy/SMS thật. */
  notify: boolean;
  /** Lý do đổi người (bắt buộc khi đổi người; hàng loạt: một lý do chung). */
  reason: string;
};

/** Ô thông báo tick sẵn khi có ít nhất một cảnh báo Nghiêm trọng. */
export const defaultNotify = (alerts: readonly Pick<AlertRecord, 'severity'>[]) => alerts.some((a) => a.severity === 'critical');

/** Form mặc định. Một cảnh báo: chọn sẵn người hiện tại + người phối hợp đang có. Hàng loạt: chưa chọn ai. */
export function initialAlertAssignForm(alerts: readonly AlertRecord[]): AlertAssignForm {
  const single = alerts.length === 1 ? alerts[0]! : null;
  return {
    assignee: single?.assignee ?? null,
    collaborators: single?.collaborators ?? [],
    note: '',
    notify: defaultNotify(alerts),
    reason: '',
  };
}

const cleanCollaborators = (list: readonly string[], assignee: string) => [...new Set(list.map((c) => c.trim()).filter((c) => c && c !== assignee))];

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** assign = chưa có người · reassign = người khác · update = cùng người, đổi phối hợp/ghi chú · none = không đổi gì. */
export type AlertAssignChange = 'assign' | 'reassign' | 'update' | 'none';

export function alertAssignChange(a: AlertRecord, f: AlertAssignForm): AlertAssignChange {
  const name = f.assignee?.trim();
  if (!name) return 'none';
  if (!a.assignee) return 'assign';
  if (a.assignee !== name) return 'reassign';
  const collabChanged = !sameSet(cleanCollaborators(f.collaborators, name), cleanCollaborators(a.collaborators ?? [], name));
  return collabChanged || f.note.trim() ? 'update' : 'none';
}

export type AlertAssignIssueId = 'status' | 'assignee' | 'reason' | 'unchanged' | 'none-eligible';
export type AlertAssignIssue = { id: AlertAssignIssueId; label: string };

/** Lỗi CHẶN xác nhận (một cảnh báo). [] = hợp lệ. */
export function validateAlertAssign(a: AlertRecord, f: AlertAssignForm): AlertAssignIssue[] {
  if (!canAssignAlert(a)) return [{ id: 'status', label: 'Cảnh báo đã hoàn thành – không phân công được' }];
  if (!f.assignee?.trim()) return [{ id: 'assignee', label: 'Chưa chọn người phụ trách' }];
  const change = alertAssignChange(a, f);
  if (change === 'reassign' && !f.reason.trim()) return [{ id: 'reason', label: 'Chưa nhập lý do đổi người xử lý' }];
  if (change === 'none') return [{ id: 'unchanged', label: 'Chưa có thay đổi (người phụ trách, người phối hợp hoặc ghi chú chỉ đạo)' }];
  return [];
}

/**
 * Ghi phân công (không hợp lệ → trả CHÍNH bản ghi cũ). Trạng thái giữ nguyên. Một dòng lịch sử `assign`:
 * "Phân công xử lý cho A · phối hợp: B · kèm ghi chú chỉ đạo" / "Đổi người xử lý: A → B – lý do: …" / "Cập nhật phân công (A) · …".
 * Ghi chú chỉ đạo → ghi chú xử lý "Chỉ đạo: …". `notify` không ghi gì (chưa gửi được – không giả vờ đã gửi).
 */
export function applyAlertAssignment(a: AlertRecord, f: AlertAssignForm, ctx: AlertActionCtx): AlertRecord {
  if (validateAlertAssign(a, f).length) return a;
  const assignee = f.assignee!.trim();
  const change = alertAssignChange(a, f);
  const collaborators = cleanCollaborators(f.collaborators, assignee);
  const before = cleanCollaborators(a.collaborators ?? [], assignee);
  const note = f.note.trim();
  const head =
    change === 'assign'
      ? `Phân công xử lý cho ${assignee}`
      : change === 'reassign'
        ? `Đổi người xử lý: ${a.assignee} → ${assignee} – lý do: ${f.reason.trim()}`
        : `Cập nhật phân công (${assignee})`;
  const details: string[] = [];
  if (!sameSet(collaborators, before) || (change === 'assign' && collaborators.length)) details.push(`phối hợp: ${collaborators.length ? collaborators.join(', ') : 'không'}`);
  if (note) details.push('kèm ghi chú chỉ đạo');
  const next: AlertRecord = {
    ...a,
    assignee,
    collaborators: collaborators.length ? collaborators : undefined,
    notes: note ? [...(a.notes ?? []), newNote(a, `Chỉ đạo: ${note}`, ctx)] : a.notes,
    history: withHistory(a, 'assign', [head, ...details].join(' · '), ctx),
  };
  if (!next.collaborators) delete next.collaborators;
  if (!next.notes) delete next.notes;
  return next;
}

// ---- Hàng loạt ----

export type BulkAlertAssignPlan = {
  /** Chưa có người phụ trách → phân công. */
  assign: AlertRecord[];
  /** Đang giao cho người KHÁC → đổi người (một lý do chung). */
  reassign: AlertRecord[];
  /** Bỏ qua: đã hoàn thành · đã giao đúng người này · id không còn. */
  skippedDone: AlertRecord[];
  skippedSame: AlertRecord[];
  missing: number;
};

/** Tách các dòng đã chọn theo người được chọn (`assignee` null → chưa tách đổi người / đúng người). */
export function planBulkAlertAssign(alerts: readonly AlertRecord[], ids: readonly string[], assignee: string | null): BulkAlertAssignPlan {
  const byId = new Map(alerts.map((a) => [a.id, a]));
  const plan: BulkAlertAssignPlan = { assign: [], reassign: [], skippedDone: [], skippedSame: [], missing: 0 };
  const name = assignee?.trim() || null;
  for (const id of ids) {
    const a = byId.get(id);
    if (!a) plan.missing++;
    else if (!canAssignAlert(a)) plan.skippedDone.push(a);
    else if (!a.assignee) plan.assign.push(a);
    else if (name && a.assignee === name) plan.skippedSame.push(a);
    else plan.reassign.push(a);
  }
  return plan;
}

export const bulkSkippedCount = (p: BulkAlertAssignPlan) => p.skippedDone.length + p.skippedSame.length + p.missing;

/** Lỗi chặn của lô: chưa chọn người · không còn dòng nào · có dòng đổi người mà thiếu lý do chung. */
export function validateBulkAlertAssign(plan: BulkAlertAssignPlan, f: AlertAssignForm): AlertAssignIssue[] {
  if (!f.assignee?.trim()) return [{ id: 'assignee', label: 'Chưa chọn người phụ trách' }];
  const out: AlertAssignIssue[] = [];
  if (!plan.assign.length && !plan.reassign.length) out.push({ id: 'none-eligible', label: 'Không còn cảnh báo nào cần phân công cho người này' });
  if (plan.reassign.length && !f.reason.trim()) out.push({ id: 'reason', label: `Chưa nhập lý do đổi người (${plan.reassign.length} cảnh báo đang giao cho người khác)` });
  return out;
}

/** Form cho từng dòng của lô: người phối hợp GỘP với người đang có (không xoá người phối hợp cũ của từng cảnh báo). */
export const bulkRowForm = (a: AlertRecord, f: AlertAssignForm): AlertAssignForm => ({ ...f, collaborators: [...(a.collaborators ?? []), ...f.collaborators] });

/** "Đã phân công 3 (đổi người 1) · bỏ qua 2 (1 đã hoàn thành, 1 đã giao đúng người)". */
export function bulkAlertAssignMessage(plan: BulkAlertAssignPlan): string {
  const done = plan.assign.length + plan.reassign.length;
  const head = `Đã phân công ${done}${plan.reassign.length ? ` (đổi người ${plan.reassign.length})` : ''}`;
  const skipped = bulkSkippedCount(plan);
  if (!skipped) return head;
  const why = [
    plan.skippedDone.length && `${plan.skippedDone.length} đã hoàn thành`,
    plan.skippedSame.length && `${plan.skippedSame.length} đã giao đúng người`,
    plan.missing && `${plan.missing} không còn tồn tại`,
  ].filter(Boolean);
  return `${head} · bỏ qua ${skipped} (${why.join(', ')})`;
}
