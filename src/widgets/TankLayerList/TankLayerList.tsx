import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type TankLayerTone = 'info' | 'neutral' | 'warning' | 'success' | 'danger' | 'muted';

export type TankLayerItem = {
  id: string;
  label: string;
  /** Giá trị đã định dạng: "76.2% | 10.4 m³", "Bình thường"… */
  value: ReactNode;
  tone?: TankLayerTone;
};

export type TankLayerListProps = {
  /** Tiêu đề nhỏ phía trên danh sách. */
  title?: string;
  items: readonly TankLayerItem[];
  className?: string;
};

const toneClass: Record<TankLayerTone, string> = {
  info: 'text-info',
  neutral: 'text-fg',
  warning: 'text-warning',
  success: 'text-success',
  danger: 'text-danger-text',
  muted: 'text-fg-secondary',
};

/**
 * Danh sách "Cấu trúc tồn chứa" cạnh hình cắt bồn: nhãn trái, giá trị phải (màu theo lớp / trạng thái), kẻ dòng.
 * Theo ảnh "Bồn LPG V-101" (chưa có node Figma). Dùng `<dl>` để trình đọc màn hình đọc theo cặp.
 */
export function TankLayerList({ title = 'Cấu trúc tồn chứa', items, className }: TankLayerListProps) {
  return (
    <div className={cn('flex flex-col', className)}>
      {title && <p className="pb-2 text-xs text-fg-muted">{title}</p>}
      <dl className="flex flex-col">
        {items.map((it, i) => (
          <div key={it.id} className={cn('flex items-center justify-between gap-4 py-3', i < items.length - 1 && 'border-b border-line/30')}>
            <dt className="text-sm text-fg-muted">{it.label}</dt>
            <dd className={cn('text-right text-sm tabular-nums', toneClass[it.tone ?? 'neutral'])}>{it.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
