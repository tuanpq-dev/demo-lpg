import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from '../Icon';
import { StatusDot } from '../StatusDot';

export type Severity = 'critical' | 'high' | 'medium' | 'low';
/**
 * - unacknowledged: "Chưa xác nhận" (bảng cảnh báo, tông đỏ)
 * - pending:        "Chờ tiếp nhận" (bảng bảo trì, tông vàng)
 * - assigned:       "Đã phân công" (bảo trì – chưa có trong Figma bảng, màu accent)
 * - in-progress:    "Đang xử lý"
 * - review:         "Chờ nghiệm thu" (bảo trì – chưa có trong Figma bảng, màu warning-soft)
 * - done:           "Đã hoàn thành"
 */
export type WorkStatus = 'unacknowledged' | 'pending' | 'assigned' | 'in-progress' | 'review' | 'done';

type CommonProps = {
  /** Ghi đè nhãn mặc định (tiếng Việt). */
  children?: ReactNode;
  className?: string;
};

export type BadgeProps = CommonProps &
  (
    | {
        /** Nhãn chữ nhật bo 4px, chữ bold 10px – cột "Mức độ" (70:5296–70:5299). */
        variant: 'severity';
        value: Severity;
        /** Bỏ độ rộng tối thiểu 87px dùng trong bảng (chỉ size sm). */
        compact?: boolean;
        /**
         * - sm: chữ bold 10px, cao 20px, không viền – bảng (mặc định)
         * - md: chữ bold 16px, bo 2px, có viền tone/20 – AlertCard (70:2913)
         */
        size?: 'sm' | 'md';
      }
    | {
        /** Pill bo 12px có viền – cột "Trạng thái" (70:3077, 70:3104, 70:3184, 70:5563, 70:5433). */
        variant: 'status';
        value: WorkStatus;
        /** Thêm icon đầu: pending → chấm vàng, done → dấu tick (kiểu trang Bảo trì). */
        withIcon?: boolean;
      }
    | {
        /**
         * Bộ đếm số lượng.
         * - sm: chip cao 18px bo 12px cạnh label Tabs (70:5556, 70:5552, 70:5548)
         * - md: vòng tròn 24px trên NavTabs (70:349)
         */
        variant: 'count';
        value: number;
        tone?: CountTone;
        size?: 'sm' | 'md';
        /** Giá trị tối đa hiển thị; vượt quá sẽ thành "99+". */
        max?: number;
      }
  );

export type CountTone = 'neutral' | 'info' | 'danger';

const countClass: Record<'sm' | 'md', Record<CountTone, string>> = {
  sm: {
    neutral: 'bg-surface-chip text-fg-secondary',
    info: 'bg-info/20 text-info',
    danger: 'bg-danger/20 text-danger',
  },
  md: {
    neutral: 'bg-surface-chip text-fg-secondary',
    info: 'bg-info/15 text-info',
    danger: 'bg-danger-strong/15 text-danger-strong',
  },
};

const severityClass: Record<Severity, string> = {
  critical: 'bg-danger/10 text-danger',
  high: 'bg-warning/10 text-warning',
  medium: 'bg-surface-muted text-fg opacity-70',
  low: 'bg-surface-muted/50 text-fg-secondary opacity-70',
};

const severityBorder: Record<Severity, string> = {
  critical: 'border-danger/20',
  high: 'border-warning/20',
  medium: 'border-line',
  low: 'border-line/50',
};

const severityLabel: Record<Severity, string> = {
  critical: 'Nghiêm trọng',
  high: 'Cao',
  medium: 'Trung bình',
  low: 'Thấp',
};

const statusClass: Record<WorkStatus, string> = {
  unacknowledged: 'border-danger/20 bg-danger/10 text-danger',
  pending: 'border-warning/20 bg-surface-muted text-warning',
  assigned: 'border-accent/20 bg-accent/10 text-accent',
  'in-progress': 'border-info/20 bg-info/10 text-info',
  review: 'border-warning-soft/20 bg-warning-soft/10 text-warning-soft',
  done: 'border-success/20 bg-success/10 text-success',
};

const statusLabel: Record<WorkStatus, string> = {
  unacknowledged: 'Chưa xác nhận',
  pending: 'Chờ tiếp nhận',
  assigned: 'Đã phân công',
  'in-progress': 'Đang xử lý',
  review: 'Chờ nghiệm thu',
  done: 'Đã hoàn thành',
};

export function Badge(props: BadgeProps) {
  const { children, className } = props;

  if (props.variant === 'severity') {
    const md = props.size === 'md';
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center whitespace-nowrap font-bold',
          md
            ? cn('rounded-xs border px-[9px] py-[3px] text-md leading-[15px]', severityBorder[props.value])
            : cn('h-5 rounded-sm px-2.5 text-2xs leading-5', !props.compact && 'min-w-[87px]'),
          severityClass[props.value],
          className,
        )}
      >
        {children ?? severityLabel[props.value]}
      </span>
    );
  }

  if (props.variant === 'count') {
    const { value, tone = 'neutral', size = 'sm', max = 99 } = props;
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center whitespace-nowrap text-2xs tabular-nums',
          size === 'sm' ? 'h-[18px] min-w-[18px] rounded-xl px-1.5' : 'size-6 rounded-full',
          countClass[size][tone],
          className,
        )}
      >
        {children ?? (value > max ? `${max}+` : value)}
      </span>
    );
  }

  let icon: ReactNode = null;
  if (props.withIcon && props.value === 'pending') icon = <StatusDot status="warning" />;
  if (props.withIcon && props.value === 'done') icon = <Icon name="check" box={12} className="w-2" />;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-xl border px-3 py-[3px] text-2xs leading-4',
        statusClass[props.value],
        className,
      )}
    >
      {icon}
      {children ?? statusLabel[props.value]}
    </span>
  );
}
