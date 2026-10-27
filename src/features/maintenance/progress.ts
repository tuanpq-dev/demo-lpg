/*
 * Cập nhật tiến độ + nghiệm thu – thuần (không React, không gọi Date.now()). Modal "Cập nhật tiến độ bảo trì" (ảnh thiết kế).
 *
 *   Trạng thái công việc (modal)   →  bản ghi
 *   Đang thực hiện                 →  in-progress (bỏ cờ tạm dừng/sự cố)
 *   Tạm dừng                       →  in-progress + hold.paused   (lý do bắt buộc)
 *   Gặp sự cố                      →  in-progress + hold.blocked  (mô tả bắt buộc)
 *   Hoàn thành                     →  KHÔNG ghi gì: nút chính thành "Tiếp tục gửi nghiệm thu" → modal "Gửi yêu cầu nghiệm thu"
 *                                     (`review.ts` – đường DUY NHẤT sang review; điền sẵn nội dung vào Tóm tắt)
 *
 * Mở được khi `assigned` / `in-progress`. Từ `assigned`: lần cập nhật đầu = "Bắt đầu thực hiện" (đúng một bước); chưa cho
 * "Hoàn thành" ngay (phải qua bước Đang thực hiện – không nhảy bước).
 * Mỗi lần cập nhật = MỘT dòng lịch sử (+ một ghi chú nếu có nội dung). `reportedProgress` tách khỏi tiến độ checklist.
 */
import { plantDateTimeKey } from '@/lib/plantTime';
import type { MaintenanceAttachment, MaintenanceHistoryKind, MaintenanceRecord, MaintenanceStatus } from '@/mocks/maintenance';
import { checklistProgress } from './checklist';
import { isPastDue, dueInstant } from './deadline';
import { addNoteRecord, type ActionContext } from './workflow';

export type WorkState = 'working' | 'paused' | 'blocked' | 'completed';

export const WORK_STATE_OPTIONS: readonly { id: WorkState; label: string }[] = [
  { id: 'working', label: 'Đang thực hiện' },
  { id: 'paused', label: 'Tạm dừng' },
  { id: 'blocked', label: 'Gặp sự cố' },
  { id: 'completed', label: 'Hoàn thành' },
];

/** Nhãn cờ phụ (badge danh sách, stepper, header). */
export const HOLD_LABEL = { paused: 'Tạm dừng', blocked: 'Gặp sự cố' } as const;

/** "Gần hạn" = còn ≤ 2 giờ tới giờ hạn (ô Hạn chót trong modal tô đỏ). */
export const NEAR_DUE_MS = 2 * 60 * 60 * 1000;

/** Bước của thanh trượt tiến độ (%). */
export const PROGRESS_STEP = 5;

/** Mở modal cập nhật tiến độ được khi đã phân công / đang thực hiện. */
export const canUpdateProgress = (s: MaintenanceStatus) => s === 'assigned' || s === 'in-progress';

/** Trạng thái công việc hiện tại của bản ghi (chọn sẵn trong modal). */
export function workStateOf(r: Pick<MaintenanceRecord, 'status' | 'hold'>): WorkState {
  if (r.status === 'review' || r.status === 'done') return 'completed';
  return r.hold?.kind ?? 'working';
}

/** Lựa chọn được phép theo trạng thái: từ "Đã phân công" chưa báo hoàn thành được (phải bắt đầu trước). */
export const workStateDisabled = (status: MaintenanceStatus, s: WorkState) => s === 'completed' && status === 'assigned';

/** Kẹp 0..100 và làm tròn về bội số của `PROGRESS_STEP`. NaN → 0. */
export function clampProgress(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(100, Math.max(0, Math.round(v / PROGRESS_STEP) * PROGRESS_STEP));
}

/** Tiến độ báo cáo đang có: `reportedProgress`, thiếu → tiến độ checklist (có checklist) hoặc `progress`. */
export function reportedProgressOf(r: Pick<MaintenanceRecord, 'reportedProgress' | 'progress' | 'checklist'>): number {
  if (r.reportedProgress !== undefined) return r.reportedProgress;
  return r.checklist?.length ? checklistProgress(r.checklist).percent : r.progress;
}

/** Giá trị mặc định của thanh trượt = tiến độ báo cáo đang có, làm tròn về bước 5. */
export const defaultReportedProgress = (r: Pick<MaintenanceRecord, 'reportedProgress' | 'progress' | 'checklist'>) =>
  clampProgress(reportedProgressOf(r));

/** Nội dung bắt buộc khi Tạm dừng / Gặp sự cố (Hoàn thành: Tóm tắt bắt buộc ở modal Gửi nghiệm thu). */
export const requiresText = (s: WorkState) => s === 'paused' || s === 'blocked';

/** "Hoàn thành" ở modal tiến độ → chuyển sang modal Gửi nghiệm thu (chỉ khi đang thực hiện). */
export const canContinueToSubmit = (status: MaintenanceStatus, s: WorkState) => s === 'completed' && status === 'in-progress';

/** Nhãn ô "Nội dung đã thực hiện" theo lựa chọn. */
export const TEXT_LABEL: Record<WorkState, string> = {
  working: 'Nội dung đã thực hiện',
  paused: 'Lý do tạm dừng',
  blocked: 'Mô tả sự cố',
  completed: 'Nội dung đã hoàn thành',
};

const TEXT_REQUIRED_ERROR: Record<'paused' | 'blocked', string> = {
  paused: 'Nhập lý do tạm dừng.',
  blocked: 'Mô tả sự cố đang gặp.',
};

/** Tệp đính kèm thêm trong lần cập nhật (chỉ thông tin – không object URL). */
export type ProgressFile = Pick<MaintenanceAttachment, 'name' | 'size' | 'kind'>;

export type ProgressUpdateInput = { state: WorkState; progress: number; text: string; files?: readonly ProgressFile[] };
export type ProgressUpdateErrors = { text?: string; state?: string; form?: string };

/** Lỗi của lần cập nhật ({} = hợp lệ). */
export function validateProgressUpdate(r: MaintenanceRecord, input: ProgressUpdateInput): ProgressUpdateErrors {
  if (!canUpdateProgress(r.status)) return { form: 'Yêu cầu không còn ở bước cập nhật tiến độ.' };
  const errors: ProgressUpdateErrors = {};
  if (workStateDisabled(r.status, input.state)) errors.state = 'Bắt đầu thực hiện trước khi báo hoàn thành.';
  else if (input.state === 'completed') errors.state = 'Báo hoàn thành qua "Tiếp tục gửi nghiệm thu".';
  if ((input.state === 'paused' || input.state === 'blocked') && !input.text.trim()) errors.text = TEXT_REQUIRED_ERROR[input.state];
  if (errors.state || errors.text) return errors;
  const changed =
    r.status === 'assigned' ||
    input.state !== workStateOf(r) ||
    // So với giá trị mặc định của thanh trượt (đã làm tròn bước 5): checklist 33 % → mặc định 35 % không tính là thay đổi.
    clampProgress(input.progress) !== defaultReportedProgress(r) ||
    !!input.text.trim() ||
    !!input.files?.length;
  return changed ? {} : { form: 'Chưa có thay đổi nào để cập nhật.' };
}

/** Một dòng lịch sử cho cả lần cập nhật: loại theo thay đổi trạng thái, nội dung gộp tiến độ + tệp. */
function historyLine(r: MaintenanceRecord, input: ProgressUpdateInput, progress: number): { kind: MaintenanceHistoryKind; text: string } {
  const before = reportedProgressOf(r);
  const prevState = workStateOf(r);
  const text = input.text.trim();
  const parts: string[] = [];
  let kind: MaintenanceHistoryKind = 'progress';
  if (input.state === 'paused') {
    kind = 'pause';
    parts.push(`Tạm dừng – lý do: ${text}`);
  } else if (input.state === 'blocked') {
    kind = 'block';
    parts.push(`Gặp sự cố: ${text}`);
  } else if (r.status === 'assigned') {
    kind = 'start';
    parts.push('Bắt đầu thực hiện');
  } else if (prevState !== 'working') {
    kind = 'resume';
    parts.push('Tiếp tục thực hiện');
  } else {
    parts.push('Cập nhật tiến độ');
  }
  parts.push(progress !== defaultReportedProgress(r) ? `${before}% → ${progress}%` : `tiến độ ${progress}%`);
  if (input.files?.length) parts.push(`đính kèm ${input.files.length} tệp`);
  return { kind, text: parts.join(' · ') };
}

/**
 * Áp dụng lần cập nhật. Không hợp lệ (`validateProgressUpdate`, kể cả "Hoàn thành") → trả nguyên bản ghi.
 * - status → in-progress (từ assigned = bắt đầu, đúng một bước).
 * - hold: paused/blocked → { kind, reason = nội dung, at }; working/completed → bỏ.
 * - reportedProgress = giá trị thanh trượt (được giảm); `progress` (checklist) giữ nguyên.
 * - Nội dung → một ghi chú kỹ thuật; tệp → `attachments` với `isTemp: true` (chỉ tên/kích thước/loại).
 */
export function applyProgressUpdate(
  r: MaintenanceRecord,
  input: ProgressUpdateInput,
  ctx: ActionContext,
): MaintenanceRecord {
  if (Object.keys(validateProgressUpdate(r, input)).length) return r;
  const at = plantDateTimeKey(ctx.now);
  const progress = clampProgress(input.progress);
  const line = historyLine(r, input, progress);
  const text = input.text.trim();
  const history = r.history ?? [];
  const existing = r.attachments ?? [];
  const added = (input.files ?? []).map((f, i) => ({
    id: `t${existing.length + i + 1}`,
    name: f.name,
    size: f.size,
    kind: f.kind,
    isTemp: true as const,
  }));
  let next: MaintenanceRecord = {
    ...r,
    status: 'in-progress',
    reportedProgress: progress,
    hold: input.state === 'paused' || input.state === 'blocked' ? { kind: input.state, reason: text, at } : undefined,
    attachments: added.length ? [...existing, ...added] : r.attachments,
    history: [...history, { id: `h${history.length + 1}`, at, kind: line.kind, text: line.text, actor: ctx.actor }],
  };
  if (!next.hold) delete next.hold;
  if (text) next = addNoteRecord(next, text, ctx);
  return next;
}

/** Hạn chót trong modal: đỏ khi đã quá hạn hoặc còn ≤ `NEAR_DUE_MS`. */
export function isNearOrPastDue(dueAt: string, now: Date, hasTime = true): boolean {
  if (isPastDue(dueAt, now, hasTime)) return true;
  const due = dueInstant(dueAt, hasTime);
  return !!due && due.getTime() - now.getTime() <= NEAR_DUE_MS;
}

// ---- Tệp tải lên trong modal (chỉ trong phiên – TODO(backend): upload thật qua API lưu trữ) ----

export const UPLOAD_RULES = {
  /** Đuôi tệp cho phép (chữ thường). */
  exts: ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'docx', 'xlsx', 'txt'] as readonly string[],
  /** Tối đa mỗi tệp. */
  maxBytes: 10 * 1024 * 1024,
  /** Tối đa số tệp thêm trong MỘT lần cập nhật. */
  maxFiles: 5,
};

/** Giá trị `accept` cho input file. */
export const UPLOAD_ACCEPT = UPLOAD_RULES.exts.map((e) => `.${e}`).join(',');

/** "Ảnh JPG, PNG, WEBP hoặc PDF, DOCX, XLSX, TXT · tối đa 10 MB/tệp · 5 tệp mỗi lần". */
export const UPLOAD_HINT = 'Ảnh JPG, PNG, WEBP hoặc tài liệu PDF, DOCX, XLSX, TXT · tối đa 10 MB mỗi tệp · 5 tệp mỗi lần cập nhật';

const ext = (name: string) => (/\.([^.]+)$/.exec(name)?.[1] ?? '').toLowerCase();

/** Loại thẻ tệp theo đuôi: ảnh → image, còn lại → document. */
export const uploadKind = (name: string): 'image' | 'document' => (['jpg', 'jpeg', 'png', 'webp'].includes(ext(name)) ? 'image' : 'document');

/**
 * Lọc tệp người dùng chọn: sai loại / quá dung lượng / vượt số tệp còn lại (`already` = số tệp đã thêm trong lần này)
 * → `rejected` kèm lý do; phần còn lại → `accepted` (giữ thứ tự).
 */
export function checkUploads<F extends { name: string; size: number }>(files: readonly F[], already: number) {
  const accepted: F[] = [];
  const rejected: { name: string; reason: string }[] = [];
  for (const f of files) {
    if (!UPLOAD_RULES.exts.includes(ext(f.name))) rejected.push({ name: f.name, reason: 'không đúng loại tệp cho phép' });
    else if (f.size > UPLOAD_RULES.maxBytes) rejected.push({ name: f.name, reason: 'vượt quá 10 MB' });
    else if (already + accepted.length >= UPLOAD_RULES.maxFiles) rejected.push({ name: f.name, reason: `đã đủ ${UPLOAD_RULES.maxFiles} tệp cho lần cập nhật này` });
    else accepted.push(f);
  }
  return { accepted, rejected };
}
