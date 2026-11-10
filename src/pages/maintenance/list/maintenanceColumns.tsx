import { Badge, type DataTableColumn } from '@/components';
import { STATUS_BADGE, STATUS_LABEL, dueLabel, formatDate, isOverdue, type MaintenanceRecord } from '@/data/maintenance';
import { canAssign } from '@/features/maintenance/assign';
import { HOLD_LABEL, canUpdateProgress, reportedProgressOf } from '@/features/maintenance/progress';
import { REVIEW_FAILED_LABEL } from '@/features/maintenance/review';
import { cn } from '@/lib/cn';
import { checklistText } from './exportMaintenanceCsv';

/** Badge trạng thái + cờ "Tạm dừng"/"Gặp sự cố" (Gặp sự cố nổi bật: nền đỏ nhạt, chữ đỏ). */
function StatusCell({ r }: { r: MaintenanceRecord }) {
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Badge variant="status" value={STATUS_BADGE[r.status]} withIcon>
        {STATUS_LABEL[r.status]}
      </Badge>
      {r.hold && (
        <Badge variant="tag" tone={r.hold.kind === 'blocked' ? 'danger' : 'warning'}>
          {r.hold.kind === 'blocked' && <span aria-hidden="true">⚠&nbsp;</span>}
          {HOLD_LABEL[r.hold.kind]}
        </Badge>
      )}
      {r.reviewFailed && r.status === 'in-progress' && (
        <Badge variant="tag" tone="danger">
          {REVIEW_FAILED_LABEL}
        </Badge>
      )}
    </span>
  );
}

/** Modal mở từ badge trạng thái của dòng (qua query). */
export type RowModal = 'assign' | 'review' | 'progress';

export type MaintenanceColumnsOptions = {
  now: Date;
  canWrite: boolean;
  canReview: boolean;
  openDetail: (id: string) => void;
  openModal: (modal: RowModal, id: string) => void;
};

/**
 * Cột bảng "Danh sách yêu cầu bảo trì" (Figma 70:5642). Badge trạng thái là nút theo bước + quyền: Chờ tiếp nhận → Phân công,
 * Chờ nghiệm thu → Nghiệm thu, Đã phân công / Đang thực hiện → Cập nhật tiến độ (tên = chữ ẩn + chữ hiển thị, WCAG 2.5.3).
 */
export function maintenanceColumns({
  now,
  canWrite,
  canReview,
  openDetail,
  openModal,
}: MaintenanceColumnsOptions): DataTableColumn<MaintenanceRecord>[] {
  return [
    {
      id: 'code',
      header: 'Mã yêu cầu',
      width: 100,
      cell: (r) => (
        <button
          type="button"
          onClick={() => openDetail(r.id)}
          className={cn('rounded-sm text-base text-info hover:underline', r.status === 'done' && 'text-fg-secondary line-through')}
        >
          {r.code}
        </button>
      ),
    },
    { id: 'createdAt', header: 'Ngày tạo', width: 100, className: 'text-base text-fg', cell: (r) => formatDate(r.createdAt) },
    {
      id: 'title',
      header: 'Nội dung',
      align: 'start',
      width: 240,
      className: 'max-w-[240px] truncate text-fg',
      cell: (r) => <span title={r.title}>{r.title}</span>,
    },
    { id: 'device', header: 'Thiết bị', width: 80, className: 'text-base text-fg' },
    { id: 'priority', header: 'Mức độ', width: 100, cell: (r) => <Badge variant="severity" value={r.priority} /> },
    { id: 'assignee', header: 'Người PT', width: 110, className: 'text-base text-fg-secondary', cell: (r) => r.assignee ?? '–' },
    {
      id: 'dueAt',
      header: 'Hạn xử lý',
      width: 100,
      cell: (r) => (
        <span className={cn('text-base', isOverdue(r, now) ? 'text-danger-text' : 'text-fg')} title={dueLabel(r, now)}>
          {formatDate(r.dueAt)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Trạng thái',
      width: 120,
      cell: (r) =>
        canWrite && canAssign(r.status) ? (
          <button
            type="button"
            onClick={() => openModal('assign', r.id)}
            title="Phân công người xử lý"
            className="rounded-md text-left hover:brightness-125"
          >
            {/* Tên = chữ ẩn + chữ hiển thị ("label in name" – WCAG 2.5.3), cùng cách badge tiến độ/nghiệm thu. */}
            <span className="sr-only">Phân công {r.code} – trạng thái: </span>
            <StatusCell r={r} />
          </button>
        ) : canReview && r.status === 'review' ? (
          <button type="button" onClick={() => openModal('review', r.id)} title="Nghiệm thu" className="rounded-md text-left hover:brightness-125">
            <span className="sr-only">Nghiệm thu {r.code} – trạng thái: </span>
            <StatusCell r={r} />
          </button>
        ) : canWrite && canUpdateProgress(r.status) ? (
          <button
            type="button"
            onClick={() => openModal('progress', r.id)}
            title="Cập nhật tiến độ"
            className="rounded-md text-left hover:brightness-125"
          >
            {/* Tên truy cập = chữ ẩn + chữ hiển thị (không dùng aria-label → khớp WCAG 2.5.3 "label in name"). */}
            <span className="sr-only">Cập nhật tiến độ {r.code} – trạng thái: </span>
            <StatusCell r={r} />
          </button>
        ) : (
          <StatusCell r={r} />
        ),
    },
    {
      id: 'progress',
      header: 'Tiến độ',
      width: 96,
      cell: (r) => {
        const list = checklistText(r);
        return (
          <span className="flex flex-col leading-tight">
            <span className="text-base tabular-nums text-fg">
              {reportedProgressOf(r)}%<span className="sr-only"> (tiến độ báo cáo)</span>
            </span>
            {list && <span className="text-xs text-fg-secondary">Checklist {list}</span>}
          </span>
        );
      },
    },
  ];
}
