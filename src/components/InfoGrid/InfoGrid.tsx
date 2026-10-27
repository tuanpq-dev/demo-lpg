import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type InfoGridTone = 'default' | 'danger' | 'warning' | 'link';

export type InfoGridItem = {
  id: string;
  label: string;
  value: ReactNode;
  /** danger: đỏ đậm (Mức ưu tiên "Nghiêm trọng", Hạn quá gấp) · warning: vàng (Trạng thái "Chờ tiếp nhận") · link: primary. */
  tone?: InfoGridTone;
  /** Tooltip giải thích nhãn (vd cách tính "T/G vượt ngưỡng 20% LEL"). Nhãn hiển thị phải tự đủ nghĩa – tooltip chỉ bổ sung. */
  hint?: string;
  /** Bắt đầu hàng mới (ảnh: "Trạng thái" đứng riêng hàng cuối). */
  newRow?: boolean;
};

export type InfoGridProps = {
  items: readonly InfoGridItem[];
  /**
   * stats = hàng chỉ số nhỏ (4 chỉ số dưới thang đo – drawer cảnh báo gas): nhãn 12px, giá trị 16px; 2 cột, từ `sm` 4 cột
   * (không theo `xl` của trang vì nằm trong drawer 440px). pairs = luôn 2 cột, cùng cỡ chữ stats ("Thông tin báo cháy").
   */
  variant?: 'default' | 'stats' | 'pairs';
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
export function InfoGrid({ items, variant = 'default', className }: InfoGridProps) {
  if (variant === 'stats') {
    return (
      <dl className={cn('grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-4', className)}>
        {items.map((it) => (
          <div key={it.id} className="flex min-w-0 flex-col gap-1">
            <dt className="text-sm text-fg-secondary" title={it.hint}>
              {it.label}
            </dt>
            <dd className={cn('break-words text-md', toneClass[it.tone ?? 'default'])}>{it.value}</dd>
          </div>
        ))}
      </dl>
    );
  }
  if (variant === 'pairs') {
    // Luôn 2 cột (khung hẹp như drawer 440px – "Thông tin báo cháy"): nhãn 12px, giá trị 16px.
    return (
      <dl className={cn('grid grid-cols-2 gap-x-6 gap-y-4', className)}>
        {items.map((it) => (
          <div key={it.id} className="flex min-w-0 flex-col gap-1">
            <dt className="text-sm text-fg-secondary" title={it.hint}>
              {it.label}
            </dt>
            <dd className={cn('break-words text-md', toneClass[it.tone ?? 'default'])}>{it.value}</dd>
          </div>
        ))}
      </dl>
    );
  }
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
