import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { StatusDot, type DotStatus } from '../StatusDot';

export type StatusPillTone = 'success' | 'warning' | 'danger' | 'neutral';

export type StatusPillProps = {
  /**
   * - success: "Hệ thống bình thường" – nền success/10, viền success/20, chữ + chấm live (53:125)
   * - warning / danger: cùng cấu trúc, đổi màu (chưa có trong Figma).
   * - neutral: mất tín hiệu / chưa có số liệu (xám).
   */
  tone?: StatusPillTone;
  /** md = cao 36px như Button (PageHeader) · sm = badge nhỏ trong header card ("Bình thường" – trang chi tiết tài sản). */
  size?: 'sm' | 'md';
  children: ReactNode;
  /** Chấm nhấp nháy khi trạng thái realtime. */
  pulse?: boolean;
  className?: string;
};

const toneClass: Record<StatusPillTone, string> = {
  success: 'border-success/20 bg-success/10 text-live',
  warning: 'border-warning/20 bg-warning/10 text-warning',
  danger: 'border-danger-strong/30 bg-danger-strong/10 text-danger-text',
  neutral: 'border-line/30 bg-surface-muted/20 text-fg-secondary',
};

const dotStatus: Record<StatusPillTone, DotStatus> = {
  success: 'live',
  warning: 'warning',
  danger: 'danger',
  neutral: 'offline',
};

/** Chỉ báo trạng thái hệ thống, cao 36px như Button – dùng trong slot actions của PageHeader. */
export function StatusPill({ tone = 'success', size = 'md', children, pulse, className }: StatusPillProps) {
  return (
    <span
      role="status"
      className={cn(
        'inline-flex shrink-0 items-center whitespace-nowrap border font-semibold leading-4 backdrop-blur-sm',
        size === 'md' ? 'h-9 gap-2 rounded-lg px-4 text-base tracking-label' : 'h-6 gap-1.5 rounded-xl px-2.5 text-xs',
        toneClass[tone],
        className,
      )}
    >
      <StatusDot status={dotStatus[tone]} pulse={pulse} />
      {children}
    </span>
  );
}
