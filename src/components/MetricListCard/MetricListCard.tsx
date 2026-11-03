import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Badge, type CountTone } from '../Badge';
import { Button } from '../Button';
import { Card, type CardAction, type CardProps } from '../Card';
import { ProgressBar, type ProgressTone } from '../ProgressBar';

export type MetricTone = 'default' | 'success' | 'warning' | 'danger' | 'primary';

export type MetricRow = {
  id: string;
  label: string;
  value: ReactNode;
  /** Màu số (danger → chữ `danger-text`). */
  tone?: MetricTone;
  /** Vạch kẻ phía trên dòng – tách nhóm ("Bảo trì tiếp theo" ở "Trạng thái nhanh", ảnh `op-device-right.png`). */
  separated?: boolean;
};

export type MetricListCardProps = {
  title: string;
  /** Chip đếm cạnh tiêu đề ("Chờ xác nhận 6"). */
  count?: { value: number; tone?: CountTone; label?: string };
  /** Thanh tiến độ đầu thẻ ("Hoàn thành 19/24 ngày", 79%). */
  progress?: { label: string; value: number; max: number; valueText: string; tone?: ProgressTone };
  rows: readonly MetricRow[];
  /** Link cuối thẻ, căn phải ("Xem tất cả"). */
  action?: CardAction;
  /** Kiểu header của Card (mặc định như Card). `divided` = tiêu đề + vạch dưới (màn Vận hành). */
  headerVariant?: CardProps['headerVariant'];
  /** Kẻ ngang giữa MỌI dòng, dòng cao ~33px, giá trị dài xuống dòng căn phải – "Tóm tắt cấu hình" (màn cấu hình kịch bản). */
  divided?: boolean;
  titleSize?: CardProps['titleSize'];
  className?: string;
};

const valueTone: Record<MetricTone, string> = {
  default: 'text-fg',
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger-text',
};

/**
 * Thẻ danh sách chỉ số nhãn – số (tuỳ chọn thanh tiến độ ở đầu, chip đếm ở tiêu đề, link cuối).
 * Màn Báo cáo (ảnh thiết kế): "Chờ xác nhận" (chip + 3 dòng vai trò + "Xem tất cả"), "Tiến độ tháng 06" (thanh + 3 dòng).
 */
export function MetricListCard({ title, count, progress, rows, action, headerVariant, divided, titleSize, className }: MetricListCardProps) {
  const pct = progress && progress.max > 0 ? Math.round((progress.value / progress.max) * 100) : 0;
  return (
    <Card
      title={title}
      headerVariant={headerVariant}
      titleSize={titleSize}
      radius="lg"
      headerEnd={
        count ? (
          <Badge variant="count" value={count.value} tone={count.tone} size="md">
            {count.value}
            {count.label && <span className="sr-only"> {count.label}</span>}
          </Badge>
        ) : undefined
      }
      className={cn('h-full', className)}
      bodyClassName="gap-4"
    >
      {progress && (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3 text-base">
            <span className="text-fg-secondary">{progress.label}</span>
            <span className="font-semibold tabular-nums text-fg">{progress.valueText}</span>
          </div>
          <ProgressBar value={progress.value} max={progress.max} tone={progress.tone ?? 'primary'} track="solid" label={progress.label} />
          <span className="self-end text-xs tabular-nums text-fg-secondary">{pct}%</span>
        </div>
      )}
      <dl className={cn('flex flex-col', divided ? '-mt-2' : 'gap-2.5')}>
        {rows.map((r, i) => (
          <div
            key={r.id}
            className={cn(
              'flex items-baseline justify-between gap-3 text-base',
              divided ? cn('py-2', i > 0 && 'border-t border-line/20') : r.separated && 'mt-1.5 border-t border-line/30 pt-4',
            )}
          >
            <dt className={cn('text-fg-secondary', divided ? 'shrink-0' : 'min-w-0')}>{r.label}</dt>
            <dd className={cn('font-semibold tabular-nums', divided ? 'min-w-0 text-right' : 'shrink-0', valueTone[r.tone ?? 'default'])}>{r.value}</dd>
          </div>
        ))}
      </dl>
      {action &&
        (action.href ? (
          <a href={action.href} className="self-end rounded-sm text-base text-accent hover:underline">
            {action.label}
          </a>
        ) : (
          <Button variant="link" size="lg" onClick={action.onClick} className="self-end">
            {action.label}
          </Button>
        ))}
    </Card>
  );
}
