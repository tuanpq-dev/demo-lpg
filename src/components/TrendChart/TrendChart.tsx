import { useId } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
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

function Common({
  c,
  ticks,
  xTicks,
  domain,
  unit,
  format,
}: {
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
    <Tooltip key="t" cursor={{ stroke: c('line'), strokeDasharray: '3 3' }} content={<ChartTooltip unit={unit} format={format} />} />,
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

// ============================================================================
// Hai chỉ số, hai thang đo – "Xu hướng vận hành (60 phút)" màn Vận hành (ảnh `op-device-left.png`)
// ============================================================================

export type DualTrendSeries = {
  /** Khoá trong mỗi điểm dữ liệu. */
  id: string;
  /** Tên trong tooltip / chú thích: "Nhiệt độ (°C)". */
  name: string;
  /** Hậu tố nhãn giá trị cuối đường: "°C", " bar". */
  suffix: string;
  color: ColorToken;
  /** Đường nét đứt (series thứ hai trong ảnh). */
  dashed?: boolean;
  /** Tô vùng dưới đường (gradient như AreaTrendChart). */
  area?: boolean;
  /** Thang riêng của series – hai series khác đơn vị nên không chung trục. */
  domain: [number, number];
  /** Đường ngưỡng: số ở mép trái, tên ở mép phải (màu `color`). */
  threshold?: { value: number; label: string; color: ColorToken };
  digits?: number;
};

/** Một điểm: `label` trục X + giá trị theo `id` của series (null = mất tín hiệu → đứt đường). */
export type DualTrendPoint = { label: string } & Record<string, number | string | null>;

export type DualTrendChartProps = {
  data: readonly DualTrendPoint[];
  series: readonly [DualTrendSeries, DualTrendSeries];
  xTicks: readonly string[];
};

/** Giá trị ở điểm CUỐI (hiện tại) – null/thiếu (mất tín hiệu) → không có nhãn, không lùi về số cũ. */
function lastValue(data: readonly DualTrendPoint[], id: string): { label: string; value: number } | undefined {
  const last = data[data.length - 1];
  const v = last?.[id];
  return typeof v === 'number' ? { label: last.label, value: v } : undefined;
}

/**
 * Hai đường trên cùng khung, MỖI series một trục Y ẩn (thang riêng) – ngưỡng vẽ bằng ReferenceLine (số trái, tên phải),
 * giá trị hiện tại là nhãn khung ở cuối đường. Màu qua token. Không animation (giảm chuyển động + số trực tiếp).
 */
export function DualTrendChart({ data, series, xTicks }: DualTrendChartProps) {
  const c = useTokenColors();
  const gid = useId().replace(/:/g, '');
  const fmt = (s: DualTrendSeries, v: number) => v.toFixed(s.digits ?? 1);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={[...data]} margin={{ top: 12, right: 64, bottom: 0, left: 36 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.id} id={`dual-${gid}-${s.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c(s.color, 0.18)} />
              <stop offset="100%" stopColor={c(s.color, 0)} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} stroke={c('line', 0.15)} />
        <XAxis
          dataKey="label"
          ticks={[...xTicks]}
          interval={0}
          axisLine={{ stroke: c('line', 0.4) }}
          tickLine={false}
          tick={{ fontSize: 10, fill: c('text-muted') }}
          tickMargin={8}
        />
        {series.map((s) => (
          <YAxis key={s.id} yAxisId={s.id} hide domain={s.domain} allowDataOverflow />
        ))}
        <Tooltip cursor={{ stroke: c('line'), strokeDasharray: '3 3' }} content={<ChartTooltip format={(v) => v.toFixed(1)} />} />
        {series.map((s) =>
          s.threshold ? (
            <ReferenceLine
              key={`t-${s.id}`}
              yAxisId={s.id}
              y={s.threshold.value}
              stroke={c(s.threshold.color, 0.6)}
              strokeDasharray="3 3"
              label={(p: { viewBox: { x: number; y: number; width: number } }) => (
                <g>
                  <text x={p.viewBox.x - 6} y={p.viewBox.y} dy={3} textAnchor="end" fontSize={10} fontWeight={700} fill={c(s.threshold!.color)}>
                    {fmt(s, s.threshold!.value)}
                  </text>
                  <text x={p.viewBox.x + p.viewBox.width} y={p.viewBox.y} dy={-6} textAnchor="end" fontSize={12} fill={c(s.threshold!.color)}>
                    {s.threshold!.label}
                  </text>
                </g>
              )}
            />
          ) : null,
        )}
        {series.map((s) =>
          s.area ? (
            <Area
              key={s.id}
              yAxisId={s.id}
              type="monotone"
              dataKey={s.id}
              name={s.name}
              stroke={c(s.color)}
              strokeWidth={2}
              fill={`url(#dual-${gid}-${s.id})`}
              connectNulls={false}
              isAnimationActive={false}
              activeDot={{ r: 3, fill: c(s.color), stroke: c('surface') }}
            />
          ) : (
            <Line
              key={s.id}
              yAxisId={s.id}
              type="monotone"
              dataKey={s.id}
              name={s.name}
              stroke={c(s.color)}
              strokeWidth={1.5}
              strokeDasharray={s.dashed ? '8 6' : undefined}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
              activeDot={{ r: 3, fill: c(s.color), stroke: c('surface') }}
            />
          ),
        )}
        {series.map((s) => {
          const last = lastValue(data, s.id);
          if (!last) return null;
          const text = `${fmt(s, last.value)}${s.suffix}`;
          const w = text.length * 7 + 14;
          return (
            <ReferenceDot
              key={`v-${s.id}`}
              yAxisId={s.id}
              x={last.label}
              y={last.value}
              r={0}
              ifOverflow="visible"
              label={(p: { viewBox: { x: number; y: number } }) => (
                <g>
                  <rect
                    x={p.viewBox.x - w + 8}
                    y={p.viewBox.y - 12}
                    width={w}
                    height={24}
                    rx={3}
                    fill={c('surface-sunken')}
                    stroke={c(s.dashed ? 'text-secondary' : s.color, 0.8)}
                  />
                  <text
                    x={p.viewBox.x + 1}
                    y={p.viewBox.y}
                    dy={4}
                    textAnchor="end"
                    fontSize={12}
                    fontWeight={700}
                    fill={c(s.dashed ? 'text-primary' : s.color)}
                  >
                    {text}
                  </text>
                </g>
              )}
            />
          );
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ============================================================================
// Một chỉ số tiến tới mục tiêu – "Diễn biến nồng độ gas mô phỏng" (ảnh `ai-sim-monitor/2.png`)
// ============================================================================

export type TargetTrendPoint = { x: number; value: number };

export type TargetTrendLine = { id: string; value: number; color: ColorToken };

export type TargetTrendChartProps = {
  /** Điểm đã có (x tăng dần) – điểm cuối = hiện tại, có chấm tròn. */
  data: readonly TargetTrendPoint[];
  /** Miền trục X cố định (vd 0 → thời lượng giây) – đường chỉ phủ phần đã chạy. */
  xDomain: [number, number];
  xTicks: readonly number[];
  formatX: (x: number) => string;
  domain: [number, number];
  yTicks: readonly number[];
  formatY: (v: number) => string;
  /** Vạch ngang nét đứt (ngưỡng, mục tiêu). Chú thích đặt ở header thẻ. */
  lines?: readonly TargetTrendLine[];
  color?: ColorToken;
  /** Tên series trong tooltip. */
  name: string;
  /** Định dạng giá trị trong tooltip ("28% LEL"). */
  format?: (v: number) => string;
  /** Lưới ngang + dọc (ảnh Kết quả mô phỏng). */
  grid?: boolean;
  /** Chấm rỗng ở mọi điểm dữ liệu (ảnh Kết quả: mỗi phút một chấm). */
  dots?: boolean;
  /** Chấm tròn đặc ở điểm cuối = hiện tại (mặc định bật – màn Theo dõi). */
  endDot?: boolean;
  /** Độ đậm gradient vùng dưới đường (0–1, mặc định 0.3). */
  areaOpacity?: number;
  /** Khung hẹp tự bỏ bớt nhãn trục X (giữ đầu/cuối) thay vì chồng chữ – nhiều mốc (ảnh Kết quả: 0m…10m). */
  thinTicks?: boolean;
};

/**
 * Đường + vùng gradient của MỘT chỉ số trên trục X cố định (phần chưa chạy để trống), trục Y hiện nhãn, vạch ngưỡng / mục
 * tiêu nét đứt, chấm tròn ở điểm hiện tại. Màu qua token; không animation (số chạy theo giây + giảm chuyển động).
 */
export function TargetTrendChart({
  data,
  xDomain,
  xTicks,
  formatX,
  domain,
  yTicks,
  formatY,
  lines = [],
  color = 'danger-strong',
  name,
  format,
  grid = false,
  dots = false,
  endDot = true,
  areaOpacity = 0.3,
  thinTicks = false,
}: TargetTrendChartProps) {
  const c = useTokenColors();
  const gid = useId().replace(/:/g, '');
  const last = data[data.length - 1];
  const n = xTicks.length;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={[...data]} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`target-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c(color, areaOpacity)} />
            <stop offset="100%" stopColor={c(color, 0)} />
          </linearGradient>
        </defs>
        {grid && <CartesianGrid stroke={c('line', 0.5)} />}
        <XAxis
          dataKey="x"
          type="number"
          domain={xDomain}
          ticks={[...xTicks]}
          interval={thinTicks ? 'preserveStartEnd' : 0}
          minTickGap={thinTicks ? 12 : undefined}
          axisLine={{ stroke: c('line', 0.6) }}
          tickLine={false}
          tickMargin={10}
          tick={(p: { x: number; y: number; payload: { value: number }; index: number }) => (
            // Nhãn đầu căn trái, nhãn cuối căn phải (ảnh: "00:00" sát trục, "10:00" sát mép phải).
            // thinTicks: căn giữa mọi nhãn để phép bỏ bớt nhãn của recharts (tính theo tâm) không làm chồng chữ.
            <text
              x={p.x}
              y={p.y}
              dy={10}
              fontSize={12}
              fill={c('text-muted')}
              textAnchor={thinTicks ? 'middle' : p.index === 0 ? 'start' : p.index === n - 1 ? 'end' : 'middle'}
            >
              {formatX(p.payload.value)}
            </text>
          )}
        />
        <YAxis
          domain={domain}
          ticks={[...yTicks]}
          allowDataOverflow
          axisLine={{ stroke: c('line', 0.6) }}
          tickLine={false}
          width={44}
          tick={{ fontSize: 12, fill: c('text-muted') }}
          tickFormatter={formatY}
        />
        <Tooltip
          cursor={{ stroke: c('line'), strokeDasharray: '3 3' }}
          content={<ChartTooltip format={format} labelFormat={(x) => formatX(Number(x))} />}
        />
        {lines.map((l) => (
          <ReferenceLine key={l.id} y={l.value} stroke={c(l.color)} strokeDasharray="4 3" ifOverflow="extendDomain" />
        ))}
        <Area
          type="monotone"
          dataKey="value"
          name={name}
          stroke={c(color)}
          strokeWidth={3}
          fill={`url(#target-${gid})`}
          isAnimationActive={false}
          dot={dots ? { r: 4, fill: c('surface'), stroke: c(color), strokeWidth: 2 } : false}
          activeDot={{ r: 4, fill: c(color), stroke: c('surface') }}
        />
        {endDot && last && (
          <ReferenceDot x={last.x} y={last.value} r={7} fill={c(color)} stroke={c(color, 0.35)} strokeWidth={4} ifOverflow="visible" />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
