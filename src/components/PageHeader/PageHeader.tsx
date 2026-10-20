import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

export type BreadcrumbItem = {
  label: string;
  /** Đường dẫn router; mục cuối (trang hiện tại) không cần. */
  to?: string;
};

export type PageHeaderProps = {
  /** "Cảnh báo / Trung tâm cảnh báo" – mục cuối in đậm (70:2850). */
  breadcrumb?: readonly BreadcrumbItem[];
  /** Tiêu đề 32px bold (70:2856). */
  title?: ReactNode;
  /** Mô tả dưới tiêu đề (70:2898). */
  description?: ReactNode;
  /**
   * Slot bên phải, căn giữa theo khối tiêu đề (70:2882, 70:4037):
   * StatusPill, Button "Hôm nay", "Xuất báo cáo", "Dữ liệu trực tiếp"…
   * Nếu không có breadcrumb/title (màn Tổng quan – 53:124) thì actions dồn phải thành một hàng.
   */
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ breadcrumb, title, description, actions, className }: PageHeaderProps) {
  const hasHeading = !!breadcrumb?.length || title !== undefined;

  if (!hasHeading) {
    return actions ? (
      <div className={cn('flex flex-wrap items-center justify-end gap-3', className)}>{actions}</div>
    ) : null;
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-2">
          {!!breadcrumb?.length && (
            <nav aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center text-base text-fg-secondary">
                {breadcrumb.map((item, i) => {
                  const last = i === breadcrumb.length - 1;
                  return (
                    <Fragment key={`${item.label}-${i}`}>
                      <li>
                        {last ? (
                          <span aria-current="page" className="font-bold">
                            {item.label}
                          </span>
                        ) : item.to ? (
                          <Link to={item.to} className="rounded-sm hover:text-fg">
                            {item.label}
                          </Link>
                        ) : (
                          item.label
                        )}
                      </li>
                      {!last && (
                        <li aria-hidden="true" className="px-1">
                          /
                        </li>
                      )}
                    </Fragment>
                  );
                })}
              </ol>
            </nav>
          )}
          {title !== undefined && <h1 className="text-3xl font-bold leading-8 text-fg">{title}</h1>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
      {description && <p className="text-base text-fg-secondary">{description}</p>}
    </div>
  );
}
