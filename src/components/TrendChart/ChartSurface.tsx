import { useId, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode, type RefObject } from 'react';
import { useElementSize } from '@/hooks/useElementSize';
import { ChartTooltip, type ChartTooltipProps } from '../ChartCard';
import { nearestIndex } from './geometry';

/** Vùng vẽ (px, trong toạ độ SVG): x0–x1 ngang, y0 (đỉnh) – y1 (đáy). */
export type PlotArea = { width: number; height: number; x0: number; x1: number; y0: number; y1: number; clipId: string };

export type ChartMargin = { top: number; right: number; bottom: number; left: number };

/** Trục X ở đáy chiếm 30 px (như mặc định recharts) – chart giữ nguyên bố cục cũ. */
export const X_AXIS_HEIGHT = 30;

export type ChartSurfaceProps = {
  margin: ChartMargin;
  /** Bề rộng trục Y hiện nhãn bên trái (0 = trục ẩn). */
  yAxisWidth?: number;
  /** Toạ độ X của từng điểm (null = điểm không có số → bỏ qua khi tìm điểm gần con trỏ). */
  xs: (plot: PlotArea) => readonly (number | null)[];
  /** Nội dung SVG; `active` = chỉ số điểm đang trỏ (vẽ chấm nổi bật). */
  children: (plot: PlotArea, active: number | null) => ReactNode;
  /** Dữ liệu tooltip của điểm `i` (null = không hiện). */
  tooltip: (i: number) => Pick<ChartTooltipProps, 'items' | 'label'> | null;
  tooltipFormat?: Pick<ChartTooltipProps, 'unit' | 'format' | 'labelFormat'>;
  /** Màu đường con trỏ dọc. */
  cursorColor: string;
};

/**
 * Khung chung của chart SVG: đo kích thước khung cha (100% × 100%), tính vùng vẽ, tìm điểm gần con trỏ (chuột / chạm),
 * vẽ đường con trỏ dọc + tooltip HTML. SVG `aria-hidden` – khung cha (ChartCard / `role="img"`) mang mô tả cho trình đọc
 * màn hình như trước.
 */
export function ChartSurface({ margin, yAxisWidth = 0, xs, children, tooltip, tooltipFormat, cursorColor }: ChartSurfaceProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(ref);
  const clipId = `clip-${useId().replace(/:/g, '')}`;
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);

  const plot: PlotArea = {
    width,
    height,
    x0: margin.left + yAxisWidth,
    x1: Math.max(margin.left + yAxisWidth, width - margin.right),
    y0: margin.top,
    y1: Math.max(margin.top, height - margin.bottom - X_AXIS_HEIGHT),
    clipId,
  };
  const ready = width > 0 && height > 0;
  const pointXs = ready ? xs(plot) : [];

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const inside = x >= plot.x0 - 2 && x <= plot.x1 + 2 && y >= plot.y0 && y <= plot.y1;
    const i = inside ? nearestIndex(pointXs, x) : null;
    setHover(i === null ? null : { i, x, y });
  };

  const active = hover?.i ?? null;
  const tip = active !== null ? tooltip(active) : null;
  const cursorX = active !== null ? pointXs[active] : null;
  const tipRef = useRef<HTMLDivElement>(null);
  const tipPos = useTooltipPosition(tipRef, hover, width, height, active);

  return (
    <div ref={ref} className="relative size-full">
      {ready && (
        <svg
          width={width}
          height={height}
          className="block touch-pan-y overflow-visible"
          aria-hidden="true"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={plot.x0} y={plot.y0} width={plot.x1 - plot.x0} height={plot.y1 - plot.y0} />
            </clipPath>
          </defs>
          {cursorX != null && <line x1={cursorX} x2={cursorX} y1={plot.y0} y2={plot.y1} stroke={cursorColor} strokeDasharray="3 3" />}
          {children(plot, active)}
        </svg>
      )}
      {tip && hover && (
        <div ref={tipRef} className="pointer-events-none absolute left-0 top-0 z-10" style={tipPos}>
          <ChartTooltip active {...tip} {...tooltipFormat} />
        </div>
      )}
    </div>
  );
}

/**
 * Vị trí tooltip như recharts: lệch 10 px sang phải / xuống dưới con trỏ; tràn mép phải / dưới của khung thì lật sang trái
 * / lên trên. Đo kích thước tooltip thật sau render (trước khi vẽ – không nháy).
 */
function useTooltipPosition(
  ref: RefObject<HTMLDivElement>,
  at: { x: number; y: number } | null,
  width: number,
  height: number,
  /** Điểm đang trỏ – đổi điểm thì nội dung (và kích thước) tooltip đổi → đo lại. */
  contentKey: number | null,
) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
  }, [ref, contentKey]);
  if (!at) return undefined;
  const x = at.x + 10 + size.w > width ? Math.max(0, at.x - 10 - size.w) : at.x + 10;
  const y = at.y + 10 + size.h > height ? Math.max(0, at.y - 10 - size.h) : at.y + 10;
  // Lần đo đầu (chưa biết kích thước) ẩn tooltip để không nháy ở vị trí sai.
  return { transform: `translate(${x}px, ${y}px)`, visibility: size.w ? ('visible' as const) : ('hidden' as const) };
}
