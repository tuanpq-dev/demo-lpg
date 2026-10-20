import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Card, type CardAction } from '../Card';

export type ChartCardProps = {
  title: ReactNode;
  action?: CardAction;
  /** Chiều cao vùng nội dung (px). Figma: 240.75 trong thẻ cao 315 (53:320). */
  height?: number;
  /** Mô tả cho trình đọc màn hình (tóm tắt dữ liệu của chart). */
  description?: string;
  children: ReactNode;
  className?: string;
};

/** Khung chart: Card bo 12px + tiêu đề plain + vùng nội dung cố định chiều cao (Figma 53:319). */
export function ChartCard({ title, action, height = 240, description, children, className }: ChartCardProps) {
  return (
    <Card title={title} action={action} headerVariant="plain" className={cn('h-full', className)}>
      <div role="figure" aria-label={description} className="relative w-full" style={{ height }}>
        {children}
      </div>
    </Card>
  );
}
