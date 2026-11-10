/*
 * Báo cáo vận hành định kỳ – kiểu dữ liệu + trạng thái suy dẫn (THUẦN, nhận `now` qua tham số).
 *
 * Trạng thái hoàn thành KHÔNG lưu mà tính từ mốc kiểm tra + kỳ:
 *   kỳ chưa kết thúc (hôm nay ≤ ngày cuối kỳ, giờ nhà máy) → "Đang thực hiện"
 *   kỳ đã qua, còn mốc chưa có dữ liệu                       → "Thiếu dữ liệu"
 *   kỳ đã qua, đủ mốc                                         → "Hoàn thành"
 * Chữ ký chỉ có nghĩa khi đã Hoàn thành; trước đó luôn "Chưa gửi ký".
 */
import { plantDateTimeKey, plantDayKey } from '@/lib/plantTime';
import { PERIOD_CONFIG, periodRange, type PeriodKey, type ReportPeriod } from './period';

export type ReportCheckpoint = {
  /** Khoá ổn định: "08:00" (ngày) · "2026-06-03" (tháng) · "2026-04" (quý) · "2026-Q1" (năm). */
  key: string;
  /** Nhãn hiển thị: "08:00" · "03/06" · "Tháng 04" · "Quý 1". */
  label: string;
  /** Hạn của mốc "yyyy-mm-ddTHH:mm" (giờ nhà máy). */
  dueAt: string;
  /** Đã có dữ liệu. */
  done: boolean;
  /** Dữ liệu đã nhập nhưng cần xác minh lại ("Dữ liệu 14:00: Cần xác minh"). */
  needsVerify?: boolean;
};

export const SIGNATURE_STEPS = ['inspector', 'approver', 'tap'] as const;
export type SignatureStep = (typeof SIGNATURE_STEPS)[number];

export const SIGNATURE_STEP_LABEL: Record<SignatureStep, string> = {
  inspector: 'Người kiểm tra (Inspector)',
  approver: 'Người duyệt (Approver)',
  tap: 'Ban TAP (TAP)',
};

/** Trạng thái chữ ký lưu trong bản ghi. */
export type StoredSignature =
  | { status: 'not-sent' }
  | { status: 'pending'; step: SignatureStep }
  | { status: 'signed' }
  | { status: 'rejected'; reason?: string };

/** Một lần ký (FE – chờ API): bước, người ký, lúc ký "yyyy-mm-ddTHH:mm" (giờ nhà máy), ghi chú khi ký. */
export type SignLogEntry = { step: SignatureStep; by: string; at: string; note?: string };

export type ReportRecord = {
  id: string;
  code: string;
  period: ReportPeriod;
  periodKey: PeriodKey;
  /** Ca vận hành – chỉ báo cáo ngày ("Ca 1"). */
  shift?: string;
  checkpoints: readonly ReportCheckpoint[];
  inspector: string;
  /** Chưa có → "Chưa chỉ định". */
  approver?: string;
  signature: StoredSignature;
  /** Cập nhật cuối "yyyy-mm-ddTHH:mm" (giờ nhà máy). */
  updatedAt: string;
  /** Nhận xét cuối ca của người kiểm tra (chỉ báo cáo ngày) – điều kiện ký. Màn nhập chưa có thiết kế. */
  shiftRemark?: string;
  /** Nhật ký ký (mới nhất cuối). */
  signLog?: readonly SignLogEntry[];
  /** Ghi nhận mốc trong phiên (modal "Ghi nhận mốc kiểm tra") theo khoá mốc ("18:00"). */
  checkpointLog?: Readonly<Record<string, CheckpointLogEntry>>;
};

/**
 * Một lần ghi nhận mốc: người, lúc "yyyy-mm-ddTHH:mm" (giờ nhà máy), nhận xét, giá trị nhập tay theo hạng mục bảng ngày
 * (`DAILY_ITEMS` id → số, ghi đè số IoT), tên tệp đính kèm (chưa upload).
 */
export type CheckpointLogEntry = {
  by: string;
  at: string;
  remark: string;
  manual?: Readonly<Record<string, number>>;
  files?: readonly string[];
};

export const COMPLETION_STATUSES = ['in-progress', 'done', 'missing-data'] as const;
export type CompletionStatus = (typeof COMPLETION_STATUSES)[number];
export const COMPLETION_LABEL: Record<CompletionStatus, string> = {
  'in-progress': 'Đang thực hiện',
  done: 'Hoàn thành',
  'missing-data': 'Thiếu dữ liệu',
};

export const SIGNATURE_STATUSES = ['not-sent', 'pending', 'signed', 'rejected'] as const;
export type SignatureStatus = (typeof SIGNATURE_STATUSES)[number];
export const SIGNATURE_LABEL: Record<SignatureStatus, string> = {
  'not-sent': 'Chưa gửi ký',
  pending: 'Chờ duyệt ký',
  signed: 'Đã ký',
  rejected: 'Bị trả lại',
};

/**
 * Nhóm tách rời (mỗi báo cáo đúng MỘT nhóm) – nguồn của 4 KPI trạng thái và thẻ "Tiến độ tháng":
 * Đang thực hiện · Thiếu dữ liệu · Chờ xác nhận (đủ mốc, chưa ký đủ – gồm bị trả lại) · Đã ký đầy đủ.
 */
export type ReportState = 'in-progress' | 'missing-data' | 'awaiting' | 'signed';

/** Kỳ đã kết thúc (hôm nay theo giờ nhà máy > ngày cuối kỳ). */
export function isPeriodClosed(r: Pick<ReportRecord, 'period' | 'periodKey'>, now: Date): boolean {
  return plantDayKey(now) > periodRange(r.period, r.periodKey).end;
}

export function completionOf(r: ReportRecord, now: Date): CompletionStatus {
  if (!isPeriodClosed(r, now)) return 'in-progress';
  return r.checkpoints.every((c) => c.done) ? 'done' : 'missing-data';
}

export function signatureOf(r: ReportRecord, now: Date): SignatureStatus {
  return completionOf(r, now) === 'done' ? r.signature.status : 'not-sent';
}

export function reportState(r: ReportRecord, now: Date): ReportState {
  const c = completionOf(r, now);
  if (c !== 'done') return c;
  return r.signature.status === 'signed' ? 'signed' : 'awaiting';
}

/**
 * Bước ký đang chờ của báo cáo "Chờ xác nhận": bị trả lại / chưa gửi → quay về người kiểm tra.
 * Không ở nhóm Chờ xác nhận → undefined.
 */
export function awaitingStep(r: ReportRecord, now: Date): SignatureStep | undefined {
  if (reportState(r, now) !== 'awaiting') return undefined;
  return r.signature.status === 'pending' ? r.signature.step : 'inspector';
}

/** Mốc đã tới hạn (hạn ≤ bây giờ) mà chưa có dữ liệu; kỳ đã qua → mọi mốc chưa có dữ liệu. */
export function missingCheckpoints(r: ReportRecord, now: Date): ReportCheckpoint[] {
  const closed = isPeriodClosed(r, now);
  const t = plantDateTimeKey(now);
  return r.checkpoints.filter((c) => !c.done && (closed || c.dueAt <= t));
}

export function checkpointProgress(r: ReportRecord): { done: number; total: number; percent: number } {
  const total = r.checkpoints.length;
  const done = r.checkpoints.filter((c) => c.done).length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

/** "5/6 mốc (83%)" · "19/30 ngày (63%)". */
export function progressText(r: ReportRecord): string {
  const p = checkpointProgress(r);
  return `${p.done}/${p.total} ${PERIOD_CONFIG[r.period].checkpointUnit} (${p.percent}%)`;
}

/** "18:00" · "16:00, 18:00" · "03/06, 04/06 +2" · "Không có". */
export function missingText(r: ReportRecord, now: Date, max = 3): string {
  const m = missingCheckpoints(r, now);
  if (!m.length) return 'Không có';
  const head = m
    .slice(0, max)
    .map((c) => c.label)
    .join(', ');
  return m.length > max ? `${head} +${m.length - max}` : head;
}

/** "14:05 24/06" (giờ nhà máy). */
export function formatUpdatedAt(at: string): string {
  return `${at.slice(11, 16)} ${at.slice(8, 10)}/${at.slice(5, 7)}`;
}
