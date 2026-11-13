import { useId } from 'react';
import { useTokenColors } from '@/hooks/useTokenColors';
import type { ColorToken } from '@/lib/tokens';
import { ChartSurface, type PlotArea } from './ChartSurface';
import { ActiveDot, FadeGradient, HGrid, XLabels, niceTicks } from './axes';
import { areaPath, linearScale, monotonePath, pointPositions, segments, type Pt } from './geometry';

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

const MARGIN = { top: 12, right: 64, bottom: 0, left: 36 };

const num = (p: DualTrendPoint | undefined, id: string) => {
  const v = p?.[id];
  return typeof v === 'number' ? v : null;
};

const fmt = (s: DualTrendSeries, v: number) => v.toFixed(s.digits ?? 1);

/** Toạ độ từng điểm của một series theo thang riêng (null = mất tín hiệu). */
function seriesPoints(data: readonly DualTrendPoint[], s: DualTrendSeries, xs: readonly number[], plot: PlotArea): (Pt | null)[] {
  const y = linearScale(s.domain, [plot.y1, plot.y0]);
  return data.map((d, i) => {
    const v = num(d, s.id);
    return v === null ? null : { x: xs[i]!, y: y(v) };
  });
}

/** Ngưỡng của series: vạch nét đứt, số ở mép trái, tên ở mép phải. */
function Threshold({ s, plot, color }: { s: DualTrendSeries; plot: PlotArea; color: (t: ColorToken, a?: number) => string }) {
  const t = s.threshold;
  if (!t) return null;
  const y = linearScale(s.domain, [plot.y1, plot.y0])(t.value);
  return (
    <g>
      <line x1={plot.x0} x2={plot.x1} y1={y} y2={y} stroke={color(t.color, 0.6)} strokeDasharray="3 3" />
      <text x={plot.x0 - 6} y={y} dy={3} textAnchor="end" fontSize={10} fontWeight={700} fill={color(t.color)}>
        {fmt(s, t.value)}
      </text>
      <text x={plot.x1} y={y} dy={-6} textAnchor="end" fontSize={12} fill={color(t.color)}>
        {t.label}
      </text>
    </g>
  );
}

/**
 * Hai đường trên cùng khung, MỖI series một trục Y ẩn (thang riêng) – ngưỡng nét đứt (số trái, tên phải), giá trị hiện tại
 * là nhãn khung ở cuối đường. Màu qua token. Không animation (giảm chuyển động + số trực tiếp).
 */
export function DualTrendChart({ data, series, xTicks }: DualTrendChartProps) {
  const c = useTokenColors();
  const gid = `dual-${useId().replace(/:/g, '')}`;
  const xsOf = (plot: PlotArea) => pointPositions(data.length, plot.x0, plot.x1);
  const last = data[data.length - 1];

  return (
    <ChartSurface
      margin={MARGIN}
      xs={xsOf}
      cursorColor={c('line')}
      tooltip={(i) => {
        const d = data[i];
        const items = series.flatMap((s) => {
          const v = num(d, s.id);
          return v === null ? [] : [{ key: s.id, name: s.name, value: v, color: c(s.color) }];
        });
        return d && items.length ? { label: d.label, items } : null;
      }}
      tooltipFormat={{ format: (v) => v.toFixed(1) }}
    >
      {(plot, active) => {
        const xs = xsOf(plot);
        const pts = series.map((s) => seriesPoints(data, s, xs, plot));
        const gridY = linearScale(series[0].domain, [plot.y1, plot.y0]);
        const labels = xTicks.flatMap((t) => {
          const i = data.findIndex((d) => d.label === t);
          return i < 0 ? [] : [{ key: t, x: xs[i]!, text: t }];
        });
        return (
          <>
            <defs>
              {series.map((s) => (
                <FadeGradient key={s.id} id={`${gid}-${s.id}`} top={c(s.color, 0.18)} bottom={c(s.color, 0)} />
              ))}
            </defs>
            <HGrid plot={plot} ys={niceTicks(series[0].domain).map(gridY)} stroke={c('line', 0.15)} />
            <line x1={plot.x0} x2={plot.x1} y1={plot.y1} y2={plot.y1} stroke={c('line', 0.4)} />
            <XLabels plot={plot} labels={labels} tickMargin={8} dy={7} fontSize={10} fill={c('text-muted')} />
            {series.map((s) => (
              <Threshold key={s.id} s={s} plot={plot} color={c} />
            ))}
            <g clipPath={`url(#${plot.clipId})`}>
              {series.map((s, k) =>
                segments(pts[k]!).map((seg, j) => (
                  <g key={`${s.id}-${j}`}>
                    {s.area && <path d={areaPath(seg, plot.y1)} fill={`url(#${gid}-${s.id})`} />}
                    <path
                      d={monotonePath(seg)}
                      fill="none"
                      stroke={c(s.color)}
                      strokeWidth={s.area ? 2 : 1.5}
                      strokeDasharray={s.dashed ? '8 6' : undefined}
                    />
                  </g>
                )),
              )}
            </g>
            {active !== null &&
              series.map((s, k) => {
                const p = pts[k]![active];
                return p ? <ActiveDot key={s.id} x={p.x} y={p.y} r={3} fill={c(s.color)} stroke={c('surface')} /> : null;
              })}
            {/* Giá trị hiện tại: nhãn khung ở cuối đường; điểm cuối mất tín hiệu → không có nhãn (không lùi về số cũ). */}
            {series.map((s, k) => {
              const v = num(last, s.id);
              const p = pts[k]![data.length - 1];
              if (v === null || !p) return null;
              const text = `${fmt(s, v)}${s.suffix}`;
              const w = text.length * 7 + 14;
              return (
                <g key={`v-${s.id}`}>
                  <rect
                    x={p.x - w + 8}
                    y={p.y - 12}
                    width={w}
                    height={24}
                    rx={3}
                    fill={c('surface-sunken')}
                    stroke={c(s.dashed ? 'text-secondary' : s.color, 0.8)}
                  />
                  <text x={p.x + 1} y={p.y} dy={4} textAnchor="end" fontSize={12} fontWeight={700} fill={c(s.dashed ? 'text-primary' : s.color)}>
                    {text}
                  </text>
                </g>
              );
            })}
          </>
        );
      }}
    </ChartSurface>
  );
}
