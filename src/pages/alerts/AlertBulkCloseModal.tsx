import { useState } from 'react';
import { Button, Modal, Textarea } from '@/components';
import { runAction } from '@/lib/actionError';

/**
 * Đóng hàng loạt (chưa có thiết kế – dựng theo token): MỘT ghi chú kết luận chung bắt buộc; chỉ dòng Đã xử lý ĐỦ 3 điều
 * kiện hệ thống, bỏ qua dòng Nghiêm trọng nếu người đóng là người xử lý (báo trước số dòng + lý do). Chỉ mount khi mở.
 */
export function AlertBulkCloseModal({
  eligible,
  skippedText,
  onClose,
  onConfirm,
}: {
  eligible: number;
  /** "bỏ qua 2 (1 chưa đủ điều kiện hệ thống; 1 …)" – null khi không bỏ dòng nào. */
  skippedText: string | null;
  onClose: () => void;
  onConfirm: (note: string) => Promise<unknown> | void;
}) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  /** Lỗi khi đóng thất bại (mạng / máy chủ). */
  const [submitError, setSubmitError] = useState('');
  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Đóng cảnh báo"
      description={`${eligible} cảnh báo Đã xử lý đủ điều kiện sẽ chuyển sang Hoàn thành.`}
      dismissOnBackdrop={!note}
      onSubmit={(e) => {
        e.preventDefault();
        if (!note.trim()) {
          setError('Nhập ghi chú kết luận chung cho cả lô.');
          return;
        }
        setSubmitError('');
        void runAction(() => onConfirm(note), setSubmitError);
      }}
      footerStart={
        <Button variant="plain" onClick={onClose}>
          Hủy
        </Button>
      }
      footer={
        <Button type="submit" variant="primary" disabled={eligible === 0}>
          Đóng {eligible} cảnh báo
        </Button>
      }
    >
      {skippedText && <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-base text-warning">Sẽ {skippedText}.</p>}
      <Textarea
        label="Ghi chú kết luận"
        required
        value={note}
        onChange={(v) => {
          setNote(v);
          setError(undefined);
        }}
        rows={4}
        maxLength={1000}
        error={error}
        hint="Lưu thành ghi chú kết luận của từng cảnh báo trong lô."
      />
      {submitError && (
        <p role="alert" className="text-sm text-danger-text">
          {submitError}
        </p>
      )}
    </Modal>
  );
}
