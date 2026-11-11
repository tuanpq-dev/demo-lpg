import { useId, useState } from 'react';
import { Badge, Button, DatePicker, FormField, Modal, Select, Textarea, DiscardConfirmButtons } from '@/components';
import { REVIEWERS, type MaintenanceRecord } from '@/data/maintenance';
import { clearSubmitDraft, loadSubmitDraft, saveSubmitDraft, useRelatedDevice, type SubmitDraft } from '@/data/maintenanceDetail';
import type { ProgressFile } from '@/features/maintenance/progress';
import { defaultProposedAt, snapshotReading, submitMissing, type SubmitForm, type SubmitInput } from '@/features/maintenance/review';
import { announce } from '@/lib/announce';
import { appNow } from '@/lib/demoNow';
import { plantDateTimeKey } from '@/lib/plantTime';
import { useNow } from '@/lib/useNow';
import { useFormModal } from '@/lib/useFormModal';
import { ChecklistSection, DeviceConditionSection, SubmitSummaryCard } from './submit/SubmitParts';

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

  const [initial] = useState(() => {
    const draft = loadSubmitDraft(r.id);
    const base = EMPTY(appNow());
    const values = draft ? { ...draft } : { ...base };
    if (prefill?.text?.trim() && !values.summary.trim()) values.summary = prefill.text.trim();
    return { base, draft, values };
  });
  const [v, setV] = useState(initial.values);
  const [error, setError] = useState('');
  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) => {
    setV((cur) => ({ ...cur, [k]: value }));
    setError('');
  };

  const form: SubmitForm = { ...v, proposedAt: v.proposedAt || undefined };
  const missing = submitMissing(r, form);
  const eligible = missing.length === 0;
  const files = prefill?.files ?? [];
  const modal = useFormModal({
    initial: initial.base,
    values: v,
    // Có tệp mang sang từ bước cập nhật tiến độ cũng tính là đã có thay đổi (tệp không vào nháp).
    isDirty: (cur, base) => (Object.keys(base) as (keyof typeof cur)[]).some((k) => cur[k] !== base[k]) || files.length > 0,
    draft: {
      exists: !!initial.draft,
      save: (cur): boolean => saveSubmitDraft(r.id, { ...cur, savedAt: new Date().toISOString() } satisfies SubmitDraft),
      clear: () => clearSubmitDraft(r.id),
    },
    onSubmit,
    onClose,
    onSubmitError: setError,
  });
  const { confirming, submitting, hasDraft, requestClose, discard } = modal;

  const reviewerOptions = REVIEWERS.filter((p) => p.name !== r.assignee).map((p) => ({ value: p.name, label: `${p.name} (${p.title})` }));

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
    await modal.submit({ ...form, readings, files });
  };

  const onSaveDraft = () => {
    if (!modal.saveDraft()) {
      setError('Không lưu được nháp (bộ nhớ trình duyệt không khả dụng).');
      return;
    }
    announce(`Đã lưu nháp gửi nghiệm thu ${r.code}${files.length ? ' – tệp đính kèm không được lưu trong nháp' : ''}.`);
  };

  const footer = confirming ? (
    <DiscardConfirmButtons keepEditingRef={modal.keepEditingRef} onKeepEditing={modal.keepEditing} onDiscard={discard} hasDraft={hasDraft} />
  ) : (
    <>
      <Button variant="plain" onClick={requestClose}>
        Hủy
      </Button>
      <Button variant="subtle" onClick={onSaveDraft}>
        Lưu nháp
      </Button>
      <Button
        type="submit"
        variant="primary"
        aria-disabled={!eligible || submitting || undefined}
        aria-describedby={eligible ? undefined : missingId}
      >
        Gửi nghiệm thu
      </Button>
    </>
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

        <SubmitSummaryCard record={r} now={now} missing={missing} missingId={missingId} />

        <div data-field="summary">
          <Textarea
            labelVariant="section"
            label="Tóm tắt công việc"
            required
            value={v.summary}
            onChange={(x) => set('summary', x)}
            rows={2}
            maxLength={1000}
            placeholder="Các việc đã làm, kết quả kiểm tra…"
          />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <ChecklistSection record={r} headingId={`${uid}-cl`} />
          <div data-field="cause" className="flex min-w-0 flex-col">
            <Textarea
              labelVariant="section"
              label="Nguyên nhân xác định"
              required
              value={v.cause}
              onChange={(x) => set('cause', x)}
              rows={10}
              maxLength={1000}
              placeholder="Nguyên nhân gốc của sự cố / bất thường…"
            />
          </div>
        </div>

        <div data-field="remedy">
          <Textarea
            labelVariant="section"
            label="Biện pháp"
            required
            value={v.remedy}
            onChange={(x) => set('remedy', x)}
            rows={2}
            maxLength={1000}
            placeholder="Biện pháp đã thực hiện để khắc phục…"
          />
        </div>

        <DeviceConditionSection
          uid={uid}
          values={v}
          device={device}
          onChange={(k, x) => {
            setV((cur) => ({ ...cur, [k]: x }));
            setError('');
          }}
        />

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
          <DatePicker
            labelVariant="section"
            type="datetime-local"
            label="Thời gian đề nghị"
            value={v.proposedAt}
            onChange={(x) => set('proposedAt', x)}
            hint="Mặc định: sau 30 phút (làm tròn mốc 15 phút) – sửa được, không bắt buộc."
          />
        </div>

        {files.length > 0 && (
          <p className="text-sm text-fg-secondary">Kèm {files.length} tệp đã thêm ở bước cập nhật tiến độ (chưa tải lên máy chủ).</p>
        )}

        {error && (
          <p role="alert" className="text-sm text-danger-text">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
