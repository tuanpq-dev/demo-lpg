import { useId } from 'react';
import { useTokenColors } from '@/hooks/useTokenColors';
import type { ColorToken } from '@/lib/tokens';
import { ChartSurface, type ChartMargin, type PlotArea } from './ChartSurface';
import { ActiveDot, FadeGradient, HGrid, XLabels } from './axes';
import { areaPath, linearScale, monotonePath, pointPositions } from './geometry';

export type TrendPoint = {
  /** Nhãn trục X, ví dụ "00:00". */
  label: string;
  value: number;
};

type BaseProps = {
  data: readonly TrendPoint[];
  /** Nhãn hiện trên trục X; mặc định 00:00 / 12:00 / 24:00 như Figma. */
  xTicks?: readonly string[];
  /**
   * Miền trục Y. Mặc định: dữ liệu chiếm khoảng 1/3 chiều cao ở giữa, như Figma 53:379
   * (nới mỗi phía bằng `padRatio` × biên độ).
   */
  domain?: [number, number];
  /** Hệ số nới miền Y khi không truyền `domain` (mặc định 1). */
  padRatio?: number;
  /** Màu đường (token). */
  color?: ColorToken;
  unit?: string;
  format?: (v: number) => string;
};

const DEFAULT_TICKS = ['00:00', '12:00', '24:00'] as const;

function axisOf(data: readonly TrendPoint[], domain?: [number, number], padRatio = 1) {
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min || Math.abs(max) * 0.05 || 1) * padRatio;
  const [lo, hi] = domain ?? [min - pad, max + pad];
  // 3 đường lưới: đỉnh / giữa / đáy (Figma 53:327–53:329).
  return { domain: [lo, hi] as [number, number], ticks: [lo, (lo + hi) / 2, hi] };
}

type SingleTrendProps = Omit<BaseProps, 'color'> & {
  color: ColorToken;
  margin: ChartMargin;
  strokeWidth: number;
  dotR: number;
  /** Có vùng gradient dưới đường. */
  area: boolean;
};

/**
 * Một series trên trục X phân loại (nhãn giờ): lưới ngang nét đứt 3 mốc, nhãn đầu căn trái / cuối căn phải (không bị cắt ở
 * mép – Figma 53:330), tooltip theo điểm gần con trỏ. Không animation.
 */
function SingleTrend({ data, xTicks = DEFAULT_TICKS, domain, padRatio, color, unit, format, margin, strokeWidth, dotR, area }: SingleTrendProps) {
  const c = useTokenColors();
  const gid = `trend-${useId().replace(/:/g, '')}`;
  const axis = axisOf(data, domain, padRatio);
  const geo = (plot: PlotArea) => {
    const xs = pointPositions(data.length, plot.x0, plot.x1);
    const y = linearScale(axis.domain, [plot.y1, plot.y0]);
    return { xs, y, pts: data.map((d, i) => ({ x: xs[i]!, y: y(d.value) })) };
  };
  const stroke = c(color);
  return (
    <ChartSurface
      margin={margin}
      xs={(plot) => geo(plot).xs}
      cursorColor={c('line')}
      tooltip={(i) => {
        const d = data[i];
        return d ? { label: d.label, items: [{ key: 'value', value: d.value, color: stroke }] } : null;
      }}
      tooltipFormat={{ unit, format }}
    >
      {(plot, active) => {
        const { xs, y, pts } = geo(plot);
        const labels = xTicks.flatMap((t, k) => {
          const i = data.findIndex((d) => d.label === t);
          const anchor = k === 0 ? 'start' : k === xTicks.length - 1 ? 'end' : 'middle';
          return i < 0 ? [] : [{ key: t, x: xs[i]!, text: t, anchor } as const];
        });
        const hot = active !== null ? pts[active] : undefined;
        return (
          <>
            {area && (
              <defs>
                <FadeGradient id={gid} top={c(color, 0.1)} bottom={c(color, 0)} />
              </defs>
            )}
            <HGrid plot={plot} ys={axis.ticks.map(y)} stroke={c('line', 0.2)} dash="3 3" />
            <XLabels plot={plot} labels={labels} tickMargin={6} dy={10} fontSize={10} fill={c('text-muted')} />
            {area && <path d={areaPath(pts, plot.y1)} fill={`url(#${gid})`} />}
            <path d={monotonePath(pts)} fill="none" stroke={stroke} strokeWidth={strokeWidth} />
            {hot && <ActiveDot x={hot.x} y={hot.y} r={dotR} fill={stroke} stroke={c('surface')} />}
          </>
        );
      }}
    </ChartSurface>
  );
}

export type AreaTrendChartProps = BaseProps;

/** Area gradient – "Xu hướng tồn kho (24h)" (Figma 53:324): viền accent 1px, nền accent 10% → 0%. */
export function AreaTrendChart(props: AreaTrendChartProps) {
  return <SingleTrend {...props} color={props.color ?? 'accent'} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} strokeWidth={1} dotR={3} area />;
}

export type LineTrendChartProps = BaseProps & { strokeWidth?: number };

/** Đường mượt – "Áp suất hệ thống (24h)" (Figma 53:379): stroke neutral dày 3px. */
export function LineTrendChart({ strokeWidth = 3, ...props }: LineTrendChartProps) {
  return (
    <SingleTrend
      {...props}
      color={props.color ?? 'neutral'}
      margin={{ top: 8, right: 2, bottom: 0, left: 2 }}
      strokeWidth={strokeWidth}
      dotR={4}
      area={false}
    />
  );
}
