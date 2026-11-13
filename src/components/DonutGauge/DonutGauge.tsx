import { useState, type PointerEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useTokenColors } from '@/hooks/useTokenColors';
import type { ColorToken } from '@/lib/tokens';
import { ChartTooltip } from '../ChartCard';
import { annularSector, donutAngles } from '../TrendChart/geometry';
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
  /**
   * Thay chữ giữa vòng (mặc định = tổng + `totalLabel`), vd { value: '98%', caption: 'TỐI ƯU', tone: 'success' }
   * – "Tình trạng tài sản" trang chi tiết.
   */
  center?: { value: ReactNode; caption?: ReactNode; tone?: 'success' | 'warning' | 'danger' };
  /** Độ dày vòng (px); mặc định theo tỉ lệ Figma 8/180 kích thước. */
  ringWidth?: number;
  /** Tên cho trình đọc màn hình (mặc định "`totalLabel` `tổng`: từng phần"). */
  label?: string;
  className?: string;
};

const centerTone = { success: 'text-success', warning: 'text-warning', danger: 'text-danger-text' } as const;

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
export function DonutGauge({ segments, totalLabel = 'Tổng', total, size = 180, hideLegend, center, ringWidth, label, className }: DonutGaugeProps) {
  const c = useTokenColors();
  const sum = total ?? segments.reduce((s, x) => s + x.value, 0);
  // Tỉ lệ theo Figma: bán kính ngoài 65 / trong 57 trên khung 180.
  const outer = (size * 65) / 180;
  const inner = ringWidth !== undefined ? outer - ringWidth : (size * 57) / 180;
  const summary = segments.map((s) => `${s.label} ${s.value}`).join(', ');
  const mid = size / 2;
  // Mỗi phần khác 0 cách nhau 1.5° (như Figma); bắt đầu từ 12 giờ theo chiều kim đồng hồ.
  const angles = donutAngles(
    segments.map((s) => s.value),
    segments.length > 1 ? 1.5 : 0,
  );
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const tip = hover ? segments[hover.i] : undefined;

  return (
    <div className={cn('flex flex-col gap-0', className)}>
      <div className="relative" style={{ width: size, height: size }} role="img" aria-label={label ?? `${totalLabel} ${sum}: ${summary}`}>
        {/* role="img" đã mô tả đủ (aria-label); SVG bên trong ẩn khỏi trình đọc màn hình. */}
        <svg width={size} height={size} aria-hidden="true" className="block" onPointerLeave={() => setHover(null)}>
          <circle cx={mid} cy={mid} r={(outer + inner) / 2} fill="none" stroke={c('surface-muted')} strokeWidth={outer - inner} />
          {segments.map((s, i) => {
            const a = angles[i];
            if (!a) return null;
            const show = (e: PointerEvent<SVGPathElement>) => {
              const r = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
              setHover({ i, x: e.clientX - r.left, y: e.clientY - r.top });
            };
            return (
              <path
                key={s.id}
                d={annularSector(mid, mid, inner, outer, a.start, a.end)}
                fill={c(segColor[s.tone])}
                onPointerMove={show}
                onPointerDown={show}
              />
            );
          })}
        </svg>
        {tip && hover && (
          <div className="pointer-events-none absolute z-10" style={{ left: hover.x + 10, top: hover.y + 10 }}>
            <ChartTooltip active items={[{ key: tip.id, name: tip.label, value: tip.value, color: c(segColor[tip.tone]) }]} />
          </div>
        )}
        {center ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1">
            <span className="text-2xl font-bold leading-8 text-fg">{center.value}</span>
            {center.caption !== undefined && (
              <span className={cn('text-2xs font-semibold uppercase tracking-caps', centerTone[center.tone ?? 'success'])}>{center.caption}</span>
            )}
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3">
            <span className="text-3xl font-bold leading-6 text-success">{sum}</span>
            <span className="text-md leading-[15px] text-fg-muted">{totalLabel}</span>
          </div>
        )}
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
