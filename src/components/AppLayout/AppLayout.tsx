import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type AppLayoutVariant = 'full' | 'sidebar';

export type AppLayoutProps = {
  /** Thường là <AppHeader />; được ghim (sticky) trên cùng. */
  header: ReactNode;
  /**
   * - full:    nội dung full-width, padding ngang 32px (Cảnh báo 70:2846, Bảo trì 70:4001)
   * - sidebar: 2 cột main + sidebar 326px (Tổng quan 53:164). Dưới 1280px sidebar xuống dưới main.
   */
  variant?: AppLayoutVariant;
  /** <PageHeader /> – nằm trên vùng nội dung, full-width ở cả 2 variant. */
  pageHeader?: ReactNode;
  /** Chỉ dùng khi variant="sidebar". */
  sidebar?: ReactNode;
  children?: ReactNode;
  className?: string;
};

/**
 * Khung trang theo Figma (frame 1565px):
 * header 60px · cách 24px · page header · cách 24px · nội dung; padding ngang 32px, đáy 32px.
 */
export function AppLayout({ header, variant = 'full', pageHeader, sidebar, children, className }: AppLayoutProps) {
  return (
    <div className={cn('flex min-h-screen flex-col bg-bg-app', className)}>
      <div className="sticky top-0 z-30">{header}</div>
      <main className="flex flex-1 flex-col gap-6 px-page pb-8 pt-6">
        {pageHeader}
        {variant === 'sidebar' ? (
          <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_326px]">
            <div className="flex min-w-0 flex-col gap-6">{children}</div>
            <aside className="flex flex-col gap-6">{sidebar}</aside>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-6">{children}</div>
        )}
      </main>
    </div>
  );
}
