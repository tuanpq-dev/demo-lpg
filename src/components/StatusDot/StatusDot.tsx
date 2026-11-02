import { cn } from '@/lib/cn';

export type DotStatus = 'success' | 'warning' | 'danger' | 'offline' | 'live' | 'verify';

export type StatusDotProps = {
  /**
   * - success: #34D399 (Online, chú thích donut 53:410)
   * - warning: #FFBB43 (pill "Chờ tiếp nhận" 70:5564)
   * - danger:  #FA2439 (Cảnh báo, 53:416)
   * - offline: nền muted + viền line/50 (53:422)
   * - live:    #0DE635 (chấm "Dữ liệu trực tiếp"/"Hệ thống bình thường" 53:126)
   * - verify:  #A78BFA (số đọc tại hiện trường / mốc cần xác minh – chi tiết báo cáo ngày 117:4250)
   */
  status: DotStatus;
  /** sm = 6px (danh sách thiết bị), md = 8px (mặc định). */
  size?: 'sm' | 'md';
  /** circle (mặc định) hoặc square bo 2px như chú thích biểu đồ donut. */
  shape?: 'circle' | 'square';
  /** Hiệu ứng nhấp nháy cho dữ liệu realtime. */
  pulse?: boolean;
  /** Nhãn cho trình đọc màn hình; bỏ trống = trang trí. */
  label?: string;
  className?: string;
};

const statusClass: Record<DotStatus, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger-strong',
  offline: 'border border-line/50 bg-surface-muted',
  live: 'bg-live',
  verify: 'bg-verify',
};

export function StatusDot({ status, size = 'md', shape = 'circle', pulse, label, className }: StatusDotProps) {
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        'relative inline-block shrink-0',
        size === 'md' ? 'size-2' : 'size-1.5',
        shape === 'circle' ? 'rounded-full' : 'rounded-xs',
        statusClass[status],
        className,
      )}
    >
      {pulse && (
        <span className={cn('absolute inset-0 animate-ping rounded-[inherit] opacity-60', statusClass[status])} />
      )}
    </span>
  );
}
