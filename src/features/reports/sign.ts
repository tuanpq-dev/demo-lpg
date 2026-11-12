/*
 * Ký xác nhận báo cáo ngày – bước Người kiểm tra (modal "Hoàn thành nhận xét & ký xác nhận", ảnh thiết kế).
 * THUẦN, `now` qua tham số. Điều kiện ký tính từ bản ghi + số đo theo mốc + cảnh báo cảm biến + 2 thao tác trong modal
 * (đã xem trước biểu mẫu, đã tick xác nhận trách nhiệm). Đủ 8 điều kiện mới ký được.
 */
import { plantDateTimeKey } from '@/lib/plantTime';
import { flaggedReadings, signedSteps, type DailyReadingRow } from './daily';
import { PERIOD_CONFIG } from './period';
import { SIGNATURE_STEPS, awaitingStep, checkpointProgress, type ReportRecord, type SignatureStep } from './status';

/** Giờ ca ngày của báo cáo ngày (giả định – docs/questions.md 12.14). */
export const DAILY_SHIFT_HOURS = '08:00–20:00';

/** Vai trò hiển thị ở thẻ "Xác nhận của người kiểm tra" (giả định – chưa có danh mục vai trò thật). */
export const SIGN_ROLE_LABEL: Record<SignatureStep, string> = {
  inspector: 'Nhân viên vận hành',
  approver: 'Người duyệt',
  tap: 'TAP vận hành',
};

/**
 * Hệ thống bật xác thực ký (mã xác nhận / mật khẩu ký)? Bản demo: TẮT – ô vẫn hiện như ảnh, để trống vẫn ký được.
 * TODO(backend): lấy từ cấu hình hệ thống + kiểm mã ở máy chủ (FE không lưu mã).
 */
export const SIGN_PIN_REQUIRED = false;

/** Chỉ báo cáo NGÀY đang chờ Người kiểm tra (chờ ký, bị trả lại, chưa gửi) mới mở được modal ký. */
export function canInspectorSign(r: ReportRecord, now: Date): boolean {
  return r.period === 'daily' && awaitingStep(r, now) === 'inspector';
}

// ============================================================================
// Điều kiện ký
// ============================================================================

export type SignConditionId =
  | 'checkpoints'
  | 'scada'
  | 'no-missing'
  | 'no-sensor-fault'
  | 'draft-reviewed'
  | 'shift-remark'
  | 'responsibility'
  | 'anomalies-noted';

export type SignCondition = { id: SignConditionId; label: string; met: boolean };

export type SignContext = {
  report: ReportRecord;
  rows: readonly DailyReadingRow[];
  /** Mã cảnh báo lỗi / mất tín hiệu cảm biến trong ngày báo cáo chưa xử lý (`openSensorFaults`). */
  sensorFaults: readonly string[];
  /** Đã bấm "Xem trước biểu mẫu" trong modal. */
  draftReviewed: boolean;
  /** Đã tick ô "Tôi xác nhận…". */
  responsibility: boolean;
};

const listText = (items: readonly string[], max = 3) =>
  items.length > max ? `${items.slice(0, max).join(', ')} +${items.length - max}` : items.join(', ');

/**
 * 8 điều kiện theo thứ tự ĐỌC của ảnh (cột trái từ trên xuống rồi cột phải). Nhãn đổi theo kết quả để đọc được lý do khoá:
 * "Đã hoàn thành đủ 6/6 mốc kiểm tra" ↔ "Mới hoàn thành 5/6 mốc kiểm tra".
 * - PLC/SCADA: thông số đo tự động (`source = auto`) có số ở MỌI mốc; mốc "Cần xác minh" → chưa xác nhận.
 * - Dữ liệu thiếu: mốc chưa có dữ liệu hoặc ô trống ở bất kỳ hạng mục nào (kể cả đọc tại chỗ).
 * - Bất thường: ô ngoài ngưỡng (Cảnh báo / Bất thường) phải có ghi chú ở đúng mốc.
 */
export function signConditions(ctx: SignContext): SignCondition[] {
  const { report: r, rows } = ctx;
  const p = checkpointProgress(r);
  const unit = PERIOD_CONFIG[r.period].checkpointUnit;
  const keys = r.checkpoints.map((c) => c.key);

  const verify = r.checkpoints.filter((c) => c.done && c.needsVerify).map((c) => c.label);
  const auto = rows.filter((x) => x.source === 'auto');
  const autoOk = auto.filter((x) => keys.every((k) => x.values[k] != null)).length;
  const scadaMet = autoOk === auto.length && verify.length === 0;

  const missing = r.checkpoints.filter((c) => !c.done || rows.some((x) => x.values[c.key] == null)).map((c) => c.label);

  const unnoted = flaggedReadings(rows, keys).filter((f) => !rows.find((x) => x.id === f.rowId)?.notes?.[f.checkpoint]?.trim());

  const remark = !!r.shiftRemark?.trim();

  return [
    {
      id: 'checkpoints',
      met: p.done === p.total,
      label: p.done === p.total ? `Đã hoàn thành đủ ${p.done}/${p.total} ${unit} kiểm tra` : `Mới hoàn thành ${p.done}/${p.total} ${unit} kiểm tra`,
    },
    {
      id: 'scada',
      met: scadaMet,
      label: scadaMet
        ? `Đã xác nhận đủ ${autoOk}/${auto.length} thông số PLC/SCADA`
        : verify.length
          ? `Thông số PLC/SCADA mốc ${listText(verify)} cần xác minh lại`
          : `Mới xác nhận ${autoOk}/${auto.length} thông số PLC/SCADA`,
    },
    {
      id: 'no-missing',
      met: missing.length === 0,
      label: missing.length ? `Còn thiếu dữ liệu mốc ${listText(missing)}` : 'Không còn dữ liệu thiếu',
    },
    {
      id: 'no-sensor-fault',
      met: ctx.sensorFaults.length === 0,
      label: ctx.sensorFaults.length ? `Còn lỗi cảm biến chưa xử lý: ${listText(ctx.sensorFaults, 2)}` : 'Không có lỗi cảm biến chưa xử lý',
    },
    {
      id: 'draft-reviewed',
      met: ctx.draftReviewed,
      label: ctx.draftReviewed ? 'Đã kiểm tra biểu mẫu bản nháp' : 'Chưa xem trước biểu mẫu bản nháp',
    },
    {
      id: 'shift-remark',
      met: remark,
      label: remark ? 'Đã hoàn thành nhận xét cuối ca' : 'Chưa có nhận xét cuối ca',
    },
    {
      id: 'responsibility',
      met: ctx.responsibility,
      label: ctx.responsibility ? 'Người kiểm tra xác nhận trách nhiệm' : 'Người kiểm tra chưa xác nhận trách nhiệm',
    },
    {
      id: 'anomalies-noted',
      met: unnoted.length === 0,
      label: unnoted.length
        ? `Còn ${unnoted.length} bất thường chưa ghi chú: ${listText(
            unnoted.map((f) => `${f.device} lúc ${f.checkpoint}`),
            2,
          )}`
        : 'Không có bất thường chưa ghi chú',
    },
  ];
}

export const signReady = (conditions: readonly SignCondition[]) => conditions.every((c) => c.met);

// ============================================================================
// Cảnh báo cảm biến
// ============================================================================

/** Cảnh báo rút gọn – `day` = ngày phát sinh "yyyy-mm-dd" (giờ nhà máy). */
export type SensorAlertLike = { code: string; kind?: string; status: string; day: string };

/** Loại cảnh báo tính là "lỗi cảm biến" (mocks/alertKinds.ts). */
export const SENSOR_FAULT_KINDS: readonly string[] = ['sensor-signal-lost'];
/** Đã xử lý (chờ đóng) hoặc đã đóng → không chặn ký. */
const HANDLED_STATUSES: readonly string[] = ['resolved', 'done'];

/** Mã cảnh báo lỗi cảm biến PHÁT SINH TRONG NGÀY báo cáo mà chưa xử lý. */
export function openSensorFaults(alerts: readonly SensorAlertLike[], day: string): string[] {
  return alerts
    .filter((a) => a.day === day && a.kind !== undefined && SENSOR_FAULT_KINDS.includes(a.kind) && !HANDLED_STATUSES.includes(a.status))
    .map((a) => a.code);
}

// ============================================================================
// Trạng thái + luồng phê duyệt
// ============================================================================

/** Nhãn badge "Trạng thái hiện tại" của báo cáo chờ Người kiểm tra. */
export function inspectorSignStatus(r: ReportRecord): { label: string; short: string; tone: 'warning' | 'danger' } {
  return r.signature.status === 'rejected'
    ? { label: 'Bị trả lại – chờ ký lại', short: 'Ký lại', tone: 'danger' }
    : { label: 'Chờ người kiểm tra ký', short: 'Chờ ký', tone: 'warning' };
}

const APPROVAL_STEP_LABEL: Record<SignatureStep, string> = {
  inspector: 'Người kiểm tra ký',
  approver: 'Người duyệt ký',
  tap: 'TAP vận hành xác nhận',
};

const STEP_SHORT: Record<SignatureStep, string> = { inspector: 'người kiểm tra', approver: 'người duyệt', tap: 'TAP vận hành' };

export type ApprovalStepView = { step: SignatureStep; label: string; detail: string; state: 'done' | 'current' | 'waiting' };

/**
 * "1. Người kiểm tra ký – Đang thực hiện - Nguyễn Văn A" · "2. Người duyệt ký – Chờ sau bước người kiểm tra - Trần Văn B" ·
 * "3. TAP vận hành xác nhận – Chờ sau bước người duyệt". Bị trả lại / chưa gửi → bước 1 là bước hiện tại.
 */
export function approvalFlow(r: ReportRecord, now: Date): ApprovalStepView[] {
  const done = signedSteps(r, now);
  const nameOf: Record<SignatureStep, string | undefined> = { inspector: r.inspector, approver: r.approver ?? 'Chưa chỉ định', tap: undefined };
  const withName = (text: string, step: SignatureStep) => (nameOf[step] ? `${text} - ${nameOf[step]}` : text);
  return SIGNATURE_STEPS.map((step, i) => {
    const label = `${i + 1}. ${APPROVAL_STEP_LABEL[step]}`;
    if (i < done) return { step, label, state: 'done', detail: withName(step === 'tap' ? 'Đã xác nhận' : 'Đã ký', step) };
    if (i === done) {
      const text = step === 'inspector' && r.signature.status === 'rejected' ? 'Ký lại sau khi bị trả lại' : 'Đang thực hiện';
      return { step, label, state: 'current', detail: withName(text, step) };
    }
    return { step, label, state: 'waiting', detail: withName(`Chờ sau bước ${STEP_SHORT[SIGNATURE_STEPS[i - 1]!]}`, step) };
  });
}

/** "Bản nháp hoàn chỉnh" khi đủ dữ liệu mọi mốc; còn thiếu → "Bản nháp chưa đủ dữ liệu". */
export function draftVersionLabel(r: ReportRecord): string {
  const p = checkpointProgress(r);
  return p.done === p.total ? 'Bản nháp hoàn chỉnh' : 'Bản nháp chưa đủ dữ liệu';
}

/** "18:10 · 24/06/2026" (giờ nhà máy). */
export function formatSignTime(now: Date): string {
  const k = plantDateTimeKey(now);
  return `${k.slice(11, 16)} · ${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}`;
}

// ============================================================================
// Ghi chữ ký
// ============================================================================

/**
 * Người kiểm tra ký → chuyển sang chờ Người duyệt, ghi nhật ký ký + giờ cập nhật. Không tự kiểm điều kiện (lớp dữ liệu
 * gọi `signConditions` trước). Ghi chú rỗng không lưu.
 */
export function applyInspectorSign(r: ReportRecord, input: { note?: string; at: Date }): ReportRecord {
  const at = plantDateTimeKey(input.at);
  const note = input.note?.trim();
  return {
    ...r,
    signature: { status: 'pending', step: 'approver' },
    updatedAt: at,
    signLog: [...(r.signLog ?? []), { step: 'inspector', by: r.inspector, at, ...(note ? { note } : {}) }],
  };
}
