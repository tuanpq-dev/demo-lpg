import { Button, Modal, DiscardConfirmButtons } from '@/components';
import type { MaintenanceRecord } from '@/data/maintenance';
import type { ProgressFile, ProgressUpdateInput } from '@/features/maintenance/progress';
import { useNow } from '@/lib/useNow';
import { ProgressFilesSection } from './progress/ProgressFilesSection';
import { DraftNote, ProgressInfoCards, ProgressSection, ProgressTextField, WorkStateSection } from './progress/ProgressSections';
import { useProgressUpdateForm } from './progress/useProgressUpdateForm';

export type ProgressUpdateModalProps = {
  record: MaintenanceRecord;
  onClose: () => void;
  /** Ghi bản ghi (mutation) – modal đã kiểm tra hợp lệ trước khi gọi. */
  onSubmit: (input: ProgressUpdateInput) => Promise<void>;
  /** "Mở checklist": modal đã tự lưu nháp nếu đang sửa; nơi gọi đóng modal + đưa tới khối Checklist. */
  onOpenChecklist?: () => void;
  /**
   * Chọn "Hoàn thành" → nút chính "Tiếp tục gửi nghiệm thu": KHÔNG ghi bản ghi; nơi gọi đóng modal này và mở modal
   * "Gửi yêu cầu nghiệm thu" với nội dung (→ Tóm tắt) + thông tin tệp đã thêm.
   */
  onContinueToSubmit: (prefill: { text: string; files: readonly ProgressFile[] }) => void;
};

/**
 * Modal "Cập nhật tiến độ bảo trì" – ảnh thiết kế (chưa có node Figma; số đo ước lượng, lệch ghi docs/figma-diffs.md):
 * 5 ô thông tin · Trạng thái công việc (radiogroup) · Tiến độ hoàn thành (thanh trượt, bước 5) + dòng Checklist ·
 * Ảnh và tài liệu (tệp có sẵn + tệp tạm + "Tải tệp lên") · Nội dung đã thực hiện · Hủy / Lưu nháp / Cập nhật tiến độ.
 * Quy tắc trạng thái + lịch sử: `features/maintenance/progress.ts`. Nháp: sessionStorage theo mã (không đổi trạng thái).
 * Khối: `progress/ProgressSections`, `progress/ProgressFilesSection`; state + kiểm tra: `useProgressUpdateForm`.
 * Chỉ mount khi mở.
 */
export function ProgressUpdateModal({ record: r, onClose, onSubmit, onOpenChecklist, onContinueToSubmit }: ProgressUpdateModalProps) {
  const now = useNow(30_000);
  const f = useProgressUpdateForm({ record: r, onClose, onSubmit, onOpenChecklist, onContinueToSubmit });
  const { confirming, submitting, hasDraft, requestClose, discard } = f.modal;

  const footer = confirming ? (
    <DiscardConfirmButtons keepEditingRef={f.modal.keepEditingRef} onKeepEditing={f.modal.keepEditing} onDiscard={discard} hasDraft={hasDraft} />
  ) : (
    <>
      <Button variant="plain" onClick={requestClose}>
        Hủy
      </Button>
      <Button variant="subtle" onClick={f.saveDraft}>
        Lưu nháp
      </Button>
      <Button type="submit" variant="primary" disabled={submitting}>
        {f.continueToSubmit ? 'Tiếp tục gửi nghiệm thu' : 'Cập nhật tiến độ'}
      </Button>
    </>
  );

  return (
    <Modal
      open
      size="xl"
      titleTone="primary"
      title="Cập nhật tiến độ bảo trì"
      description={`Ghi nhận tình trạng thực hiện và cập nhật tiến độ công việc ${r.code}`}
      onClose={requestClose}
      dismissOnBackdrop={false}
      onSubmit={(e) => {
        e.preventDefault();
        if (!confirming) void f.submit();
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
        {f.initialDraft && <DraftNote savedAt={f.initialDraft.savedAt} />}
        <ProgressInfoCards record={r} now={now} />
        <WorkStateSection f={f} status={r.status} />
        <ProgressSection f={f} record={r} canOpenChecklist={!!onOpenChecklist} />
        <ProgressFilesSection f={f} record={r} />
        <ProgressTextField f={f} />
        {f.errors.form && (
          <p role="alert" className="text-sm text-danger-text">
            {f.errors.form}
          </p>
        )}
      </div>
    </Modal>
  );
}
