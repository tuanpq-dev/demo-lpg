/*
 * "Cập nhật xử lý" – KHUNG CHUNG mọi loại có `update.kind = 'alert-update'` (áp suất theo ảnh 28/10/2026; gas, cháy dựng theo
 * khung đó – docs/guide/alerts.md (4o)). Thuần, có test (update.test.ts). Thời điểm + người thao tác truyền vào (`ctx`,
 * `savedAt`); số live do UI đọc rồi truyền vào (`CloseRuleInput`) – hàm kiểm lại.
 *
 * Ô trạng thái ↔ bản ghi:
 *   Đang kiểm tra / Đang xử lý = in-progress + phase (inspecting | resolving)
 *   Tạm dừng   = in-progress + hold paused (lý do bắt buộc)
 *   Cần hỗ trợ = in-progress + hold needs-support (lý do + người hỗ trợ bắt buộc → người phối hợp)
 *   Đã xử lý (cháy: Đã xử lý sự cố / Báo động giả) = resolved (chờ xác nhận đóng) – CHỈ khi đủ điều kiện của loại
 *   (`updateCloseCheck`: áp suất / gas / cháy giữ nguyên như modal cũ). Hoàn thành chỉ qua `close.ts`.
 */
import type { AlertFollowUp, AlertRecord, VerificationSource } from '@/features/alerts/types';
import type { AlertUpdateConfig, UpdateStateId } from '@/features/alerts/kinds';
import { plantTimeOfDay } from '@/lib/plantTime';
import { canCloseGas } from './bands';
import { canCloseFire, type DetectorAlarm, type DetectorDevice } from './fire';
import { formatMeasure } from './gauge';
import { inspectionErrors, writeInspection, type InspectionEntry } from './inspection';
import { canClosePressure, hasGauge, type LiveState } from './pressure';
import { canResolve, newNote, withHistory, type AlertActionCtx } from './workflow';

export type { VerificationSource, LiveState };
export { hasGauge };

export type UpdateState = UpdateStateId;

const UPDATE_STATES: readonly UpdateState[] = ['inspecting', 'resolving', 'paused', 'needs-support', 'resolved', 'false-alarm'];
const DEFAULT_STATE_LABEL: Record<UpdateState, string> = {
  inspecting: 'Đang kiểm tra',
  resolving: 'Đang xử lý',
  paused: 'Tạm dừng',
  'needs-support': 'Cần hỗ trợ',
  resolved: 'Đã xử lý',
  'false-alarm': 'Báo động giả',
};
export const stateLabel = (cfg: Pick<AlertUpdateConfig, 'stateLabels'>, s: UpdateState) => cfg.stateLabels?.[s] ?? DEFAULT_STATE_LABEL[s];
/** Ô đưa cảnh báo tới Đã xử lý (resolved). */
export const isResolvedState = (s: UpdateState) => s === 'resolved' || s === 'false-alarm';

/** Nhãn cờ dưới badge trạng thái (drawer + bảng). */
export const ALERT_HOLD_LABEL = { paused: 'Tạm dừng', 'needs-support': 'Cần hỗ trợ' } as const;

const DEFAULT_SOURCES: Record<VerificationSource, string> = { sensor: 'Cảm biến (SCADA)', gauge: 'Đồng hồ cơ', both: 'Cả hai' };
export const sourceLabel = (cfg: Pick<AlertUpdateConfig, 'sources'>, s: VerificationSource) => (cfg.sources ?? DEFAULT_SOURCES)[s];

/** Ô hiện tại theo bản ghi. Đã xử lý / Hoàn thành → resolved (báo động giả → false-alarm). Thiếu phase (bản ghi cũ) = Đang kiểm tra. */
export function updateStateOf(a: Pick<AlertRecord, 'status' | 'phase' | 'hold' | 'resolution'>): UpdateState {
  if (a.status === 'resolved' || a.status === 'done') return a.resolution?.kind === 'false-alarm' ? 'false-alarm' : 'resolved';
  if (a.hold) return a.hold.kind;
  return a.phase ?? 'inspecting';
}

/** Trường bản ghi theo ô chọn (`phase` không có → giữ phase cũ khi tạm dừng / cần hỗ trợ). */
function updateStateFields(
  state: UpdateState,
  reason: string,
  at: string,
): Pick<AlertRecord, 'status' | 'phase' | 'hold'> | Pick<AlertRecord, 'status' | 'hold'> {
  if (state === 'inspecting' || state === 'resolving') return { status: 'in-progress', phase: state, hold: undefined };
  if (state === 'paused' || state === 'needs-support') return { status: 'in-progress', hold: { kind: state, reason: reason.trim(), at } };
  return { status: 'resolved', hold: undefined };
}

// ---- Điều kiện chọn "Đã xử lý" theo loại ----

export type CloseBasis = 'live' | 'measured' | 'field';
export type UpdateClose =
  | { ok: true; /** Số sau xử lý (áp suất / gas). */ value?: number; basis: CloseBasis }
  | { ok: false; reason: string; message: string };

export type CloseRuleInput = {
  liveState: LiveState;
  live?: number;
  /** "Sau xử lý" của dòng chính (live hoặc số đo tay). */
  after?: number;
  /** "Sau" là số đo tay (nguồn có đồng hồ cơ / máy đo cầm tay). */
  manual?: boolean;
  source: VerificationSource;
  /** Ngưỡng đóng (áp suất = ngưỡng cảnh báo; gas = đầu mức `closeBelow`). */
  limit: number;
  unit: string;
  /** Báo cháy: trạng thái đầu báo + đã kiểm tra tại chỗ (mục xác minh role field). */
  detector?: { alarm: DetectorAlarm; device: DetectorDevice; name: string };
  fieldChecked?: boolean;
};

/** Điều kiện của loại (giữ nguyên như modal cũ): áp suất `canClosePressure` · gas `canCloseGas` · cháy `canCloseFire`. */
export function updateCloseCheck(rule: AlertUpdateConfig['close'], c: CloseRuleInput): UpdateClose {
  if (rule.rule === 'pressure') {
    const r = canClosePressure({ liveState: c.liveState, live: c.live, after: c.after, source: c.source, warn: c.limit, unit: c.unit });
    return r.ok ? { ok: true, value: r.value, basis: c.source === 'sensor' ? 'live' : 'measured' } : r;
  }
  if (rule.rule === 'gas') {
    if (c.liveState === 'pending') return { ok: false, reason: 'pending', message: 'Đang đọc nồng độ hiện tại…' };
    const lost = c.liveState !== 'ok' || c.live === undefined;
    if (lost && !hasGauge(c.source))
      return { ok: false, reason: 'need-gauge', message: 'Cảm biến mất tín hiệu – chọn nguồn xác minh có "Máy đo cầm tay" và nhập nồng độ đo lại.' };
    const r = canCloseGas({ live: lost ? undefined : c.live, measured: c.manual ? c.after : undefined, limit: c.limit, unit: c.unit });
    return r.ok ? { ok: true, value: r.value, basis: r.source } : r;
  }
  const d = c.detector ?? { alarm: 'unknown' as const, device: 'pending' as const, name: '' };
  const r = canCloseFire({ alarm: d.alarm, device: d.device, fieldChecked: c.fieldChecked, detector: d.name });
  return r.ok ? { ok: true, basis: r.source } : r;
}

/** Màu số theo ngưỡng cấu hình: ≥ nguy hiểm → danger · ≥ cảnh báo → warning. Không có ngưỡng / không có số → normal. */
export function readingTone(value: number | undefined, warn?: number, danger?: number): 'danger' | 'warning' | 'normal' {
  if (value === undefined) return 'normal';
  if (danger !== undefined && value >= danger) return 'danger';
  if (warn !== undefined && value >= warn) return 'warning';
  return 'normal';
}

// ---- Kết quả xác minh ----

const roleItem = (cfg: Pick<AlertUpdateConfig, 'verification'>, role: string) => cfg.verification.find((v) => v.role === role);
export const normalItemId = (cfg: Pick<AlertUpdateConfig, 'verification'>) => roleItem(cfg, 'normal')?.id;
export const fieldItemId = (cfg: Pick<AlertUpdateConfig, 'verification'>) => roleItem(cfg, 'field')?.id;

/**
 * Mâu thuẫn bị chặn: mục role normal khi chưa đủ điều kiện · normal cùng lúc với over · chọn Đã xử lý mà chưa chọn mục normal
 * bắt buộc (`required`) · "Có cháy thật" (real-fire) cùng lúc với ô "Báo động giả".
 */
function verificationErrors(
  selected: readonly string[],
  cfg: Pick<AlertUpdateConfig, 'verification' | 'normalHint' | 'stateLabels'>,
  closeOk: boolean,
  state: UpdateState,
  text: (id: string) => string,
): string[] {
  const normal = roleItem(cfg, 'normal');
  const over = roleItem(cfg, 'over');
  const fire = roleItem(cfg, 'real-fire');
  const has = (id?: string) => !!id && selected.includes(id);
  const out: string[] = [];
  if (normal && has(normal.id) && !closeOk) out.push(`Chỉ chọn "${text(normal.id)}" khi ${cfg.normalHint ?? 'đủ điều kiện "Đã xử lý"'}.`);
  if (normal && over && has(normal.id) && has(over.id)) out.push(`"${text(over.id)}" mâu thuẫn với "${text(normal.id)}" – bỏ một mục.`);
  if (isResolvedState(state) && normal?.required && !has(normal.id)) out.push(`Chọn "${text(normal.id)}" khi đánh dấu ${stateLabel(cfg, state)}.`);
  if (state === 'false-alarm' && fire && has(fire.id)) out.push(`"${text(fire.id)}" mâu thuẫn với "${stateLabel(cfg, 'false-alarm')}" – bỏ một mục.`);
  return out;
}

// ---- Theo dõi sau xử lý ----

export type FollowUpChoice = number | 'custom';

/** Thời điểm kiểm tra lại = lúc lưu + số phút. */
export const followUpUntil = (savedAt: Date, minutes: number) => new Date(savedAt.getTime() + minutes * 60_000);

/** Khoảng theo dõi thực tế (0 phút → null). Tùy chỉnh: thời điểm phải sau lúc lưu (không thì null). */
export function followUpWindow(choice: FollowUpChoice, customAt: string | undefined, savedAt: Date): { minutes: number; until: Date } | null {
  if (choice === 'custom') {
    const t = customAt ? new Date(customAt) : null;
    if (!t || Number.isNaN(t.getTime()) || t.getTime() <= savedAt.getTime()) return null;
    return { minutes: Math.round((t.getTime() - savedAt.getTime()) / 60_000), until: t };
  }
  return choice > 0 ? { minutes: choice, until: followUpUntil(savedAt, choice) } : null;
}

export const followUpChoiceLabel = (c: FollowUpChoice) =>
  c === 'custom' ? 'Tùy chỉnh' : c === 0 ? 'Không cần theo dõi thêm' : c < 60 ? `Theo dõi thêm ${c} phút` : `Theo dõi thêm ${c / 60} giờ`;

/** Nhãn ngắn của thời gian theo dõi (select ở modal đóng): "30 phút", "2 Giờ", "Không theo dõi". */
export const followUpDurationLabel = (m: number) =>
  m === 0 ? 'Không theo dõi' : m < 60 ? `${m} phút` : m % 60 === 0 ? `${m / 60} Giờ` : `${Math.floor(m / 60)} Giờ ${m % 60} phút`;

const hhmm = (iso: string) => plantTimeOfDay(new Date(iso)).slice(0, 5);

/** "Đang theo dõi đến HH:MM[, mục tiêu < 10 bar]" – Đã xử lý hoặc Hoàn thành có theo dõi và chưa hết giờ. */
export function followUpLabel(a: Pick<AlertRecord, 'status' | 'followUp'>, now: Date): string | null {
  const f = a.followUp;
  if ((a.status !== 'done' && a.status !== 'resolved') || !f || new Date(f.until).getTime() <= now.getTime()) return null;
  return `Đang theo dõi đến ${hhmm(f.until)}${f.target !== undefined ? `, mục tiêu < ${formatMeasure(f.target, f.unit)}` : ''}`;
}

/** Hết giờ theo dõi mà vẫn chờ đóng → chip "Đến giờ kiểm tra lại". */
export function followUpDue(a: Pick<AlertRecord, 'status' | 'followUp'>, now: Date): boolean {
  return a.status === 'resolved' && !!a.followUp && new Date(a.followUp.until).getTime() <= now.getTime();
}
export const FOLLOW_UP_DUE_LABEL = 'Đến giờ kiểm tra lại';

// ---- Form ----

export type UpdateFile = { name: string; size: number; kind: 'image' | 'document' };
export type UpdateReadingInput = { id: string; before?: number; after?: number; manual?: boolean };

export type AlertUpdateInput = {
  state: UpdateState;
  /** Lý do tạm dừng / cần hỗ trợ. */
  holdReason: string;
  supportPeople: readonly string[];
  inspection: Readonly<Record<string, InspectionEntry>>;
  readings: { source: VerificationSource; /** ISO */ at: string; rows: readonly UpdateReadingInput[] };
  verification: readonly string[];
  cause: string;
  actionTaken: string;
  issue: { kind: string; note: string };
  files: readonly UpdateFile[];
  followUp: { choice: FollowUpChoice; /** ISO – chỉ khi Tùy chỉnh */ customAt?: string; target?: number; owner: string };
};

export type UpdateCheck = {
  close: UpdateClose;
  config: AlertUpdateConfig;
  /** Hạng mục (chữ đã điền) – tên trong cảnh báo/lịch sử. */
  steps: readonly { id: string; text: string }[];
  /** Chữ đã điền của mục xác minh. */
  verificationText: (id: string) => string;
  unit: string;
};

export type UpdateErrors = Partial<
  Record<'state' | 'holdReason' | 'supportPeople' | 'cause' | 'actionTaken' | 'issueNote' | 'verification' | 'close' | 'followUp', string>
> & {
  inspection?: Record<string, string>;
};

export const hasErrors = (e: UpdateErrors) => Object.entries(e).some(([k, v]) => (k === 'inspection' ? Object.keys(v as object).length > 0 : !!v));

/** Tạm dừng / cần hỗ trợ: lý do (+ người hỗ trợ). */
function holdErrors(input: AlertUpdateInput): UpdateErrors {
  const e: UpdateErrors = {};
  if (input.state === 'paused' && !input.holdReason.trim()) e.holdReason = 'Nhập lý do tạm dừng.';
  if (input.state === 'needs-support') {
    if (!input.supportPeople.length) e.supportPeople = 'Chọn người hỗ trợ.';
    if (!input.holdReason.trim()) e.holdReason = 'Nhập lý do cần hỗ trợ.';
  }
  return e;
}

/** Đã xử lý / báo động giả: nguyên nhân + nội dung đã xử lý + theo dõi sau xử lý. */
function resolvedErrors(input: AlertUpdateInput, check: UpdateCheck, savedAt: Date): UpdateErrors {
  const e: UpdateErrors = {};
  const label = stateLabel(check.config, input.state);
  if (!check.close.ok) e.close = check.close.message;
  if (!input.cause.trim()) e.cause = `Nhập nguyên nhân khi đánh dấu ${label}.`;
  if (!input.actionTaken.trim()) e.actionTaken = `Nhập nội dung đã xử lý khi đánh dấu ${label}.`;
  const followUp = followUpError(input.followUp, check.config.followUp.target !== undefined, savedAt);
  if (followUp) e.followUp = followUp;
  return e;
}

function followUpError(f: AlertUpdateInput['followUp'], needsTarget: boolean, savedAt: Date): string | undefined {
  if (f.choice === 'custom' && !followUpWindow(f.choice, f.customAt, savedAt)) return 'Chọn thời điểm kiểm tra lại sau thời điểm lưu.';
  if (f.choice === 0) return undefined;
  if (needsTarget && (f.target === undefined || f.target <= 0)) return 'Nhập giá trị mục tiêu.';
  if (!f.owner) return 'Chọn người chịu trách nhiệm theo dõi.';
  return undefined;
}

export function validateAlertUpdate(input: AlertUpdateInput, check: UpdateCheck, savedAt: Date): UpdateErrors {
  const s = input.state;
  const e: UpdateErrors = { ...holdErrors(input), ...(isResolvedState(s) ? resolvedErrors(input, check, savedAt) : {}) };
  if (!check.config.states.includes(s)) e.state = 'Trạng thái không áp dụng cho loại cảnh báo này.';
  const ins = inspectionErrors(input.inspection);
  if (Object.keys(ins).length) e.inspection = ins;
  const issue = check.config.issues.find((i) => i.id === input.issue.kind);
  if (issue?.needsNote && !input.issue.note.trim()) e.issueNote = 'Mô tả vấn đề phát sinh.';
  const ver = verificationErrors(input.verification, check.config, check.close.ok, s, check.verificationText);
  if (ver.length) e.verification = ver.join(' ');
  return e;
}

/** Cảnh báo KHÔNG chặn (aria-live ở modal). */
export function updateWarnings(input: AlertUpdateInput, check: UpdateCheck): string[] {
  const out: string[] = [];
  if (isResolvedState(input.state)) {
    const issues = check.steps.filter((x) => input.inspection[x.id]?.status === 'issue').map((x) => x.text);
    if (issues.length) out.push(`Còn hạng mục "Có vấn đề": ${issues.join(', ')}.`);
    const pending = check.steps.filter((x) => (input.inspection[x.id]?.status ?? 'pending') === 'pending').map((x) => x.text);
    if (pending.length) out.push(`Còn ${pending.length} hạng mục chưa kiểm tra: ${pending.join(', ')}.`);
    if (input.issue.kind === 'no-access' || input.issue.kind === 'missing-data') {
      const label = check.config.issues.find((i) => i.id === input.issue.kind)?.label;
      out.push(`Vấn đề phát sinh "${label}" – kiểm tra lại trước khi đóng cảnh báo.`);
    }
  }
  return out;
}

/** Gợi ý chuyển sang "Cần hỗ trợ" (vấn đề "Cần thêm nhân sự hỗ trợ" khi chưa ở Cần hỗ trợ). */
export function suggestsSupport(input: Pick<AlertUpdateInput, 'issue' | 'state'>, cfg: Pick<AlertUpdateConfig, 'issues'>): boolean {
  return input.state !== 'needs-support' && !!cfg.issues.find((i) => i.id === input.issue.kind)?.suggestSupport;
}

export type AlertUpdateResult = { ok: true; record: AlertRecord } | { ok: false; errors: UpdateErrors };

/** Lịch sử khi chọn Đã xử lý: số sau xử lý (áp suất / gas) hoặc căn cứ đầu báo (cháy) + theo dõi. */
function resolvedHistory(
  a: AlertRecord,
  input: AlertUpdateInput,
  check: UpdateCheck,
  close: Extract<UpdateClose, { ok: true }>,
  follow: AlertFollowUp | undefined,
): string {
  const f = (n: number) => formatMeasure(n, check.unit);
  const label = stateLabel(check.config, input.state);
  const head =
    check.config.close.rule === 'fire'
      ? `${label} (${close.basis === 'field' ? `đầu báo ${a.device} mất tín hiệu – đã kiểm tra tại chỗ` : `đầu báo ${a.device} đã phục hồi`})`
      : `${label} – ${check.config.quantity} sau xử lý ${f(close.value!)} (${sourceLabel(check.config, input.readings.source)})`;
  const tail = follow ? ` · theo dõi đến ${hhmm(follow.until)}${follow.target !== undefined ? `, mục tiêu < ${f(follow.target)}` : ''}` : '';
  return head + tail;
}

/**
 * "Lưu cập nhật": chỉ Đang xử lý; hợp lệ → hạng mục (guide), thông số, xác minh, vấn đề, nguyên nhân/nội dung, tệp (chỉ tên,
 * kích thước, loại – isTemp), trạng thái, người phối hợp (cần hỗ trợ), theo dõi (Đã xử lý) + MỘT ghi chú + MỘT dòng lịch sử.
 * Đã xử lý → resolved + `resolvedBy`; áp suất/gas lưu `closingReading`, cháy lưu `resolution` (thống kê báo động giả).
 */
export function alertUpdate(a: AlertRecord, input: AlertUpdateInput, check: UpdateCheck, ctx: AlertActionCtx): AlertUpdateResult {
  if (!canResolve(a)) return { ok: false, errors: { state: 'Cảnh báo không ở trạng thái Đang xử lý.' } };
  const errors = validateAlertUpdate(input, check, ctx.at);
  if (hasErrors(errors)) return { ok: false, errors };

  const at = ctx.at.toISOString();
  const s = input.state;
  const resolved = isResolvedState(s);
  const people = [...new Set(input.supportPeople.map((p) => p.trim()).filter(Boolean))];
  const followUp = resolved ? followUpOf(input, check, ctx.at) : undefined;
  const issueNote = input.issue.note.trim();

  const record: AlertRecord = {
    ...a,
    ...updateStateFields(s, input.holdReason, at),
    guide: check.steps.reduce((g, step) => {
      const e = input.inspection[step.id];
      return e ? writeInspection(g, step.id, e, ctx) : g;
    }, a.guide),
    readings: { source: input.readings.source, at: input.readings.at, rows: input.readings.rows.map((r) => ({ ...r })) },
    verification: [...input.verification],
    issue: input.issue.kind === 'none' ? undefined : { kind: input.issue.kind, ...(issueNote ? { note: issueNote } : {}) },
    cause: input.cause.trim() || a.cause,
    actionTaken: input.actionTaken.trim() || a.actionTaken,
    attachments: [...(a.attachments ?? []), ...input.files.map((x) => ({ name: x.name, size: x.size, kind: x.kind, isTemp: true }))],
    collaborators: s === 'needs-support' ? [...new Set([...(a.collaborators ?? []), ...people])] : a.collaborators,
    followUp,
    notes: [...(a.notes ?? []), newNote(a, updateNoteLines(input, check, people).join('\n'), ctx)],
    history: withHistory(a, historyKind(s), updateHistoryText(a, input, check, people, followUp), ctx),
  };
  const close = check.close;
  if (resolved && close.ok) {
    record.resolvedAt = at;
    record.resolvedBy = ctx.by;
    Object.assign(record, closeOutcome(check.config, s, close));
  }
  return { ok: true, record };
}

const isHold = (s: UpdateState) => s === 'paused' || s === 'needs-support';
const historyKind = (s: UpdateState) => (isResolvedState(s) ? 'resolve' : isHold(s) ? 'hold' : 'update');

/** Cửa sổ theo dõi sau xử lý (không chọn theo dõi → undefined). */
function followUpOf(input: AlertUpdateInput, check: UpdateCheck, at: Date): AlertFollowUp | undefined {
  const win = followUpWindow(input.followUp.choice, input.followUp.customAt, at);
  if (!win) return undefined;
  const target = check.config.followUp.target !== undefined ? input.followUp.target : undefined;
  return {
    minutes: win.minutes,
    until: win.until.toISOString(),
    ...(target !== undefined ? { target } : {}),
    unit: check.unit,
    owner: input.followUp.owner,
  };
}

/** Ghi chú của lần cập nhật: các phần có nội dung, mỗi phần một dòng. */
function updateNoteLines(input: AlertUpdateInput, check: UpdateCheck, people: readonly string[]): string[] {
  const s = input.state;
  const issueCfg = check.config.issues.find((i) => i.id === input.issue.kind);
  const issueNote = input.issue.note.trim();
  return [
    `Trạng thái: ${stateLabel(check.config, s)}`,
    isHold(s) ? `Lý do: ${input.holdReason.trim()}` : '',
    s === 'needs-support' ? `Người hỗ trợ: ${people.join(', ')}` : '',
    input.cause.trim() ? `Nguyên nhân: ${input.cause.trim()}` : '',
    input.actionTaken.trim() ? `Đã xử lý: ${input.actionTaken.trim()}` : '',
    issueCfg && issueCfg.id !== 'none' ? `Vấn đề phát sinh: ${issueCfg.label}${issueNote ? ` – ${issueNote}` : ''}` : '',
  ].filter(Boolean);
}

/** Một dòng lịch sử: kết quả xử lý · tạm dừng · cần hỗ trợ · tiếp tục · cập nhật. */
function updateHistoryText(
  a: AlertRecord,
  input: AlertUpdateInput,
  check: UpdateCheck,
  people: readonly string[],
  followUp: AlertFollowUp | undefined,
) {
  const s = input.state;
  const label = stateLabel(check.config, s);
  if (isResolvedState(s) && check.close.ok) return resolvedHistory(a, input, check, check.close, followUp);
  if (s === 'paused') return `Tạm dừng: ${input.holdReason.trim()}`;
  if (s === 'needs-support') return `Cần hỗ trợ: ${people.join(', ')} – ${input.holdReason.trim()}`;
  return isHold(updateStateOf(a)) ? `Tiếp tục xử lý (${label})` : `Cập nhật xử lý: ${label}`;
}

/** Kết quả đóng: cháy → `resolution` (thống kê báo động giả); áp suất/gas → `closingReading`. */
function closeOutcome(cfg: AlertUpdateConfig, s: UpdateState, close: Extract<UpdateClose, { ok: true }>): Partial<AlertRecord> {
  if (cfg.close.rule === 'fire')
    return { resolution: { kind: s === 'false-alarm' ? 'false-alarm' : 'handled', closedBy: close.basis === 'field' ? 'field' : 'live' } };
  if (close.value !== undefined) return { closingReading: { value: close.value, source: close.basis === 'live' ? 'live' : 'measured' } };
  return {};
}

// ---- Nháp (sessionStorage theo mã – `createSessionDraft` ở data/alertDetail) ----

export type UpdateDraft = Omit<AlertUpdateInput, 'files'> & { /** ISO */ savedAt: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Nháp sai dạng → null (coi như không có). Tệp tạm KHÔNG vào nháp (không giữ được File qua sessionStorage). */
export function parseUpdateDraft(raw: unknown): UpdateDraft | null {
  if (!isObj(raw)) return null;
  const { state, holdReason, supportPeople, inspection, readings, verification, cause, actionTaken, issue, followUp, savedAt } = raw;
  if (typeof state !== 'string' || !UPDATE_STATES.includes(state as UpdateState)) return null;
  if (typeof holdReason !== 'string' || typeof cause !== 'string' || typeof actionTaken !== 'string' || typeof savedAt !== 'string') return null;
  if (!Array.isArray(supportPeople) || !Array.isArray(verification) || !isObj(inspection) || !isObj(readings) || !isObj(issue) || !isObj(followUp))
    return null;
  if (!Array.isArray(readings.rows) || typeof readings.source !== 'string' || !(readings.source in DEFAULT_SOURCES)) return null;
  if (followUp.choice !== 'custom' && typeof followUp.choice !== 'number') return null;
  return raw as unknown as UpdateDraft;
}
