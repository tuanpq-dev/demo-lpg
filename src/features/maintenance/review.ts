/*
 * Gửi nghiệm thu + nghiệm thu – thuần (không React, không gọi Date.now()). Hai modal theo ảnh thiết kế:
 *
 *   in-progress ──"Gửi yêu cầu nghiệm thu" (kỹ thuật viên, đủ điều kiện)──▶ review
 *   review ──"Nghiệm thu yêu cầu bảo trì" (người nghiệm thu ≠ người thực hiện)──▶
 *        Đạt yêu cầu   → done (+ theo dõi thêm N giờ)
 *        Cần bổ sung   → in-progress, giữ tiến độ báo cáo, ý kiến bắt buộc → ghi chú kỹ thuật
 *        Không đạt     → in-progress + cờ `reviewFailed`, tiến độ báo cáo = tiến độ checklist, lý do bắt buộc → ghi chú
 *
 * Đây là đường DUY NHẤT sang review (gửi) và sang done (Đạt). Mỗi thao tác = MỘT dòng lịch sử.
 */
import { plantDateTimeKey, plantDayKey } from '@/lib/plantTime';
import type {
  DeviceCondition,
  MaintenanceAttachment,
  MaintenanceRecord,
  ReadingSnapshot,
  ReviewResult,
  ReviewSubmission,
  SensorStatus,
  ValveStatus,
} from '@/features/maintenance/types';
import { checklistProgress } from './checklist';
import { reportedProgressOf } from './progress';
import type { ActionContext } from './workflow';

export type { DeviceCondition, ReadingSnapshot, ReviewResult, ReviewSubmission, SensorStatus, ValveStatus };

export const DEVICE_CONDITION_OPTIONS: readonly { id: DeviceCondition; label: string }[] = [
  { id: 'normal', label: 'Hoạt động bình thường' },
  { id: 'monitor', label: 'Theo dõi thêm' },
  { id: 'unresolved', label: 'Chưa khắc phục' },
];
export const DEVICE_CONDITION_LABEL = Object.fromEntries(DEVICE_CONDITION_OPTIONS.map((o) => [o.id, o.label])) as Record<DeviceCondition, string>;

export const SENSOR_STATUS_OPTIONS: readonly { value: SensorStatus; label: string }[] = [
  { value: 'normal', label: 'Bình thường' },
  { value: 'monitor', label: 'Cần theo dõi' },
  { value: 'fault', label: 'Lỗi' },
];
export const VALVE_STATUS_OPTIONS: readonly { value: ValveStatus; label: string }[] = [
  { value: 'stable', label: 'Ổn định' },
  { value: 'leak', label: 'Rò rỉ' },
  { value: 'stuck', label: 'Kẹt' },
];
export const SENSOR_STATUS_LABEL = Object.fromEntries(SENSOR_STATUS_OPTIONS.map((o) => [o.value, o.label])) as Record<SensorStatus, string>;
export const VALVE_STATUS_LABEL = Object.fromEntries(VALVE_STATUS_OPTIONS.map((o) => [o.value, o.label])) as Record<ValveStatus, string>;

export const REVIEW_RESULT_OPTIONS: readonly { id: ReviewResult; label: string }[] = [
  { id: 'pass', label: 'Đạt yêu cầu' },
  { id: 'needs-info', label: 'Cần bổ sung' },
  { id: 'fail', label: 'Không đạt' },
];
export const REVIEW_RESULT_LABEL = Object.fromEntries(REVIEW_RESULT_OPTIONS.map((o) => [o.id, o.label])) as Record<ReviewResult, string>;

/** Nhãn nút xác nhận của modal Nghiệm thu theo kết quả (ảnh: "Xác nhận hoàn thành" khi Đạt). */
export const REVIEW_SUBMIT_LABEL: Record<ReviewResult, string> = {
  pass: 'Xác nhận hoàn thành',
  'needs-info': 'Yêu cầu bổ sung',
  fail: 'Xác nhận không đạt',
};

/** Cờ danh sách / header. */
export const REVIEW_FAILED_LABEL = 'Không đạt nghiệm thu';

/** "Thời gian theo dõi thêm" (giờ) khi Đạt – 0 = không theo dõi. */
export const FOLLOW_UP_OPTIONS: readonly { value: string; label: string }[] = [
  { value: '0', label: 'Không theo dõi thêm' },
  { value: '2', label: '2 giờ' },
  { value: '4', label: '4 giờ' },
  { value: '8', label: '8 giờ' },
  { value: '24', label: '24 giờ' },
];
export const DEFAULT_FOLLOW_UP_HOURS = 2;

// ============================================================================
// Gửi nghiệm thu
// ============================================================================

/** Nội dung modal Gửi (chưa có ảnh chụp số liệu – chụp lúc bấm Gửi). */
export type SubmitForm = {
  summary: string;
  cause: string;
  remedy: string;
  deviceCondition: DeviceCondition;
  sensorStatus: SensorStatus;
  valveStatus: ValveStatus;
  reviewer: string | null;
  proposedAt?: string;
};

export type SubmitInput = SubmitForm & {
  readings: ReviewSubmission['readings'];
  /** Tệp thêm ở modal "Cập nhật tiến độ" trước khi chuyển sang Gửi (chỉ thông tin – chưa upload). */
  files?: readonly Pick<MaintenanceAttachment, 'name' | 'size' | 'kind'>[];
};

export type SubmitMissingId = 'status' | 'checklist' | 'summary' | 'cause' | 'remedy' | 'reviewer' | 'reviewer-self';
export type SubmitMissing = { id: SubmitMissingId; label: string };

/**
 * Điều kiện gửi còn thiếu ([] = đủ): đang thực hiện · checklist xong (bỏ mục N/A; không có checklist → bỏ qua) · tóm tắt ·
 * nguyên nhân · biện pháp · người nghiệm thu (khác người thực hiện). "Chưa khắc phục" KHÔNG chặn gửi (chỉ cảnh báo).
 */
export function submitMissing(r: MaintenanceRecord, form: SubmitForm): SubmitMissing[] {
  const out: SubmitMissing[] = [];
  if (r.status !== 'in-progress') out.push({ id: 'status', label: 'Yêu cầu không ở trạng thái Đang thực hiện' });
  if (r.checklist?.length) {
    const p = checklistProgress(r.checklist);
    if (p.done < p.total) out.push({ id: 'checklist', label: `Checklist chưa hoàn thành (${p.done}/${p.total})` });
  }
  if (!form.summary.trim()) out.push({ id: 'summary', label: 'Chưa nhập tóm tắt công việc' });
  if (!form.cause.trim()) out.push({ id: 'cause', label: 'Chưa nhập nguyên nhân xác định' });
  if (!form.remedy.trim()) out.push({ id: 'remedy', label: 'Chưa nhập biện pháp' });
  const reviewer = form.reviewer?.trim();
  if (!reviewer) out.push({ id: 'reviewer', label: 'Chưa chọn người nghiệm thu' });
  else if (reviewer === r.assignee) out.push({ id: 'reviewer-self', label: 'Người nghiệm thu phải khác người thực hiện' });
  return out;
}

/** Mốc làm tròn + khoảng chờ mặc định của "Thời gian đề nghị". */
const PROPOSED_LEAD_MS = 30 * 60_000;
const PROPOSED_STEP_MS = 15 * 60_000;

/**
 * "Thời gian đề nghị" mặc định = `now` + 30 phút, làm tròn LÊN mốc 15 phút ("yyyy-mm-ddTHH:mm" giờ nhà máy – UTC+7 lệch giờ
 * tròn nên mốc 15 phút trùng nhau). Đúng mốc thì giữ; giây lẻ → mốc kế tiếp.
 */
export function defaultProposedAt(now: Date): string {
  const t = Math.ceil((now.getTime() + PROPOSED_LEAD_MS) / PROPOSED_STEP_MS) * PROPOSED_STEP_MS;
  return plantDateTimeKey(new Date(t));
}

const canSubmitForReview = (r: MaintenanceRecord, form: SubmitForm) => submitMissing(r, form).length === 0;

/** Chụp một số liệu trực tiếp: mất tín hiệu / chưa có số → value null (KHÔNG giữ số cũ). */
export function snapshotReading(
  live: { state: 'pending' | 'lost' | 'ok'; value?: number } | undefined,
  meta: { tag?: string; warn?: number } = {},
): ReadingSnapshot | undefined {
  if (!live) return undefined;
  const value = live.state === 'ok' && typeof live.value === 'number' && Number.isFinite(live.value) ? live.value : null;
  const out: ReadingSnapshot = { value };
  if (meta.tag) out.tag = meta.tag;
  if (meta.warn !== undefined) out.warn = meta.warn;
  return out;
}

/**
 * Gửi nghiệm thu: chỉ khi `canSubmitForReview` (không đủ → trả nguyên bản ghi).
 * → review, bỏ `hold` + cờ Không đạt, `reportedProgress` = 100, lưu `submission` (bản sao – không tham chiếu live),
 * tệp → `attachments` (isTemp), tóm tắt → ghi chú kỹ thuật, MỘT dòng lịch sử `submit` (kèm "80% → 100%" khi số đổi).
 */
export function submitForReview(r: MaintenanceRecord, input: SubmitInput, ctx: ActionContext): MaintenanceRecord {
  if (!canSubmitForReview(r, input)) return r;
  const at = plantDateTimeKey(ctx.now);
  const reviewer = input.reviewer!.trim();
  const before = reportedProgressOf(r);
  const files = input.files ?? [];
  const parts = [`Gửi nghiệm thu – người nghiệm thu: ${reviewer}`];
  if (before !== 100) parts.push(`${before}% → 100%`);
  if (input.deviceCondition === 'unresolved') parts.push('thiết bị: Chưa khắc phục');
  if (files.length) parts.push(`đính kèm ${files.length} tệp`);
  const { pressure, temperature } = input.readings;
  const submission: ReviewSubmission = {
    summary: input.summary.trim(),
    cause: input.cause.trim(),
    remedy: input.remedy.trim(),
    deviceCondition: input.deviceCondition,
    readings: {
      ...(pressure ? { pressure: { ...pressure } } : {}),
      ...(temperature ? { temperature: { ...temperature } } : {}),
      at: input.readings.at,
    },
    sensorStatus: input.sensorStatus,
    valveStatus: input.valveStatus,
    reviewer,
    ...(input.proposedAt ? { proposedAt: input.proposedAt } : {}),
    submittedBy: ctx.actor,
    submittedAt: at,
  };
  const existing = r.attachments ?? [];
  const added = files.map((f, i) => ({ id: `t${existing.length + i + 1}`, name: f.name, size: f.size, kind: f.kind, isTemp: true as const }));
  const history = r.history ?? [];
  const notes = r.notes ?? [];
  const next: MaintenanceRecord = {
    ...r,
    status: 'review',
    reportedProgress: 100,
    submission,
    attachments: added.length ? [...existing, ...added] : r.attachments,
    notes: [...notes, { id: `n${notes.length + 1}`, author: ctx.actor, at, text: `Tóm tắt gửi nghiệm thu: ${submission.summary}` }],
    history: [...history, { id: `h${history.length + 1}`, at, kind: 'submit', text: parts.join(' · '), actor: ctx.actor }],
  };
  delete next.hold;
  delete next.reviewFailed;
  return next;
}

// ============================================================================
// Nghiệm thu
// ============================================================================

export type ReviewInput = { result: ReviewResult; reviewer: string; comment: string; followUpHours?: number };
export type ReviewErrors = { reviewer?: string; comment?: string; form?: string };

/**
 * Người nghiệm thu hiển thị (chỉ đọc): người đang đăng nhập; chế độ không đăng nhập (`VITE_AUTH=off`, phiên giả) → người
 * được chọn khi gửi (một người nhất quán ở cả hai modal).
 */
export function resolveReviewer(opts: { authOff: boolean; userName?: string | null; submission?: Pick<ReviewSubmission, 'reviewer'> }): string {
  if (opts.authOff) return opts.submission?.reviewer || opts.userName || '';
  return opts.userName || '';
}

/** Lỗi nghiệm thu ({} = hợp lệ): chỉ từ review · có người nghiệm thu · KHÔNG tự nghiệm thu · ý kiến bắt buộc khi Cần bổ sung / Không đạt. */
export function validateReview(r: MaintenanceRecord, input: ReviewInput): ReviewErrors {
  if (r.status !== 'review') return { form: 'Yêu cầu không ở trạng thái Chờ nghiệm thu.' };
  const errors: ReviewErrors = {};
  const reviewer = input.reviewer.trim();
  if (!reviewer) errors.reviewer = 'Chưa xác định người nghiệm thu.';
  else if (r.assignee && reviewer === r.assignee) errors.reviewer = 'Người thực hiện không được tự nghiệm thu yêu cầu của mình.';
  if (input.result !== 'pass' && !input.comment.trim())
    errors.comment = input.result === 'fail' ? 'Nhập lý do không đạt.' : 'Nhập nội dung cần bổ sung.';
  return errors;
}

/** Mốc hết theo dõi = now + giờ ("yyyy-mm-ddTHH:mm" giờ nhà máy); 0/thiếu → undefined. */
function followUpUntil(now: Date, hours?: number): string | undefined {
  if (!hours || hours <= 0) return undefined;
  return plantDateTimeKey(new Date(now.getTime() + hours * 3_600_000));
}

/**
 * Ghi kết quả nghiệm thu (không hợp lệ → trả nguyên bản ghi). Người thao tác (lịch sử/ghi chú) = người nghiệm thu.
 * - pass: done, `completedAt`, `review` (+ theo dõi thêm). Lịch sử `review-pass`.
 * - needs-info: in-progress, giữ `reportedProgress`; ý kiến → ghi chú "Nghiệm thu: Cần bổ sung – …"; lịch sử ngắn trỏ tới ghi chú.
 * - fail: in-progress + `reviewFailed`, `reportedProgress` = tiến độ checklist; ý kiến → ghi chú "Nghiệm thu: Không đạt – …".
 * `submission` giữ nguyên (hồ sơ lần gửi gần nhất).
 */
export function reviewRecord(r: MaintenanceRecord, input: ReviewInput, ctx: Pick<ActionContext, 'now'>): MaintenanceRecord {
  if (Object.keys(validateReview(r, input)).length) return r;
  const reviewer = input.reviewer.trim();
  const at = plantDateTimeKey(ctx.now);
  const comment = input.comment.trim();
  const history = r.history ?? [];
  const hId = `h${history.length + 1}`;

  if (input.result === 'pass') {
    const hours = input.followUpHours && input.followUpHours > 0 ? input.followUpHours : 0;
    const until = followUpUntil(ctx.now, hours);
    const next: MaintenanceRecord = {
      ...r,
      status: 'done',
      progress: r.checklist?.length ? r.progress : 100,
      completedAt: plantDayKey(ctx.now),
      review: { result: 'pass', reviewer, ...(comment ? { comment } : {}), followUpHours: hours, ...(until ? { followUpUntil: until } : {}), at },
      history: [
        ...history,
        {
          id: hId,
          at,
          kind: 'review-pass',
          text: `Nghiệm thu đạt – hoàn thành${until ? ` · theo dõi thêm ${hours} giờ (đến ${until.slice(11, 16)})` : ''}`,
          actor: reviewer,
        },
      ],
    };
    delete next.reviewFailed;
    return next;
  }

  const label = REVIEW_RESULT_LABEL[input.result];
  const notes = r.notes ?? [];
  const before = reportedProgressOf(r);
  const reset = input.result === 'fail' ? (r.checklist?.length ? checklistProgress(r.checklist).percent : r.progress) : before;
  const text = `Nghiệm thu: ${label} – xem ghi chú kỹ thuật${reset !== before ? ` · tiến độ ${before}% → ${reset}%` : ''}`;
  const next: MaintenanceRecord = {
    ...r,
    status: 'in-progress',
    reportedProgress: reset,
    review: { result: input.result, reviewer, comment, at },
    notes: [...notes, { id: `n${notes.length + 1}`, author: reviewer, at, text: `Nghiệm thu: ${label} – ${comment}` }],
    history: [...history, { id: hId, at, kind: input.result === 'fail' ? 'review-fail' : 'review-needs-info', text, actor: reviewer }],
  };
  if (input.result === 'fail') next.reviewFailed = true;
  else delete next.reviewFailed;
  return next;
}
