import { useId } from 'react';
import { Modal } from '@/components';
import type { ReportRecord } from '@/features/reports';
import { RecordFooter, RecordFooterStart, RecordHeaderInfo, RecordNav } from './record/RecordChrome';
import { RecordEquipment, RecordOverview, RecordRemarkAndFiles, RecordSummary } from './record/RecordSections';
import { useCheckpointRecordForm } from './record/useCheckpointRecordForm';
import { useSectionNav } from './record/useSectionNav';

export type CheckpointRecordModalProps = {
  report: ReportRecord;
  /** Khoá mốc "18:00". */
  checkpoint: string;
  onClose: () => void;
};

/**
 * Modal "Ghi nhận mốc kiểm tra HH:mm" – Figma bản sao A88YJ2BRhICDDdeu2rtRg1, node 126:7966 (frame 126:8506). Mở từ chi tiết
 * báo cáo ngày (`?record=<mốc>`). Số IoT tự điền (`data/checkpointRecord`), nhập đồng hồ cơ ghi đè, nhận xét bắt buộc,
 * tệp chỉ giữ trong phiên. Logic: `features/reports/record.ts`. Nháp sessionStorage theo mã + mốc. Chỉ mount khi mở.
 * Khối (thư mục `record/`): thông tin đầu + tab + chân (RecordChrome), tổng quan / nhóm thiết bị / nhận xét + tệp / tóm tắt
 * (RecordSections). State + kiểm tra: `useCheckpointRecordForm` (reducer + useFormModal); tab theo cuộn: `useSectionNav`.
 */
export function CheckpointRecordModal({ report: r, checkpoint, onClose }: CheckpointRecordModalProps) {
  const uid = useId();
  const blockersId = `${uid}-blockers`;
  const f = useCheckpointRecordForm(r, checkpoint, onClose);
  const nav = useSectionNav();
  const confirming = f.modal.confirming;
  const sectionProps = { f, uid, sectionRef: nav.sectionRef };

  return (
    <Modal
      open
      size="xl"
      titleTone="primary"
      title={`Ghi nhận mốc kiểm tra ${checkpoint}`}
      description="Cập nhật thông số vận hành định kỳ cho hệ thống trạm LPG."
      headerExtra={<RecordHeaderInfo report={r} checkpoint={checkpoint} />}
      beforeBody={<RecordNav active={nav.active} onGo={nav.goTo} />}
      bodyRef={nav.bodyRef}
      onClose={f.modal.requestClose}
      dismissOnBackdrop={false}
      onSubmit={(e) => {
        e.preventDefault();
        if (!confirming) void f.submit();
      }}
      footerStart={<RecordFooterStart f={f} checkpoint={checkpoint} />}
      footer={<RecordFooter f={f} checkpoint={checkpoint} blockersId={blockersId} />}
    >
      <span id={blockersId} hidden>
        {`Chưa đủ điều kiện xác nhận: ${f.blockers.join('; ')}.`}
      </span>

      <div className="flex flex-col gap-8 py-1">
        <RecordOverview {...sectionProps} />
        <RecordEquipment {...sectionProps} />
        <RecordRemarkAndFiles {...sectionProps} />
        <RecordSummary f={f} />
        {f.error && (
          <p role="alert" className="text-sm text-danger-text">
            {f.error}
          </p>
        )}
      </div>
    </Modal>
  );
}
