import { useId, useState } from 'react';
import { Badge, Button, FileIcon, Modal, Textarea } from '@/components';
import type { MaintenanceAttachment, MaintenanceRecord } from '@/data/maintenance';
import { runAction } from '@/lib/actionError';

/** Xác nhận hủy yêu cầu – lý do không bắt buộc, ghi vào lịch sử xử lý. */
export function CancelMaintenanceModal({
  record,
  onClose,
  onConfirm,
}: {
  record: MaintenanceRecord;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  /** Lỗi khi hủy thất bại (mạng / máy chủ). */
  const [submitError, setSubmitError] = useState('');
  return (
    <Modal
      open
      onClose={onClose}
      dismissOnBackdrop={false}
      title={`Hủy yêu cầu ${record.code}?`}
      description="Yêu cầu sẽ chuyển sang “Đã hủy”, không tính vào KPI và không thể tiếp tục xử lý. Thao tác được ghi vào lịch sử."
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitError('');
        void runAction(() => onConfirm(reason), setSubmitError);
      }}
      footer={
        <>
          <Button onClick={onClose}>Giữ yêu cầu</Button>
          <Button type="submit" variant="primary">
            Xác nhận hủy
          </Button>
        </>
      }
    >
      <Textarea label="Lý do hủy (không bắt buộc)" value={reason} onChange={setReason} maxLength={300} showCount rows={3} />
      {submitError && (
        <p role="alert" className="text-sm text-danger-text">
          {submitError}
        </p>
      )}
    </Modal>
  );
}

/**
 * "Xem" tệp khi chưa có backend: modal giữ chỗ. Tệp mẫu → nhãn "Dữ liệu mẫu" + tải bản .txt; tệp tạm (`isTemp`, thêm ở
 * modal cập nhật tiến độ) → nhãn "Chưa tải lên máy chủ", không có nội dung để tải.
 */
export function ViewAttachmentModal({
  attachment,
  meta,
  onClose,
  onDownload,
}: {
  attachment: MaintenanceAttachment;
  meta: string;
  onClose: () => void;
  onDownload: () => void;
}) {
  const descId = useId();
  const temp = !!attachment.isTemp;
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={attachment.name}
      footer={
        <>
          {!temp && <Button onClick={onDownload}>Tải bản mẫu (.txt)</Button>}
          <Button variant="primary" onClick={onClose}>
            Đóng
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="tag" tone={temp ? 'warning' : 'neutral'}>
            {temp ? 'Chưa tải lên máy chủ' : 'Dữ liệu mẫu'}
          </Badge>
          <span className="text-sm text-fg-secondary">{meta}</span>
        </div>
        <div className="grid min-h-[240px] place-items-center rounded-md border border-dashed border-line bg-surface-sunken/40 p-6 text-center">
          <div className="flex flex-col items-center gap-2">
            <FileIcon size={32} className="text-fg-secondary" />
            <p id={descId} className="max-w-[420px] text-base text-fg-secondary">
              {temp
                ? 'Tệp được thêm khi cập nhật tiến độ nhưng chưa tải lên máy chủ (bản demo chưa nối kho lưu trữ) – chỉ còn tên và dung lượng.'
                : 'Chưa có tệp thật – bản demo chưa nối kho lưu trữ. Xem trước sẽ hiện ở đây khi có backend.'}
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
