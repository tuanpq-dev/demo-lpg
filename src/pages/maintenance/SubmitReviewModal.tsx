import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  AlertCircleIcon,
  Badge,
  Button,
  CheckCircleIcon,
  Checklist,
  DatePicker,
  EyeIcon,
  FormField,
  KpiCard,
  Modal,
  Select,
  StatusOptionGroup,
  Textarea,
  type KpiTone,
  type StatusOption,
} from '@/components';
import type { Reading } from '@/data/assetDetail';
import { REVIEWERS, STATUS_LABEL, dueHasTime, type MaintenanceRecord } from '@/data/maintenance';
import { clearSubmitDraft, loadSubmitDraft, saveSubmitDraft, useRelatedDevice, type SubmitDraft } from '@/data/maintenanceDetail';
import { checklistProgress } from '@/features/maintenance/checklist';
import { deadlineDayLabel } from '@/features/maintenance/deadline';
import { isNearOrPastDue, reportedProgressOf, type ProgressFile } from '@/features/maintenance/progress';
import {
  DEVICE_CONDITION_OPTIONS,
  SENSOR_STATUS_OPTIONS,
  defaultProposedAt,
  VALVE_STATUS_OPTIONS,
  snapshotReading,
  submitMissing,
  type DeviceCondition,
  type SensorStatus,
  type SubmitForm,
  type SubmitInput,
  type ValveStatus,
} from '@/features/maintenance/review';
import { actionErrorText } from '@/lib/actionError';
import { announce } from '@/lib/announce';
import { appNow } from '@/lib/demoNow';
import { plantDateTimeKey } from '@/lib/plantTime';
import { useNow } from '@/lib/useNow';

const CONDITION_ICON: Record<DeviceCondition, ReactNode> = {
  normal: <CheckCircleIcon size={22} />,
  monitor: <EyeIcon size={22} />,
  unresolved: <AlertCircleIcon size={22} />,
};
const CONDITION_TONE = { normal: 'primary', monitor: 'warning', unresolved: 'danger' } as const;

// Bình thường = chữ trắng (ảnh); vượt ngưỡng mới tô màu.
const readingTone = (r: Reading): KpiTone => (r.status === 'danger' ? 'danger' : r.status === 'warning' ? 'warning' : 'neutral');

export type SubmitReviewModalProps = {
  record: MaintenanceRecord;
  onClose: () => void;
  /** Ghi bản ghi – modal đã kiểm tra đủ điều kiện + chụp số liệu trước khi gọi. */
  onSubmit: (input: SubmitInput) => Promise<void>;
  /** Từ modal "Cập nhật tiến độ" (chọn Hoàn thành → "Tiếp tục gửi nghiệm thu"): nội dung → Tóm tắt, tệp đã thêm. */
  prefill?: { text?: string; files?: readonly ProgressFile[] };
};

const EMPTY = (now: Date): Omit<SubmitDraft, 'savedAt'> => ({
  summary: '',
  cause: '',
  remedy: '',
  deviceCondition: 'normal',
  sensorStatus: 'normal',
  valveStatus: 'stable',
  reviewer: null,
  proposedAt: defaultProposedAt(now),
});

/** Ô chọn trạng thái nhỏ (Cảm biến / Van xả) – cùng khung với ô số liệu. */
function SelectTile<V extends string>({ label, value, options, onChange }: { label: string; value: V; options: readonly { value: V; label: string }[]; onChange: (v: V) => void }) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-md border border-line/30 px-3.5 py-3">
      <span id={`${id}-l`} className="text-base text-fg-secondary">
        {label}
      </span>
      <Select variant="field" id={id} labelledBy={`${id}-l`} label={label} options={options} value={value} onChange={(v) => v && onChange(v)} />
    </div>
  );
}

/**
 * Modal "Gửi yêu cầu nghiệm thu" – ảnh thiết kế (chưa có node Figma; số đo ước lượng, lệch ghi docs/figma-diffs.md). Kỹ thuật viên,
 * in-progress → review. Điều kiện + ghi bản ghi: `features/maintenance/review.ts`. Nháp: sessionStorage theo mã (không đổi trạng thái).
 * Áp suất / nhiệt độ: hiện số trực tiếp, CHỤP lại lúc bấm Gửi (không đổi theo live sau đó). Chỉ mount khi mở.
 */
export function SubmitReviewModal({ record: r, onClose, onSubmit, prefill }: SubmitReviewModalProps) {
  const now = useNow(30_000);
  const device = useRelatedDevice(r.device);
  const uid = useId();
  const missingId = `${uid}-missing`;
  const conditionId = `${uid}-condition`;
  const conditionNoteId = `${uid}-condition-note`;
  const keepEditingRef = useRef<HTMLButtonElement>(null);

  const [initial] = useState(() => {
    const draft = loadSubmitDraft(r.id);
    const base = EMPTY(appNow());
    const values = draft ? { ...draft } : { ...base };
    if (prefill?.text?.trim() && !values.summary.trim()) values.summary = prefill.text.trim();
    return { base, draft, values };
  });
  const [v, setV] = useState(initial.values);
  const [hasDraft, setHasDraft] = useState(!!initial.draft);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) => {
    setV((cur) => ({ ...cur, [k]: value }));
    setError('');
  };

  useEffect(() => {
    if (confirming) keepEditingRef.current?.focus();
  }, [confirming]);

  const form: SubmitForm = { ...v, proposedAt: v.proposedAt || undefined };
  const missing = submitMissing(r, form);
  const eligible = missing.length === 0;
  const dirty = (Object.keys(initial.base) as (keyof typeof v)[]).some((k) => v[k] !== initial.base[k]);
  const checklist = r.checklist?.length ? checklistProgress(r.checklist) : null;
  const hasTime = dueHasTime(r);
  const dueRed = isNearOrPastDue(r.dueAt, now, hasTime);
  const files = prefill?.files ?? [];

  const reviewerOptions = REVIEWERS.filter((p) => p.name !== r.assignee).map((p) => ({ value: p.name, label: `${p.name} (${p.title})` }));

  const conditionOptions: StatusOption<DeviceCondition>[] = DEVICE_CONDITION_OPTIONS.map((o) => ({
    id: o.id,
    label: o.label,
    icon: CONDITION_ICON[o.id],
    tone: CONDITION_TONE[o.id],
  }));

  const toDraft = (): SubmitDraft => ({ ...v, savedAt: new Date().toISOString() });

  const submit = async () => {
    // Nút "Gửi nghiệm thu" aria-disabled đã chặn click/Enter/gửi ngầm (Button) – chặn thêm ở đây cho chắc.
    if (!eligible) return;
    // Chụp số liệu ĐÚNG lúc gửi (bản sao số – không tham chiếu live).
    const live = device.kind === 'live' ? device : null;
    const readings: SubmitInput['readings'] = {
      ...(live ? { pressure: snapshotReading(live.pressure, { tag: live.tags.pressure, warn: live.limits.pressure }) } : {}),
      ...(live ? { temperature: snapshotReading(live.temperature, { tag: live.tags.temperature, warn: live.limits.temperature }) } : {}),
      at: plantDateTimeKey(appNow()),
    };
    setSubmitting(true);
    try {
      await onSubmit({ ...form, readings, files });
      clearSubmitDraft(r.id);
    } catch (e) {
      setError(actionErrorText(e));
    } finally {
      setSubmitting(false);
    }
  };

  const onSaveDraft = () => {
    if (!saveSubmitDraft(r.id, toDraft())) {
      setError('Không lưu được nháp (bộ nhớ trình duyệt không khả dụng).');
      return;
    }
    setHasDraft(true);
    announce(`Đã lưu nháp gửi nghiệm thu ${r.code}${files.length ? ' – tệp đính kèm không được lưu trong nháp' : ''}.`);
    onClose();
  };

  const requestClose = () => {
    if (confirming) return setConfirming(false);
    if (dirty || hasDraft || files.length) setConfirming(true);
    else onClose();
  };

  const discard = () => {
    clearSubmitDraft(r.id);
    onClose();
  };

  const footer = confirming ? (
    <>
      <Button ref={keepEditingRef} variant="subtle" onClick={() => setConfirming(false)}>
        Tiếp tục sửa
      </Button>
      <Button variant="primary" onClick={discard}>
        {hasDraft ? 'Bỏ thay đổi và xóa nháp' : 'Bỏ thay đổi'}
      </Button>
    </>
  ) : (
    <>
      <Button variant="plain" onClick={requestClose}>
        Hủy
      </Button>
      <Button variant="subtle" onClick={onSaveDraft}>
        Lưu nháp
      </Button>
      <Button type="submit" variant="primary" aria-disabled={!eligible || submitting || undefined} aria-describedby={eligible ? undefined : missingId}>
        Gửi nghiệm thu
      </Button>
    </>
  );

  const reading = (label: string, unit: string, rd: Reading | undefined) =>
    rd ? (
      <KpiCard size="sm" emphasis label={label} value={rd.value?.toFixed(1) ?? '—'} unit={unit} tone={readingTone(rd)} signalLost={rd.state === 'lost'} />
    ) : (
      <KpiCard size="sm" emphasis label={label} value="—" footnote="Không có số liệu trực tiếp" />
    );

  return (
    <Modal
      open
      size="xl"
      titleTone="primary"
      title="Gửi yêu cầu nghiệm thu"
      description="Kiểm tra và xác nhận đầy đủ kết quả bảo trì trước khi gửi nghiệm thu"
      onClose={requestClose}
      dismissOnBackdrop={false}
      onSubmit={(e) => {
        e.preventDefault();
        if (!confirming && !submitting) void submit();
      }}
      footerStart={
        confirming ? (
          <p role="alert" className="text-base text-fg">
            {hasDraft ? 'Bỏ các thay đổi và xóa bản nháp đã lưu?' : 'Bỏ các thay đổi chưa lưu?'}
          </p>
        ) : undefined
      }
      footer={footer}
    >
      <div className="flex flex-col gap-5 py-1">
        {initial.draft && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-fg-secondary">
            <Badge variant="tag" tone="neutral">
              Bản nháp
            </Badge>
            Đang mở bản nháp đã lưu.
          </p>
        )}

        {/* Thẻ đầu */}
        <section aria-label={`Yêu cầu ${r.code}`} className="flex flex-col gap-4 rounded-lg border border-line-card bg-surface-raised/40 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-lg text-fg">
                <span className="font-semibold">{r.code}</span>
                <span aria-hidden="true" className="mx-2 text-fg-secondary">
                  |
                </span>
                <span className="sr-only"> – </span>
                {r.title}
              </p>
              <p className="text-sm text-fg-secondary">
                Thiết bị: {r.device} <span aria-hidden="true">|</span>
                <span className="sr-only">,</span> Khu vực: {r.area}
              </p>
            </div>
            <Badge variant="tag" size="md" tone={eligible ? 'success' : 'danger'}>
              {eligible ? 'Đủ điều kiện gửi nghiệm thu' : 'Chưa đủ điều kiện'}
            </Badge>
          </div>
          <dl className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <dt className="text-sm text-fg-secondary">Nhân sự</dt>
              <dd className="text-md font-semibold text-fg">{r.assignee ?? 'Chưa phân công'}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-sm text-fg-secondary">Tiến độ</dt>
              <dd className="text-md font-semibold text-success">
                {reportedProgressOf(r)}% <span aria-hidden="true">|</span>
                <span className="sr-only">,</span> {STATUS_LABEL[r.status]}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-sm text-fg-secondary">Hạn chót</dt>
              <dd className={dueRed ? 'text-md font-semibold text-danger-text' : 'text-md font-semibold text-fg'}>{deadlineDayLabel(r.dueAt, now, hasTime)}</dd>
            </div>
          </dl>
          {!eligible && (
            <div id={missingId} className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-fg">
              <p className="font-semibold">Chưa đủ điều kiện gửi – còn thiếu:</p>
              <ul className="mt-1 list-disc pl-5">
                {missing.map((m) => (
                  <li key={m.id}>{m.label}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <div data-field="summary">
          <Textarea labelVariant="section" label="Tóm tắt công việc" required value={v.summary} onChange={(x) => set('summary', x)} rows={2} maxLength={1000} placeholder="Các việc đã làm, kết quả kiểm tra…" />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <section className="flex min-w-0 flex-col gap-3" aria-labelledby={`${uid}-cl`}>
            <div className="flex items-center justify-between gap-2">
              <h3 id={`${uid}-cl`} className="text-lg font-semibold text-fg-secondary">
                Checklist hoàn thành
              </h3>
              {checklist && (
                <span className={checklist.done === checklist.total ? 'text-lg font-semibold tabular-nums text-success' : 'text-lg font-semibold tabular-nums text-warning'}>
                  {checklist.done}/{checklist.total}
                  <span className="sr-only"> mục hoàn thành</span>
                </span>
              )}
            </div>
            <div className="flex-1 rounded-md border border-line/30 px-4 py-3">
              {checklist ? (
                <Checklist variant="summary" items={r.checklist!} progress={checklist} />
              ) : (
                <p className="text-base text-fg-secondary">Yêu cầu không có checklist.</p>
              )}
            </div>
          </section>
          <div data-field="cause" className="flex min-w-0 flex-col">
            <Textarea labelVariant="section" label="Nguyên nhân xác định" required value={v.cause} onChange={(x) => set('cause', x)} rows={10} maxLength={1000} placeholder="Nguyên nhân gốc của sự cố / bất thường…" />
          </div>
        </div>

        <div data-field="remedy">
          <Textarea labelVariant="section" label="Biện pháp" required value={v.remedy} onChange={(x) => set('remedy', x)} rows={2} maxLength={1000} placeholder="Biện pháp đã thực hiện để khắc phục…" />
        </div>

        <section className="flex flex-col gap-3">
          <h3 id={conditionId} className="text-lg font-semibold text-fg-secondary">
            Tình trạng thiết bị sau bảo trì
          </h3>
          <StatusOptionGroup
            label="Tình trạng thiết bị sau bảo trì"
            labelledBy={conditionId}
            describedBy={v.deviceCondition === 'unresolved' ? conditionNoteId : undefined}
            columns={3}
            options={conditionOptions}
            value={v.deviceCondition}
            onChange={(x) => set('deviceCondition', x)}
          />
          {v.deviceCondition === 'unresolved' && (
            <p id={conditionNoteId} className="flex items-center gap-2 text-sm text-warning">
              <AlertCircleIcon size={16} className="shrink-0" />
              Thiết bị chưa khắc phục – vẫn gửi được, người nghiệm thu sẽ xem xét. Nêu rõ phần còn tồn tại trong Biện pháp.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-6">
            {reading('Áp suất', 'bar', device.kind === 'live' ? device.pressure : undefined)}
            {reading('Nhiệt độ', '°C', device.kind === 'live' ? device.temperature : undefined)}
            <SelectTile<SensorStatus> label="Cảm biến" value={v.sensorStatus} options={SENSOR_STATUS_OPTIONS} onChange={(x) => set('sensorStatus', x)} />
            <SelectTile<ValveStatus> label="Van xả" value={v.valveStatus} options={VALVE_STATUS_OPTIONS} onChange={(x) => set('valveStatus', x)} />
          </div>
          {device.kind === 'live' && (
            <p className="text-sm text-fg-secondary">
              Áp suất ({device.tags.pressure}) và nhiệt độ ({device.tags.temperature}) là số liệu trực tiếp – được chụp lại lúc bấm “Gửi nghiệm thu”.
            </p>
          )}
        </section>

        <div className="grid gap-5 md:grid-cols-2">
          <div data-field="reviewer">
            <FormField labelVariant="section" label="Người nghiệm thu" required hint="Phải khác người thực hiện.">
              {({ id, labelId, describedBy }) => (
                <Select
                  variant="field"
                  id={id}
                  labelledBy={labelId}
                  describedBy={describedBy}
                  label="Người nghiệm thu"
                  placeholder="Chọn người nghiệm thu"
                  options={reviewerOptions}
                  value={v.reviewer}
                  onChange={(x) => set('reviewer', x)}
                />
              )}
            </FormField>
          </div>
          <DatePicker labelVariant="section" type="datetime-local" label="Thời gian đề nghị" value={v.proposedAt} onChange={(x) => set('proposedAt', x)} hint="Mặc định: sau 30 phút (làm tròn mốc 15 phút) – sửa được, không bắt buộc." />
        </div>

        {files.length > 0 && <p className="text-sm text-fg-secondary">Kèm {files.length} tệp đã thêm ở bước cập nhật tiến độ (chưa tải lên máy chủ).</p>}

        {error && (
          <p role="alert" className="text-sm text-danger-text">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
