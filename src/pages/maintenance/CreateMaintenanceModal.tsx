import { useEffect, useLayoutEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  Badge,
  Button,
  Checkbox,
  CheckCircleIcon,
  ChecklistEditor,
  Combobox,
  DatePicker,
  FileDropzone,
  FormField,
  Icon,
  Modal,
  PaperclipIcon,
  PeopleIcon,
  SegmentedControl,
  Select,
  SendIcon,
  ShieldIcon,
  SparkleIcon,
  Textarea,
  TextField,
  ToolsIcon,
  newChecklistItem,
  type AttachedFile,
  type ChecklistItem,
  type Severity,
} from '@/components';
import type { AlertRecord } from '@/data/alerts';
import {
  CHECKLIST_TEMPLATES,
  DEPARTMENTS,
  FORM_PRIORITY_OPTIONS,
  FORM_TYPE_OPTIONS,
  PEOPLE,
  SHIFTS,
  SOURCE_OPTIONS,
  clearMaintenanceDraft,
  departmentFor,
  durationHours,
  loadMaintenanceDraft,
  localDateTime,
  saveMaintenanceDraft,
  shiftFor,
  suggestForRequest,
  templateFor,
  type MaintenanceSource,
  type MaintenanceType,
  type NewMaintenanceInput,
  type ShiftId,
} from '@/data/maintenance';
import { actionErrorText } from '@/lib/actionError';
import { cn } from '@/lib/cn';

type FormState = {
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

type Errors = Partial<Record<'title' | 'device' | 'dueAt', string>>;

const PRIORITY_TEXT: Record<Severity, string> = { critical: 'Nghiêm trọng', high: 'Cao', medium: 'Thường', low: 'Thấp' };

function blank(device: string | null): FormState {
  const startAt = localDateTime(0);
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
    dueAt: localDateTime(24),
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
function fromAlert(a: AlertRecord, title?: string): FormState {
  const startAt = localDateTime(0);
  const priority: Severity = a.severity === 'low' ? 'medium' : a.severity;
  const tpl = templateFor(a.device, a);
  return {
    ...blank(a.device),
    title: title ?? `Kiểm tra và khắc phục: ${a.message.charAt(0).toLowerCase()}${a.message.slice(1)}`,
    description: `${a.message} – giá trị ${a.value} / ngưỡng ${a.threshold} ${a.unit}. Cần kiểm tra ngay lập tức nguyên nhân và xử lý theo quy trình.`,
    type: 'incident',
    priority,
    source: 'alert',
    referenceCode: a.code,
    startAt,
    dueAt: localDateTime(a.severity === 'critical' ? 4 : 24),
    assignee: a.assignee,
    shift: shiftFor(startAt),
    checklist: (tpl?.items ?? []).map((t) => newChecklistItem(t.replace(/^Kiểm tra trực quan van$/, `Kiểm tra trực quan van ${a.device}`))),
  };
}

function validate(f: FormState): Errors {
  const e: Errors = {};
  if (f.title.trim().length < 5) e.title = 'Nhập tên yêu cầu (ít nhất 5 ký tự).';
  if (!f.device) e.device = 'Chọn thiết bị.';
  if (!f.dueAt) e.dueAt = 'Chọn hạn hoàn thành.';
  else if (f.startAt && f.dueAt <= f.startAt) e.dueAt = 'Hạn hoàn thành phải sau thời gian bắt đầu.';
  else if (f.dueAt.slice(0, 10) < localDateTime(-1).slice(0, 10)) e.dueAt = 'Hạn hoàn thành không được trong quá khứ.';
  return e;
}

/**
 * "Tạo yêu cầu bảo trì" – theo ảnh thiết kế người dùng gửi (chưa có node Figma).
 * Hai cột thông tin · Góp ý từ AI (mock) · Checklist · Tệp đính kèm · Ghi chú & An toàn · thanh tổng quan.
 */
export function CreateMaintenanceModal({
  open,
  onClose,
  devices,
  defaultDevice,
  alert,
  defaultTitle,
  onSubmit,
  onDraftSaved,
}: {
  open: boolean;
  onClose: () => void;
  /** Danh bạ thiết bị → khu vực (setDeviceDirectory). */
  devices: readonly { device: string; area: string }[];
  defaultDevice?: string;
  /** Cảnh báo nguồn (mở từ /alerts). */
  alert?: AlertRecord;
  /** Tên yêu cầu điền sẵn thay câu suy từ cảnh báo (báo cháy "Báo động giả" → "Kiểm tra đầu báo HD-02"). */
  defaultTitle?: string;
  onSubmit: (input: NewMaintenanceInput) => Promise<unknown>;
  onDraftSaved?: () => void;
}) {
  /** Giá trị khởi tạo: cảnh báo nguồn > bản nháp > form trống. */
  const initial = (): { form: FormState; draftAt: string | null } => {
    if (alert) return { form: fromAlert(alert, defaultTitle), draftAt: null };
    const draft = loadMaintenanceDraft<FormState>();
    if (draft && !defaultDevice)
      return {
        form: { ...blank(null), ...draft.draft, attachments: draft.draft.attachments ?? [] },
        draftAt: new Date(draft.savedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }),
      };
    return { form: blank(defaultDevice ?? null), draftAt: null };
  };
  const [init] = useState(initial);
  const [form, setForm] = useState<FormState>(init.form);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  /** Lỗi khi tạo thất bại (mạng / máy chủ) – khác lỗi kiểm tra trường. */
  const [submitError, setSubmitError] = useState('');
  const [draftInfo, setDraftInfo] = useState<string | null>(init.draftAt);
  const [touched, setTouched] = useState({ department: false, shift: false });
  /** Tăng mỗi lần submit lỗi → focus trường lỗi đầu tiên sau khi render. */
  const [errorTick, setErrorTick] = useState(0);
  useEffect(() => {
    if (errorTick) document.querySelector<HTMLElement>('[role=dialog] [aria-invalid="true"]')?.focus();
  }, [errorTick]);

  // Modal được mount khi mở (trang render có điều kiện) → state khởi tạo đúng ngay lần vẽ đầu.
  // Chỉ nạp lại nếu cảnh báo nguồn tới muộn (F5 thẳng vào URL ?from=…).
  const [loadedAlert, setLoadedAlert] = useState(alert?.id);
  useLayoutEffect(() => {
    if (alert && alert.id !== loadedAlert) {
      setLoadedAlert(alert.id);
      setForm(fromAlert(alert, defaultTitle));
      setDraftInfo(null);
    }
  }, [alert, loadedAlert, defaultTitle]);

  const areaOf = (d: string | null) => (d ? devices.find((x) => x.device === d)?.area ?? 'Khác' : '');
  const suggestion = useMemo(() => suggestForRequest({ device: form.device, alert }), [form.device, alert]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (k in errors) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const setDevice = (d: string | null) =>
    setForm((f) => ({
      ...f,
      device: d,
      department: touched.department || !d ? f.department : departmentFor(d),
      checklist: f.checklist.length || !d ? f.checklist : (templateFor(d)?.items ?? []).map((t) => newChecklistItem(t)),
    }));

  const setStart = (v: string) =>
    setForm((f) => ({ ...f, startAt: v, shift: touched.shift || !v ? f.shift : shiftFor(v) }));

  const toggleSuggestion = (text: string) =>
    setForm((f) => {
      const has = f.checklist.find((c) => c.text === text);
      return { ...f, checklist: has ? f.checklist.filter((c) => c !== has) : [...f.checklist, newChecklistItem(text)] };
    });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) {
      setErrorTick((t) => t + 1);
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit({
        title: form.title,
        description: form.description,
        device: form.device!,
        area: areaOf(form.device),
        type: form.type,
        priority: form.priority,
        source: form.source,
        referenceCode: form.referenceCode,
        startAt: form.startAt,
        dueAt: form.dueAt,
        assignee: form.assignee,
        collaborators: form.collaborators,
        department: form.department ?? undefined,
        shift: form.shift,
        checklist: form.checklist,
        attachments: form.attachments,
        notes: form.notes,
        requiresPermit: form.requiresPermit,
        sourceAlertId: alert?.id,
      });
      clearMaintenanceDraft();
    } catch (err) {
      setSubmitError(actionErrorText(err));
    } finally {
      setSubmitting(false);
    }
  };

  const saveDraft = () => {
    // File thật không lưu được vào localStorage – chỉ giữ tên/dung lượng.
    saveMaintenanceDraft({ ...form, attachments: form.attachments.map(({ id, name, size }) => ({ id, name, size })) });
    onDraftSaved?.();
  };

  const hours = durationHours(form.startAt, form.dueAt);
  const steps = form.checklist.filter((c) => c.text.trim()).length;
  const people = PEOPLE.map((p) => ({ value: p.name, label: p.name, meta: p.department }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      icon={<ToolsIcon />}
      title="Tạo yêu cầu bảo trì"
      description="Tạo công việc kiểm tra, sửa chữa hoặc bảo dưỡng thiết bị"
      onSubmit={handleSubmit}
      dismissOnBackdrop={false}
      footerStart={
        <button type="button" onClick={onClose} className="rounded-sm px-1 text-base text-fg-secondary hover:text-fg">
          Hủy
        </button>
      }
      footer={
        <>
          <Button onClick={saveDraft}>Lưu nháp</Button>
          <Button variant="primary" type="submit" disabled={submitting}>
            Tạo yêu cầu
            <SendIcon />
          </Button>
        </>
      }
    >
      {/* Liên kết cảnh báo */}
      {alert && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-danger-strong/30 bg-danger-strong/10 px-4 py-3">
          {/* eslint-disable-next-line no-restricted-syntax -- icon, không phải chữ */}
          <AlertTriangleIcon className="shrink-0 text-danger-strong" />
          <p className="min-w-0 flex-1 text-sm text-fg">
            Liên kết với cảnh báo <span className="font-semibold text-danger-text">{alert.code}</span> ({alert.message} tại{' '}
            {alert.area} {alert.device})
          </p>
          <Badge variant="severity" value={alert.severity} size="md" />
          <Link to={`/alerts?alert=${encodeURIComponent(alert.id)}`} className="inline-flex items-center gap-1 rounded-sm text-sm text-accent underline">
            Xem cảnh báo
            <ArrowRightIcon />
          </Link>
        </div>
      )}
      {draftInfo && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-info/20 bg-info/10 px-4 py-2.5 text-sm text-info">
          Đã khôi phục bản nháp lưu lúc {draftInfo}.
          <Button
            variant="link"
            onClick={() => {
              clearMaintenanceDraft();
              setForm(blank(null));
              setDraftInfo(null);
            }}
            className="ml-auto"
          >
            Bỏ nháp
          </Button>
        </div>
      )}

      {/* Hai cột thông tin */}
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <TextField
            label="Tên yêu cầu bảo trì"
            required
            value={form.title}
            onChange={(v) => set('title', v)}
            error={errors.title}
            placeholder="Ví dụ: Kiểm tra và khắc phục sự cố tăng áp suất van V-101"
            maxLength={160}
          />
          <Textarea label="Mô tả chi tiết" value={form.description} onChange={(v) => set('description', v)} rows={3} maxLength={1000} placeholder="Hiện tượng, phạm vi công việc, yêu cầu đặc biệt…" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Loại bảo trì">
              {({ id, labelId }) => (
                <Select variant="field" id={id} labelledBy={labelId} label="Loại bảo trì" options={FORM_TYPE_OPTIONS} value={form.type} onChange={(v) => v && set('type', v)} />
              )}
            </FormField>
            <FormField label="Mức độ ưu tiên">
              {({ id, labelId }) => (
                <SegmentedControl
                  variant="field"
                  id={id}
                  labelledBy={labelId}
                  label="Mức độ ưu tiên"
                  options={FORM_PRIORITY_OPTIONS}
                  value={form.priority === 'low' ? 'medium' : form.priority}
                  onChange={(v) => set('priority', v as Severity)}
                />
              )}
            </FormField>
            <FormField label="Thiết bị" required error={errors.device}>
              {({ id, labelId, describedBy, invalid }) => (
                <Combobox
                  id={id}
                  labelledBy={labelId}
                  describedBy={describedBy}
                  invalid={invalid}
                  leading={<Icon name="search" box={16} />}
                  placeholder="Tìm mã thiết bị…"
                  options={devices.map((d) => ({ value: d.device, label: d.device, meta: d.area }))}
                  value={form.device}
                  onChange={(v) => {
                    setDevice(v);
                    if (errors.device) setErrors((e) => ({ ...e, device: undefined }));
                  }}
                  clearable={false}
                />
              )}
            </FormField>
            <TextField label="Khu vực" value={form.device ? `Khu vực ${areaOf(form.device)}` : ''} onChange={() => undefined} readOnly placeholder="Tự điền theo thiết bị" className="[&_input]:bg-surface-muted [&_input]:text-fg-secondary" />
          </div>
          <FormField label="Phòng ban phụ trách">
            {({ id, labelId }) => (
              <Select
                variant="field"
                id={id}
                labelledBy={labelId}
                label="Phòng ban phụ trách"
                placeholder="Chọn phòng ban"
                options={DEPARTMENTS.map((d) => ({ value: d, label: d }))}
                value={form.department}
                onChange={(v) => {
                  setTouched((t) => ({ ...t, department: true }));
                  set('department', v);
                }}
              />
            )}
          </FormField>
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Nguồn tạo yêu cầu">
              {({ id, labelId }) => (
                <Select variant="field" id={id} labelledBy={labelId} label="Nguồn tạo yêu cầu" options={SOURCE_OPTIONS} value={form.source} onChange={(v) => v && set('source', v)} />
              )}
            </FormField>
            <TextField label="Mã tham chiếu / Cảnh báo" value={form.referenceCode} onChange={(v) => set('referenceCode', v)} placeholder="ALT-…" />
            <DatePicker type="datetime-local" label="Thời gian bắt đầu dự kiến" value={form.startAt} onChange={setStart} />
            <DatePicker type="datetime-local" label="Hạn hoàn thành" required value={form.dueAt} min={form.startAt || undefined} onChange={(v) => set('dueAt', v)} error={errors.dueAt} />
          </div>
          <FormField label="Người phụ trách chính" hint={form.assignee ? undefined : 'Để trống → trạng thái "Chờ tiếp nhận".'}>
            {({ id, labelId, describedBy }) => (
              <Combobox id={id} labelledBy={labelId} describedBy={describedBy} showAvatar placeholder="Chọn người phụ trách…" options={people} value={form.assignee} onChange={(v) => set('assignee', v)} />
            )}
          </FormField>
          <FormField label="Người phối hợp">
            {({ id, labelId }) => (
              <Combobox
                multiple
                id={id}
                labelledBy={labelId}
                showAvatar
                leading={<PeopleIcon />}
                placeholder="Tìm kiếm nhân sự…"
                options={people.filter((p) => p.value !== form.assignee)}
                value={form.collaborators}
                onChange={(v) => set('collaborators', v)}
              />
            )}
          </FormField>
          <FormField label="Ca vận hành">
            {({ id, labelId }) => (
              <Select
                variant="field"
                id={id}
                labelledBy={labelId}
                label="Ca vận hành"
                options={SHIFTS}
                value={form.shift}
                onChange={(v) => {
                  if (!v) return;
                  setTouched((t) => ({ ...t, shift: true }));
                  set('shift', v);
                }}
              />
            )}
          </FormField>
        </div>
      </div>

      {/* Góp ý từ AI (mock) */}
      {suggestion && (
        <section aria-labelledby="ai-title" className="flex flex-col gap-3 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <h3 id="ai-title" className="flex items-center gap-2 text-sm font-bold uppercase tracking-label text-accent">
              <SparkleIcon />
              Góp ý từ AI
            </h3>
            <span className="rounded-sm bg-accent/20 px-2 py-0.5 text-2xs font-bold uppercase text-accent">AI hỗ trợ</span>
          </div>
          <p className="text-sm italic text-fg-muted/70">AI phân tích dữ liệu vận hành liên quan và đưa ra gợi ý hỗ trợ tạo yêu cầu bảo trì.</p>
          <p className="rounded-md bg-surface-sunken/60 px-3 py-2.5 text-sm text-fg">
            <span className="font-semibold text-accent">Đánh giá:</span> {suggestion.assessment}
          </p>
          <div className="flex flex-col gap-2">
            <span className="text-sm text-fg-secondary">Gợi ý kiểm tra (bấm để thêm vào checklist):</span>
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {suggestion.checks.map((c) => {
                const added = form.checklist.some((x) => x.text === c);
                return (
                  <li key={c}>
                    <button
                      type="button"
                      aria-pressed={added}
                      onClick={() => toggleSuggestion(c)}
                      className={cn('inline-flex items-center gap-1.5 rounded-sm text-sm hover:text-fg', added ? 'text-success' : 'text-fg-secondary')}
                    >
                      <CheckCircleIcon className={added ? 'text-success' : 'text-accent'} />
                      {c}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <p className="text-2xs text-fg-muted/65">* AI chỉ hỗ trợ thông tin và góp ý. Admin là người xác nhận nội dung cuối cùng của yêu cầu bảo trì.</p>
        </section>
      )}

      <hr className="border-line/30" />

      <ChecklistEditor items={form.checklist} onChange={(v) => set('checklist', v)} templates={CHECKLIST_TEMPLATES} />

      {/* Tệp đính kèm + Ghi chú & An toàn */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section aria-labelledby="att-title" className="flex flex-col gap-3">
          <h3 id="att-title" className="flex items-center gap-2 text-lg font-semibold text-fg">
            <PaperclipIcon className="text-fg-secondary" />
            Tệp đính kèm
          </h3>
          <FileDropzone files={form.attachments} onChange={(v) => set('attachments', v)} accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xlsx" />
        </section>
        <section aria-labelledby="note-title" className="flex flex-col gap-3">
          <h3 id="note-title" className="flex items-center gap-2 text-lg font-semibold text-fg">
            <ShieldIcon className="text-fg-secondary" />
            Ghi chú &amp; An toàn
          </h3>
          <Textarea label="Ghi chú nội bộ" value={form.notes} onChange={(v) => set('notes', v)} rows={4} placeholder="Thêm ghi chú nội bộ hoặc lưu ý an toàn…" className="[&>label]:sr-only" />
          {/* Nhãn hiển thị = tên truy cập (WCAG 2.5.3), bấm chữ cũng chọn; không lồng <label>. */}
          <Checkbox
            showLabel
            label="Công việc yêu cầu tuân thủ quy trình Giấy phép Làm việc (Permit to Work - PTW)."
            checked={form.requiresPermit}
            onChange={(v) => set('requiresPermit', v)}
            className="items-start gap-3"
          />
        </section>
      </div>

      {/* Tổng quan */}
      {submitError && (
        <p role="alert" className="text-sm text-danger-text">
          {submitError}
        </p>
      )}

      <dl aria-label="Tổng quan yêu cầu" className="flex flex-wrap gap-x-8 gap-y-3 rounded-lg border border-line/30 bg-surface-raised px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <dt className="text-2xs uppercase tracking-label text-fg-muted/65">Tổng quan</dt>
          <dd className="text-sm text-fg">
            {form.device ? 1 : 0} Thiết bị • {steps} Bước thực hiện
          </dd>
        </div>
        <div className="flex flex-col gap-0.5 border-l border-line/30 pl-8">
          <dt className="text-2xs uppercase tracking-label text-fg-muted/65">Mức độ</dt>
          <dd className={cn('text-sm font-semibold', form.priority === 'critical' ? 'text-danger-text' : form.priority === 'high' ? 'text-warning' : 'text-fg')}>
            {form.priority === 'critical' && '! '}
            {PRIORITY_TEXT[form.priority]}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5 border-l border-line/30 pl-8">
          <dt className="text-2xs uppercase tracking-label text-fg-muted/65">Thời lượng dự kiến</dt>
          <dd className="text-sm text-fg">{hours !== null && hours > 0 ? `${hours} giờ` : '–'}</dd>
        </div>
        {form.requiresPermit && (
          <div className="flex flex-col gap-0.5 border-l border-line/30 pl-8">
            <dt className="text-2xs uppercase tracking-label text-fg-muted/65">An toàn</dt>
            <dd className="text-sm text-warning">Cần PTW</dd>
          </div>
        )}
      </dl>
    </Modal>
  );
}
