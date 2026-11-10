import { cn } from '@/lib/cn';
import { Button } from '../Button';
import { Card } from '../Card';
import { UserPlusIcon } from '../Icon';

export type AssigneeCardProps = {
  /** Người chịu trách nhiệm chính; null = chưa phân công. */
  assignee: string | null;
  /** Vai trò / phòng ban của người phụ trách (dòng phụ). */
  assigneeNote?: string;
  department?: string;
  shift?: string;
  /** Mở hộp phân công. Không truyền = ẩn nút. */
  onAssign?: () => void;
  /** Nhãn nút (mặc định: có người → "Đổi người xử lý", chưa có → "Phân công người xử lý"). */
  assignLabel?: string;
  /** Khoá nút (đã hoàn thành / đã hủy / không có quyền). */
  assignDisabled?: boolean;
  className?: string;
};

/**
 * "Phân công" – ảnh MT-00128 (số đo ước lượng): "Người chịu trách nhiệm chính", ô viền đứt khi chưa phân công
 * (ô "?" 32px + "Chưa phân công" nghiêng + "Cần chỉ định kỹ thuật viên" đỏ), hai ô Phòng ban / Ca trực, nút viền primary.
 */
export function AssigneeCard({ assignee, assigneeNote, department, shift, onAssign, assignLabel, assignDisabled, className }: AssigneeCardProps) {
  return (
    <Card title="Phân công" icon={<UserPlusIcon size={18} className="text-fg-secondary" />} headerVariant="divided" radius="lg" className={className}>
      <div className="flex flex-col gap-3">
        <p className="text-base text-fg-secondary">Người chịu trách nhiệm chính</p>
        {assignee ? (
          <div className="flex items-center gap-3 rounded-md border border-line/30 p-3">
            <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-info/20 text-xs font-semibold text-info">
              {assignee.split(/\s+/).slice(-1)[0]?.[0]?.toUpperCase()}
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-base font-semibold text-fg">{assignee}</span>
              {assigneeNote && <span className="truncate text-sm text-fg-secondary">{assigneeNote}</span>}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-md border border-dashed border-line p-3">
            <span
              aria-hidden="true"
              className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-muted text-md font-semibold text-fg-secondary"
            >
              ?
            </span>
            <div className="flex flex-col">
              <span className="text-base italic text-fg">Chưa phân công</span>
              <span className="text-base text-danger-text">Cần chỉ định kỹ thuật viên</span>
            </div>
          </div>
        )}
        <dl className="grid grid-cols-2 gap-3">
          {[
            { label: 'Phòng ban', value: department },
            { label: 'Ca trực', value: shift },
          ].map((f) => (
            <div key={f.label} className={cn('flex min-w-0 flex-col gap-0.5 rounded-md border border-line/30 px-2.5 py-2')}>
              <dt className="text-base text-fg-secondary">{f.label}</dt>
              <dd className="truncate text-base font-semibold text-fg">{f.value || '—'}</dd>
            </div>
          ))}
        </dl>
        {onAssign && (
          <Button variant="outline" onClick={onAssign} disabled={assignDisabled} className="w-full">
            {assignLabel ?? (assignee ? 'Đổi người xử lý' : 'Phân công người xử lý')}
          </Button>
        )}
      </div>
    </Card>
  );
}
