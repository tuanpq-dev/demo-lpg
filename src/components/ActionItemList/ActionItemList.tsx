import { cn } from '@/lib/cn';
import { AlertTriangleIcon } from '../Icon';

export type ActionItemTone = 'danger' | 'warning';

export type ActionItemData = {
  id: string;
  tone: ActionItemTone;
  /** Phần đậm đầu dòng: "BCVH-N-24062026", "Dữ liệu 14:00". */
  subject: string;
  /** Nội dung sau dấu hai chấm: "Thiếu mốc 18:00". */
  message: string;
};

export type ActionItemListProps = {
  items: readonly ActionItemData[];
  /** Nhãn nút hành động trong mỗi hộp. */
  actionLabel?: string;
  /** Bấm nút hành động. Bỏ trống → không có nút. */
  onAction?: (id: string) => void;
  emptyState?: string;
  className?: string;
};

const boxTone: Record<ActionItemTone, string> = {
  danger: 'border-danger/40 bg-danger/10',
  warning: 'border-warning/40 bg-warning/10',
};

/** Màu ICON (luật chữ đỏ chỉ áp cho chữ). */
const iconTone: Record<ActionItemTone, string> = {
  // eslint-disable-next-line no-restricted-syntax -- icon, không phải chữ
  danger: 'text-danger',
  warning: 'text-warning',
};

/**
 * Danh sách hộp việc cần làm (icon tam giác + "Mã: nội dung" + link hành động), tô theo mức.
 * "Cần xử lý hôm nay" – màn Báo cáo (ảnh thiết kế).
 */
export function ActionItemList({
  items,
  actionLabel = 'Xử lý ngay',
  onAction,
  emptyState = 'Không có việc cần xử lý.',
  className,
}: ActionItemListProps) {
  if (!items.length) return <p className={cn('text-sm text-fg-secondary', className)}>{emptyState}</p>;
  return (
    <ul className={cn('flex flex-col gap-3', className)}>
      {items.map((it) => (
        <li key={it.id} className={cn('flex gap-2.5 rounded-md border px-3.5 py-3', boxTone[it.tone])}>
          <AlertTriangleIcon size={18} className={cn('mt-px shrink-0', iconTone[it.tone])} />
          <div className="flex min-w-0 flex-col items-start gap-1.5">
            <p className="text-sm text-fg">
              <span className="sr-only">{it.tone === 'danger' ? 'Khẩn: ' : 'Lưu ý: '}</span>
              <strong className="font-bold">{it.subject}:</strong> {it.message}
            </p>
            {onAction && (
              <button type="button" onClick={() => onAction(it.id)} className="rounded-sm text-sm text-accent hover:underline">
                {actionLabel}
                <span className="sr-only"> – {it.subject}</span>
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
