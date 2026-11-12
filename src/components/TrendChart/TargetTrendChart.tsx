import { useId } from 'react';
import { useTokenColors, type ColorToken } from '@/lib/tokens';
import { ChartSurface, type PlotArea } from './ChartSurface';
import { ActiveDot, FadeGradient, HGrid, VGrid, XLabels } from './axes';
import { areaPath, linearScale, monotonePath, thinLabels } from './geometry';

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

const MARGIN = { top: 12, right: 12, bottom: 0, left: 0 };
const Y_AXIS_WIDTH = 44;
const FONT = 12;
/** Bề rộng ước lượng của nhãn (px) – chỉ dùng để bỏ bớt nhãn chồng nhau. */
const textWidth = (s: string) => s.length * FONT * 0.6;

/**
 * Đường + vùng gradient của MỘT chỉ số trên trục X cố định (phần chưa chạy để trống), trục Y hiện nhãn, vạch ngưỡng / mục
 * tiêu nét đứt (miền Y nới để luôn thấy vạch), chấm tròn ở điểm hiện tại. Màu qua token; không animation (số chạy theo
 * giây + giảm chuyển động).
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
  const gid = `target-${useId().replace(/:/g, '')}`;
  const yDomain: [number, number] = [Math.min(domain[0], ...lines.map((l) => l.value)), Math.max(domain[1], ...lines.map((l) => l.value))];
  const scales = (plot: PlotArea) => ({ x: linearScale(xDomain, [plot.x0, plot.x1]), y: linearScale(yDomain, [plot.y1, plot.y0]) });
  const stroke = c(color);
  const n = xTicks.length;

  return (
    <ChartSurface
      margin={MARGIN}
      yAxisWidth={Y_AXIS_WIDTH}
      xs={(plot) => data.map((d) => scales(plot).x(d.x))}
      cursorColor={c('line')}
      tooltip={(i) => {
        const d = data[i];
        return d ? { label: d.x, items: [{ key: 'value', name, value: d.value, color: stroke }] } : null;
      }}
      tooltipFormat={{ format, labelFormat: (x) => formatX(Number(x)) }}
    >
      {(plot, active) => {
        const { x, y } = scales(plot);
        const pts = data.map((d) => ({ x: x(d.x), y: y(d.value) }));
        const tickXs = xTicks.map(x);
        const texts = xTicks.map(formatX);
        // thinTicks: căn giữa mọi nhãn rồi bỏ bớt nhãn chồng (giữ đầu/cuối); thường: đầu căn trái, cuối căn phải.
        const keep = thinTicks ? thinLabels(tickXs, texts.map(textWidth), 12) : tickXs.map(() => true);
        const labels = xTicks.flatMap((t, k) => {
          if (!keep[k]) return [];
          const anchor = thinTicks ? 'middle' : k === 0 ? 'start' : k === n - 1 ? 'end' : 'middle';
          return [{ key: t, x: tickXs[k]!, text: texts[k]!, anchor } as const];
        });
        const hot = active !== null ? pts[active] : undefined;
        const end = pts[pts.length - 1];
        return (
          <>
            <defs>
              <FadeGradient id={gid} top={c(color, areaOpacity)} bottom={c(color, 0)} />
            </defs>
            {grid && (
              <>
                <HGrid plot={plot} ys={yTicks.map(y)} stroke={c('line', 0.5)} />
                <VGrid plot={plot} xs={tickXs} stroke={c('line', 0.5)} />
              </>
            )}
            <line x1={plot.x0} x2={plot.x1} y1={plot.y1} y2={plot.y1} stroke={c('line', 0.6)} />
            <line x1={plot.x0} x2={plot.x0} y1={plot.y0} y2={plot.y1} stroke={c('line', 0.6)} />
            <XLabels plot={plot} labels={labels} tickMargin={10} dy={10} fontSize={FONT} fill={c('text-muted')} />
            <g>
              {yTicks.map((t) => (
                <text key={t} x={plot.x0 - 8} y={y(t)} dy="0.355em" textAnchor="end" fontSize={FONT} fill={c('text-muted')}>
                  {formatY(t)}
                </text>
              ))}
            </g>
            {lines.map((l) => (
              <line key={l.id} x1={plot.x0} x2={plot.x1} y1={y(l.value)} y2={y(l.value)} stroke={c(l.color)} strokeDasharray="4 3" />
            ))}
            <g clipPath={`url(#${plot.clipId})`}>
              <path d={areaPath(pts, plot.y1)} fill={`url(#${gid})`} />
              <path d={monotonePath(pts)} fill="none" stroke={stroke} strokeWidth={3} />
            </g>
            {dots && pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={4} fill={c('surface')} stroke={stroke} strokeWidth={2} />)}
            {hot && <ActiveDot x={hot.x} y={hot.y} r={4} fill={stroke} stroke={c('surface')} />}
            {endDot && end && <circle cx={end.x} cy={end.y} r={7} fill={stroke} stroke={c(color, 0.35)} strokeWidth={4} />}
          </>
        );
      }}
    </ChartSurface>
  );
}
