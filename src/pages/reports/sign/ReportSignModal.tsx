import { useId, useState } from 'react';
import { Button, Modal, SignaturePenIcon } from '@/components';
import { reportDetailPath } from '@/data/dailyReport';
import { signDailyReport, useReportSignData } from '@/data/reportSign';
import { SIGN_PIN_REQUIRED, inspectorSignStatus, signConditions, signReady, type ReportRecord } from '@/features/reports';
import { actionErrorText } from '@/lib/actionError';
import { announce } from '@/lib/announce';
import { useNow } from '@/lib/useNow';
import { ApprovalFlowSection, DraftFormCard, ReportInfoCard, SignConditionsList, SignerSection } from './SignParts';

export type ReportSignModalProps = {
  report: ReportRecord;
  onClose: () => void;
  /** "Quay lại chỉnh sửa" – màn nhập nhận xét chưa có thiết kế → trang chi tiết báo cáo ngày. */
  onBackToEdit: () => void;
  /** Giữ `?now=` (demo) khi mở bản xem trước ở thẻ mới. */
  nowParam?: string | null;
};

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
  const detailPath = reportDetailPath(r) ?? '/reports';
  const previewHref = nowParam ? `${detailPath}?now=${encodeURIComponent(nowParam)}` : detailPath;

  const submit = async () => {
    if (!ready || submitting) return;
    setSubmitting(true);
    try {
      const res = await signDailyReport(r.id, { note, draftReviewed, responsibility });
      if (!res.ok) return setError(res.error);
      announce(`Đã ký xác nhận báo cáo ${r.code}. Chuyển bước Người duyệt${r.approver ? ` (${r.approver})` : ''}.`);
      onClose();
    } catch (e) {
      setError(actionErrorText(e));
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
          <ReportInfoCard report={r} status={status} />
          <SignConditionsList headingId={`${uid}-cond`} conditions={conditions} />
          <ApprovalFlowSection headingId={`${uid}-flow`} report={r} now={now} />
        </div>

        {/* ---- Cột phải ---- */}
        <div className="flex min-w-0 flex-col gap-6">
          <DraftFormCard
            headingId={`${uid}-pdf-title`}
            pdfPendingId={pdfPendingId}
            report={r}
            status={status}
            now={now}
            previewHref={previewHref}
            onPreview={() => {
              setDraftReviewed(true);
              announce('Đã đánh dấu kiểm tra biểu mẫu bản nháp.');
            }}
          />
          <SignerSection
            uid={uid}
            report={r}
            status={status}
            now={now}
            pin={pin}
            onPinChange={setPin}
            note={note}
            onNoteChange={setNote}
            responsibility={responsibility}
            onResponsibilityChange={setResponsibility}
          />

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
