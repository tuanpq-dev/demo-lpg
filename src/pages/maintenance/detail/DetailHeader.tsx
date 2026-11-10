import { Badge, Button, PageHeader, WorkflowStepper } from '@/components';
import { STATUS_BADGE, STATUS_LABEL, type MaintenanceRecord } from '@/data/maintenance';
import { HOLD_LABEL } from '@/features/maintenance/progress';
import { REVIEW_FAILED_LABEL } from '@/features/maintenance/review';
import { WORKFLOW_STEPS, workflowPosition } from '@/features/maintenance/workflow';

export type DetailHeaderProps = {
  record: MaintenanceRecord;
  listUrl: string;
  overdue: boolean;
  onBack: () => void;
};

/** Tiêu đề trang chi tiết: breadcrumb, tên, badge mức độ / trạng thái / khẩn cấp / tạm dừng / không đạt / quá hạn, nút quay lại. */
export function DetailHeader({ record: r, listUrl, overdue, onBack }: DetailHeaderProps) {
  return (
    <PageHeader
      breadcrumb={[{ label: 'Bảo trì', to: '/maintenance' }, { label: 'Quản lý bảo trì', to: listUrl }, { label: r.code }]}
      title={r.title}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <Badge variant="severity" value={r.priority} size="chip" withIcon={r.priority === 'critical'} />
          <Badge variant="status" value={STATUS_BADGE[r.status]} size="md" withIcon>
            {STATUS_LABEL[r.status]}
          </Badge>
          {r.priority === 'critical' && (
            <Badge variant="tag" size="md">
              Bảo trì khẩn cấp
            </Badge>
          )}
          {r.hold && (
            <Badge variant="tag" size="md" tone={r.hold.kind === 'blocked' ? 'danger' : 'warning'}>
              {HOLD_LABEL[r.hold.kind]}
            </Badge>
          )}
          {r.reviewFailed && r.status === 'in-progress' && (
            <Badge variant="tag" size="md" tone="danger">
              {REVIEW_FAILED_LABEL}
            </Badge>
          )}
          {overdue && (
            <Badge variant="status" value="unacknowledged" size="md">
              Quá hạn
            </Badge>
          )}
        </span>
      }
      actions={
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Quay lại danh sách
        </Button>
      }
    />
  );
}

const STEPS = WORKFLOW_STEPS.map((s) => ({ id: s.status, label: s.label }));
/** Bước "Đang thực hiện" kèm nhãn phụ khi tạm dừng / gặp sự cố (vẫn bước 3). */
function stepsFor(r: MaintenanceRecord) {
  const hold = r.hold;
  // Nhãn phụ dưới "Đang thực hiện": tạm dừng / gặp sự cố; không thì "Không đạt nghiệm thu" (bị trả về).
  if (!hold && !r.reviewFailed) return STEPS;
  const note = hold ? HOLD_LABEL[hold.kind] : REVIEW_FAILED_LABEL;
  const noteTone = !hold || hold.kind === 'blocked' ? ('danger' as const) : ('warning' as const);
  return STEPS.map((s) => (s.id === 'in-progress' ? { ...s, note, noteTone } : s));
}

/** Thanh tiến trình 5 bước (full-width dưới tiêu đề). */
export function DetailStepper({ record: r }: { record: MaintenanceRecord }) {
  const pos = workflowPosition(r);
  return (
    <WorkflowStepper
      steps={stepsFor(r)}
      completed={pos.completed}
      current={pos.current}
      label={`Tiến trình xử lý ${r.code}`}
      className="min-h-[var(--mt-stepper-height)]"
    />
  );
}
