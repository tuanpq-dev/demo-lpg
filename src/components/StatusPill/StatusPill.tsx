import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { StatusDot, type DotStatus } from '../StatusDot';

export type StatusPillTone = 'success' | 'warning' | 'danger';

export type StatusPillProps = {
  /**
   * - success: "Hệ thống bình thường" – nền success/10, viền success/20, chữ + chấm live (53:125)
   * - warning / danger: cùng cấu trúc, đổi màu (chưa có trong Figma).
   */
  tone?: StatusPillTone;
  children: ReactNode;
  /** Chấm nhấp nháy khi trạng thái realtime. */
  pulse?: boolean;
  className?: string;
};

const toneClass: Record<StatusPillTone, string> = {
  success: 'border-success/20 bg-success/10 text-live',
  warning: 'border-warning/20 bg-warning/10 text-warning',
  danger: 'border-danger-strong/30 bg-danger-strong/10 text-danger-strong',
};

const dotStatus: Record<StatusPillTone, DotStatus> = {
  success: 'live',
  warning: 'warning',
  danger: 'danger',
};

/** Chỉ báo trạng thái hệ thống, cao 36px như Button – dùng trong slot actions của PageHeader. */
export function StatusPill({ tone = 'success', children, pulse, className }: StatusPillProps) {
  return (
    <span
      role="status"
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-4 text-base font-semibold leading-4 tracking-label backdrop-blur-[4px]',
        toneClass[tone],
        className,
      )}
    >
      <StatusDot status={dotStatus[tone]} pulse={pulse} />
      {children}
    </span>
  );
}
