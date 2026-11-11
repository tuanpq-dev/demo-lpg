import { useId } from 'react';
import { ModalDataFallback } from '@/app/Placeholder';
import { Button, Modal } from '@/components';
import { useCheckpointSnapshot } from '@/data/checkpointRecord';
import type { CheckpointSnapshot, ReportRecord } from '@/features/reports';
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
export function CheckpointRecordModal(props: CheckpointRecordModalProps) {
  const { report: r, checkpoint, onClose } = props;
  const snapshot = useCheckpointSnapshot(r, checkpoint);
  // Số liệu IoT của mốc chưa tải xong / lỗi → chưa dựng form (nhóm thiết bị, điều kiện xác nhận đều tính từ ảnh chụp này).
  if (snapshot.status !== 'success') {
    return (
      <Modal
        open
        size="xl"
        titleTone="primary"
        title={`Ghi nhận mốc kiểm tra ${checkpoint}`}
        description={RECORD_DESCRIPTION}
        headerExtra={<RecordHeaderInfo report={r} checkpoint={checkpoint} />}
        onClose={onClose}
        dismissOnBackdrop={false}
        footer={
          <Button variant="subtle" onClick={onClose}>
            Hủy
          </Button>
        }
      >
        <ModalDataFallback q={snapshot} errorTitle={`Không tải được số liệu mốc ${checkpoint}`} />
      </Modal>
    );
  }
  return <CheckpointRecordForm {...props} snapshot={snapshot.data} />;
}

const RECORD_DESCRIPTION = 'Cập nhật thông số vận hành định kỳ cho hệ thống trạm LPG.';

function CheckpointRecordForm({ report: r, checkpoint, onClose, snapshot }: CheckpointRecordModalProps & { snapshot: CheckpointSnapshot }) {
  const uid = useId();
  const blockersId = `${uid}-blockers`;
  const f = useCheckpointRecordForm(r, checkpoint, snapshot, onClose);
  const nav = useSectionNav();
  const confirming = f.modal.confirming;
  const sectionProps = { f, uid, sectionRef: nav.sectionRef };

  return (
    <Modal
      open
      size="xl"
      titleTone="primary"
      title={`Ghi nhận mốc kiểm tra ${checkpoint}`}
      description={RECORD_DESCRIPTION}
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
