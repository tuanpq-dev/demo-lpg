import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Card } from '../Card';
import { InfoIcon, SignalLostIcon } from '../Icon';
import { ProgressBar, type ProgressTone } from '../ProgressBar';

export type KpiVariant = 'default' | 'danger' | 'with-progress' | 'compact';
export type KpiTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary';
export type KpiSubTone = KpiTone | 'muted' | 'warning-soft';

export type KpiCardProps = {
  label: string;
  /**
   * Định nghĩa/ghi chú của chỉ số (vd "Mức bồn = % thể tích toàn bộ chất lỏng"): tooltip khi rê chuột + đọc kèm nhãn
   * cho trình đọc màn hình. `hintIcon` hiện thêm icon ⓘ cạnh nhãn.
   */
  hint?: string;
  hintIcon?: boolean;
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
  /**
   * Thẻ thấp (~104px, trang chi tiết tài sản): padding dọc 14px, dòng phụ 11px. Dùng với default (kèm progress
   * tuỳ chọn). Không đổi kích thước số.
   */
  dense?: boolean;
  /** Viền theo tone (KPI "Quá hạn" 70:5058) – chỉ áp dụng cho compact. */
  outlined?: boolean;
  /** compact: viền line-card (Bảo trì) thay vì line/30 (Cảnh báo). */
  strongBorder?: boolean;
  /** ProgressBar dưới giá trị – bắt buộc với "with-progress", tuỳ chọn với compact (70:5097). */
  progress?: { value: number; max?: number; tone?: ProgressTone };
  /** Link cuối thẻ (variant="danger": "Xem chi tiết"). */
  action?: { label: string; onClick?: () => void };
  /**
   * sm = ô số liệu nhỏ (nhãn 12–14px, số 14px, viền line/30, không bóng) – "Thiết bị liên quan" ở chi tiết bảo trì
   * (ảnh MT-00128). Dùng `label`, `value`, `unit`, `tone`, `signalLost`, `hint`; bỏ qua variant/icon/progress/sub.
   */
  size?: 'md' | 'sm';
  /**
   * sm: ô thông tin to hơn – nhãn 14px, giá trị 16px đậm, đệm 14px (5 ô đầu modal "Cập nhật tiến độ bảo trì"; ảnh thiết kế).
   */
  emphasis?: boolean;
  className?: string;
};

const valueTone: Record<KpiTone, string> = {
  neutral: 'text-fg',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger-text',
  info: 'text-info',
  primary: 'text-primary',
};

const subToneClass: Record<KpiSubTone, string> = {
  ...valueTone,
  muted: 'text-fg-secondary',
  'warning-soft': 'text-warning-soft',
};

export function KpiCard({
  label,
  hint,
  hintIcon,
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
  dense,
  size = 'md',
  emphasis,
  className,
}: KpiCardProps) {
  if (size === 'sm') {
    return (
      <div className={cn('flex min-w-0 flex-col rounded-md border border-line/30', emphasis ? 'gap-1 px-3.5 py-3' : 'gap-0.5 px-2.5 py-2', className)}>
        <span className={cn('truncate text-fg-secondary', emphasis ? 'text-base' : 'text-sm')} title={hint ? `${label} – ${hint}` : undefined}>
          {label}
          {hint && <span className="sr-only">. {hint}</span>}
        </span>
        {signalLost ? (
          <span className="flex items-center gap-1 text-sm text-fg-secondary">
            <SignalLostIcon size={14} className="shrink-0" />
            Mất tín hiệu
          </span>
        ) : (
          <span
            className={cn(
              'truncate tabular-nums',
              emphasis ? 'text-md font-semibold' : 'text-base',
              tone === 'neutral' ? 'text-fg' : cn('font-bold', valueTone[tone]),
            )}
          >
            {value}
            {unit && (unit.startsWith('°') || unit === '%' ? unit : ` ${unit}`)}
          </span>
        )}
      </div>
    );
  }
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

  // Số KPI là "chữ lớn" WCAG (text-kpi / text-2xl = 28px đậm ≥ 18.66px đậm) → danger-strong được phép (4.54:1 ≥ 3:1).
  // Kiểm bằng code: test KpiCard (cỡ chữ đi cùng danger-strong) + script e2e quét mọi chữ màu danger-strong trên các trang.
  const numberClass = cn(
    'font-bold',
    compact ? 'text-2xl' : 'text-kpi',
    // eslint-disable-next-line no-restricted-syntax -- chữ lớn 28px đậm
    signalLost ? 'text-fg-disabled' : danger ? 'text-danger-strong' : valueTone[tone],
  );

  return (
    <Card
      tone={cardTone}
      radius={compact ? 'lg' : 'xl'}
      className={cn('h-full', className)}
      // with-progress: số nằm ngay dưới nhãn (Figma 53:207), không dàn đều theo chiều cao như các thẻ khác.
      bodyClassName={cn(
        compact ? 'gap-2' : variant === 'with-progress' ? 'gap-0 py-[18px]' : 'justify-between gap-0',
        dense && 'justify-start gap-1 py-3.5',
      )}
    >
      {/* Hàng tiêu đề */}
      <div className={cn('flex items-center', iconPosition === 'start' ? 'gap-1' : 'justify-between gap-2')}>
        {iconPosition === 'start' && icon}
        <span className={cn(labelClass, hintIcon && 'flex items-center gap-1')} title={hint ? `${label} – ${hint}` : label}>
          {hintIcon ? <span className="truncate">{label}</span> : label}
          {hintIcon && <InfoIcon size={14} className="shrink-0 text-fg-secondary" />}
          {hint && <span className="sr-only">. {hint}</span>}
        </span>
        {iconPosition === 'end' && icon}
      </div>

      {/* Giá trị */}
      <div className={cn('flex flex-col', compact && sub !== undefined && 'gap-2')}>
        <p className="flex items-baseline gap-1 whitespace-nowrap">
          <span className={numberClass}>{signalLost ? '—' : value}</span>
          {unit && !signalLost && (
            // Đơn vị phụ ("Active"): thứ bậc bằng CỠ (16px thường so với số 28px đậm), không bằng độ mờ.
            <span className={cn('text-md font-normal', danger ? 'text-danger-text' : 'text-fg-muted')}>{unit}</span>
          )}
        </p>

        {progress && (
          <ProgressBar
            value={progress.value}
            max={progress.max}
            tone={progress.tone ?? 'success'}
            track={compact ? 'solid' : 'subtle'}
            label={label}
            className={dense ? 'mt-1.5' : 'mt-2'}
          />
        )}

        {signalLost ? (
          <div className={cn('flex items-center gap-1 text-fg-secondary', dense ? 'h-4 text-xs' : 'h-6 text-md')} role="status">
            <SignalLostIcon size={dense ? 12 : 16} className="shrink-0" />
            <span className="truncate">Mất tín hiệu</span>
          </div>
        ) : (
          (sub !== undefined || subIcon) && (
            <div className={cn('flex items-center gap-1', dense ? 'h-4 text-xs' : 'h-6 text-md', subToneClass[subTone], subDim && 'opacity-70')}>
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
              // Link không chỉ dựa vào màu: luôn gạch chân + mũi tên (trước: chữ đỏ mờ 80 %, gạch chân khi hover).
              'self-start rounded-sm text-md underline decoration-1 underline-offset-2 hover:decoration-2',
              danger ? 'text-danger-text' : 'text-accent',
            )}
          >
            {action.label}
            <span aria-hidden="true"> →</span>
          </button>
        )}
      </div>
    </Card>
  );
}
