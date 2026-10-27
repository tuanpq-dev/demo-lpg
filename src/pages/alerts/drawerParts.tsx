import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { plantTimeOfDay } from '@/lib/plantTime';

/** Mục có tiêu đề 18px trong thân drawer cảnh báo (dùng chung khung + panel). */
export function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn('flex flex-col gap-3', className)}>
      <h3 id={id} className="text-lg font-semibold text-fg-secondary">
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * Mục thu gọn (`<details>`) – loại cảnh báo cấu hình `collapsed` (gas: Tiến trình, Ghi chú; ảnh không có các mục này).
 * Tiêu đề là `<h3>` trong `<summary>` (hợp lệ HTML, trình đọc vẫn nhảy theo heading).
 */
export function Collapsible({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen || undefined} className="group rounded-md border border-line/30">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-md px-3 py-2.5 hover:bg-surface-muted/40 [&::-webkit-details-marker]:hidden">
        <h3 className="text-md font-semibold text-fg-secondary">{title}</h3>
        <span aria-hidden="true" className="text-fg-secondary transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="flex flex-col gap-3 px-3 pb-3 pt-1">{children}</div>
    </details>
  );
}

export function Pair({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 gap-1">
      <dt className="shrink-0 text-fg-secondary">{label}:</dt>
      <dd className="min-w-0 text-fg">{value}</dd>
    </div>
  );
}

/** "HH:mm:ss" giờ nhà máy của một mốc ISO. */
export const fmtAt = (iso: string) => plantTimeOfDay(new Date(iso));
