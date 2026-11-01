import { cn } from '@/lib/cn';
import type { Severity } from '../Badge';
import { AlertCircleIcon, CheckCircleIcon } from '../Icon';

export type AlertItemTone = 'danger' | 'warning' | 'success';

export type AlertItemData = {
  id: string;
  /** Mã thiết bị/tag: "PT-101". */
  code: string;
  message: string;
  /** Thời gian tương đối: "10 phút trước". */
  time: string;
  severity: Severity;
};

export type AlertItemProps = AlertItemData & {
  /**
   * - stacked (mặc định): mã + giờ trên, nội dung dưới – "Cảnh báo ưu tiên" Tổng quan (53:470)
   * - inline: icon theo `tone` + nội dung + giờ trên một dòng – "Cảnh báo liên quan" (trang chi tiết tài sản)
   * - bar: khối nền nhạt có vạch màu `tone` bên trái, nội dung + "giờ - trạng thái" – "Cảnh báo liên quan" màn Vận hành
   *   (ảnh `op-device-right.png`)
   */
  layout?: 'stacked' | 'inline' | 'bar';
  /** layout="bar": nhãn trạng thái sau giờ ("Đang xử lý"). */
  statusLabel?: string;
  /** Icon/màu của dạng inline; mặc định suy từ severity (critical → danger, còn lại warning). */
  tone?: AlertItemTone;
  /** Nền đỏ mờ cho cảnh báo nổi bật nhất (53:471). */
  highlighted?: boolean;
  /** Ẩn viền dưới (item cuối danh sách). */
  last?: boolean;
  onClick?: (id: string) => void;
  className?: string;
};

const codeTone: Record<Severity, string> = {
  critical: 'text-danger-text',
  high: 'text-warning-soft',
  medium: 'text-warning-soft',
  low: 'text-fg-secondary',
};

/** Màu ICON đầu dòng (currentColor) – icon giữ `danger` (luật chữ đỏ chỉ áp cho chữ). */
const inlineTone: Record<AlertItemTone, string> = {
  // eslint-disable-next-line no-restricted-syntax -- icon, không phải chữ
  danger: 'text-danger',
  warning: 'text-warning',
  success: 'text-success',
};

/** Màu vạch trái của layout="bar" (viền – không phải chữ). */
const barTone: Record<AlertItemTone, string> = {
  danger: 'border-l-danger',
  warning: 'border-l-warning',
  success: 'border-l-success',
};

/** Một dòng cảnh báo trong danh sách "Cảnh báo ưu tiên" – cột phải Tổng quan (Figma 53:470). */
export function AlertItem({
  id,
  code,
  message,
  time,
  severity,
  layout = 'stacked',
  tone,
  highlighted,
  last,
  statusLabel,
  onClick,
  className,
}: AlertItemProps) {
  const Tag = onClick ? 'button' : 'div';
  if (layout === 'bar') {
    const t: AlertItemTone = tone ?? (severity === 'critical' ? 'danger' : 'warning');
    return (
      <Tag
        type={onClick ? 'button' : undefined}
        onClick={onClick ? () => onClick(id) : undefined}
        className={cn(
          'flex w-full flex-col gap-1 rounded-md border-l-2 bg-surface-muted/20 px-3 py-2.5 text-left',
          barTone[t],
          onClick && 'transition-colors hover:bg-surface-muted/40',
          className,
        )}
      >
        <span className={cn('text-base', t === 'success' ? 'text-success' : 'text-fg')}>
          <span className="sr-only">{code}: </span>
          {message}
        </span>
        <span className="text-sm text-fg-secondary">
          {time}
          {statusLabel && ` - ${statusLabel}`}
        </span>
      </Tag>
    );
  }
  if (layout === 'inline') {
    const t: AlertItemTone = tone ?? (severity === 'critical' ? 'danger' : 'warning');
    const IconC = t === 'success' ? CheckCircleIcon : AlertCircleIcon;
    return (
      <Tag
        type={onClick ? 'button' : undefined}
        onClick={onClick ? () => onClick(id) : undefined}
        className={cn(
          'flex w-full items-center gap-2.5 px-4 py-2.5 text-left',
          !last && 'border-b border-line/30',
          onClick && 'transition-colors hover:bg-surface-muted/20',
          className,
        )}
      >
        <IconC size={16} className={cn('shrink-0', inlineTone[t])} />
        <span className="min-w-0 flex-1 truncate text-sm text-fg-muted" title={message}>
          <span className="sr-only">{code}: </span>
          {message}
        </span>
        <span className="shrink-0 text-2xs text-fg-muted/65">{time}</span>
      </Tag>
    );
  }
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick ? () => onClick(id) : undefined}
      className={cn(
        'flex w-full flex-col gap-2.5 px-4 pb-[11px] pt-2.5 text-left',
        !last && 'border-b border-line/30',
        highlighted && 'bg-danger-strong/15',
        onClick && 'transition-colors',
        onClick && (highlighted ? 'hover:bg-danger-strong/20' : 'hover:bg-surface-muted/20'),
        className,
      )}
    >
      <div className="flex w-full items-center justify-between gap-3">
        <span className={cn('text-sm font-bold', codeTone[severity])}>{code}</span>
        <span className="shrink-0 text-2xs text-fg-muted/65">{time}</span>
      </div>
      <p className="text-sm text-fg-muted/70">{message}</p>
    </Tag>
  );
}
