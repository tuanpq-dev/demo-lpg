import { useId } from 'react';
import { Badge, Button, Modal } from '@/components';
import type { MaintenanceRecord } from '@/data/maintenance';
import type { AssignForm } from '@/features/maintenance/assign';
import { AssignDetailsColumn, AssignRequestBand, StaffPickerColumn } from './assign/AssignSections';
import { useAssignForm } from './assign/useAssignForm';

export type AssignModalProps = {
  record: MaintenanceRecord;
  /** Toàn bộ yêu cầu – tính "đang làm / quá hạn / Bận" của từng người. */
  records: readonly MaintenanceRecord[];
  onClose: () => void;
  /** Ghi bản ghi – modal đã kiểm tra hợp lệ trước khi gọi. */
  onSubmit: (form: AssignForm) => Promise<void>;
};

/**
 * Modal "Phân công người xử lý" – ảnh thiết kế (chưa có node; lệch ghi docs/figma-diffs.md). Hai chế độ theo trạng thái:
 * phân công (Chờ tiếp nhận) · đổi người (Đã phân công / Đang thực hiện – lý do bắt buộc). Quy tắc: `features/maintenance/assign.ts`.
 * Trái: tìm + lọc phòng ban/ca + danh sách nhân sự (radiogroup, KHÔNG chọn sẵn). Phải: chi tiết phân công.
 * Chặn: nút xác nhận aria-disabled + danh sách lý do; cảnh báo không chặn đọc qua aria-live. Nháp: sessionStorage. Chỉ mount khi mở.
 * Khối: `assign/AssignSections`; state + kiểm tra: `assign/useAssignForm` (reducer `assignFormReducer` + useFormModal).
 */
export function AssignModal({ record: r, records, onClose, onSubmit }: AssignModalProps) {
  const blockId = `${useId()}-block`;
  const a = useAssignForm({ record: r, records, onClose, onSubmit });
  const { confirming, submitting, hasDraft, requestClose, discard } = a.modal;

  return (
    <Modal
      open
      size="xl"
      title={a.reassign ? 'Đổi người xử lý' : 'Phân công người xử lý'}
      description={a.reassign ? 'Chọn người xử lý mới – lý do đổi được ghi vào lịch sử xử lý' : 'Chọn nhân sự phù hợp để tiếp nhận và xử lý yêu cầu bảo trì'}
      onClose={requestClose}
      dismissOnBackdrop={false}
      onSubmit={(e) => {
        e.preventDefault();
        if (!confirming) void a.submit();
      }}
      footerStart={
        confirming ? (
          <p role="alert" className="text-base text-fg">
            {hasDraft ? 'Bỏ các thay đổi và xóa bản lưu tạm?' : 'Bỏ các thay đổi chưa lưu?'}
          </p>
        ) : (
          <Button variant="plain" onClick={requestClose}>
            Hủy
          </Button>
        )
      }
      footer={
        confirming ? (
          <>
            <Button ref={a.modal.keepEditingRef} variant="subtle" onClick={a.modal.keepEditing}>
              Tiếp tục sửa
            </Button>
            <Button variant="primary" onClick={discard}>
              {hasDraft ? 'Bỏ thay đổi và xóa bản lưu tạm' : 'Bỏ thay đổi'}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={a.saveDraft}>
              Lưu tạm
            </Button>
            <Button type="submit" variant="primary" aria-disabled={a.blocked || submitting || undefined} aria-describedby={a.blocked ? blockId : undefined}>
              {a.reassign ? 'Xác nhận đổi người' : 'Xác nhận phân công'}
            </Button>
          </>
        )
      }
    >
      <AssignRequestBand record={r} />

      {a.initialDraft && (
        <p className="flex items-center gap-2 text-sm text-fg-secondary">
          <Badge variant="tag">Bản lưu tạm</Badge>
          Đang mở bản lưu tạm.
        </p>
      )}

      <div className="-mx-5 -mb-4 grid min-h-0 flex-1 md:grid-cols-[2fr_3fr]">
        <StaffPickerColumn a={a} />
        <AssignDetailsColumn a={a} record={r} blockId={blockId} />
      </div>
    </Modal>
  );
}
