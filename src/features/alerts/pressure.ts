/*
 * "Cập nhật xử lý cảnh báo áp suất" (modal theo ảnh 28/10/2026, docs/guide/alerts.md (4o)) – thuần, có test (pressure.test.ts).
 * Thời điểm + người thao tác truyền vào (`ctx`, `savedAt`); số live do UI đọc rồi truyền vào (`CloseInput`) – hàm kiểm lại.
 *
 * Trạng thái xử lý (5 ô) ↔ bản ghi:
 *   Đang kiểm tra / Đang xử lý = in-progress + phase (inspecting | resolving)
 *   Tạm dừng   = in-progress + hold paused (lý do bắt buộc)
 *   Cần hỗ trợ = in-progress + hold needs-support (lý do + người hỗ trợ bắt buộc → người phối hợp)
 *   Đã xử lý   = done – CHỈ khi áp suất LIVE < ngưỡng cảnh báo VÀ giá trị "sau xử lý" < ngưỡng; mất tín hiệu → nguồn xác minh
 *                phải có đồng hồ cơ + số đo tay < ngưỡng.
 */
import type { AlertFollowUp, AlertPhase, AlertRecord, VerificationSource } from '@/mocks/alerts';
import type { PressureUpdateConfig } from '@/mocks/alertKinds';
import { plantTimeOfDay } from '@/lib/plantTime';
import { formatMeasure } from './gauge';
import { INSPECTION_STATUS_LABEL, inspectionErrors, writeInspection, type InspectionEntry } from './inspection';
import { canResolve, newNote, withHistory, type AlertActionCtx } from './workflow';

export type { VerificationSource };

export type PressureState = AlertPhase | 'paused' | 'needs-support' | 'resolved';

export const PRESSURE_STATES: readonly PressureState[] = ['inspecting', 'resolving', 'paused', 'needs-support', 'resolved'];
export const PRESSURE_STATE_LABEL: Record<PressureState, string> = {
  inspecting: 'Đang kiểm tra',
  resolving: 'Đang xử lý',
  paused: 'Tạm dừng',
  'needs-support': 'Cần hỗ trợ',
  resolved: 'Đã xử lý',
};
/** Nhãn cờ dưới badge trạng thái (drawer + bảng). */
export const ALERT_HOLD_LABEL = { paused: 'Tạm dừng', 'needs-support': 'Cần hỗ trợ' } as const;

export const SOURCE_LABEL: Record<VerificationSource, string> = { sensor: 'Cảm biến (SCADA)', gauge: 'Đồng hồ cơ', both: 'Cả hai' };
/** Nguồn có đồng hồ cơ → ô "Sau" sửa tay được; mất tín hiệu bắt buộc. */
export const hasGauge = (s: VerificationSource) => s !== 'sensor';

/** Trạng thái hiện tại của bản ghi theo 5 ô. Đang xử lý chưa có phase (bản ghi cũ) = Đang kiểm tra. */
export function pressureStateOf(a: Pick<AlertRecord, 'status' | 'phase' | 'hold'>): PressureState {
  if (a.status === 'done') return 'resolved';
  if (a.hold) return a.hold.kind;
  return a.phase ?? 'inspecting';
}

/** Trường bản ghi theo trạng thái chọn (`phase` không có → giữ phase cũ khi tạm dừng / cần hỗ trợ). */
export function pressureStateFields(state: PressureState, reason: string, at: string): Pick<AlertRecord, 'status' | 'phase' | 'hold'> | Pick<AlertRecord, 'status' | 'hold'> {
  if (state === 'inspecting' || state === 'resolving') return { status: 'in-progress', phase: state, hold: undefined };
  if (state === 'paused' || state === 'needs-support') return { status: 'in-progress', hold: { kind: state, reason: reason.trim(), at } };
  return { status: 'done', hold: undefined };
}

// ---- Điều kiện "Đã xử lý" ----

export type LiveState = 'ok' | 'lost' | 'pending' | 'none';
export type CloseInput = {
  liveState: LiveState;
  live?: number;
  /** Giá trị "sau xử lý" của dòng áp suất chính (live khi nguồn = cảm biến, số đo tay khi có đồng hồ cơ). */
  after?: number;
  source: VerificationSource;
  /** Ngưỡng cảnh báo (cấu hình tag; thiếu → ngưỡng bản ghi). */
  warn: number;
  unit: string;
};
export type CloseCheck =
  | { ok: true; value: number }
  | { ok: false; reason: 'pending' | 'live-high' | 'need-gauge' | 'need-after' | 'after-high'; message: string };

export function canClosePressure(c: CloseInput): CloseCheck {
  const f = (n: number) => formatMeasure(n, c.unit);
  if (c.liveState === 'pending') return { ok: false, reason: 'pending', message: 'Đang đọc áp suất hiện tại…' };
  const lost = c.liveState !== 'ok' || c.live === undefined;
  if (lost && !hasGauge(c.source))
    return { ok: false, reason: 'need-gauge', message: 'Mất tín hiệu áp suất – chọn nguồn xác minh có "Đồng hồ cơ" và nhập giá trị đo tay.' };
  if (!lost && c.live! >= c.warn) return { ok: false, reason: 'live-high', message: `Áp suất hiện tại ${f(c.live!)} vẫn chưa dưới ngưỡng cảnh báo ${f(c.warn)}.` };
  if (c.after === undefined)
    return { ok: false, reason: 'need-after', message: lost ? 'Nhập áp suất sau xử lý đo bằng đồng hồ cơ.' : 'Nhập áp suất sau xử lý.' };
  if (c.after >= c.warn) return { ok: false, reason: 'after-high', message: `Áp suất sau xử lý ${f(c.after)} vẫn chưa dưới ngưỡng cảnh báo ${f(c.warn)}.` };
  return { ok: true, value: c.after };
}

/** Màu số theo ngưỡng cấu hình: ≥ nguy hiểm → danger · ≥ cảnh báo → warning. Không có ngưỡng / không có số → normal. */
export function readingTone(value: number | undefined, warn?: number, danger?: number): 'danger' | 'warning' | 'normal' {
  if (value === undefined) return 'normal';
  if (danger !== undefined && value >= danger) return 'danger';
  if (warn !== undefined && value >= warn) return 'warning';
  return 'normal';
}

// ---- Kết quả xác minh ----

export const normalItemId = (cfg: PressureUpdateConfig) => cfg.verification.find((v) => v.role === 'normal')?.id;
const overItemId = (cfg: PressureUpdateConfig) => cfg.verification.find((v) => v.role === 'over')?.id;

/**
 * Mâu thuẫn bị chặn: "Hệ thống đã trở về bình thường" khi điều kiện đóng chưa đúng · cùng lúc với "Xác nhận áp suất thực
 * tế vượt ngưỡng" · chọn "Đã xử lý" mà chưa chọn "Hệ thống đã trở về bình thường".
 */
export function verificationErrors(selected: readonly string[], cfg: PressureUpdateConfig, closeOk: boolean, state: PressureState, text: (id: string) => string): string[] {
  const normal = normalItemId(cfg);
  const over = overItemId(cfg);
  const has = (id?: string) => !!id && selected.includes(id);
  const out: string[] = [];
  if (has(normal) && !closeOk) out.push(`Chỉ chọn "${text(normal!)}" khi áp suất hiện tại và sau xử lý đều dưới ngưỡng cảnh báo.`);
  if (has(normal) && has(over)) out.push(`"${text(over!)}" mâu thuẫn với "${text(normal!)}" – bỏ một mục.`);
  if (state === 'resolved' && normal && !has(normal)) out.push(`Chọn "${text(normal)}" khi đánh dấu Đã xử lý.`);
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

/** "Đang theo dõi đến HH:MM, mục tiêu < 10 bar" – chỉ khi đã đóng có theo dõi và chưa hết giờ. */
export function followUpLabel(a: Pick<AlertRecord, 'status' | 'followUp'>, now: Date): string | null {
  const f = a.followUp;
  if (a.status !== 'done' || !f || new Date(f.until).getTime() <= now.getTime()) return null;
  return `Đang theo dõi đến ${plantTimeOfDay(new Date(f.until)).slice(0, 5)}, mục tiêu < ${formatMeasure(f.target, f.unit)}`;
}

// ---- Form ----

export type PressureFile = { name: string; size: number; kind: 'image' | 'document' };
export type PressureReadingInput = { id: string; before?: number; after?: number; manual?: boolean };

export type PressureUpdateInput = {
  state: PressureState;
  /** Lý do tạm dừng / cần hỗ trợ. */
  holdReason: string;
  supportPeople: readonly string[];
  inspection: Readonly<Record<string, InspectionEntry>>;
  readings: { source: VerificationSource; /** ISO */ at: string; rows: readonly PressureReadingInput[] };
  verification: readonly string[];
  cause: string;
  actionTaken: string;
  issue: { kind: string; note: string };
  files: readonly PressureFile[];
  followUp: { choice: FollowUpChoice; /** ISO – chỉ khi Tùy chỉnh */ customAt?: string; target?: number; owner: string };
};

export type PressureCheck = {
  close: CloseCheck;
  config: PressureUpdateConfig;
  /** Hạng mục (chữ đã điền) – tên trong cảnh báo/lịch sử. */
  steps: readonly { id: string; text: string }[];
  /** Chữ đã điền của mục xác minh. */
  verificationText: (id: string) => string;
  unit: string;
};

export type PressureErrors = Partial<Record<'state' | 'holdReason' | 'supportPeople' | 'cause' | 'actionTaken' | 'issueNote' | 'verification' | 'close' | 'followUp', string>> & {
  inspection?: Record<string, string>;
};

export const hasErrors = (e: PressureErrors) => Object.entries(e).some(([k, v]) => (k === 'inspection' ? Object.keys(v as object).length > 0 : !!v));

export function validatePressureUpdate(input: PressureUpdateInput, check: PressureCheck, savedAt: Date): PressureErrors {
  const e: PressureErrors = {};
  const s = input.state;
  if (s === 'resolved' && !check.close.ok) e.close = check.close.message;
  if (s === 'paused' && !input.holdReason.trim()) e.holdReason = 'Nhập lý do tạm dừng.';
  if (s === 'needs-support') {
    if (!input.supportPeople.length) e.supportPeople = 'Chọn người hỗ trợ.';
    if (!input.holdReason.trim()) e.holdReason = 'Nhập lý do cần hỗ trợ.';
  }
  if (s === 'resolved') {
    if (!input.cause.trim()) e.cause = 'Nhập nguyên nhân khi đánh dấu Đã xử lý.';
    if (!input.actionTaken.trim()) e.actionTaken = 'Nhập nội dung đã xử lý khi đánh dấu Đã xử lý.';
  }
  const ins = inspectionErrors(input.inspection);
  if (Object.keys(ins).length) e.inspection = ins;
  const issue = check.config.issues.find((i) => i.id === input.issue.kind);
  if (issue?.needsNote && !input.issue.note.trim()) e.issueNote = 'Mô tả vấn đề phát sinh.';
  const ver = verificationErrors(input.verification, check.config, check.close.ok, s, check.verificationText);
  if (ver.length) e.verification = ver.join(' ');
  if (s === 'resolved') {
    const f = input.followUp;
    if (f.choice === 'custom' && !followUpWindow(f.choice, f.customAt, savedAt)) e.followUp = 'Chọn thời điểm kiểm tra lại sau thời điểm lưu.';
    else if (f.choice !== 0 && (f.target === undefined || f.target <= 0)) e.followUp = 'Nhập giá trị mục tiêu.';
    else if (f.choice !== 0 && !f.owner) e.followUp = 'Chọn người chịu trách nhiệm theo dõi.';
  }
  return e;
}

/** Cảnh báo KHÔNG chặn (aria-live ở modal). */
export function pressureWarnings(input: PressureUpdateInput, check: PressureCheck): string[] {
  const out: string[] = [];
  const name = (id: string) => check.steps.find((x) => x.id === id)?.text ?? id;
  if (input.state === 'resolved') {
    const issues = check.steps.filter((x) => input.inspection[x.id]?.status === 'issue').map((x) => x.text);
    if (issues.length) out.push(`Còn hạng mục "Có vấn đề": ${issues.join(', ')}.`);
    const pending = check.steps.filter((x) => (input.inspection[x.id]?.status ?? 'pending') === 'pending').map((x) => name(x.id));
    if (pending.length) out.push(`Còn ${pending.length} hạng mục chưa kiểm tra: ${pending.join(', ')}.`);
    if (input.issue.kind === 'no-access' || input.issue.kind === 'missing-data') {
      const label = check.config.issues.find((i) => i.id === input.issue.kind)?.label;
      out.push(`Vấn đề phát sinh "${label}" – kiểm tra lại trước khi đóng cảnh báo.`);
    }
  }
  return out;
}

/** Gợi ý chuyển sang "Cần hỗ trợ" (vấn đề "Cần thêm nhân sự hỗ trợ" khi chưa ở Cần hỗ trợ). */
export function suggestsSupport(input: Pick<PressureUpdateInput, 'issue' | 'state'>, cfg: PressureUpdateConfig): boolean {
  return input.state !== 'needs-support' && !!cfg.issues.find((i) => i.id === input.issue.kind)?.suggestSupport;
}

export type PressureUpdateResult = { ok: true; record: AlertRecord } | { ok: false; errors: PressureErrors };

/**
 * "Lưu cập nhật": chỉ Đang xử lý; hợp lệ → hạng mục (guide), thông số, xác minh, vấn đề, nguyên nhân/nội dung, tệp (chỉ tên,
 * kích thước, loại – isTemp), trạng thái, người phối hợp (cần hỗ trợ), theo dõi (Đã xử lý) + MỘT ghi chú + MỘT dòng lịch sử.
 */
export function pressureUpdate(a: AlertRecord, input: PressureUpdateInput, check: PressureCheck, ctx: AlertActionCtx): PressureUpdateResult {
  if (!canResolve(a)) return { ok: false, errors: { state: 'Cảnh báo không ở trạng thái Đang xử lý.' } };
  const errors = validatePressureUpdate(input, check, ctx.at);
  if (hasErrors(errors)) return { ok: false, errors };

  const at = ctx.at.toISOString();
  const s = input.state;
  const before = pressureStateOf(a);
  let guide = a.guide;
  for (const step of check.steps) {
    const e = input.inspection[step.id];
    if (e) guide = writeInspection(guide, step.id, e, ctx);
  }
  const issueCfg = check.config.issues.find((i) => i.id === input.issue.kind);
  const people = [...new Set(input.supportPeople.map((p) => p.trim()).filter(Boolean))];
  const win = s === 'resolved' ? followUpWindow(input.followUp.choice, input.followUp.customAt, ctx.at) : null;
  const followUp: AlertFollowUp | undefined =
    win && input.followUp.target !== undefined
      ? { minutes: win.minutes, until: win.until.toISOString(), target: input.followUp.target, unit: check.unit, owner: input.followUp.owner }
      : undefined;

  // Ghi chú: các phần có nội dung, mỗi phần một dòng.
  const noteLines = [
    `Trạng thái: ${PRESSURE_STATE_LABEL[s]}`,
    s === 'paused' || s === 'needs-support' ? `Lý do: ${input.holdReason.trim()}` : '',
    s === 'needs-support' ? `Người hỗ trợ: ${people.join(', ')}` : '',
    input.cause.trim() ? `Nguyên nhân: ${input.cause.trim()}` : '',
    input.actionTaken.trim() ? `Đã xử lý: ${input.actionTaken.trim()}` : '',
    issueCfg && issueCfg.id !== 'none' ? `Vấn đề phát sinh: ${issueCfg.label}${input.issue.note.trim() ? ` – ${input.issue.note.trim()}` : ''}` : '',
  ].filter(Boolean);

  const f = (n: number) => formatMeasure(n, check.unit);
  const historyText =
    s === 'resolved'
      ? `Đã xử lý – áp suất sau xử lý ${f((check.close as { value: number }).value)} (${SOURCE_LABEL[input.readings.source]})${followUp ? ` · theo dõi đến ${plantTimeOfDay(win!.until).slice(0, 5)}, mục tiêu < ${f(followUp.target)}` : ''}`
      : s === 'paused'
        ? `Tạm dừng: ${input.holdReason.trim()}`
        : s === 'needs-support'
          ? `Cần hỗ trợ: ${people.join(', ')} – ${input.holdReason.trim()}`
          : before === 'paused' || before === 'needs-support'
            ? `Tiếp tục xử lý (${PRESSURE_STATE_LABEL[s]})`
            : `Cập nhật xử lý: ${PRESSURE_STATE_LABEL[s]}`;
  const kind = s === 'resolved' ? 'resolve' : s === 'paused' || s === 'needs-support' ? 'hold' : 'update';

  const record: AlertRecord = {
    ...a,
    ...pressureStateFields(s, input.holdReason, at),
    guide,
    readings: { source: input.readings.source, at: input.readings.at, rows: input.readings.rows.map((r) => ({ ...r })) },
    verification: [...input.verification],
    issue: input.issue.kind === 'none' ? undefined : { kind: input.issue.kind, ...(input.issue.note.trim() ? { note: input.issue.note.trim() } : {}) },
    cause: input.cause.trim() || a.cause,
    actionTaken: input.actionTaken.trim() || a.actionTaken,
    attachments: [...(a.attachments ?? []), ...input.files.map((x) => ({ name: x.name, size: x.size, kind: x.kind, isTemp: true }))],
    collaborators: s === 'needs-support' ? [...new Set([...(a.collaborators ?? []), ...people])] : a.collaborators,
    followUp,
    notes: [...(a.notes ?? []), newNote(a, noteLines.join('\n'), ctx)],
    history: withHistory(a, kind, historyText, ctx),
  };
  if (s === 'resolved') {
    record.resolvedAt = at;
    record.closingReading = { value: (check.close as { value: number }).value, source: input.readings.source === 'sensor' ? 'live' : 'measured' };
  }
  return { ok: true, record };
}

/** Nhãn trạng thái hạng mục (tái xuất cho modal/test). */
export { INSPECTION_STATUS_LABEL };

// ---- Nháp (sessionStorage theo mã – `createSessionDraft` ở data/alertDetail) ----

export type PressureDraft = Omit<PressureUpdateInput, 'files'> & { /** ISO */ savedAt: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Nháp sai dạng → null (coi như không có). Tệp tạm KHÔNG vào nháp (không giữ được File qua sessionStorage). */
export function parsePressureDraft(raw: unknown): PressureDraft | null {
  if (!isObj(raw)) return null;
  const { state, holdReason, supportPeople, inspection, readings, verification, cause, actionTaken, issue, followUp, savedAt } = raw;
  if (typeof state !== 'string' || !PRESSURE_STATES.includes(state as PressureState)) return null;
  if (typeof holdReason !== 'string' || typeof cause !== 'string' || typeof actionTaken !== 'string' || typeof savedAt !== 'string') return null;
  if (!Array.isArray(supportPeople) || !Array.isArray(verification) || !isObj(inspection) || !isObj(readings) || !isObj(issue) || !isObj(followUp)) return null;
  if (!Array.isArray(readings.rows) || typeof readings.source !== 'string' || !(readings.source in SOURCE_LABEL)) return null;
  if (followUp.choice !== 'custom' && typeof followUp.choice !== 'number') return null;
  return raw as unknown as PressureDraft;
}
