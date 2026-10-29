import { cn } from '@/lib/cn';

export type ScheduleItem = {
  id: string;
  /** Ngày "yyyy-mm-dd" – cho <time dateTime>. */
  date: string;
  /** Thứ viết tắt trong ô ngày: "T6", "CN". */
  weekday: string;
  /** Số ngày trong ô: "26". */
  day: string;
  title: string;
  /** Dòng phụ: "Hạn chót: 17:00". */
  meta?: string;
  /** Mô tả đầy đủ cho trình đọc màn hình (thay cho ô ngày rút gọn), vd "Thứ Sáu 26/06/2026". */
  dateLabel?: string;
};

export type ScheduleListProps = {
  items: readonly ScheduleItem[];
  /** Bấm một mục (render thành button). */
  onItemClick?: (id: string) => void;
  /** Nội dung khi rỗng. */
  emptyState?: string;
  className?: string;
};

/**
 * Danh sách lịch có ô ngày (thứ + số ngày) bên trái, tiêu đề + dòng phụ bên phải.
 * "Lịch báo cáo sắp tới" – màn Báo cáo (ảnh thiết kế). Khác `EventTimeline variant="schedule"` (chấm + đường dọc).
 */
export function ScheduleList({ items, onItemClick, emptyState = 'Không có lịch sắp tới.', className }: ScheduleListProps) {
  if (!items.length) return <p className={cn('text-sm text-fg-secondary', className)}>{emptyState}</p>;
  return (
    <ul className={cn('flex flex-col gap-3', className)}>
      {items.map((it) => {
        const Tag = onItemClick ? 'button' : 'div';
        return (
          <li key={it.id}>
            <Tag
              {...(onItemClick ? { type: 'button' as const, onClick: () => onItemClick(it.id) } : {})}
              className={cn('flex w-full items-center gap-3 text-left', onItemClick && 'rounded-md hover:bg-surface-muted/20')}
            >
              <time
                dateTime={it.date}
                className="flex size-[52px] shrink-0 flex-col items-center justify-center rounded-md bg-surface-chip leading-tight"
              >
                <span aria-hidden={it.dateLabel ? true : undefined} className="text-sm text-fg-secondary">
                  {it.weekday}
                </span>
                <span aria-hidden={it.dateLabel ? true : undefined} className="text-base font-bold text-fg">
                  {it.day}
                </span>
                {it.dateLabel && <span className="sr-only">{it.dateLabel}</span>}
              </time>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-semibold text-fg">{it.title}</span>
                {it.meta && <span className="text-sm text-fg-secondary">{it.meta}</span>}
              </span>
            </Tag>
          </li>
        );
      })}
    </ul>
  );
}
