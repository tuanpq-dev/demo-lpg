/*
 * Quy trình xử lý cảnh báo – thuần, có test (workflow.test.ts). Thời điểm + người thao tác truyền vào (`ctx`).
 *
 * Chỉ đi TIẾN: Chưa xác nhận → Đang xử lý → Đã xử lý (resolved, chờ đóng) → Hoàn thành (`close.ts`, modal "Xác nhận đóng
 * cảnh báo"). "Tiếp tục theo dõi" giữ Đã xử lý. Không có đường nhảy cóc (kể cả hàng loạt), không lùi bước. Phân công KHÔNG tự xác nhận (drawer và hàng loạt dùng chung `assignAlert`).
 * Hàm gặp thao tác không hợp lệ trả lại CHÍNH bản ghi cũ (so tham chiếu được) hoặc `{ ok: false }`.
 */
import type { AlertHistoryEntry, AlertHistoryKind, AlertRecord } from '@/features/alerts/types';
import { plantTimeOfDay } from '@/lib/plantTime';
import { inspectionEntry, toggledInspection, writeInspection } from './inspection';

export type AlertActionCtx = { by: string; at: Date };

export const canAcknowledge = (a: Pick<AlertRecord, 'status'>) => a.status === 'unacknowledged';
export const canResolve = (a: Pick<AlertRecord, 'status'>) => a.status === 'in-progress';
export const canAssignAlert = (a: Pick<AlertRecord, 'status'>) => a.status !== 'done';
/** Hướng dẫn xử lý tick được khi Đang xử lý (xác nhận trước; xong rồi thì chỉ xem). */
const canEditGuide = (a: Pick<AlertRecord, 'status'>) => a.status === 'in-progress';
export const canAddAlertNote = (a: Pick<AlertRecord, 'status'>) => a.status !== 'done';

/** Gợi ý khi hướng dẫn bị khoá; null = tick được. */
export function guideLockHint(a: Pick<AlertRecord, 'status'>): string | null {
  if (a.status === 'unacknowledged') return 'Xác nhận cảnh báo để bắt đầu xử lý.';
  if (a.status === 'resolved') return 'Cảnh báo đã xử lý, chờ xác nhận đóng – chỉ xem.';
  if (a.status === 'done') return 'Cảnh báo đã hoàn thành – chỉ xem.';
  return null;
}

/** Thêm một dòng lịch sử (dùng chung với `assign.ts`). */
export function withHistory(a: AlertRecord, kind: AlertHistoryKind, text: string, ctx: AlertActionCtx): readonly AlertHistoryEntry[] {
  const list = a.history ?? [];
  return [...list, { id: `${a.id}-h${list.length + 1}`, at: ctx.at.toISOString(), kind, text, actor: ctx.by }];
}

/** Xác nhận: Chưa xác nhận → Đang xử lý (giai đoạn Đang kiểm tra). Chưa có người phụ trách → người xác nhận nhận xử lý. */
export function acknowledgeAlert(a: AlertRecord, ctx: AlertActionCtx): AlertRecord {
  if (!canAcknowledge(a)) return a;
  return {
    ...a,
    status: 'in-progress',
    phase: 'inspecting',
    assignee: a.assignee ?? ctx.by,
    acknowledgedAt: ctx.at.toISOString(),
    history: withHistory(a, 'acknowledge', a.assignee ? 'Xác nhận cảnh báo' : `Xác nhận cảnh báo – ${ctx.by} nhận xử lý`, ctx),
  };
}

export type ResolveResult = { ok: true; record: AlertRecord } | { ok: false; reason: 'status' | 'note' };

/** Đánh dấu đã xử lý: chỉ Đang xử lý → Đã xử lý (resolved, chờ đóng), BẮT BUỘC ghi chú kết quả (lưu thành ghi chú của cảnh báo). */
export function resolveAlert(a: AlertRecord, note: string, ctx: AlertActionCtx): ResolveResult {
  if (!canResolve(a)) return { ok: false, reason: 'status' };
  const text = note.trim();
  if (!text) return { ok: false, reason: 'note' };
  const withNote = { ...a, notes: [...(a.notes ?? []), newNote(a, text, ctx)] };
  return {
    ok: true,
    record: {
      ...withNote,
      status: 'resolved',
      hold: undefined,
      resolvedAt: ctx.at.toISOString(),
      resolvedBy: ctx.by,
      actionTaken: a.actionTaken ?? text,
      history: withHistory(a, 'resolve', `Đánh dấu đã xử lý: ${text}`, ctx),
    },
  };
}

/** Tạo một ghi chú xử lý (dùng chung với `assign.ts`). */
export const newNote = (a: AlertRecord, text: string, ctx: AlertActionCtx) => ({
  id: `${a.id}-n${(a.notes?.length ?? 0) + 1}`,
  author: ctx.by,
  at: ctx.at.toISOString(),
  text,
});

/** Lưu ghi chú xử lý. Trống / đã hoàn thành → không đổi. */
export function addAlertNote(a: AlertRecord, text: string, ctx: AlertActionCtx): AlertRecord {
  const t = text.trim();
  if (!t || !canAddAlertNote(a)) return a;
  return { ...a, notes: [...(a.notes ?? []), newNote(a, t, ctx)], history: withHistory(a, 'note', `Ghi chú: ${t}`, ctx) };
}

/**
 * Tick / bỏ tick một bước hướng dẫn ở drawer (chỉ Đang xử lý): Chưa kiểm tra ↔ Đạt. Hạng mục "Có vấn đề" / "Không áp
 * dụng" (đặt trong modal cập nhật xử lý) không đổi ở đây. Đọc/ghi qua `inspection.ts` (dạng cũ `{at, by}` = Đạt).
 */
export function toggleGuideStep(a: AlertRecord, step: { id: string; text: string }, ctx: AlertActionCtx): AlertRecord {
  if (!canEditGuide(a)) return a;
  const cur = inspectionEntry(a.guide, step.id);
  const next = toggledInspection(cur);
  if (!next) return a;
  const guide = writeInspection(a.guide, step.id, next, ctx);
  return { ...a, guide, history: withHistory(a, 'guide', `${next.status === 'pending' ? 'Bỏ đánh dấu' : 'Đã làm'}: ${step.text}`, ctx) };
}

/**
 * Yêu cầu hỗ trợ: thêm người làm NGƯỜI PHỐI HỢP (không đổi người phụ trách/trạng thái) + lịch sử kèm lý do (bắt buộc).
 * Đã hoàn thành / không chọn ai / thiếu lý do → giữ nguyên. Gửi thông báo thật: TODO backend (UI không báo "đã gửi").
 */
export function requestSupport(a: AlertRecord, input: { people: readonly string[]; reason: string }, ctx: AlertActionCtx): AlertRecord {
  const reason = input.reason.trim();
  const people = [...new Set(input.people.map((p) => p.trim()).filter(Boolean))];
  if (a.status === 'done' || !reason || !people.length) return a;
  const collaborators = [...new Set([...(a.collaborators ?? []), ...people])];
  return { ...a, collaborators, history: withHistory(a, 'support', `Yêu cầu hỗ trợ: ${people.join(', ')} – ${reason}`, ctx) };
}

/** Ghi lịch sử "Tạo yêu cầu bảo trì MT-…" (liên kết thật nằm ở `sourceAlertId` của yêu cầu – một nguồn). */
export function recordMaintenanceCreated(a: AlertRecord, code: string, ctx: AlertActionCtx): AlertRecord {
  return { ...a, history: withHistory(a, 'maintenance', `Tạo yêu cầu bảo trì ${code}`, ctx) };
}

/** Yêu cầu bảo trì tạo từ cảnh báo (bỏ yêu cầu đã hủy) – có thì KHÔNG cho tạo thêm. */
export function linkedMaintenance<T extends { status: string; sourceAlertId?: string }>(alertId: string, records: readonly T[]): T | undefined {
  return records.find((r) => r.sourceAlertId === alertId && r.status !== 'cancelled');
}

// ---- Hàng loạt ----

export type BulkPlan = { eligible: string[]; skipped: number };

/** Tách id đủ điều kiện (theo thứ tự đã chọn); id không tồn tại cũng tính là bỏ qua. */
export function planBulk(alerts: readonly AlertRecord[], ids: readonly string[], ok: (a: AlertRecord) => boolean): BulkPlan {
  const byId = new Map(alerts.map((a) => [a.id, a]));
  const eligible = ids.filter((id) => {
    const a = byId.get(id);
    return !!a && ok(a);
  });
  return { eligible, skipped: ids.length - eligible.length };
}

/** "Đã hoàn thành 2 · bỏ qua 1" (không có dòng bỏ qua → không ghi phần sau). */
export const bulkMessage = (verb: string, done: number, skipped: number) => `${verb} ${done}${skipped > 0 ? ` · bỏ qua ${skipped}` : ''}`;

// ---- Tiến trình (stepper dọc) ----

export type AlertStepView = { id: string; label: string; time?: string };

const clock = (iso?: string) => (iso ? plantTimeOfDay(new Date(iso)) : undefined);

/**
 * 5 bước. Bước ĐÃ XONG dùng thì quá khứ + giờ: "Đã phát hiện (10:45:22)", "Đã gửi thông báo (10:45:25)", "Đã xác nhận (…)",
 * "Đã xử lý (…)" (xong khi resolved), "Hoàn thành (…)" (xong khi đóng). Bước đang chờ giữ tên trạng thái (badge/tab):
 * "Chưa xác nhận" / "Đang xử lý" / "Hoàn thành" (chờ đóng). Bước chưa tới: "Đang xử lý", "Hoàn thành".
 */
export function alertSteps(a: AlertRecord): { steps: AlertStepView[]; completed: number; current: number | null } {
  const completed = { unacknowledged: 2, 'in-progress': 3, resolved: 4, done: 5 }[a.status];
  const done = (i: number) => i < completed;
  const resolved = clock(a.resolvedAt);
  const closed = clock(a.closedAt) ?? resolved;
  const steps: AlertStepView[] = [
    { id: 'detect', label: 'Đã phát hiện', time: a.time },
    { id: 'notify', label: 'Đã gửi thông báo', time: a.notifiedTime },
    { id: 'ack', label: done(2) ? 'Đã xác nhận' : 'Chưa xác nhận', time: done(2) ? clock(a.acknowledgedAt) : undefined },
    { id: 'progress', label: done(3) ? 'Đã xử lý' : 'Đang xử lý', time: done(3) ? resolved : undefined },
    { id: 'done', label: 'Hoàn thành', time: done(4) ? closed : undefined },
  ];
  return { steps, completed, current: completed < 5 ? completed : null };
}
