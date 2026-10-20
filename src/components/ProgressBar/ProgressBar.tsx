import { cn } from '@/lib/cn';

export type ProgressTone = 'success' | 'accent' | 'info' | 'warning' | 'neutral';

export type ProgressBarProps = {
  value: number;
  max?: number;
  /**
   * - success: sức khỏe thiết bị (53:212)
   * - accent:  Xưởng 1 (53:349)
   * - info:    "Đang thực hiện" trang Bảo trì (70:5099)
   * - warning: Xưởng 2 – warning-soft (53:357)
   * - neutral: Lò hơi (53:373)
   */
  tone?: ProgressTone;
  /** sm = 4px, đầu fill bo tròn (KPI). md = 6px, đầu fill vuông (bar theo khu vực). */
  size?: 'sm' | 'md';
  /** subtle = surface-muted/50 (Tổng quan), solid = surface-muted (Bảo trì 70:5098). */
  track?: 'subtle' | 'solid';
  /** Nhãn cho trình đọc màn hình. */
  label?: string;
  className?: string;
};

const toneClass: Record<ProgressTone, string> = {
  success: 'bg-success',
  accent: 'bg-accent',
  info: 'bg-info',
  warning: 'bg-warning-soft',
  neutral: 'bg-fg-secondary',
};

export function ProgressBar({
  value,
  max = 100,
  tone = 'success',
  size = 'sm',
  track = 'subtle',
  label,
  className,
}: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className={cn(
        'relative w-full overflow-clip rounded-full',
        size === 'sm' ? 'h-1' : 'h-1.5',
        track === 'subtle' ? 'bg-surface-muted/50' : 'bg-surface-muted',
        className,
      )}
    >
      <div
        className={cn('absolute inset-y-0 left-0 transition-[width]', toneClass[tone], size === 'sm' && 'rounded-full')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
