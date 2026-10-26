import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Badge, type Severity } from '../Badge';

/**
 * Trạng thái xử lý hiển thị góc phải dưới thẻ:
 * - action-required: "Cần xử lý" (đỏ)
 * - in-progress:     "Đang xử lý" (info)
 * - unacknowledged:  "Chưa xác nhận" (chữ phụ)
 * - done:            "Đã hoàn thành" (xanh)
 */
export type AlertHandling = 'action-required' | 'in-progress' | 'unacknowledged' | 'done';

export type AlertCardData = {
  id: string;
  severity: Severity;
  /** Mã cảnh báo: "ALT-00128". */
  code: string;
  /** Thiết bị: "V-101". */
  device: string;
  message: string;
  /** Giá trị đo + đơn vị: "11.8 bar". */
  value: string;
  /** Ngưỡng + đơn vị: "10.5 bar". */
  threshold: string;
  handling: AlertHandling;
};

export type AlertCardProps = AlertCardData & {
  onClick?: (id: string) => void;
  /**
   * - default: thẻ lớn "Cảnh báo ưu tiên" (70:2911)
   * - compact: khối trong card "Cảnh báo liên quan" (ảnh chi tiết bảo trì MT-00128): mã (màu mức độ) + badge, nội dung,
   *   hai cột giá trị/ngưỡng, `footer` (link). Không hiện `handling`, không phải nút (link nằm trong `footer`).
   */
  variant?: 'default' | 'compact';
  /** compact: nhãn cột giá trị – mặc định "Hiện tại" (ảnh); trang bảo trì dùng "Lúc cảnh báo" (giá trị lúc phát sinh). */
  valueLabel?: string;
  /** compact: phần cuối (vd `<Link>` "Xem chi tiết cảnh báo →" – component không import router). */
  footer?: ReactNode;
  className?: string;
};

const accentBorder: Record<Severity, string> = {
  critical: 'border-danger',
  high: 'border-warning',
  medium: 'border-line',
  low: 'border-line/50',
};

const valueTone: Record<Severity, string> = {
  critical: 'text-danger-text',
  high: 'text-warning',
  medium: 'text-fg',
  low: 'text-fg-secondary',
};

const handlingClass: Record<AlertHandling, string> = {
  'action-required': 'font-semibold text-danger-text',
  'in-progress': 'font-bold text-info',
  unacknowledged: 'font-bold text-fg-secondary',
  done: 'font-bold text-success',
};

const handlingLabel: Record<AlertHandling, string> = {
  'action-required': 'Cần xử lý',
  'in-progress': 'Đang xử lý',
  unacknowledged: 'Chưa xác nhận',
  done: 'Đã hoàn thành',
};

const codeTone: Record<Severity, string> = {
  critical: 'text-danger-text',
  high: 'text-warning',
  medium: 'text-fg-secondary',
  low: 'text-fg-secondary',
};

/** compact – khối "Cảnh báo liên quan" (ảnh MT-00128; số đo là ước lượng). */
function CompactAlert({ severity, code, message, value, threshold, valueLabel = 'Hiện tại', footer, className }: AlertCardProps) {
  return (
    <article className={cn('flex flex-col gap-2', className)} aria-label={`Cảnh báo ${code}`}>
      <div className="flex items-center justify-between gap-3">
        <span className={cn('truncate text-base', codeTone[severity])}>{code}</span>
        <Badge variant="severity" value={severity} compact outline />
      </div>
      <p className="text-base text-fg">{message}</p>
      <dl className="flex gap-4">
        <div className="flex flex-col gap-0.5">
          <dt className="text-sm text-fg-secondary">{valueLabel}</dt>
          <dd className={cn('text-base font-bold', valueTone[severity])}>{value}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-sm text-fg-secondary">Ngưỡng</dt>
          <dd className="text-base text-fg">{threshold}</dd>
        </div>
      </dl>
      {footer}
    </article>
  );
}

/** Thẻ cảnh báo lớn – "Cảnh báo ưu tiên" ở Trung tâm cảnh báo (Figma 70:2911, 70:2926, 70:2941). */
export function AlertCard(props: AlertCardProps) {
  if (props.variant === 'compact') return <CompactAlert {...props} />;
  const { id, severity, code, device, message, value, threshold, handling, onClick, className } = props;
  const Tag = onClick ? 'button' : 'article';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick ? () => onClick(id) : undefined}
      className={cn(
        'flex w-full flex-col gap-2 rounded-lg border-l-2 bg-surface py-3 pl-3.5 pr-3 text-left shadow-card',
        accentBorder[severity],
        onClick && 'transition-colors hover:bg-surface-raised',
        className,
      )}
    >
      <div className="flex w-full items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Badge variant="severity" value={severity} size="md" />
          <span className="truncate text-sm text-fg-secondary">{code}</span>
        </div>
        <span className="shrink-0 text-sm text-fg-secondary">{device}</span>
      </div>
      <p className="w-full truncate text-base text-fg">{message}</p>
      <div className="flex w-full items-center justify-between gap-3">
        <span className="text-sm">
          <span className={valueTone[severity]}>{value}</span>
          <span className="text-fg-secondary"> / {threshold}</span>
        </span>
        <span className={cn('shrink-0 text-md leading-4', handlingClass[handling])}>{handlingLabel[handling]}</span>
      </div>
    </Tag>
  );
}
