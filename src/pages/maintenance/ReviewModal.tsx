import { useId, useRef, useState } from 'react';
import { Button, FormField, KpiCard, Modal, Select, StatusOptionGroup, Textarea, inputClass, type KpiTone, type StatusOption } from '@/components';
import type { Reading } from '@/data/assetDetail';
import { REVIEWERS, type MaintenanceRecord } from '@/data/maintenance';
import { useRelatedDevice } from '@/data/maintenanceDetail';
import {
  DEFAULT_FOLLOW_UP_HOURS,
  DEVICE_CONDITION_LABEL,
  FOLLOW_UP_OPTIONS,
  REVIEW_RESULT_OPTIONS,
  REVIEW_SUBMIT_LABEL,
  SENSOR_STATUS_LABEL,
  VALVE_STATUS_LABEL,
  validateReview,
  type ReadingSnapshot,
  type ReviewErrors,
  type ReviewInput,
  type ReviewResult,
} from '@/features/maintenance/review';
import { cn } from '@/lib/cn';
import { useFormModal } from '@/lib/useFormModal';

const RESULT_TONE = { pass: 'primary', 'needs-info': 'warning', fail: 'danger' } as const;

/** Số đã chụp so với ngưỡng cảnh báo (cấu hình tag lúc gửi): ≥ warn → warning, còn lại success. */
const snapTone = (s: ReadingSnapshot): KpiTone => (s.value === null ? 'neutral' : s.warn !== undefined && s.value >= s.warn ? 'warning' : 'success');
/** "10.5" – bỏ số 0 thừa, không có dấu chấm cuối (ảnh: "Ngưỡng: 30."). */
const fmtLimit = (n: number) => String(Number(n.toFixed(2)));
const liveText = (rd: Reading | undefined, unit: string) =>
  !rd
    ? null
    : rd.state === 'lost'
      ? 'Hiện tại: mất tín hiệu'
      : rd.value === undefined
        ? 'Hiện tại: —'
        : `Hiện tại: ${rd.value.toFixed(1)}${unit.startsWith('°') ? unit : ` ${unit}`}`;

export type ReviewModalProps = {
  record: MaintenanceRecord;
  /** Người nghiệm thu (chỉ đọc) – `resolveReviewer`: người đăng nhập, hoặc người được chọn khi gửi (không đăng nhập). */
  reviewer: string;
  onClose: () => void;
  onSubmit: (input: ReviewInput) => Promise<void>;
};

/**
 * Modal "Nghiệm thu yêu cầu bảo trì" – ảnh thiết kế (chưa có node Figma; lệch ghi docs/figma-diffs.md). Người nghiệm thu, review →
 * done (Đạt) hoặc in-progress (Cần bổ sung / Không đạt). Quy tắc: `features/maintenance/review.ts` (`validateReview`, `reviewRecord`).
 * Thông số: số đã CHỤP lúc gửi + ngưỡng (cấu hình tag), kèm số trực tiếp hiện tại nhỏ bên dưới. Chỉ mount khi mở.
 */
export function ReviewModal({ record: r, reviewer, onClose, onSubmit }: ReviewModalProps) {
  const uid = useId();
  const resultId = `${uid}-result`;
  const device = useRelatedDevice(r.device);
  const sub = r.submission;
  const commentRef = useRef<HTMLDivElement>(null);

  const [result, setResult] = useState<ReviewResult>('pass');
  const [followUp, setFollowUp] = useState(String(DEFAULT_FOLLOW_UP_HOURS));
  const [comment, setComment] = useState('');
  const [errors, setErrors] = useState<ReviewErrors>({});

  const input: ReviewInput = { result, reviewer, comment, followUpHours: result === 'pass' ? Number(followUp) : undefined };
  const selfReview = validateReview(r, { ...input, comment: 'x' }).reviewer;
  const blockId = `${uid}-block`;
  const title = REVIEWERS.find((p) => p.name === reviewer)?.title;
  const reviewerLabel = reviewer ? `${reviewer}${title ? ` (${title})` : ''}` : '—';
  const form = useFormModal({
    initial: { result: 'pass', followUp: String(DEFAULT_FOLLOW_UP_HOURS), comment: '' },
    values: { result, followUp, comment },
    // Ý kiến chỉ có khoảng trắng = chưa sửa.
    isDirty: (v, i) => v.result !== i.result || v.comment.trim() !== '' || v.followUp !== i.followUp,
    onSubmit,
    onClose,
    onSubmitError: (text) => setErrors({ form: text }),
  });
  const { confirming, submitting, requestClose } = form;

  const options: StatusOption<ReviewResult>[] = REVIEW_RESULT_OPTIONS.map((o) => ({
    id: o.id,
    label: o.label,
    tone: RESULT_TONE[o.id],
    toneLabel: o.id === 'fail',
  }));

  const submit = async () => {
    const e = validateReview(r, input);
    setErrors(e);
    if (e.comment) {
      commentRef.current?.querySelector('textarea')?.focus();
      return;
    }
    if (Object.keys(e).length) return;
    await form.submit(input);
  };

  const live = device.kind === 'live' ? device : null;
  const readingCard = (label: string, unit: string, snap: ReadingSnapshot | undefined, now: Reading | undefined) => {
    if (!snap) return <KpiCard size="sm" emphasis align="center" label={`${label} (${unit})`} value="—" footnote="Không có số liệu lúc gửi" />;
    return (
      <KpiCard
        size="sm"
        emphasis
        align="center"
        label={`${label} (${unit})`}
        value={snap.value === null ? 'Mất tín hiệu' : snap.value.toFixed(1)}
        tone={snapTone(snap)}
        hint={snap.value === null ? 'Lúc gửi nghiệm thu không có tín hiệu' : 'Giá trị lúc gửi nghiệm thu'}
        footnote={
          <span className="flex flex-col">
            {snap.warn !== undefined && <span>Ngưỡng: {fmtLimit(snap.warn)}</span>}
            {liveText(now, unit) && <span className="text-xs">{liveText(now, unit)}</span>}
          </span>
        }
      />
    );
  };

  const footer = confirming ? (
    <>
      <Button ref={form.keepEditingRef} variant="subtle" onClick={form.keepEditing}>
        Tiếp tục nghiệm thu
      </Button>
      <Button variant="primary" onClick={form.discard}>
        Bỏ thay đổi
      </Button>
    </>
  ) : (
    <>
      <Button variant="subtle" onClick={requestClose}>
        Hủy bỏ
      </Button>
      <Button
        type="submit"
        variant="primary"
        aria-disabled={!!selfReview || submitting || undefined}
        aria-describedby={selfReview ? blockId : undefined}
      >
        {REVIEW_SUBMIT_LABEL[result]}
      </Button>
    </>
  );

  return (
    <Modal
      open
      size="xl"
      titleTone="primary"
      title="Nghiệm thu yêu cầu bảo trì"
      description={`Kiểm tra kết quả thực hiện và xác nhận yêu cầu ${r.code}`}
      onClose={requestClose}
      dismissOnBackdrop={false}
      onSubmit={(e) => {
        e.preventDefault();
        if (!confirming && !submitting && !selfReview) void submit();
      }}
      footerStart={
        confirming ? (
          <p role="alert" className="text-base text-fg">
            Bỏ kết quả nghiệm thu đang nhập?
          </p>
        ) : undefined
      }
      footer={footer}
    >
      <div className="flex flex-col gap-5 py-1">
        <dl className="grid gap-4 rounded-lg border border-line-card bg-surface-raised/40 px-5 py-4 sm:grid-cols-3">
          {[
            ['Mã yêu cầu', r.code],
            ['Thiết bị', live ? `${r.device} – ${live.name}` : r.device],
            ['Người thực hiện', r.assignee ?? '—'],
          ].map(([k, val]) => (
            <div key={k} className="flex min-w-0 flex-col gap-1">
              <dt className="text-base text-fg-secondary">{k}</dt>
              <dd className="text-lg font-semibold text-fg">{val}</dd>
            </div>
          ))}
        </dl>

        {!sub ? (
          <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-base text-fg">
            Yêu cầu này chuyển nghiệm thu trước khi có biểu mẫu gửi nghiệm thu – không có nguyên nhân, biện pháp và thông số đã chụp. Kiểm tra lịch sử
            xử lý và ghi chú kỹ thuật trước khi kết luận.
          </p>
        ) : (
          <>
            <section className="flex flex-col gap-3" aria-labelledby={`${uid}-detail`}>
              <h3 id={`${uid}-detail`} className="text-lg font-semibold text-fg-secondary">
                Chi tiết kết quả
              </h3>
              <dl className="grid gap-4 md:grid-cols-2">
                {[
                  ['Nguyên nhân', sub.cause],
                  ['Biện pháp', sub.remedy],
                ].map(([k, val]) => (
                  <div key={k} className="flex min-w-0 flex-col gap-1.5 rounded-md border border-line/30 px-4 py-3">
                    <dt className="text-base text-fg-secondary">{k}</dt>
                    <dd className="text-base text-fg">{val}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-sm text-fg-secondary">
                Tóm tắt: {sub.summary} · Tình trạng sau bảo trì:{' '}
                <span className={sub.deviceCondition === 'unresolved' ? 'text-danger-text' : 'text-fg'}>
                  {DEVICE_CONDITION_LABEL[sub.deviceCondition]}
                </span>{' '}
                · Gửi bởi {sub.submittedBy}
              </p>
            </section>

            <section className="flex flex-col gap-3" aria-labelledby={`${uid}-readings`}>
              <h3 id={`${uid}-readings`} className="text-lg font-semibold text-fg-secondary">
                Thông số vận hành sau bảo trì
              </h3>
              <div className="grid gap-3 sm:grid-cols-3 sm:gap-6 lg:gap-12">
                {readingCard('Áp suất', 'bar', sub.readings.pressure, live?.pressure)}
                {readingCard('Nhiệt độ', '°C', sub.readings.temperature, live?.temperature)}
                <KpiCard
                  size="sm"
                  emphasis
                  align="center"
                  label="Trạng thái van"
                  value={VALVE_STATUS_LABEL[sub.valveStatus]}
                  tone={sub.valveStatus === 'stable' ? 'success' : 'danger'}
                  footnote={`Cảm biến: ${SENSOR_STATUS_LABEL[sub.sensorStatus]}`}
                />
              </div>
            </section>
          </>
        )}

        <section className="flex flex-col gap-3">
          <h3 id={resultId} className="text-lg font-semibold text-fg-secondary">
            Kết quả nghiệm thu
          </h3>
          <StatusOptionGroup
            label="Kết quả nghiệm thu"
            labelledBy={resultId}
            layout="inline"
            columns={3}
            options={options}
            value={result}
            onChange={(x) => {
              setResult(x);
              setErrors({});
            }}
          />
        </section>

        <div className="grid gap-5 md:grid-cols-2">
          <FormField
            labelVariant="section"
            label="Người nghiệm thu"
            error={selfReview}
            hint={selfReview ? undefined : 'Người đang đăng nhập (hoặc người được đề nghị khi gửi).'}
          >
            {({ id, describedBy, invalid }) => (
              <>
                <input
                  id={id}
                  readOnly
                  value={reviewerLabel}
                  aria-invalid={invalid || undefined}
                  aria-describedby={describedBy}
                  className={cn(inputClass(invalid), 'h-field bg-surface-muted/60')}
                />
                {selfReview && (
                  <span id={blockId} className="sr-only">
                    Không xác nhận được: {selfReview}
                  </span>
                )}
              </>
            )}
          </FormField>
          <FormField
            labelVariant="section"
            label="Thời gian theo dõi thêm"
            hint={result === 'pass' ? 'Sau khi hoàn thành, tiếp tục theo dõi thiết bị trong khoảng này.' : 'Chỉ áp dụng khi Đạt yêu cầu.'}
          >
            {({ id, labelId, describedBy }) => (
              <Select
                variant="field"
                id={id}
                labelledBy={labelId}
                describedBy={describedBy}
                label="Thời gian theo dõi thêm"
                options={FOLLOW_UP_OPTIONS}
                value={followUp}
                onChange={(x) => x && setFollowUp(x)}
                disabled={result !== 'pass'}
              />
            )}
          </FormField>
        </div>

        <div ref={commentRef}>
          <Textarea
            labelVariant="section"
            label="Ý kiến đánh giá"
            required={result !== 'pass'}
            value={comment}
            onChange={(x) => {
              setComment(x);
              if (errors.comment) setErrors((e) => ({ ...e, comment: undefined }));
            }}
            rows={3}
            maxLength={1000}
            error={errors.comment}
            placeholder={result === 'pass' ? 'Nhận xét (không bắt buộc)…' : result === 'fail' ? 'Lý do không đạt…' : 'Nội dung cần bổ sung…'}
            hint={
              result === 'pass' ? 'Không bắt buộc – lưu vào kết quả bảo trì.' : 'Bắt buộc – ghi thành ghi chú kỹ thuật để người thực hiện xử lý tiếp.'
            }
          />
        </div>

        {errors.form && (
          <p role="alert" className="text-sm text-danger-text">
            {errors.form}
          </p>
        )}
      </div>
    </Modal>
  );
}
