import { Button, SendIcon, StickyActionBar } from '@/components';
import type { MaintenanceRecord } from '@/data/maintenance';
import { canUpdateProgress } from '@/features/maintenance/progress';
import { NEXT_ACTION_LABEL, canCancel } from '@/features/maintenance/workflow';
import type { DetailDialog } from './useDetailDialog';

export type DetailActionBarProps = {
  record: MaintenanceRecord;
  canReview: boolean;
  /** Bước kế tiếp từ Chờ tiếp nhận ("Tiếp nhận ngay"). */
  onAdvance: () => void;
  onOpen: (d: DetailDialog) => void;
};

/** Thanh hành động dính đáy theo bước: Hủy · Tiếp nhận · Gửi nghiệm thu · Cập nhật tiến độ · Nghiệm thu. */
export function DetailActionBar({ record: r, canReview, onAdvance, onOpen }: DetailActionBarProps) {
  const nextLabel = NEXT_ACTION_LABEL[r.status];
  return (
    <StickyActionBar label={`Thao tác yêu cầu ${r.code}`}>
      {canCancel(r.status) && (
        <Button variant="subtle" onClick={() => onOpen('cancel')}>
          Hủy yêu cầu
        </Button>
      )}
      {r.status === 'pending' && nextLabel && (
        <Button variant="outline" onClick={onAdvance}>
          {nextLabel}
          <SendIcon size={16} />
        </Button>
      )}
      {r.status === 'in-progress' && (
        <Button variant="subtle" onClick={() => onOpen('submit')}>
          Gửi nghiệm thu
        </Button>
      )}
      {canUpdateProgress(r.status) && (
        <Button variant="outline" onClick={() => onOpen('progress')}>
          Cập nhật tiến độ
        </Button>
      )}
      {r.status === 'review' && canReview && (
        <Button variant="outline" onClick={() => onOpen('review')}>
          Nghiệm thu
        </Button>
      )}
    </StickyActionBar>
  );
}
