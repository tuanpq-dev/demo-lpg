import { cn } from '@/lib/cn';

/** Khối giữ chỗ cho nội dung chưa làm (GĐ sau). Chiều cao lấy theo Figma để layout đúng tỉ lệ. */
export function Placeholder({ label, height, className }: { label: string; height: number; className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-xl border border-dashed border-line/50 bg-surface/40 text-sm text-fg-muted/65',
        className,
      )}
      style={{ minHeight: height }}
    >
      {label}
    </div>
  );
}
