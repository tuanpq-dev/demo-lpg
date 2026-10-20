import { useId } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTokenColors, type ColorToken } from '@/lib/tokens';
import { ChartTooltip } from '../ChartCard';

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

function useAxis(data: readonly TrendPoint[], domain?: [number, number], padRatio = 1) {
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min || Math.abs(max) * 0.05 || 1) * padRatio;
  const [lo, hi] = domain ?? [min - pad, max + pad];
  // 3 đường lưới: đỉnh / giữa / đáy (Figma 53:327–53:329).
  return { domain: [lo, hi] as [number, number], ticks: [lo, (lo + hi) / 2, hi] };
}

function Common({ c, ticks, xTicks, domain, unit, format }: {
  c: ReturnType<typeof useTokenColors>;
  ticks: number[];
  xTicks: readonly string[];
  domain: [number, number];
  unit?: string;
  format?: (v: number) => string;
}) {
  return [
    <CartesianGrid key="g" vertical={false} stroke={c('line', 0.2)} strokeDasharray="3 3" />,
    <XAxis
      key="x"
      dataKey="label"
      ticks={[...xTicks]}
      interval={0}
      axisLine={false}
      tickLine={false}
      tick={(p: { x: number; y: number; payload: { value: string }; index: number }) => (
        // Nhãn đầu căn trái, nhãn cuối căn phải để không bị cắt ở mép (Figma 53:330).
        <text
          x={p.x}
          y={p.y}
          dy={10}
          fontSize={10}
          fill={c('text-muted')}
          textAnchor={p.index === 0 ? 'start' : p.index === xTicks.length - 1 ? 'end' : 'middle'}
        >
          {p.payload.value}
        </text>
      )}
      tickMargin={6}
    />,
    <YAxis key="y" hide domain={domain} ticks={ticks} />,
    <Tooltip
      key="t"
      cursor={{ stroke: c('line'), strokeDasharray: '3 3' }}
      content={<ChartTooltip unit={unit} format={format} />}
    />,
  ];
}

export type AreaTrendChartProps = BaseProps;

/** Area gradient – "Xu hướng tồn kho (24h)" (Figma 53:324): viền accent 1px, nền accent 10% → 0%. */
export function AreaTrendChart({ data, xTicks = DEFAULT_TICKS, domain, padRatio, color = 'accent', unit, format }: AreaTrendChartProps) {
  const c = useTokenColors();
  const gid = useId().replace(/:/g, '');
  const axis = useAxis(data, domain, padRatio);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={[...data]} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`area-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c(color, 0.1)} />
            <stop offset="100%" stopColor={c(color, 0)} />
          </linearGradient>
        </defs>
        {Common({ c, ...axis, xTicks, unit, format })}
        <Area
          type="monotone"
          dataKey="value"
          name="value"
          stroke={c(color)}
          strokeWidth={1}
          fill={`url(#area-${gid})`}
          activeDot={{ r: 3, fill: c(color), stroke: c('surface') }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export type LineTrendChartProps = BaseProps & { strokeWidth?: number };

/** Đường mượt – "Áp suất hệ thống (24h)" (Figma 53:379): stroke neutral dày 3px. */
export function LineTrendChart({
  data,
  xTicks = DEFAULT_TICKS,
  domain,
  padRatio,
  color = 'neutral',
  unit,
  format,
  strokeWidth = 3,
}: LineTrendChartProps) {
  const c = useTokenColors();
  const axis = useAxis(data, domain, padRatio);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={[...data]} margin={{ top: 8, right: 2, bottom: 0, left: 2 }}>
        {Common({ c, ...axis, xTicks, unit, format })}
        <Line
          type="monotone"
          dataKey="value"
          name="value"
          stroke={c(color)}
          strokeWidth={strokeWidth}
          dot={false}
          activeDot={{ r: 4, fill: c(color), stroke: c('surface') }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
