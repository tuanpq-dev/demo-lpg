/*
 * Quy trình xử lý cảnh báo – thuần, có test (workflow.test.ts). Thời điểm + người thao tác truyền vào (`ctx`).
 *
 * Chỉ đi TIẾN: Chưa xác nhận → Đang xử lý → Hoàn thành. Không có đường từ Chưa xác nhận sang thẳng Hoàn thành
 * (kể cả hàng loạt), không lùi bước. Phân công KHÔNG tự xác nhận (drawer và hàng loạt dùng chung `assignAlert`).
 * Hàm gặp thao tác không hợp lệ trả lại CHÍNH bản ghi cũ (so tham chiếu được) hoặc `{ ok: false }`.
 */
import type { AlertHistoryEntry, AlertHistoryKind, AlertRecord, AlertStatus } from '@/mocks/alerts';
import { plantTimeOfDay } from '@/lib/plantTime';
import { canCloseGas, type CloseCheck } from './bands';
import { canCloseFire, type DetectorAlarm, type DetectorDevice, type FireCloseCheck } from './fire';
import { formatMeasure } from './gauge';

export type AlertActionCtx = { by: string; at: Date };

export const ALERT_STATUS_ORDER: readonly AlertStatus[] = ['unacknowledged', 'in-progress', 'done'];

export const canAcknowledge = (a: Pick<AlertRecord, 'status'>) => a.status === 'unacknowledged';
export const canResolve = (a: Pick<AlertRecord, 'status'>) => a.status === 'in-progress';
export const canAssignAlert = (a: Pick<AlertRecord, 'status'>) => a.status !== 'done';
/** Hướng dẫn xử lý tick được khi Đang xử lý (xác nhận trước; xong rồi thì chỉ xem). */
export const canEditGuide = (a: Pick<AlertRecord, 'status'>) => a.status === 'in-progress';
export const canAddAlertNote = (a: Pick<AlertRecord, 'status'>) => a.status !== 'done';

/** Gợi ý khi hướng dẫn bị khoá; null = tick được. */
export function guideLockHint(a: Pick<AlertRecord, 'status'>): string | null {
  if (a.status === 'unacknowledged') return 'Xác nhận cảnh báo để bắt đầu xử lý.';
  if (a.status === 'done') return 'Cảnh báo đã hoàn thành – chỉ xem.';
  return null;
}

/** Thêm một dòng lịch sử (dùng chung với `assign.ts`). */
export function withHistory(a: AlertRecord, kind: AlertHistoryKind, text: string, ctx: AlertActionCtx): readonly AlertHistoryEntry[] {
  const list = a.history ?? [];
  return [...list, { id: `${a.id}-h${list.length + 1}`, at: ctx.at.toISOString(), kind, text, actor: ctx.by }];
}

/** Xác nhận: Chưa xác nhận → Đang xử lý. Chưa có người phụ trách → người xác nhận nhận xử lý. */
export function acknowledgeAlert(a: AlertRecord, ctx: AlertActionCtx): AlertRecord {
  if (!canAcknowledge(a)) return a;
  return {
    ...a,
    status: 'in-progress',
    assignee: a.assignee ?? ctx.by,
    acknowledgedAt: ctx.at.toISOString(),
    history: withHistory(a, 'acknowledge', a.assignee ? 'Xác nhận cảnh báo' : `Xác nhận cảnh báo – ${ctx.by} nhận xử lý`, ctx),
  };
}

/** Phân công / đổi người phụ trách – giữ nguyên trạng thái. Đã hoàn thành hoặc trùng người → không đổi. */
export function assignAlert(a: AlertRecord, assignee: string, ctx: AlertActionCtx): AlertRecord {
  const name = assignee.trim();
  if (!canAssignAlert(a) || !name || name === a.assignee) return a;
  const text = a.assignee ? `Đổi người phụ trách: ${a.assignee} → ${name}` : `Phân công xử lý cho ${name}`;
  return { ...a, assignee: name, history: withHistory(a, 'assign', text, ctx) };
}

export type ResolveResult = { ok: true; record: AlertRecord } | { ok: false; reason: 'status' | 'note' };

/** Đánh dấu đã xử lý: chỉ Đang xử lý, BẮT BUỘC ghi chú kết quả (lưu thành ghi chú của cảnh báo). */
export function resolveAlert(a: AlertRecord, note: string, ctx: AlertActionCtx): ResolveResult {
  if (!canResolve(a)) return { ok: false, reason: 'status' };
  const text = note.trim();
  if (!text) return { ok: false, reason: 'note' };
  const withNote = { ...a, notes: [...(a.notes ?? []), newNote(a, text, ctx)] };
  return {
    ok: true,
    record: { ...withNote, status: 'done', resolvedAt: ctx.at.toISOString(), history: withHistory(a, 'resolve', `Đánh dấu đã xử lý: ${text}`, ctx) },
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

/** Tick / bỏ tick một bước hướng dẫn (chỉ Đang xử lý). `stepText` để ghi lịch sử dễ đọc. */
export function toggleGuideStep(a: AlertRecord, step: { id: string; text: string }, ctx: AlertActionCtx): AlertRecord {
  if (!canEditGuide(a)) return a;
  const guide = { ...(a.guide ?? {}) };
  const wasDone = step.id in guide;
  if (wasDone) delete guide[step.id];
  else guide[step.id] = { at: ctx.at.toISOString(), by: ctx.by };
  return { ...a, guide, history: withHistory(a, 'guide', `${wasDone ? 'Bỏ đánh dấu' : 'Đã làm'}: ${step.text}`, ctx) };
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

export type GasUpdateInput = { action: 'continue' | 'close'; note: string; /** Nồng độ đo lại tại chỗ (tuỳ chọn; bắt buộc khi mất tín hiệu và đóng). */ measured?: number };
export type GasUpdateResult =
  | { ok: true; record: AlertRecord }
  | { ok: false; reason: 'status' | 'note' }
  | { ok: false; reason: Extract<CloseCheck, { ok: false }>['reason']; message: string };

/**
 * "Cập nhật xử lý" (cảnh báo gas, Đang xử lý): ghi chú bắt buộc.
 * - continue: giữ Đang xử lý, một ghi chú + một dòng lịch sử (kèm số đo lại nếu có).
 * - close: chỉ khi `canCloseGas` (live < ngưỡng cấp 1, mất tín hiệu → số đo lại < ngưỡng) → Hoàn thành, lịch sử ghi nồng độ lúc đóng.
 */
export function gasUpdate(
  a: AlertRecord,
  input: GasUpdateInput,
  check: { live: number | undefined; limit: number; unit: string },
  ctx: AlertActionCtx,
): GasUpdateResult {
  if (!canResolve(a)) return { ok: false, reason: 'status' };
  const note = input.note.trim();
  if (!note) return { ok: false, reason: 'note' };
  const measuredText = input.measured !== undefined ? ` · đo lại tại chỗ: ${formatMeasure(input.measured, check.unit)}` : '';
  if (input.action === 'continue') {
    return {
      ok: true,
      record: { ...a, notes: [...(a.notes ?? []), newNote(a, note, ctx)], history: withHistory(a, 'update', `Tiếp tục xử lý${measuredText}: ${note}`, ctx) },
    };
  }
  const c = canCloseGas({ live: check.live, measured: input.measured, limit: check.limit, unit: check.unit });
  if (!c.ok) return { ok: false, reason: c.reason, message: c.message };
  const res = resolveAlert(a, note, ctx);
  if (!res.ok) return res;
  const how = c.source === 'live' ? 'số trực tiếp' : 'đo lại tại chỗ';
  const history = [...(res.record.history ?? [])];
  history[history.length - 1] = { ...history[history.length - 1]!, text: `Đã xử lý xong – nồng độ lúc đóng ${formatMeasure(c.value, check.unit)} (${how}): ${note}` };
  return { ok: true, record: { ...res.record, history, closingReading: { value: c.value, source: c.source } } };
}

export type FireUpdateAction = 'continue' | 'handled' | 'false-alarm';
export type FireUpdateInput = { action: FireUpdateAction; note: string; /** Đã kiểm tra tại chỗ (bắt buộc khi đóng lúc đầu báo mất tín hiệu). */ fieldChecked?: boolean };
export type FireUpdateResult =
  | { ok: true; record: AlertRecord }
  | { ok: false; reason: 'status' | 'note' }
  | { ok: false; reason: Extract<FireCloseCheck, { ok: false }>['reason']; message: string };

const FIRE_CLOSE_LABEL = { handled: 'Đã xử lý sự cố', 'false-alarm': 'Báo động giả' } as const;

/**
 * "Cập nhật xử lý" báo cháy (Đang xử lý): ghi chú BẮT BUỘC cho cả 3 lựa chọn.
 * - continue: giữ Đang xử lý, một ghi chú + một dòng lịch sử.
 * - handled / false-alarm: chỉ khi `canCloseFire` (đầu báo đã phục hồi; mất tín hiệu → `fieldChecked`) → Hoàn thành +
 *   `resolution` { kind, closedBy } (thống kê báo động giả) + lịch sử ghi căn cứ đóng.
 */
export function fireUpdate(
  a: AlertRecord,
  input: FireUpdateInput,
  check: { alarm: DetectorAlarm; device: DetectorDevice; detector: string },
  ctx: AlertActionCtx,
): FireUpdateResult {
  if (!canResolve(a)) return { ok: false, reason: 'status' };
  const note = input.note.trim();
  if (!note) return { ok: false, reason: 'note' };
  if (input.action === 'continue') {
    return { ok: true, record: { ...a, notes: [...(a.notes ?? []), newNote(a, note, ctx)], history: withHistory(a, 'update', `Tiếp tục xử lý: ${note}`, ctx) } };
  }
  const c = canCloseFire({ ...check, fieldChecked: input.fieldChecked });
  if (!c.ok) return { ok: false, reason: c.reason, message: c.message };
  const res = resolveAlert(a, note, ctx);
  if (!res.ok) return res;
  const basis = c.source === 'live' ? `đầu báo ${check.detector} đã phục hồi` : `đầu báo ${check.detector} mất tín hiệu – đã kiểm tra tại chỗ`;
  const history = [...(res.record.history ?? [])];
  history[history.length - 1] = { ...history[history.length - 1]!, text: `${FIRE_CLOSE_LABEL[input.action]} (${basis}): ${note}` };
  return { ok: true, record: { ...res.record, history, resolution: { kind: input.action, closedBy: c.source } } };
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
 * "Đã xử lý (…)", "Hoàn thành (…)". Bước đang chờ giữ tên trạng thái (badge/tab): "Chưa xác nhận" / "Đang xử lý".
 * Bước chưa tới: "Đang xử lý", "Hoàn thành".
 */
export function alertSteps(a: AlertRecord): { steps: AlertStepView[]; completed: number; current: number | null } {
  const completed = a.status === 'unacknowledged' ? 2 : a.status === 'in-progress' ? 3 : 5;
  const done = (i: number) => i < completed;
  const resolved = clock(a.resolvedAt);
  const steps: AlertStepView[] = [
    { id: 'detect', label: 'Đã phát hiện', time: a.time },
    { id: 'notify', label: 'Đã gửi thông báo', time: a.notifiedTime },
    { id: 'ack', label: done(2) ? 'Đã xác nhận' : 'Chưa xác nhận', time: done(2) ? clock(a.acknowledgedAt) : undefined },
    { id: 'progress', label: done(3) ? 'Đã xử lý' : 'Đang xử lý', time: done(3) ? resolved : undefined },
    { id: 'done', label: 'Hoàn thành', time: done(4) ? resolved : undefined },
  ];
  return { steps, completed, current: completed < 5 ? completed : null };
}
