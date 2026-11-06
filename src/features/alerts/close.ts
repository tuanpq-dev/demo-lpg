/*
 * "Xác nhận đóng cảnh báo" (ảnh `scratch/figma-ref/alert-close-modal-*.png`, 28/10/2026) – thuần, có test (close.test.ts).
 * Đã xử lý (resolved) → Hoàn thành (done) CHỈ qua `closeAlert`; "Tiếp tục theo dõi" (`continueMonitoring`) giữ Đã xử lý.
 *
 * 3 điều kiện DO HỆ THỐNG KIỂM TRA (UI tự tick khi đúng, không cho tick khi sai):
 *   stable     – thiết bị ổn định: tín hiệu chính đọc được, đầu báo (cháy) trực tuyến + đã phục hồi, tín hiệu phụ không bất thường
 *   in-range   – giá trị live của tag chính trong ngưỡng (theo chiều cảnh báo)
 *   no-related – không còn cảnh báo ĐANG MỞ (Chưa xác nhận / Đang xử lý) cùng thiết bị hoặc cùng khu
 * Loại không có tag trực tiếp → stable/in-range đạt kèm ghi chú "không có số trực tiếp" (hệ thống không có gì để kiểm).
 * Người đóng: mức Nghiêm trọng thì người đóng phải KHÁC người xử lý (`resolvedBy`, thiếu → người phụ trách). TODO(backend):
 * kiểm tra vai trò người đóng ở API (FE chỉ là UX).
 */
import type { AlertFollowUp, AlertRecord } from '@/features/alerts/types';
import type { FollowUpConfig } from '@/features/alerts/kinds';
import { plantTimeOfDay } from '@/lib/plantTime';
import type { DetectorAlarm, DetectorDevice } from './fire';
import { formatMeasure } from './gauge';
import type { LiveState } from './pressure';
import { followUpUntil } from './update';
import { newNote, planBulk, withHistory, type AlertActionCtx } from './workflow';

export type CloseConditionId = 'stable' | 'in-range' | 'no-related';
export const SYSTEM_CONDITION_LABEL: Record<CloseConditionId, string> = {
  stable: 'Thiết bị đã trở về trạng thái ổn định',
  'in-range': 'Giá trị cảm biến đã nằm trong ngưỡng cho phép',
  'no-related': 'Không còn cảnh báo liên quan đang hoạt động',
};
/** 2 mục tick tay, không bắt buộc (ảnh). */
export const CLOSE_MANUAL_ITEMS = [
  { id: 'result-recorded', text: 'Kết quả xử lý đã được ghi nhận đầy đủ' },
  { id: 'log-updated', text: 'Nhật ký vận hành đã được cập nhật' },
] as const;

export type RelatedAlert = Pick<AlertRecord, 'id' | 'code' | 'message'>;
export type CloseCondition = {
  id: CloseConditionId;
  ok: boolean;
  /** Sai: lý do (hiện cạnh ô, aria-describedby). Đúng: ghi chú phụ nếu có (vd không có số trực tiếp). */
  reason?: string;
  /** no-related: cảnh báo đang mở liên quan (link). */
  related?: readonly RelatedAlert[];
};

export type ReadingState = { state: LiveState; value?: number };
export type CloseConditionInput = {
  /** Tag chính + ngưỡng đóng (null = loại không có số trực tiếp). */
  primary: { label: string; reading: ReadingState; limit: number; unit: string; direction: 'above' | 'below' } | null;
  /** Tín hiệu phụ (dòng thông số khác / cảm biến cùng khu / khói…) đã đánh giá sẵn. Mất tín hiệu không chặn. */
  secondary: readonly { label: string; state: 'ok' | 'abnormal' | 'lost' | 'pending' }[];
  /** Báo cháy: trạng thái đầu báo. */
  detector?: { name: string; alarm: DetectorAlarm; device: DetectorDevice };
  related: readonly RelatedAlert[];
};

const OPEN = new Set<AlertRecord['status']>(['unacknowledged', 'in-progress']);

/** Cảnh báo ĐANG MỞ (Chưa xác nhận / Đang xử lý) khác cùng thiết bị hoặc cùng khu – mới nhất trước theo thứ tự danh sách. */
export function relatedOpenAlerts(a: Pick<AlertRecord, 'id' | 'device' | 'area'>, all: readonly AlertRecord[]): RelatedAlert[] {
  return all.filter((x) => x.id !== a.id && OPEN.has(x.status) && (x.device === a.device || x.area === a.area)).map(({ id, code, message }) => ({ id, code, message }));
}

const NO_LIVE = 'Không có số trực tiếp cho cảnh báo này – theo kết quả xử lý đã ghi.';

function stableCondition(c: CloseConditionInput): CloseCondition {
  const fail = (reason: string): CloseCondition => ({ id: 'stable', ok: false, reason });
  const d = c.detector;
  if (d) {
    if (d.device === 'pending') return fail(`Đang đọc trạng thái đầu báo ${d.name}…`);
    if (d.device === 'lost') return fail(`Đầu báo ${d.name} mất kết nối – chưa xác nhận được trạng thái ổn định.`);
    if (d.device === 'fault') return fail(`Đầu báo ${d.name} báo lỗi thiết bị.`);
    if (d.alarm === 'active') return fail(`Đầu báo ${d.name} vẫn đang báo động.`);
    if (d.alarm === 'unknown') return fail(`Không đọc được trạng thái báo động của ${d.name}.`);
  }
  const p = c.primary;
  if (p?.reading.state === 'pending') return fail('Đang đọc số liệu trực tiếp…');
  if (p && p.reading.state !== 'ok') return fail(`${p.label} mất tín hiệu – chưa xác nhận được trạng thái ổn định.`);
  const bad = c.secondary.filter((s) => s.state === 'abnormal').map((s) => s.label);
  if (bad.length) return fail(`Còn tín hiệu bất thường: ${bad.join(', ')}.`);
  if (c.secondary.some((s) => s.state === 'pending')) return fail('Đang đọc số liệu trực tiếp…');
  return { id: 'stable', ok: true, reason: !p && !d ? NO_LIVE : undefined };
}

function inRangeCondition(c: CloseConditionInput): CloseCondition {
  const p = c.primary;
  if (!p) return { id: 'in-range', ok: true, reason: NO_LIVE };
  const fail = (reason: string): CloseCondition => ({ id: 'in-range', ok: false, reason });
  if (p.reading.state === 'pending') return fail('Đang đọc số liệu trực tiếp…');
  if (p.reading.state !== 'ok' || p.reading.value === undefined) return fail(`${p.label} mất tín hiệu – không kiểm tra được ngưỡng.`);
  const v = p.reading.value;
  const f = (n: number) => formatMeasure(n, p.unit);
  const ok = p.direction === 'above' ? v < p.limit : v > p.limit;
  return ok ? { id: 'in-range', ok: true } : fail(`${p.label} hiện tại ${f(v)} chưa ${p.direction === 'above' ? 'dưới' : 'trên'} ngưỡng ${f(p.limit)}.`);
}

/** 3 điều kiện hệ thống theo thứ tự ảnh. */
export function closeConditions(c: CloseConditionInput): CloseCondition[] {
  const rel: CloseCondition =
    c.related.length === 0
      ? { id: 'no-related', ok: true }
      : { id: 'no-related', ok: false, reason: `Còn ${c.related.length} cảnh báo đang mở cùng thiết bị/khu: ${c.related.map((r) => r.code).join(', ')}.`, related: c.related };
  return [stableCondition(c), inRangeCondition(c), rel];
}

export const allConditionsOk = (list: readonly CloseCondition[]) => list.length > 0 && list.every((x) => x.ok);

/** Người xử lý = người đánh dấu Đã xử lý (thiếu → người phụ trách). */
export const resolverOf = (a: Pick<AlertRecord, 'resolvedBy' | 'assignee'>) => a.resolvedBy ?? a.assignee ?? null;

/** Mức Nghiêm trọng: người đóng phải khác người xử lý. Mức khác: người xử lý tự đóng được. */
export function closerCheck(a: Pick<AlertRecord, 'severity' | 'resolvedBy' | 'assignee'>, closer: string): { ok: true } | { ok: false; reason: string } {
  const resolver = resolverOf(a);
  if (a.severity === 'critical' && resolver && resolver === closer.trim())
    return { ok: false, reason: `Cảnh báo Nghiêm trọng: người đóng phải khác người xử lý (${resolver}).` };
  return { ok: true };
}

/**
 * Theo dõi theo lựa chọn ở modal đóng: 0 → không theo dõi · giữ số phút cũ và chưa hết giờ → giữ nguyên · còn lại → khoảng
 * mới tính từ lúc lưu (mục tiêu + người theo dõi giữ như cũ, thiếu → cấu hình loại / người xử lý).
 */
export function followUpFor(
  a: Pick<AlertRecord, 'followUp' | 'unit' | 'resolvedBy' | 'assignee'>,
  minutes: number,
  at: Date,
  cfg: Pick<FollowUpConfig, 'target'>,
  by: string,
): AlertFollowUp | undefined {
  if (minutes <= 0) return undefined;
  const cur = a.followUp;
  if (cur && cur.minutes === minutes && new Date(cur.until).getTime() > at.getTime()) return cur;
  const target = cur?.target ?? cfg.target;
  return {
    minutes,
    until: followUpUntil(at, minutes).toISOString(),
    ...(target !== undefined ? { target } : {}),
    unit: cur?.unit ?? a.unit,
    owner: cur?.owner ?? resolverOf(a) ?? by,
  };
}

export type CloseInput = { note: string; followUpMinutes: number; manualChecks: readonly string[] };
export type CloseFail = { ok: false; reason: 'status' | 'closer' | 'conditions' | 'note'; message: string };
export type CloseResult = { ok: true; record: AlertRecord } | CloseFail;

const hhmm = (iso: string) => plantTimeOfDay(new Date(iso)).slice(0, 5);

/** Kiểm tra trước khi đóng (dùng chung modal + hàm ghi). */
export function closeBlock(a: AlertRecord, conditions: readonly CloseCondition[], closer: string, note: string | null): CloseFail | null {
  if (a.status !== 'resolved') return { ok: false, reason: 'status', message: 'Chỉ đóng được cảnh báo Đã xử lý (chờ đóng).' };
  const c = closerCheck(a, closer);
  if (!c.ok) return { ok: false, reason: 'closer', message: c.reason };
  if (!allConditionsOk(conditions)) return { ok: false, reason: 'conditions', message: 'Chưa đủ 3 điều kiện hệ thống.' };
  if (note !== null && !note.trim()) return { ok: false, reason: 'note', message: 'Nhập ghi chú kết luận trước khi đóng.' };
  return null;
}

/** "Xác nhận đóng cảnh báo": Đã xử lý → Hoàn thành + người đóng + ghi chú kết luận (thành ghi chú) + MỘT dòng lịch sử. */
export function closeAlert(a: AlertRecord, input: CloseInput, conditions: readonly CloseCondition[], cfg: Pick<FollowUpConfig, 'target'>, ctx: AlertActionCtx): CloseResult {
  const block = closeBlock(a, conditions, ctx.by, input.note);
  if (block) return block;
  const note = input.note.trim();
  const followUp = followUpFor(a, input.followUpMinutes, ctx.at, cfg, ctx.by);
  return {
    ok: true,
    record: {
      ...a,
      status: 'done',
      closedAt: ctx.at.toISOString(),
      closedBy: ctx.by,
      closingNote: note,
      closeChecks: [...input.manualChecks],
      followUp,
      notes: [...(a.notes ?? []), newNote(a, `Kết luận: ${note}`, ctx)],
      history: withHistory(a, 'close', `Xác nhận đóng cảnh báo${followUp ? ` · theo dõi đến ${hhmm(followUp.until)}` : ''}: ${note}`, ctx),
    },
  };
}

export type MonitorResult = { ok: true; record: AlertRecord } | { ok: false; reason: 'status' | 'minutes'; message: string };

/** "Tiếp tục theo dõi": giữ Đã xử lý + MỘT giá trị theo dõi (bắt buộc > 0 phút); ghi chú không bắt buộc. */
export function continueMonitoring(a: AlertRecord, input: { minutes: number; note: string }, cfg: Pick<FollowUpConfig, 'target'>, ctx: AlertActionCtx): MonitorResult {
  if (a.status !== 'resolved') return { ok: false, reason: 'status', message: 'Chỉ theo dõi tiếp cảnh báo Đã xử lý (chờ đóng).' };
  const followUp = followUpFor(a, input.minutes, ctx.at, cfg, ctx.by);
  if (!followUp) return { ok: false, reason: 'minutes', message: 'Chọn thời gian theo dõi để tiếp tục theo dõi.' };
  const note = input.note.trim();
  return {
    ok: true,
    record: {
      ...a,
      followUp,
      notes: note ? [...(a.notes ?? []), newNote(a, note, ctx)] : a.notes,
      history: withHistory(a, 'monitor', `Tiếp tục theo dõi đến ${hhmm(followUp.until)}${note ? `: ${note}` : ''}`, ctx),
    },
  };
}

// ---- Đóng hàng loạt ----

export type BulkCloseSkip = 'status' | 'conditions' | 'closer';
const SKIP_TEXT: Record<BulkCloseSkip, string> = {
  status: 'không ở trạng thái Chờ đóng',
  conditions: 'chưa đủ điều kiện hệ thống',
  closer: 'Nghiêm trọng – người đóng là người xử lý',
};

/**
 * Chỉ dòng Đã xử lý ĐỦ 3 điều kiện hệ thống; bỏ qua dòng Nghiêm trọng nếu người đóng là người xử lý. Thứ tự theo `ids`;
 * id không tồn tại tính là "không ở trạng thái Chờ đóng".
 */
export function planBulkClose(
  alerts: readonly AlertRecord[],
  ids: readonly string[],
  conditionsOf: (a: AlertRecord) => readonly CloseCondition[],
  closer: string,
): { eligible: string[]; skipped: { id: string; reason: BulkCloseSkip }[] } {
  const byId = new Map(alerts.map((a) => [a.id, a]));
  const skipped: { id: string; reason: BulkCloseSkip }[] = [];
  const { eligible } = planBulk(alerts, ids, (a) => {
    const b = closeBlock(a, conditionsOf(a), closer, null);
    if (b) skipped.push({ id: a.id, reason: b.reason as BulkCloseSkip });
    return !b;
  });
  for (const id of ids) if (!byId.has(id)) skipped.push({ id, reason: 'status' });
  return { eligible, skipped };
}

/** "Đã đóng 2 · bỏ qua 1 (1 chưa đủ điều kiện hệ thống)". */
export function bulkCloseMessage(done: number, skipped: readonly { reason: BulkCloseSkip }[]): string {
  if (!skipped.length) return `Đã đóng ${done}`;
  const counts = new Map<BulkCloseSkip, number>();
  for (const s of skipped) counts.set(s.reason, (counts.get(s.reason) ?? 0) + 1);
  const why = [...counts].map(([r, n]) => `${n} ${SKIP_TEXT[r]}`).join('; ');
  return `Đã đóng ${done} · bỏ qua ${skipped.length} (${why})`;
}
