import { newChecklistItem, type AttachedFile, type ChecklistItem, type Severity } from '@/components';
import type { AlertRecord } from '@/data/alerts';
import {
  departmentFor,
  shiftFor,
  templateFor,
  type MaintenanceSource,
  type MaintenanceType,
  type NewMaintenanceInput,
  type ShiftId,
} from '@/data/maintenance';
import { withUnit } from '@/lib/number';
import { plantDayKey, plantHourFromNow } from '@/lib/plantTime';

/** Giá trị form "Tạo yêu cầu bảo trì" (cũng là dạng lưu nháp – tệp chỉ giữ tên / dung lượng). */
export type CreateFormValues = {
  title: string;
  description: string;
  type: MaintenanceType;
  priority: Severity;
  device: string | null;
  department: string | null;
  source: MaintenanceSource;
  referenceCode: string;
  startAt: string;
  dueAt: string;
  assignee: string | null;
  collaborators: string[];
  shift: ShiftId;
  checklist: ChecklistItem[];
  attachments: AttachedFile[];
  notes: string;
  requiresPermit: boolean;
};

export type CreateErrors = Partial<Record<'title' | 'device' | 'dueAt', string>>;

export const PRIORITY_TEXT: Record<Severity, string> = { critical: 'Nghiêm trọng', high: 'Cao', medium: 'Thường', low: 'Thấp' };

/**
 * Form trống: bắt đầu = giờ chẵn kế tiếp, hạn = +24 giờ (giờ nhà máy, tính từ `now`), phòng ban theo thiết bị (nếu có), ca
 * theo giờ bắt đầu.
 */
export function blankForm(device: string | null, now: Date): CreateFormValues {
  const startAt = plantHourFromNow(now);
  return {
    title: '',
    description: '',
    type: 'incident',
    priority: 'medium',
    device,
    department: device ? departmentFor(device) : null,
    source: 'manual',
    referenceCode: '',
    startAt,
    dueAt: plantHourFromNow(now, 24),
    assignee: null,
    collaborators: [],
    shift: shiftFor(startAt),
    checklist: [],
    attachments: [],
    notes: '',
    requiresPermit: false,
  };
}

/** Điền sẵn từ cảnh báo (ảnh thiết kế: ALT-00128 → "Kiểm tra và khắc phục sự cố tăng áp suất van V-101"). */
export function formFromAlert(a: AlertRecord, now: Date, title?: string): CreateFormValues {
  const startAt = plantHourFromNow(now);
  const priority: Severity = a.severity === 'low' ? 'medium' : a.severity;
  const tpl = templateFor(a.device, a);
  return {
    ...blankForm(a.device, now),
    title: title ?? `Kiểm tra và khắc phục: ${a.message.charAt(0).toLowerCase()}${a.message.slice(1)}`,
    description: `${a.message} – giá trị ${a.value} / ngưỡng ${withUnit(a.threshold, a.unit)}. Cần kiểm tra ngay lập tức nguyên nhân và xử lý theo quy trình.`,
    type: 'incident',
    priority,
    source: 'alert',
    referenceCode: a.code,
    startAt,
    dueAt: plantHourFromNow(now, a.severity === 'critical' ? 4 : 24),
    assignee: a.assignee,
    shift: shiftFor(startAt),
    checklist: (tpl?.items ?? []).map((t) => newChecklistItem(t.replace(/^Kiểm tra trực quan van$/, `Kiểm tra trực quan van ${a.device}`))),
  };
}

/** Lỗi trường bắt buộc: tên ≥ 5 ký tự, thiết bị, hạn (sau giờ bắt đầu, không trước HÔM NAY theo giờ nhà máy). */
export function validateCreate(f: CreateFormValues, now: Date): CreateErrors {
  const e: CreateErrors = {};
  if (f.title.trim().length < 5) e.title = 'Nhập tên yêu cầu (ít nhất 5 ký tự).';
  if (!f.device) e.device = 'Chọn thiết bị.';
  if (!f.dueAt) e.dueAt = 'Chọn hạn hoàn thành.';
  else if (f.startAt && f.dueAt <= f.startAt) e.dueAt = 'Hạn hoàn thành phải sau thời gian bắt đầu.';
  else if (f.dueAt.slice(0, 10) < plantDayKey(now)) e.dueAt = 'Hạn hoàn thành không được trong quá khứ.';
  return e;
}

/** Dữ liệu gửi đi (form đã hợp lệ – có thiết bị). `area` theo danh bạ thiết bị. */
export function toCreateInput(f: CreateFormValues, area: string, alert: AlertRecord | undefined): NewMaintenanceInput {
  return {
    title: f.title,
    description: f.description,
    device: f.device!,
    area,
    type: f.type,
    priority: f.priority,
    source: f.source,
    referenceCode: f.referenceCode,
    startAt: f.startAt,
    dueAt: f.dueAt,
    assignee: f.assignee,
    collaborators: f.collaborators,
    department: f.department ?? undefined,
    shift: f.shift,
    checklist: f.checklist,
    attachments: f.attachments,
    notes: f.notes,
    requiresPermit: f.requiresPermit,
    sourceAlertId: alert?.id,
  };
}

// ---------------- Reducer ----------------

export type CreateFormState = {
  form: CreateFormValues;
  errors: CreateErrors;
  submitting: boolean;
  /** Lỗi khi tạo thất bại (mạng / máy chủ) – khác lỗi kiểm tra trường. */
  submitError: string;
  /** Giờ lưu của nháp đang khôi phục (dải "Đã khôi phục bản nháp…"). */
  draftInfo: string | null;
  /** Người dùng đã chọn tay → không tự điền lại theo thiết bị / giờ bắt đầu. */
  touched: { department: boolean; shift: boolean };
  /** Tăng mỗi lần gửi bị chặn → focus trường lỗi đầu tiên sau khi render. */
  errorTick: number;
};

export type CreateFormAction =
  | { type: 'set'; key: keyof CreateFormValues; value: CreateFormValues[keyof CreateFormValues] }
  | { type: 'device'; device: string | null }
  | { type: 'start'; startAt: string }
  | { type: 'department'; department: string | null }
  | { type: 'shift'; shift: ShiftId }
  | { type: 'toggle-suggestion'; text: string }
  | { type: 'reset'; form: CreateFormValues }
  | { type: 'invalid'; errors: CreateErrors }
  | { type: 'submit-start' }
  | { type: 'submit-end'; error?: string };

const clearError = (errors: CreateErrors, key: string): CreateErrors => (key in errors ? { ...errors, [key]: undefined } : errors);

/** Chọn thiết bị → tự điền phòng ban (nếu người dùng chưa chọn) và checklist mẫu (nếu checklist còn trống). */
function withDevice(s: CreateFormState, d: Extract<CreateFormAction, { type: 'device' }>['device']): CreateFormState {
  const f = s.form;
  return {
    ...s,
    form: {
      ...f,
      device: d,
      department: s.touched.department || !d ? f.department : departmentFor(d),
      checklist: f.checklist.length || !d ? f.checklist : (templateFor(d)?.items ?? []).map((t) => newChecklistItem(t)),
    },
    errors: s.errors.device ? { ...s.errors, device: undefined } : s.errors,
  };
}

export function createFormReducer(s: CreateFormState, a: CreateFormAction): CreateFormState {
  switch (a.type) {
    case 'set':
      return { ...s, form: { ...s.form, [a.key]: a.value }, errors: clearError(s.errors, a.key) };
    case 'device':
      return withDevice(s, a.device);
    case 'start':
      return { ...s, form: { ...s.form, startAt: a.startAt, shift: s.touched.shift || !a.startAt ? s.form.shift : shiftFor(a.startAt) } };
    case 'department':
      return {
        ...s,
        touched: { ...s.touched, department: true },
        form: { ...s.form, department: a.department },
        errors: clearError(s.errors, 'department'),
      };
    case 'shift':
      return { ...s, touched: { ...s.touched, shift: true }, form: { ...s.form, shift: a.shift }, errors: clearError(s.errors, 'shift') };
    case 'toggle-suggestion': {
      const list = s.form.checklist;
      const has = list.find((c) => c.text === a.text);
      return { ...s, form: { ...s.form, checklist: has ? list.filter((c) => c !== has) : [...list, newChecklistItem(a.text)] } };
    }
    case 'reset':
      return { ...s, form: a.form, draftInfo: null };
    case 'invalid':
      return { ...s, errors: a.errors, errorTick: s.errorTick + 1 };
    case 'submit-start':
      return { ...s, errors: {}, submitting: true, submitError: '' };
    case 'submit-end':
      return { ...s, submitting: false, submitError: a.error ?? s.submitError };
  }
}
