import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, type BreadcrumbItem } from '@/components';
import { StatusLayout } from './StatusLayout';

export type NotFoundPageProps = {
  /** Tiêu đề trang (h1). */
  title?: string;
  /** Câu giải thích; mặc định nêu đường dẫn đang mở. */
  message?: ReactNode;
  breadcrumb?: readonly BreadcrumbItem[];
  /** Nút thêm cạnh "Về Tổng quan". */
  actions?: ReactNode;
  withHeader?: boolean;
};

/**
 * 404 "Không tìm thấy": route lạ (`*`), mã không tồn tại (`/map/XYZ`, `/maintenance/XYZ`…) hoặc API trả NOT_FOUND.
 * Hiện rõ thay vì âm thầm chuyển về Tổng quan – người dùng biết link sai.
 */
export default function NotFoundPage({ title = 'Không tìm thấy trang', message, breadcrumb, actions, withHeader }: NotFoundPageProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return (
    <StatusLayout
      code="404"
      title={title}
      heading="Đường dẫn không tồn tại"
      breadcrumb={breadcrumb}
      withHeader={withHeader}
      message={
        message ?? (
          <>
            Không có trang nào ở <code className="font-mono text-fg">{pathname}</code>. Có thể link đã cũ hoặc gõ sai.
          </>
        )
      }
      actions={
        <>
          <Button variant="primary" onClick={() => void navigate('/overview')}>
            Về Tổng quan
          </Button>
          {actions}
        </>
      }
    />
  );
}
