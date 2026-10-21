import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Card } from '../Card';
import { SignalLostIcon } from '../Icon';
import { ProgressBar, type ProgressTone } from '../ProgressBar';

export type KpiVariant = 'default' | 'danger' | 'with-progress' | 'compact';
export type KpiTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
export type KpiSubTone = KpiTone | 'muted' | 'warning-soft';

export type KpiCardProps = {
  label: string;
  /** Icon trong khung (15–24px tuỳ màn); đặt cuối hàng tiêu đề, hoặc đầu nếu iconPosition="start". */
  icon?: ReactNode;
  iconPosition?: 'start' | 'end';
  value: ReactNode;
  /** Đơn vị cạnh giá trị: "Nm³", "%", "bar"… */
  unit?: string;
  /** Text dòng phụ (tuỳ chọn, mặc định không có): "+2.5%", "Ổn định", "+12% vs tháng trước"… */
  sub?: ReactNode;
  /** Mất tín hiệu (tag bad / quá 10 s không cập nhật): số xám "—", dòng phụ "Mất tín hiệu" + icon – không hiện số cũ. */
  signalLost?: boolean;
  subTone?: KpiSubTone;
  /**
   * Icon dòng phụ (trend ↑, "—", ⚠…). Có thể dùng một mình không kèm `sub`,
   * ví dụ "Mức bồn V-101" chỉ hiện "—" (53:239) như ảnh Figma.
   */
  subIcon?: ReactNode;
  /** Làm mờ dòng phụ 70% – dòng trạng thái ("Ổn định", "Bình thường", "—") khác dòng trend (53:187, 53:199, 53:238). */
  subDim?: boolean;
  /**
   * - default:      nhãn xanh nhạt 16, số 28/42, đơn vị, dòng phụ (53:167)
   * - danger:        viền đỏ, số + đơn vị đỏ, link "Xem chi tiết" (53:213)
   * - with-progress: viền xanh, ProgressBar dưới giá trị (53:201)
   * - compact:       số 28/32, bo 8px – KPI Cảnh báo (70:2958) & Bảo trì (70:4508)
   */
  variant?: KpiVariant;
  /** Màu số (và nhãn nếu `toneLabel`). */
  tone?: KpiTone;
  /** Tô nhãn theo tone (KPI Cảnh báo 70:2964–70:2995). */
  toneLabel?: boolean;
  /** Viền theo tone (KPI "Quá hạn" 70:5058) – chỉ áp dụng cho compact. */
  outlined?: boolean;
  /** compact: viền line-card (Bảo trì) thay vì line/30 (Cảnh báo). */
  strongBorder?: boolean;
  /** ProgressBar dưới giá trị – bắt buộc với "with-progress", tuỳ chọn với compact (70:5097). */
  progress?: { value: number; max?: number; tone?: ProgressTone };
  /** Link cuối thẻ (variant="danger": "Xem chi tiết"). */
  action?: { label: string; onClick?: () => void };
  className?: string;
};

const valueTone: Record<KpiTone, string> = {
  neutral: 'text-fg',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
};

const subToneClass: Record<KpiSubTone, string> = {
  ...valueTone,
  muted: 'text-fg-secondary',
  'warning-soft': 'text-warning-soft',
};

export function KpiCard({
  label,
  icon,
  iconPosition = 'end',
  value,
  unit,
  sub,
  subTone = 'success',
  subIcon,
  subDim,
  variant = 'default',
  tone = 'neutral',
  toneLabel,
  outlined,
  strongBorder,
  progress,
  action,
  signalLost,
  className,
}: KpiCardProps) {
  const compact = variant === 'compact';
  const danger = variant === 'danger';

  const cardTone = danger
    ? 'danger'
    : variant === 'with-progress'
      ? 'success'
      : compact && outlined && tone === 'danger'
        ? 'danger'
        : compact && strongBorder
          ? 'strong'
          : 'default';

  const labelClass = cn(
    'min-w-0 truncate text-md font-semibold',
    compact ? 'leading-6 tracking-label' : 'leading-6',
    toneLabel ? valueTone[tone] : compact ? 'text-fg-secondary' : danger ? 'text-fg-muted' : 'text-fg-label',
  );

  const numberClass = cn(
    'font-bold',
    compact ? 'text-2xl' : 'text-kpi',
    signalLost ? 'text-fg-disabled' : danger ? 'text-danger-strong' : valueTone[tone],
  );

  return (
    <Card
      tone={cardTone}
      radius={compact ? 'lg' : 'xl'}
      className={cn('h-full', className)}
      // with-progress: số nằm ngay dưới nhãn (Figma 53:207), không dàn đều theo chiều cao như các thẻ khác.
      bodyClassName={cn(compact ? 'gap-2' : variant === 'with-progress' ? 'gap-0 py-[18px]' : 'justify-between gap-0')}
    >
      {/* Hàng tiêu đề */}
      <div className={cn('flex items-center', iconPosition === 'start' ? 'gap-1' : 'justify-between gap-2')}>
        {iconPosition === 'start' && icon}
        <span className={labelClass} title={label}>
          {label}
        </span>
        {iconPosition === 'end' && icon}
      </div>

      {/* Giá trị */}
      <div className={cn('flex flex-col', compact && sub !== undefined && 'gap-2')}>
        <p className="flex items-baseline gap-1 whitespace-nowrap">
          <span className={numberClass}>{signalLost ? '—' : value}</span>
          {unit && !signalLost && (
            <span className={cn('text-md', danger ? 'text-danger-strong/70' : 'text-fg-muted')}>{unit}</span>
          )}
        </p>

        {progress && (
          <ProgressBar
            value={progress.value}
            max={progress.max}
            tone={progress.tone ?? 'success'}
            track={compact ? 'solid' : 'subtle'}
            label={label}
            className="mt-2"
          />
        )}

        {signalLost ? (
          <div className="flex h-6 items-center gap-1 text-md text-fg-secondary" role="status">
            <SignalLostIcon size={16} className="shrink-0" />
            <span className="truncate">Mất tín hiệu</span>
          </div>
        ) : (
          (sub !== undefined || subIcon) && (
            <div className={cn('flex h-6 items-center gap-1 text-md', subToneClass[subTone], subDim && 'opacity-70')}>
              {subIcon}
              {sub !== undefined && <span className="truncate">{sub}</span>}
            </div>
          )
        )}

        {action && (
          // Link 16px theo tone thẻ (53:229) – khác Button variant="link" (12px accent) nên dùng button gốc.
          <button
            type="button"
            onClick={action.onClick}
            className={cn(
              'self-start rounded-sm text-md hover:underline',
              danger ? 'text-danger-strong/80' : 'text-accent',
            )}
          >
            {action.label}
          </button>
        )}
      </div>
    </Card>
  );
}
