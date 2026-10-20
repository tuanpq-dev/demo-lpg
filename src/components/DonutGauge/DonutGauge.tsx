import { Cell, Pie, PieChart, Tooltip } from 'recharts';
import { cn } from '@/lib/cn';
import { useTokenColors, type ColorToken } from '@/lib/tokens';
import { ChartTooltip } from '../ChartCard';
import { StatusDot, type DotStatus } from '../StatusDot';

export type DonutSegmentTone = 'success' | 'warning' | 'danger' | 'offline';

export type DonutSegment = {
  id: string;
  label: string;
  value: number;
  tone: DonutSegmentTone;
};

export type DonutGaugeProps = {
  segments: readonly DonutSegment[];
  /** Nhãn dưới số tổng. */
  totalLabel?: string;
  /** Mặc định = tổng các segment. */
  total?: number;
  /** Đường kính (px). Figma: 180.8 (53:404). */
  size?: number;
  /** Ẩn legend (khi đặt legend ở chỗ khác). */
  hideLegend?: boolean;
  className?: string;
};

const segColor: Record<DonutSegmentTone, ColorToken> = {
  success: 'success',
  warning: 'warning',
  danger: 'danger-strong',
  offline: 'surface-muted',
};

const segDot: Record<DonutSegmentTone, DotStatus> = {
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  offline: 'offline',
};

/**
 * Donut nhiều segment + số tổng ở giữa + legend (Figma 53:397 "Trạng thái thiết bị").
 * Track nền surface-muted dày 8px; segment bắt đầu từ 12 giờ, chạy theo chiều kim đồng hồ.
 */
export function DonutGauge({ segments, totalLabel = 'Tổng', total, size = 180, hideLegend, className }: DonutGaugeProps) {
  const c = useTokenColors();
  const sum = total ?? segments.reduce((s, x) => s + x.value, 0);
  // Tỉ lệ theo Figma: bán kính ngoài 65 / trong 57 trên khung 180.
  const outer = (size * 65) / 180;
  const inner = (size * 57) / 180;
  const summary = segments.map((s) => `${s.label} ${s.value}`).join(', ');

  return (
    <div className={cn('flex flex-col gap-0', className)}>
      <div
        className="relative"
        style={{ width: size, height: size }}
        role="img"
        aria-label={`${totalLabel} ${sum}: ${summary}`}
      >
        <PieChart width={size} height={size}>
          {/* Track */}
          <Pie
            data={[{ v: 1 }]}
            dataKey="v"
            innerRadius={inner}
            outerRadius={outer}
            stroke="none"
            fill={c('surface-muted')}
            isAnimationActive={false}
            startAngle={90}
            endAngle={-270}
          />
          <Pie
            data={segments.map((s) => ({ ...s }))}
            dataKey="value"
            nameKey="label"
            innerRadius={inner}
            outerRadius={outer}
            startAngle={90}
            endAngle={-270}
            paddingAngle={segments.length > 1 ? 1.5 : 0}
            stroke="none"
            isAnimationActive={false}
          >
            {segments.map((s) => (
              <Cell key={s.id} fill={c(segColor[s.tone])} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3">
          <span className="text-3xl font-bold leading-6 text-success">{sum}</span>
          <span className="text-md leading-[15px] text-fg-muted">{totalLabel}</span>
        </div>
      </div>

      {!hideLegend && (
        <ul className="flex flex-col gap-2">
          {segments.map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-md leading-4">
              <StatusDot status={segDot[s.tone]} shape="square" />
              <span className="min-w-[56px] text-fg-muted">{s.label}</span>
              <span className="tabular-nums text-fg">{s.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
