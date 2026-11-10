import type { ReactNode } from 'react';
import { Card, PageHeader, type BreadcrumbItem } from '@/components';
import { Page } from '@/app/Page';

export type StatusLayoutProps = {
  /** Mã trạng thái hiển thị nhỏ phía trên (403, 404, 500). */
  code: string;
  /** Tiêu đề trang (h1). */
  title: string;
  /** Tiêu đề thẻ nội dung. */
  heading: string;
  message: ReactNode;
  actions: ReactNode;
  breadcrumb?: readonly BreadcrumbItem[];
  /**
   * true (mặc định): trong khung app (header + menu). false: trang trần, dùng khi lỗi nằm ở tầng gốc (header có thể
   * chính là chỗ lỗi nên không render lại).
   */
  withHeader?: boolean;
};

/** Khung chung của trang lỗi 403 / 404 / 500. */
export function StatusLayout({ code, title, heading, message, actions, breadcrumb, withHeader = true }: StatusLayoutProps) {
  const card = (
    <Card title={heading} headerVariant="plain" className="max-w-[640px]">
      <p className="mb-1 font-mono text-sm text-fg-muted">Mã lỗi {code}</p>
      <div className="mb-4 text-base text-fg-secondary">{message}</div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </Card>
  );
  if (!withHeader) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg-app px-page">
        <div className="w-full max-w-[640px]">
          <h1 className="mb-4 text-xl font-semibold text-fg">{title}</h1>
          {card}
        </div>
      </main>
    );
  }
  return <Page pageHeader={<PageHeader breadcrumb={breadcrumb} title={title} />}>{card}</Page>;
}
