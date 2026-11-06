import type { ReactNode } from 'react';
import { Button, Card } from '@/components';
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

export type PageErrorProps = {
  /** "Không tải được …" – tiêu đề Card. */
  title: string;
  error: Error;
  onRetry: () => void;
  /** Nút phụ cạnh "Thử lại" (vd "Về Tổng quan"). */
  actions?: ReactNode;
  /** Thông điệp nhiều dòng (danh sách lỗi validate cảnh 3D) → `<pre>` chữ mono, giữ xuống dòng. */
  preformatted?: boolean;
};

/** Trạng thái lỗi chung của trang / khối dữ liệu: Card danger + thông điệp lỗi + "Thử lại" (+ nút phụ). */
export function PageError({ title, error, onRetry, actions, preformatted }: PageErrorProps) {
  return (
    <Card title={title} headerVariant="plain" tone="danger">
      {preformatted ? (
        <pre className="mb-4 whitespace-pre-wrap font-mono text-sm text-fg-secondary">{error.message}</pre>
      ) : (
        <p className="mb-4 text-base text-fg-secondary">{error.message}</p>
      )}
      {actions ? (
        <div className="flex gap-2">
          <Button onClick={onRetry}>Thử lại</Button>
          {actions}
        </div>
      ) : (
        <Button onClick={onRetry} className="self-start">
          Thử lại
        </Button>
      )}
    </Card>
  );
}
