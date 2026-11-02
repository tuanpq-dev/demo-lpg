import { useId, useState, type ReactNode } from 'react';
import {
  AlertCircleIcon,
  Badge,
  Button,
  CheckCircleIcon,
  Checkbox,
  ClipboardClockIcon,
  EyeIcon,
  FileIcon,
  Icon,
  Modal,
  PdfFileIcon,
  SignaturePenIcon,
  TextField,
  Textarea,
  WorkflowStepper,
  buttonClass,
} from '@/components';
import { reportDetailPath } from '@/data/dailyReport';
import { signDailyReport, useReportSignData } from '@/data/reportSign';
import {
  DAILY_SHIFT_HOURS,
  PERIOD_CONFIG,
  SIGNATURE_STEPS,
  SIGN_PIN_REQUIRED,
  SIGN_ROLE_LABEL,
  approvalFlow,
  checkpointProgress,
  draftVersionLabel,
  formatSignTime,
  inspectorSignStatus,
  signConditions,
  signReady,
  signedSteps,
  type ReportRecord,
} from '@/features/reports';
import { announce } from '@/lib/announce';
import { cn } from '@/lib/cn';
import { useNow } from '@/lib/useNow';

export type ReportSignModalProps = {
  report: ReportRecord;
  onClose: () => void;
  /** "Quay lại chỉnh sửa" – màn nhập nhận xét chưa có thiết kế → trang chi tiết báo cáo ngày. */
  onBackToEdit: () => void;
  /** Giữ `?now=` (demo) khi mở bản xem trước ở thẻ mới. */
  nowParam?: string | null;
};

const ddate = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;

/** Ô nhãn – giá trị của thẻ thông tin. */
function InfoItem({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <dt className="text-sm text-fg-secondary">{label}</dt>
      <dd className="text-base text-fg">{children}</dd>
    </div>
  );
}

/**
 * Modal "Hoàn thành nhận xét & ký xác nhận" – bước Người kiểm tra của báo cáo NGÀY (ảnh thiết kế 02/11/2026, chưa có node
 * Figma; ảnh + ghi chú: scratch/figma-ref/report-sign/). Điều kiện ký: `features/reports/sign.ts`; ghi: `data/reportSign.ts`
 * (kiểm lại điều kiện từ dữ liệu hiện tại). Mã xác nhận KHÔNG lưu ở đâu (chỉ state). Chỉ mount khi mở.
 */
export function ReportSignModal({ report: r, onClose, onBackToEdit, nowParam }: ReportSignModalProps) {
  const now = useNow(30_000);
  const uid = useId();
  const unmetId = `${uid}-unmet`;
  const pdfPendingId = `${uid}-pdf`;
  const { rows, sensorFaults } = useReportSignData(r);

  const [draftReviewed, setDraftReviewed] = useState(false);
  const [responsibility, setResponsibility] = useState(false);
  const [pin, setPin] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const conditions = signConditions({ report: r, rows, sensorFaults, draftReviewed, responsibility });
  const pinMissing = SIGN_PIN_REQUIRED && !pin.trim();
  const ready = signReady(conditions) && !pinMissing;
  const unmet = conditions.filter((c) => !c.met).map((c) => c.label);
  if (pinMissing) unmet.push('Chưa nhập mã xác nhận / mật khẩu ký');

  const status = inspectorSignStatus(r);
  const flow = approvalFlow(r, now);
  const current = flow.findIndex((s) => s.state === 'current');
  const p = checkpointProgress(r);
  const detailPath = reportDetailPath(r)!;
  const previewHref = nowParam ? `${detailPath}?now=${encodeURIComponent(nowParam)}` : detailPath;

  const submit = async () => {
    if (!ready || submitting) return;
    setSubmitting(true);
    try {
      const res = await signDailyReport(r.id, { note, draftReviewed, responsibility });
      if (!res.ok) return setError(res.error);
      announce(`Đã ký xác nhận báo cáo ${r.code}. Chuyển bước Người duyệt${r.approver ? ` (${r.approver})` : ''}.`);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      size="xl"
      titleTone="primary"
      title="Hoàn thành nhận xét & ký xác nhận"
      description="Rà soát dữ liệu vận hành, xác nhận nhận xét cuối ca và ký báo cáo trước khi gửi cho Người duyệt."
      onClose={onClose}
      dismissOnBackdrop={false}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>
            Hủy
          </Button>
          <Button variant="outline" onClick={onBackToEdit}>
            Quay lại chỉnh sửa
          </Button>
          <Button
            type="submit"
            // Chưa đủ điều kiện → nút xám như ảnh (subtle + mờ), đủ → primary.
            variant={ready ? 'primary' : 'subtle'}
            icon={<SignaturePenIcon size={18} />}
            aria-disabled={!ready || submitting || undefined}
            aria-describedby={ready ? undefined : unmetId}
          >
            Ký xác nhận báo cáo
          </Button>
        </>
      }
    >
      <span id={unmetId} hidden>
        {`Chưa đủ điều kiện ký: ${unmet.join('; ')}.`}
      </span>
      <span id={pdfPendingId} hidden>
        Chưa có dịch vụ xuất PDF – chờ kết nối máy chủ.
      </span>

      <div className="grid gap-x-10 gap-y-6 py-1 lg:grid-cols-[minmax(0,4fr)_minmax(0,3fr)]">
        {/* ---- Cột trái ---- */}
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-label={`Báo cáo ${r.code}`} className="rounded-lg border border-line-card bg-surface-raised px-4 py-4">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-3">
              {/* Icon nằm TRONG <dt> (dl > div chỉ được chứa dt/dd – axe definition-list). */}
              <div className="relative flex min-w-0 flex-col gap-1 pl-10">
                <dt className="text-sm text-fg-secondary">
                  <FileIcon size={28} className="absolute left-0 top-0.5 text-primary" />
                  Mã báo cáo
                </dt>
                <dd className="text-base font-semibold text-fg">{r.code}</dd>
              </div>
              <InfoItem label="Ngày / Ca">
                {ddate(r.periodKey)} • {r.shift ?? 'Ca 1'}
                <br />
                <span className="tabular-nums">{DAILY_SHIFT_HOURS}</span>
              </InfoItem>
              <InfoItem label="Loại báo cáo">Báo cáo vận hành {PERIOD_CONFIG[r.period].noun}</InfoItem>
              <InfoItem label="Người kiểm tra">{r.inspector}</InfoItem>
              <InfoItem label="Người duyệt">{r.approver ?? <span className="text-fg-secondary">Chưa chỉ định</span>}</InfoItem>
              <InfoItem label="Trạng thái hiện tại">
                <Badge variant="tag" size="md" tone={status.tone} className="gap-1.5 text-sm">
                  <ClipboardClockIcon size={16} className="shrink-0" />
                  {status.label}
                </Badge>
              </InfoItem>
            </dl>
            {r.signature.status === 'rejected' && r.signature.reason && (
              <p className="mt-4 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-fg">
                <span className="font-semibold text-danger-text">Lý do trả lại: </span>
                {r.signature.reason}
              </p>
            )}
          </section>

          <section aria-labelledby={`${uid}-cond`} className="flex flex-col gap-3">
            <h3 id={`${uid}-cond`} className="border-b border-line-divider pb-2 text-lg font-semibold text-fg-secondary">
              Điều kiện ký xác nhận
            </h3>
            {/* Cột trái rồi cột phải (thứ tự đọc = thứ tự DOM): grid-flow-col 4 hàng. */}
            <ul className="grid gap-x-6 gap-y-2.5 md:grid-flow-col md:grid-cols-2 md:grid-rows-[repeat(4,auto)]">
              {conditions.map((c) => (
                <li key={c.id} className={cn('flex items-start gap-2 text-sm', c.met ? 'text-success' : 'text-fg')}>
                  {c.met ? <CheckCircleIcon size={16} className="mt-px shrink-0" /> : <AlertCircleIcon size={16} className="mt-px shrink-0 text-warning" />}
                  <span>
                    <span className="sr-only">{c.met ? 'Đạt: ' : 'Chưa đạt: '}</span>
                    {c.label}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby={`${uid}-flow`} className="flex flex-col gap-3">
            <h3 id={`${uid}-flow`} className="text-lg font-semibold text-fg-secondary">
              Luồng phê duyệt
            </h3>
            <WorkflowStepper
              orientation="vertical"
              marker="dot"
              label={`Luồng phê duyệt ${r.code}`}
              steps={flow.map((s) => ({ id: s.step, label: s.label, detail: s.detail }))}
              completed={flow.filter((s) => s.state === 'done').length}
              current={current >= 0 ? current : null}
            />
          </section>
        </div>

        {/* ---- Cột phải ---- */}
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby={`${uid}-pdf-title`} className="flex flex-col gap-3 rounded-lg border border-line-card bg-surface-raised px-4 py-4">
            <div className="flex items-start gap-3">
              <PdfFileIcon size={36} className="shrink-0 text-fg-secondary" />
              <div className="flex min-w-0 flex-col">
                <h3 id={`${uid}-pdf-title`} className="text-base font-semibold text-fg">
                  Biểu mẫu báo cáo bản nháp
                </h3>
                <p className="truncate text-sm text-fg-secondary">{r.code}.pdf</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div className="flex flex-wrap gap-1">
                <dt className="text-fg-secondary">Phiên bản:</dt>
                <dd className="text-fg">{draftVersionLabel(r)}</dd>
              </div>
              <div className="flex flex-wrap gap-1">
                <dt className="text-fg-secondary">Dữ liệu:</dt>
                <dd className="tabular-nums text-fg">
                  {p.done}/{p.total} {PERIOD_CONFIG[r.period].checkpointUnit}
                </dd>
              </div>
              <div className="flex flex-wrap gap-1">
                <dt className="text-fg-secondary">Trạng thái:</dt>
                <dd className={status.tone === 'danger' ? 'text-danger-text' : 'text-warning'}>{status.label}</dd>
              </div>
              <div className="flex flex-wrap gap-1">
                <dt className="text-fg-secondary">Chữ ký:</dt>
                <dd className="tabular-nums text-fg">
                  {signedSteps(r, now)}/{SIGNATURE_STEPS.length}
                </dd>
              </div>
            </dl>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-6">
              {/* Bản xem trước = màn chi tiết báo cáo ngày ở thẻ mới (chưa có mẫu in riêng). Mở → đạt "Đã kiểm tra biểu mẫu". */}
              <a
                href={previewHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  setDraftReviewed(true);
                  announce('Đã đánh dấu kiểm tra biểu mẫu bản nháp.');
                }}
                className={cn(buttonClass('outline', 'sm'), 'gap-1.5')}
              >
                <EyeIcon size={16} />
                Xem trước biểu mẫu
                <span className="sr-only"> (mở thẻ mới)</span>
              </a>
              <Button variant="subtle" size="sm" icon={<Icon name="download" box={16} />} aria-disabled="true" aria-describedby={pdfPendingId} title="Chưa có dịch vụ xuất PDF – chờ kết nối máy chủ.">
                Tải bản nháp PDF
              </Button>
            </div>
            <p className="border-t border-line-divider pt-3 text-xs italic text-fg-secondary">
              Biểu mẫu chỉ trở thành bản đã ký sau khi Người kiểm tra, Người duyệt và TAP vận hành hoàn tất xác nhận.
            </p>
          </section>

          <section aria-labelledby={`${uid}-signer`} className="flex flex-col gap-4 rounded-lg border border-primary/50 bg-surface-raised px-4 py-4">
            <h3 id={`${uid}-signer`} className="text-lg font-semibold text-primary">
              Xác nhận của người kiểm tra
            </h3>
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <dl className="flex flex-col gap-3">
                <InfoItem label="Người ký">{r.inspector}</InfoItem>
                <InfoItem label="Vai trò">{SIGN_ROLE_LABEL.inspector}</InfoItem>
                <InfoItem label="Thời gian dự kiến">
                  <span className="tabular-nums">{formatSignTime(now)}</span>
                </InfoItem>
                <div className="flex flex-col gap-1">
                  <dt className="text-sm text-fg-secondary">Trạng thái</dt>
                  <dd className={cn('text-lg font-semibold', status.tone === 'danger' ? 'text-danger-text' : 'text-warning')}>{status.short}</dd>
                </div>
              </dl>
              <div className="flex min-w-0 flex-col gap-4">
                <TextField
                  label="Mã xác nhận / mật khẩu ký"
                  type="password"
                  autoComplete="off"
                  value={pin}
                  onChange={setPin}
                  required={SIGN_PIN_REQUIRED}
                  placeholder="Nhập mã hoặc mật khẩu ký"
                  hint="Yêu cầu nếu hệ thống bật xác thực ký báo cáo."
                />
                <Textarea label="Ghi chú khi ký" value={note} onChange={setNote} rows={3} maxLength={500} placeholder="Nhập ghi chú nếu cần..." />
              </div>
            </div>
            <div className="flex items-start gap-3 border-t border-line-divider pt-4">
              <Checkbox id={`${uid}-resp`} label="" aria-label={undefined} checked={responsibility} onChange={setResponsibility} className="mt-1" />
              <label htmlFor={`${uid}-resp`} className="cursor-pointer text-sm italic text-primary">
                Tôi xác nhận đã kiểm tra dữ liệu vận hành, nhận xét cuối ca và chịu trách nhiệm về nội dung báo cáo này.
              </label>
            </div>
          </section>

          {error && (
            <p role="alert" className="text-sm text-danger-text">
              {error}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
