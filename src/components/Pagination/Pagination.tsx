import { cn } from '@/lib/cn';

export type PaginationProps = {
  /** Trang hiện tại, bắt đầu từ 1. */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** Số trang hiển thị hai bên trang hiện tại. */
  siblingCount?: number;
  className?: string;
};

type Item = number | 'ellipsis-start' | 'ellipsis-end';

function range(from: number, to: number) {
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
}

/** Dải số trang dạng 1 … 4 5 6 … 20. */
export function getPageItems(page: number, pageCount: number, siblingCount = 1): Item[] {
  const total = siblingCount * 2 + 5; // first, last, current, 2 ellipsis
  if (pageCount <= total) return range(1, pageCount);
  const left = Math.max(page - siblingCount, 1);
  const right = Math.min(page + siblingCount, pageCount);
  const showLeft = left > 2;
  const showRight = right < pageCount - 1;
  if (!showLeft) return [...range(1, 3 + siblingCount * 2), 'ellipsis-end', pageCount];
  if (!showRight) return [1, 'ellipsis-start', ...range(pageCount - (2 + siblingCount * 2), pageCount)];
  return [1, 'ellipsis-start', ...range(left, right), 'ellipsis-end', pageCount];
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  // Figma 70:5536 là vector 7.4×12 chưa tải được (MCP giới hạn) → chevron tối giản theo currentColor.
  return (
    <svg aria-hidden="true" width="8" height="12" viewBox="0 0 8 12">
      <path
        d={dir === 'left' ? 'M6.5 1L1.5 6l5 5' : 'M1.5 1l5 5-5 5'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Phân trang – nút 32px, trang hiện tại nền info (Figma 70:5533, màu đọc từ ảnh chụp). */
export function Pagination({ page, pageCount, onPageChange, siblingCount = 1, className }: PaginationProps) {
  if (pageCount <= 1) return null;
  const items = getPageItems(page, pageCount, siblingCount);
  const btn =
    'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-base tabular-nums transition-colors';

  return (
    <nav aria-label="Phân trang" className={cn('flex items-center gap-3', className)}>
      <button
        type="button"
        aria-label="Trang trước"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="inline-flex h-8 items-center px-1 text-fg hover:text-info disabled:pointer-events-none disabled:opacity-30"
      >
        <Chevron dir="left" />
      </button>
      {items.map((it) =>
        typeof it === 'number' ? (
          <button
            key={it}
            type="button"
            aria-label={`Trang ${it}`}
            aria-current={it === page ? 'page' : undefined}
            onClick={() => onPageChange(it)}
            className={cn(btn, it === page ? 'bg-info text-fg-inverse' : 'text-fg-secondary hover:bg-surface-muted hover:text-fg')}
          >
            {it}
          </button>
        ) : (
          <span key={it} aria-hidden="true" className="px-2 text-fg-secondary">
            …
          </span>
        ),
      )}
      <button
        type="button"
        aria-label="Trang sau"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
        className="inline-flex h-8 items-center px-1 text-fg hover:text-info disabled:pointer-events-none disabled:opacity-30"
      >
        <Chevron dir="right" />
      </button>
    </nav>
  );
}
