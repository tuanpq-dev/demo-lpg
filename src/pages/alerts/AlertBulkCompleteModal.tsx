import { useState } from 'react';
import { Button, Modal, Textarea } from '@/components';

/**
 * Hoàn thành hàng loạt (chưa có thiết kế – dựng theo token): MỘT ghi chú chung bắt buộc cho cả lô; chỉ dòng Đang xử lý
 * được hoàn thành, dòng khác bỏ qua (báo trước số dòng). Chỉ mount khi mở.
 */
export function AlertBulkCompleteModal({
  eligible,
  skipped,
  onClose,
  onConfirm,
}: {
  eligible: number;
  skipped: number;
  onClose: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Đánh dấu hoàn thành"
      description={`${eligible} cảnh báo Đang xử lý sẽ chuyển sang Đã hoàn thành.`}
      dismissOnBackdrop={!note}
      onSubmit={(e) => {
        e.preventDefault();
        if (!note.trim()) {
          setError('Nhập ghi chú kết quả xử lý chung cho cả lô.');
          return;
        }
        onConfirm(note);
      }}
      footerStart={
        <Button variant="plain" onClick={onClose}>
          Hủy
        </Button>
      }
      footer={
        <Button type="submit" variant="primary" disabled={eligible === 0}>
          Hoàn thành {eligible}
        </Button>
      }
    >
      {skipped > 0 && (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-base text-warning">
          Bỏ qua {skipped} cảnh báo không ở trạng thái Đang xử lý (chưa xác nhận hoặc đã hoàn thành).
        </p>
      )}
      <Textarea
        label="Ghi chú kết quả xử lý"
        required
        value={note}
        onChange={(v) => {
          setNote(v);
          setError(undefined);
        }}
        rows={4}
        maxLength={1000}
        error={error}
        hint="Lưu thành ghi chú của từng cảnh báo trong lô."
      />
    </Modal>
  );
}
