import type { MaintenanceRecord, useMaintenance } from '@/data/maintenance';
import { clearProgressDraft, clearSubmitDraft } from '@/data/maintenanceDetail';
import { announce } from '@/lib/announce';
import { AssignModal } from '../AssignModal';
import { CancelMaintenanceModal } from '../MaintenanceDetailDialogs';
import { ProgressUpdateModal } from '../ProgressUpdateModal';
import { ReviewModal } from '../ReviewModal';
import { SubmitReviewModal } from '../SubmitReviewModal';
import type { useDetailDialog } from './useDetailDialog';

type Ops = Pick<ReturnType<typeof useMaintenance>, 'assign' | 'cancel' | 'updateProgress' | 'submitForReview' | 'review'>;

export type DetailModalsProps = {
  record: MaintenanceRecord;
  dialogs: ReturnType<typeof useDetailDialog>;
  ops: Ops;
  /** Mọi bản ghi (số việc đang làm của người được phân công). */
  allRecords: readonly MaintenanceRecord[];
  actor: string;
  reviewer: Parameters<typeof ReviewModal>[0]['reviewer'];
  /** Đóng modal tiến độ + cuộn tới checklist. */
  onOpenChecklist: () => void;
};

/** Modal của trang chi tiết (chỉ mount khi mở – form khởi tạo đúng ngay lần vẽ đầu); xong → thông báo đọc màn hình. */
export function DetailModals({ record: r, dialogs: d, ops, allRecords, actor, reviewer, onOpenChecklist }: DetailModalsProps) {
  return (
    <>
      {d.dialog === 'progress' && (
        <ProgressUpdateModal
          record={r}
          onClose={d.close}
          onOpenChecklist={onOpenChecklist}
          onSubmit={async (input) => {
            await ops.updateProgress(r.id, input, actor);
            d.close();
            announce(`Đã cập nhật tiến độ ${r.code} – đã ghi lịch sử.`);
          }}
          onContinueToSubmit={d.continueToSubmit}
        />
      )}
      {d.dialog === 'submit' && (
        <SubmitReviewModal
          record={r}
          prefill={d.submitPrefill}
          onClose={d.closeSubmit}
          onSubmit={async (input) => {
            await ops.submitForReview(r.id, input, actor);
            d.closeSubmit();
            announce(`Đã gửi nghiệm thu ${r.code} – chờ ${input.reviewer} nghiệm thu.`);
          }}
        />
      )}
      {d.dialog === 'review' && (
        <ReviewModal
          record={r}
          reviewer={reviewer}
          onClose={d.close}
          onSubmit={async (input) => {
            await ops.review(r.id, input);
            d.close();
            announce(
              input.result === 'pass'
                ? `${r.code}: nghiệm thu đạt – đã hoàn thành.`
                : `${r.code}: nghiệm thu ${input.result === 'fail' ? 'không đạt' : 'cần bổ sung'} – quay về Đang thực hiện.`,
            );
          }}
        />
      )}
      {d.dialog === 'assign' && (
        <AssignModal
          record={r}
          records={allRecords}
          onClose={d.close}
          onSubmit={async (form) => {
            const before = r.assignee;
            await ops.assign(r.id, form, actor);
            // Đổi sang người khác: nháp tiến độ / gửi nghiệm thu của người cũ (trên trình duyệt này) không chuyển cho người mới.
            if (before && before !== form.assignee) {
              clearProgressDraft(r.id);
              clearSubmitDraft(r.id);
            }
            d.close();
            // TODO(backend): gửi thông báo đẩy/SMS cho người được phân công (công tắc trong modal chỉ là giao diện).
            announce(
              before && before !== form.assignee
                ? `${r.code}: đã đổi người xử lý sang ${form.assignee}.`
                : `Đã phân công ${r.code} cho ${form.assignee}.`,
            );
          }}
        />
      )}
      {d.dialog === 'cancel' && (
        <CancelMaintenanceModal
          record={r}
          onClose={d.close}
          onConfirm={async (reason) => {
            await ops.cancel(r.id, reason, actor);
            clearProgressDraft(r.id);
            clearSubmitDraft(r.id);
            d.close();
            announce(`Đã hủy yêu cầu ${r.code}.`);
          }}
        />
      )}
    </>
  );
}
