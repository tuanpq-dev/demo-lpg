import { cn } from '@/lib/cn';
import type { Severity } from '../Badge';

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
  /** Nền đỏ mờ cho cảnh báo nổi bật nhất (53:471). */
  highlighted?: boolean;
  /** Ẩn viền dưới (item cuối danh sách). */
  last?: boolean;
  onClick?: (id: string) => void;
  className?: string;
};

const codeTone: Record<Severity, string> = {
  critical: 'text-danger-strong/75',
  high: 'text-warning-soft',
  medium: 'text-warning-soft',
  low: 'text-fg-secondary',
};

/** Một dòng cảnh báo trong danh sách "Cảnh báo ưu tiên" – cột phải Tổng quan (Figma 53:470). */
export function AlertItem({
  id,
  code,
  message,
  time,
  severity,
  highlighted,
  last,
  onClick,
  className,
}: AlertItemProps) {
  const Tag = onClick ? 'button' : 'div';
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
