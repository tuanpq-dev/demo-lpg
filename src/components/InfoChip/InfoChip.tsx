import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type InfoChipTone = 'default' | 'success' | 'warning' | 'danger' | 'muted';

export type InfoChipProps = {
  /** Icon trang trí 16px trước nhãn. */
  icon?: ReactNode;
  /** "Tên", "Khu vực", "PLC" – dấu ":" tự thêm. */
  label: string;
  value: ReactNode;
  /** Màu giá trị: success = "Online" (ảnh `op-device-header.png`). */
  tone?: InfoChipTone;
  className?: string;
};

const valueTone: Record<InfoChipTone, string> = {
  default: 'text-fg',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger-text',
  muted: 'text-fg-secondary',
};

/**
 * Ô thông tin "Nhãn: Giá trị" cao 36px như Button, dùng trong slot actions của PageHeader
 * (màn Vận hành – chi tiết thiết bị, ảnh `scratch/figma-ref/op-device-header.png`). Chỉ hiển thị, không bấm được.
 */
export function InfoChip({ icon, label, value, tone = 'default', className }: InfoChipProps) {
  return (
    <span
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-line/30 bg-surface-sunken px-3.5 text-base',
        className,
      )}
    >
      {icon && <span className="inline-flex text-fg-secondary">{icon}</span>}
      <span className="shrink-0 text-fg-secondary">{label}:</span>
      {/* Chip bị giới hạn bề rộng (vd `w-full` trên mobile) → giá trị dài cắt "…" thay vì tràn. */}
      <span className={cn('min-w-0 truncate font-semibold', valueTone[tone])} title={typeof value === 'string' ? value : undefined}>
        {value}
      </span>
    </span>
  );
}
