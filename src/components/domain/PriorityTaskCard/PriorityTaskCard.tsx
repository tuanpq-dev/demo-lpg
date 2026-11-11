import type { IconName } from '@/assets/digital-twin';
import { cn } from '@/lib/cn';
import { Badge, type Severity } from '../../Badge';
import { Icon } from '../../Icon';

export type PriorityTaskData = {
  id: string;
  /** Mã yêu cầu: "MT-00128". */
  code: string;
  title: string;
  severity: Severity;
  device: string;
  /** Icon thiết bị (van/cảm biến gas/máy hóa hơi…). */
  deviceIcon?: IconName;
  /** "Quá hạn 2 ngày", "Hết hạn hôm nay", "Hết hạn ngày mai"… */
  dueLabel: string;
  /** Quá hạn → dòng hạn + icon đồng hồ màu danger. */
  overdue?: boolean;
};

export type PriorityTaskCardProps = PriorityTaskData & {
  /** Link "Chi tiết". */
  onDetail?: (id: string) => void;
  className?: string;
};

const accent: Record<Severity, string> = {
  critical: 'border-danger',
  high: 'border-warning',
  medium: 'border-line',
  low: 'border-line/50',
};

/**
 * Thẻ "Công việc cần ưu tiên" – trang Bảo trì (Figma 70:4581, 70:4601, 70:4621).
 * Khác AlertCard: mã ở trên (info), badge góc phải, dòng thiết bị + dòng hạn có icon, link "Chi tiết".
 */
export function PriorityTaskCard({
  id,
  code,
  title,
  severity,
  device,
  deviceIcon = 'mtDeviceValve',
  dueLabel,
  overdue,
  onDetail,
  className,
}: PriorityTaskCardProps) {
  return (
    <article
      className={cn(
        // Chuẩn hóa: viền trái 3px theo mức độ + viền mảnh tone/30 (Figma: thẻ 1 chỉ viền trái 2px, thẻ 2–3 viền đủ + trái 4px).
        'flex flex-col gap-2 rounded-lg border border-l-[3px] bg-surface-raised py-4 pl-[18px] pr-4',
        accent[severity],
        severity === 'critical'
          ? 'border-y-danger/30 border-r-danger/30'
          : severity === 'high'
            ? 'border-y-warning/30 border-r-warning/30'
            : 'border-y-line/30 border-r-line/30',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-md text-info">{code}</span>
        <Badge variant="severity" value={severity} size="md" />
      </div>
      <h3 className="truncate text-md font-semibold text-fg" title={title}>
        {title}
      </h3>
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-[3.5px] text-md">
          <span className="flex items-center gap-1 text-fg-secondary">
            <Icon name={deviceIcon} />
            {device}
          </span>
          <span className={cn('flex items-center gap-1', overdue ? 'text-danger-text' : 'text-fg-secondary')}>
            <Icon name={overdue ? 'mtDueOverdue' : 'mtDue'} />
            {dueLabel}
          </span>
        </div>
        {onDetail && (
          <button
            type="button"
            onClick={() => onDetail(id)}
            aria-label={`Chi tiết ${code}`}
            className="shrink-0 rounded-sm text-sm font-semibold leading-4.5 text-info underline hover:text-accent"
          >
            Chi tiết
          </button>
        )}
      </div>
    </article>
  );
}
