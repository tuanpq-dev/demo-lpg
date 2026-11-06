import { AUTH_MODE } from '@/api/auth';
import type { deriveDeviceDirectory, useMaintenance } from '@/data/maintenance';
import { resolveReviewer } from '@/features/maintenance/review';
import { AssignModal } from '../AssignModal';
import { CreateMaintenanceModal } from '../CreateMaintenanceModal';
import { ProgressUpdateModal } from '../ProgressUpdateModal';
import { ReviewModal } from '../ReviewModal';
import { SubmitReviewModal } from '../SubmitReviewModal';
import type { MaintenanceModalsState } from './useMaintenanceModals';

type Ops = Pick<ReturnType<typeof useMaintenance>, 'create' | 'assign' | 'updateProgress' | 'submitForReview' | 'review'>;

export type MaintenanceModalsProps = {
  modals: MaintenanceModalsState;
  ops: Ops;
  /** Mọi bản ghi (số việc đang làm của người được phân công). */
  all: Parameters<typeof AssignModal>[0]['records'];
  /** Danh bạ thiết bị → khu vực cho form tạo. */
  devices: ReturnType<typeof deriveDeviceDirectory>;
  /** Người đang thao tác (ghi vào lịch sử). */
  actor: string;
  /** Tên người đăng nhập – người nghiệm thu. */
  userName: string | undefined;
  /** Thông báo sau thao tác thành công. */
  flash: (msg: string) => void;
  /** Mở checklist ở trang chi tiết (từ modal tiến độ). */
  onOpenChecklist: (id: string) => void;
  /** Tạo xong → về danh sách mặc định (bỏ bộ lọc) để thấy dòng mới. */
  onCreated: () => void;
};

/** Modal của danh sách bảo trì (mount khi mở, `key` = bản ghi): tiến độ, gửi nghiệm thu, phân công, nghiệm thu, tạo yêu cầu. */
export function MaintenanceModals({ modals: m, ops, all, devices, actor, userName, flash, onOpenChecklist, onCreated }: MaintenanceModalsProps) {
  const { progress, submit, assign, review } = m;
  return (
    <>
      {progress && (
        <ProgressUpdateModal
          key={progress.id}
          record={progress}
          onClose={m.closeProgress}
          onOpenChecklist={() => onOpenChecklist(progress.id)}
          onSubmit={async (input) => {
            await ops.updateProgress(progress.id, input, actor);
            m.closeProgress();
            flash(`Đã cập nhật tiến độ ${progress.code}.`);
          }}
          onContinueToSubmit={(prefill) => m.continueToSubmit(progress.id, prefill)}
        />
      )}
      {submit && (
        <SubmitReviewModal
          key={submit.id}
          record={submit}
          prefill={m.submitPrefill}
          onClose={m.closeSubmit}
          onSubmit={async (input) => {
            await ops.submitForReview(submit.id, input, actor);
            m.closeSubmit();
            flash(`Đã gửi nghiệm thu ${submit.code} – chờ ${input.reviewer} nghiệm thu.`);
          }}
        />
      )}
      {assign && (
        <AssignModal
          key={assign.id}
          record={assign}
          records={all}
          onClose={m.closeAssign}
          onSubmit={async (form) => {
            await ops.assign(assign.id, form, actor);
            m.closeAssign();
            // TODO(backend): thông báo đẩy/SMS cho người được phân công.
            flash(`Đã phân công ${assign.code} cho ${form.assignee}.`);
          }}
        />
      )}
      {review && (
        <ReviewModal
          key={review.id}
          record={review}
          reviewer={resolveReviewer({ authOff: AUTH_MODE === 'off', userName, submission: review.submission })}
          onClose={m.closeReview}
          onSubmit={async (input) => {
            await ops.review(review.id, input);
            m.closeReview();
            flash(
              input.result === 'pass'
                ? `Đã nghiệm thu đạt ${review.code} – hoàn thành.`
                : `Đã trả ${review.code} về Đang thực hiện (${input.result === 'fail' ? 'không đạt' : 'cần bổ sung'}).`,
            );
          }}
        />
      )}

      {/* Mount khi mở để form khởi tạo đúng ngay lần vẽ đầu (không nháy giá trị cũ). */}
      {m.create.open && (
        <CreateMaintenanceModal
          open
          onClose={m.closeCreate}
          devices={devices}
          defaultDevice={m.create.device}
          alert={m.create.sourceAlert}
          onDraftSaved={() => {
            m.closeCreate();
            flash('Đã lưu nháp yêu cầu bảo trì.');
          }}
          onSubmit={async (input) => {
            const rec = await ops.create(input);
            onCreated();
            flash(`Đã tạo yêu cầu ${rec.code}.`);
          }}
        />
      )}
    </>
  );
}
