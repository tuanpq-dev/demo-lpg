import { cn } from '@/lib/cn';
import { Card } from '../Card';
import { SignalLostIcon } from '../Icon';
import { StatusDot } from '../StatusDot';

export type AssetTone = 'success' | 'warning' | 'danger' | 'offline';

export type AssetRowData = {
  id: string;
  /** Mã thiết bị: "PR-101". */
  name: string;
  /** Nhãn trạng thái: "Bình thường", "Đang chạy", "Ổn định"… */
  statusLabel: string;
  tone: AssetTone;
  /** Mất tín hiệu → icon trước nhãn (nhãn thường là "Mất tín hiệu", tone offline). */
  signalLost?: boolean;
};

export type AssetRowProps = AssetRowData & {
  onClick?: (id: string) => void;
  className?: string;
};

const textTone: Record<AssetTone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger-strong',
  offline: 'text-fg-secondary',
};

/**
 * Một dòng thiết bị – nền surface-muted/20, viền line/30, cao 34px (Figma 53:500).
 * Màu lấy từ ảnh chụp Figma (node con 53:499 chưa có design context).
 */
export function AssetRow({ id, name, statusLabel, tone, signalLost, onClick, className }: AssetRowProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick ? () => onClick(id) : undefined}
      className={cn(
        'flex h-[34px] w-full items-center justify-between gap-3 rounded-md border border-line/30 bg-surface-muted/20 px-2 text-left',
        onClick && 'transition-colors hover:border-accent/40',
        className,
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <StatusDot status={tone} size="sm" />
        <span className="truncate text-sm text-fg">{name}</span>
      </span>
      <span className={cn('flex shrink-0 items-center gap-1 text-sm', textTone[tone])}>
        {signalLost && <SignalLostIcon size={14} />}
        {statusLabel}
      </span>
    </Tag>
  );
}

export type AssetWatchlistProps = {
  title?: string;
  assets: readonly AssetRowData[];
  onAssetClick?: (id: string) => void;
  action?: { label: string; onClick?: () => void };
  className?: string;
};

/** Card "Theo dõi thiết bị" – sidebar Tổng quan (Figma 53:495). */
export function AssetWatchlist({ title = 'Theo dõi thiết bị', assets, onAssetClick, action, className }: AssetWatchlistProps) {
  return (
    <Card title={title} headerVariant="plain" action={action} className={className}>
      <ul className="flex flex-col gap-2">
        {assets.map((a) => (
          <li key={a.id}>
            <AssetRow {...a} onClick={onAssetClick} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
