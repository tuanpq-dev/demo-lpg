import { cn } from '@/lib/cn';
import { Card } from '../Card';
import { Icon } from '../Icon';

export type HealthStat = {
  label: string;
  /** Số thiết bị đang hoạt động. */
  ok: number;
  total: number;
};

export type SystemHealthCardProps = {
  title?: string;
  /** Phần trăm độ tin cậy, ví dụ 98.7. */
  value: number;
  /** Dòng mô tả dưới số: "Hoạt động tối ưu". */
  caption?: string;
  /** 3 cột thống kê: Cảm biến / Van / Bơm. */
  stats: readonly HealthStat[];
  className?: string;
};

/** "Độ tin cậy hệ thống" – sidebar Tổng quan (Figma 53:429). */
export function SystemHealthCard({ title = 'Độ tin cậy hệ thống', value, caption, stats, className }: SystemHealthCardProps) {
  return (
    <Card title={title} icon={<Icon name="shield" box={12} />} headerVariant="plain" className={className} bodyClassName="py-5">
      <div className="flex flex-col">
        <span className="text-3xl font-bold leading-[48px] text-success">{value}%</span>
        {caption && <span className="pt-1 text-sm text-fg-muted">{caption}</span>}
      </div>

      <dl className="mt-6 flex border-t border-line/30 pt-[17px]">
        {stats.map((s, i) => (
          <div key={s.label} className={cn('flex flex-1 flex-col items-center', i > 0 && i < stats.length - 1 && 'border-x border-line/30')}>
            <dt className="pb-1 text-sm text-fg-muted">{s.label}</dt>
            <dd className="text-md text-success">
              {s.ok}/{s.total}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
