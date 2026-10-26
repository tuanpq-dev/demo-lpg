import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type InfoGridTone = 'default' | 'danger' | 'warning' | 'link';

export type InfoGridItem = {
  id: string;
  label: string;
  value: ReactNode;
  /** danger: đỏ đậm (Mức ưu tiên "Nghiêm trọng", Hạn quá gấp) · warning: vàng (Trạng thái "Chờ tiếp nhận") · link: primary. */
  tone?: InfoGridTone;
  /** Bắt đầu hàng mới (ảnh: "Trạng thái" đứng riêng hàng cuối). */
  newRow?: boolean;
};

export type InfoGridProps = {
  items: readonly InfoGridItem[];
  className?: string;
};

const toneClass: Record<InfoGridTone, string> = {
  default: 'text-fg',
  danger: 'font-semibold text-danger-text',
  warning: 'text-warning',
  link: 'text-primary',
};

/**
 * Lưới nhãn/giá trị (`<dl>`) – "Thông tin chung" ảnh MT-00128: 4 cột từ `xl`, 2 cột từ `sm`, 1 cột dưới đó.
 * Nhãn 14px chữ phụ, giá trị 14px; khoảng cách hàng ~24px (ước lượng từ ảnh).
 */
export function InfoGrid({ items, className }: InfoGridProps) {
  return (
    <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-4', className)}>
      {items.map((it) => (
        <div key={it.id} className={cn('flex min-w-0 flex-col gap-1.5', it.newRow && 'sm:col-start-1')}>
          <dt className="text-base text-fg-secondary">{it.label}</dt>
          <dd className={cn('break-words text-base', toneClass[it.tone ?? 'default'])}>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
