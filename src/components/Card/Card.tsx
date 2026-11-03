import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button } from '../Button';

export type CardTone = 'default' | 'strong' | 'danger' | 'success' | 'success-vivid' | 'primary' | 'warning' | 'accent';

export type CardAction = {
  label: string;
  onClick?: () => void;
  href?: string;
};

export type CardProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  /** Tiêu đề card (semibold 16/24). */
  title?: ReactNode;
  /** Icon trước tiêu đề, khung 18px (53:461). */
  icon?: ReactNode;
  /** Link bên phải header, ví dụ { label: 'Xem tất cả' } (53:468). */
  action?: CardAction;
  /** Phần tử tuỳ ý bên phải header (sau `action`), ví dụ nút icon toàn màn hình. */
  headerEnd?: ReactNode;
  /**
   * - bar:   header có nền surface-muted/10 + viền dưới (53:459 "Cảnh báo ưu tiên")
   * - plain: tiêu đề nằm trong padding của card (53:496 "Theo dõi thiết bị")
   * - divided: như plain + đường kẻ dưới tiêu đề (ảnh chi tiết yêu cầu bảo trì MT-00128)
   */
  headerVariant?: 'bar' | 'plain' | 'divided';
  /**
   * Màu viền: strong (line-card – KPI Bảo trì 70:4508), danger (KPI "Cảnh báo" 53:213), success (53:201), accent.
   * primary / warning / success-vivid: viền đậm theo tone – KPI có viền màn Báo cáo (ảnh thiết kế).
   */
  tone?: CardTone;
  /** xl = 12px (Tổng quan), lg = 8px (Cảnh báo/Bảo trì). */
  radius?: 'lg' | 'xl';
  /** none = nội dung tự lo padding (list, table); md = 17px. */
  padding?: 'none' | 'md';
  /** Ghi đè class của vùng thân (ví dụ padding dọc khác 17px). */
  bodyClassName?: string;
  /** Cỡ tiêu đề: md = 16px (mặc định) · lg = 18px (màn cấu hình kịch bản mô phỏng). */
  titleSize?: 'md' | 'lg';
  children?: ReactNode;
};

const toneClass: Record<CardTone, string> = {
  default: 'border-line/30',
  strong: 'border-line-card',
  danger: 'border-danger-strong/50',
  success: 'border-success-strong/30',
  'success-vivid': 'border-success/70',
  primary: 'border-primary/80',
  warning: 'border-warning/80',
  accent: 'border-accent/30',
};

export function Card({
  title,
  icon,
  action,
  headerEnd,
  headerVariant = 'bar',
  tone = 'default',
  radius = 'xl',
  padding = 'md',
  bodyClassName,
  titleSize = 'md',
  className,
  children,
  ...rest
}: CardProps) {
  const hasHeader = title !== undefined || action !== undefined || headerEnd !== undefined;

  const actionNode = action ? (
    action.href ? (
      <a href={action.href} className="text-sm text-accent hover:underline">
        {action.label}
      </a>
    ) : (
      <Button variant="link" onClick={action.onClick}>
        {action.label}
      </Button>
    )
  ) : null;
  const endNode =
    actionNode || headerEnd ? (
      <div className="flex min-w-0 max-w-full shrink-0 items-center gap-2">
        {actionNode}
        {headerEnd}
      </div>
    ) : null;

  const heading = (
    <div className="flex min-w-0 items-center gap-2">
      {icon}
      {title !== undefined && <h3 className={cn('truncate font-semibold text-fg', titleSize === 'lg' ? 'text-lg' : 'text-md')}>{title}</h3>}
    </div>
  );

  return (
    <section
      className={cn(
        'flex flex-col overflow-clip border bg-surface shadow-card',
        radius === 'xl' ? 'rounded-xl' : 'rounded-lg',
        toneClass[tone],
        className,
      )}
      {...rest}
    >
      {hasHeader && headerVariant === 'bar' && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line/30 bg-surface-muted/10 px-4 pb-[13px] pt-3">
          {heading}
          {endNode}
        </header>
      )}
      <div className={cn('flex flex-1 flex-col', padding === 'md' && 'p-4', bodyClassName)}>
        {hasHeader && headerVariant !== 'bar' && (
          <header
            className={cn(
              'flex flex-wrap items-center justify-between gap-3',
              headerVariant === 'divided' ? 'mb-3 border-b border-line/30 pb-2' : 'mb-4',
            )}
          >
            {heading}
            {endNode}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}
