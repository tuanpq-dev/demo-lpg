import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Card, PageHeader, type BreadcrumbItem } from '@/components';
import { Page } from '@/app/Page';

export type NotFoundPageProps = {
  /** Tiêu đề trang (h1). */
  title?: string;
  /** Câu giải thích; mặc định nêu đường dẫn đang mở. */
  message?: ReactNode;
  breadcrumb?: readonly BreadcrumbItem[];
  /** Nút thêm cạnh "Về Tổng quan". */
  actions?: ReactNode;
};

/**
 * "Không tìm thấy": route lạ (`*`) và mã tài sản không có (`/map/XYZ`). Thay cho việc âm thầm chuyển về Tổng quan
 * – người dùng biết link sai thay vì tưởng link đúng mà ra trang khác.
 */
export default function NotFoundPage({ title = 'Không tìm thấy trang', message, breadcrumb, actions }: NotFoundPageProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return (
    <Page pageHeader={<PageHeader breadcrumb={breadcrumb} title={title} />}>
      <Card title="Đường dẫn không tồn tại" headerVariant="plain" className="max-w-[640px]">
        <p className="mb-4 text-base text-fg-secondary">
          {message ?? (
            <>
              Không có trang nào ở <code className="font-mono text-fg">{pathname}</code>. Có thể link đã cũ hoặc gõ sai.
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => navigate('/overview')}>
            Về Tổng quan
          </Button>
          {actions}
        </div>
      </Card>
    </Page>
  );
}
