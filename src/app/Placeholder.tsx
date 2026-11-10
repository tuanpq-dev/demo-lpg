import type { ReactNode } from 'react';
import { ApiError } from '@/api/client';
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

/** Câu thay cho `error.message` theo mã lỗi API (403, mất mạng); undefined = dùng message gốc. */
function errorText(error: Error): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  if (error.code === 'FORBIDDEN') return 'Tài khoản của bạn không có quyền xem nội dung này. Liên hệ quản trị viên nếu cần quyền.';
  if (error.code === 'NETWORK_ERROR') return 'Không kết nối được máy chủ. Kiểm tra mạng rồi bấm "Thử lại".';
  return undefined;
}

/**
 * Trạng thái lỗi chung của trang / khối dữ liệu: Card danger + thông điệp lỗi + "Thử lại" (+ nút phụ).
 * API trả FORBIDDEN → không hiện "Thử lại" (thử lại vẫn bị từ chối).
 */
export function PageError({ title, error, onRetry, actions, preformatted }: PageErrorProps) {
  const forbidden = error instanceof ApiError && error.code === 'FORBIDDEN';
  const text = errorText(error) ?? error.message;
  const retry = forbidden ? null : (
    <Button onClick={onRetry} className={actions ? undefined : 'self-start'}>
      Thử lại
    </Button>
  );
  return (
    <Card title={title} headerVariant="plain" tone="danger">
      {preformatted && !errorText(error) ? (
        <pre className="mb-4 whitespace-pre-wrap font-mono text-sm text-fg-secondary">{text}</pre>
      ) : (
        <p className="mb-4 text-base text-fg-secondary">{text}</p>
      )}
      {actions ? (
        <div className="flex gap-2">
          {retry}
          {actions}
        </div>
      ) : (
        retry
      )}
    </Card>
  );
}
