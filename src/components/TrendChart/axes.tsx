import type { ReactNode } from 'react';
import type { PlotArea } from './ChartSurface';

/** Khoảng từ đáy vùng vẽ tới đầu nhãn trục X: vạch 6 px (ẩn) + `tickMargin` – cùng cách tính với recharts. */
const TICK_SIZE = 6;

export type XLabel = { key: string | number; x: number; text: string; anchor?: 'start' | 'middle' | 'end' };

/** Nhãn trục X ở đáy; `dy` = độ lệch đường chân chữ so với đầu nhãn. */
export function XLabels({
  plot,
  labels,
  tickMargin,
  dy,
  fontSize,
  fill,
}: {
  plot: PlotArea;
  labels: readonly XLabel[];
  tickMargin: number;
  dy: number;
  fontSize: number;
  fill: string;
}) {
  const y = plot.y1 + TICK_SIZE + tickMargin;
  return (
    <g>
      {labels.map((l) => (
        <text key={l.key} x={l.x} y={y} dy={dy} fontSize={fontSize} fill={fill} textAnchor={l.anchor ?? 'middle'}>
          {l.text}
        </text>
      ))}
    </g>
  );
}

/** Đường lưới ngang tại các toạ độ Y. */
export function HGrid({ plot, ys, stroke, dash }: { plot: PlotArea; ys: readonly number[]; stroke: string; dash?: string }) {
  return (
    <g>
      {ys.map((y, i) => (
        <line key={i} x1={plot.x0} x2={plot.x1} y1={y} y2={y} stroke={stroke} strokeDasharray={dash} />
      ))}
    </g>
  );
}

/** Đường lưới dọc tại các toạ độ X. */
export function VGrid({ plot, xs, stroke }: { plot: PlotArea; xs: readonly number[]; stroke: string }) {
  return (
    <g>
      {xs.map((x, i) => (
        <line key={i} x1={x} x2={x} y1={plot.y0} y2={plot.y1} stroke={stroke} />
      ))}
    </g>
  );
}

/** Gradient dọc một màu: `top` ở đỉnh → trong suốt ở đáy (vùng dưới đường). */
export function FadeGradient({ id, top, bottom }: { id: string; top: string; bottom: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={top} />
      <stop offset="100%" stopColor={bottom} />
    </linearGradient>
  );
}

/** Chấm nổi bật tại điểm đang trỏ (viền màu nền để tách khỏi đường). */
export function ActiveDot({ x, y, r, fill, stroke }: { x: number; y: number; r: number; fill: string; stroke: string }): ReactNode {
  return <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={2} />;
}

/** Mốc "đẹp" (bước 1/2/2.5/5 × 10ⁿ) nằm trong miền – lưới ngang khi trục Y không truyền mốc riêng. */
export function niceTicks([lo, hi]: readonly [number, number], count = 5): number[] {
  const span = hi - lo;
  if (!(span > 0)) return [lo];
  const raw = span / (count - 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Math.round(v / step) * step);
  return out;
}
