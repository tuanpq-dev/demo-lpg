/** Khối giao diện của modal "Hoàn thành nhận xét & ký xác nhận". Tách từ ReportSignModal. */
import type { ReactNode } from 'react';
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
  PdfFileIcon,
  TextField,
  Textarea,
  WorkflowStepper,
  buttonClass,
} from '@/components';
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
  type inspectorSignStatus,
  type signConditions,
  signedSteps,
  type ReportRecord,
} from '@/features/reports';
import { cn } from '@/lib/cn';

type SignStatus = ReturnType<typeof inspectorSignStatus>;
type SignCondition = ReturnType<typeof signConditions>[number];

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

/** Thẻ thông tin báo cáo: mã, ngày/ca, loại, người kiểm tra/duyệt, trạng thái (+ lý do trả lại). */
export function ReportInfoCard({ report: r, status }: { report: ReportRecord; status: SignStatus }) {
  return (
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
  );
}

/** Danh sách điều kiện ký (đạt / chưa đạt). */
export function SignConditionsList({ headingId, conditions }: { headingId: string; conditions: readonly SignCondition[] }) {
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h3 id={headingId} className="border-b border-line-divider pb-2 text-lg font-semibold text-fg-secondary">
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
  );
}

/** Luồng phê duyệt (dọc). */
export function ApprovalFlowSection({ headingId, report: r, now }: { headingId: string; report: ReportRecord; now: Date }) {
  const flow = approvalFlow(r, now);
  const current = flow.findIndex((s) => s.state === 'current');
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h3 id={headingId} className="text-lg font-semibold text-fg-secondary">
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
  );
}

export type DraftFormCardProps = {
  headingId: string;
  pdfPendingId: string;
  report: ReportRecord;
  status: SignStatus;
  now: Date;
  previewHref: string;
  /** Mở bản xem trước → đạt điều kiện "Đã kiểm tra biểu mẫu". */
  onPreview: () => void;
};

/** Biểu mẫu báo cáo bản nháp: phiên bản, số mốc, trạng thái, chữ ký + xem trước / tải PDF. */
export function DraftFormCard({ headingId, pdfPendingId, report: r, status, now, previewHref, onPreview }: DraftFormCardProps) {
  const p = checkpointProgress(r);
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 rounded-lg border border-line-card bg-surface-raised px-4 py-4">
      <div className="flex items-start gap-3">
        <PdfFileIcon size={36} className="shrink-0 text-fg-secondary" />
        <div className="flex min-w-0 flex-col">
          <h3 id={headingId} className="text-base font-semibold text-fg">
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
        {/* Bản xem trước = màn chi tiết báo cáo ngày ở thẻ mới (chưa có mẫu in riêng). */}
        <a href={previewHref} target="_blank" rel="noopener noreferrer" onClick={onPreview} className={cn(buttonClass('outline', 'sm'), 'gap-1.5')}>
          <EyeIcon size={16} />
          Xem trước biểu mẫu
          <span className="sr-only"> (mở thẻ mới)</span>
        </a>
        <Button
          variant="subtle"
          size="sm"
          icon={<Icon name="download" box={16} />}
          aria-disabled="true"
          aria-describedby={pdfPendingId}
          title="Chưa có dịch vụ xuất PDF – chờ kết nối máy chủ."
        >
          Tải bản nháp PDF
        </Button>
      </div>
      <p className="border-t border-line-divider pt-3 text-xs italic text-fg-secondary">
        Biểu mẫu chỉ trở thành bản đã ký sau khi Người kiểm tra, Người duyệt và TAP vận hành hoàn tất xác nhận.
      </p>
    </section>
  );
}

export type SignerSectionProps = {
  uid: string;
  report: ReportRecord;
  status: SignStatus;
  now: Date;
  pin: string;
  onPinChange: (v: string) => void;
  note: string;
  onNoteChange: (v: string) => void;
  responsibility: boolean;
  onResponsibilityChange: (v: boolean) => void;
};

/** Xác nhận của người kiểm tra: thông tin người ký, mã ký, ghi chú, cam kết trách nhiệm. */
export function SignerSection({
  uid,
  report: r,
  status,
  now,
  pin,
  onPinChange,
  note,
  onNoteChange,
  responsibility,
  onResponsibilityChange,
}: SignerSectionProps) {
  return (
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
            onChange={onPinChange}
            required={SIGN_PIN_REQUIRED}
            placeholder="Nhập mã hoặc mật khẩu ký"
            hint="Yêu cầu nếu hệ thống bật xác thực ký báo cáo."
          />
          <Textarea label="Ghi chú khi ký" value={note} onChange={onNoteChange} rows={3} maxLength={500} placeholder="Nhập ghi chú nếu cần..." />
        </div>
      </div>
      <div className="flex items-start gap-3 border-t border-line-divider pt-4">
        <Checkbox id={`${uid}-resp`} label="" aria-label={undefined} checked={responsibility} onChange={onResponsibilityChange} className="mt-1" />
        <label htmlFor={`${uid}-resp`} className="cursor-pointer text-sm italic text-primary">
          Tôi xác nhận đã kiểm tra dữ liệu vận hành, nhận xét cuối ca và chịu trách nhiệm về nội dung báo cáo này.
        </label>
      </div>
    </section>
  );
}
