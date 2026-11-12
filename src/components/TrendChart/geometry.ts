/**
 * Hình học thuần của chart SVG tự vẽ (thay recharts – 118 KB gzip): thang tuyến tính, đường cong monotone (cùng thuật toán
 * `d3.curveMonotoneX` mà recharts dùng cho `type="monotone"` → hình dạng đường giữ nguyên), vùng dưới đường, cung donut.
 */

export type Pt = { x: number; y: number };

/** Thang tuyến tính [d0, d1] → [r0, r1] (miền rỗng → giữa khoảng). */
export function linearScale([d0, d1]: readonly [number, number], [r0, r1]: readonly [number, number]) {
  const span = d1 - d0;
  return (v: number) => (span === 0 ? (r0 + r1) / 2 : r0 + ((v - d0) / span) * (r1 - r0));
}

/** Toạ độ X của trục phân loại kiểu "point": điểm đầu ở mép trái, điểm cuối ở mép phải vùng vẽ. */
export function pointPositions(n: number, x0: number, x1: number): number[] {
  if (n <= 1) return n === 1 ? [(x0 + x1) / 2] : [];
  return Array.from({ length: n }, (_, i) => x0 + ((x1 - x0) * i) / (n - 1));
}

const sign = (x: number) => (x < 0 ? -1 : 1);

/** Hệ số góc tại điểm giữa (Steffen 1990, như d3 `slope3`). */
function slope3(a: Pt, b: Pt, c: Pt): number {
  const h0 = b.x - a.x;
  const h1 = c.x - b.x;
  const s0 = (b.y - a.y) / (h0 || (h1 < 0 ? -0 : 0));
  const s1 = (c.y - b.y) / (h1 || (h0 < 0 ? -0 : 0));
  const p = (s0 * h1 + s1 * h0) / (h0 + h1);
  return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
}

/** Hệ số góc ở điểm mút từ hệ số góc kề (d3 `slope2`). */
function slope2(a: Pt, b: Pt, t: number): number {
  const h = b.x - a.x;
  return h ? ((3 * (b.y - a.y)) / h - t) / 2 : t;
}

const f = (n: number) => Math.round(n * 100) / 100;

/** Path SVG đường cong monotone theo X qua các điểm liên tiếp (1 điểm → chỉ `M`, 2 điểm → đoạn thẳng). */
export function monotonePath(pts: readonly Pt[]): string {
  const [first] = pts;
  if (!first) return '';
  let d = `M${f(first.x)},${f(first.y)}`;
  if (pts.length === 2) return `${d}L${f(pts[1]!.x)},${f(pts[1]!.y)}`;
  if (pts.length < 3) return d;
  const n = pts.length;
  const t: number[] = new Array<number>(n);
  for (let i = 1; i < n - 1; i++) t[i] = slope3(pts[i - 1]!, pts[i]!, pts[i + 1]!);
  t[0] = slope2(pts[0]!, pts[1]!, t[1]!);
  t[n - 1] = slope2(pts[n - 2]!, pts[n - 1]!, t[n - 2]!);
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const dx = (b.x - a.x) / 3;
    d += `C${f(a.x + dx)},${f(a.y + dx * t[i]!)},${f(b.x - dx)},${f(b.y - dx * t[i + 1]!)},${f(b.x)},${f(b.y)}`;
  }
  return d;
}

/** Tách chuỗi điểm thành các đoạn liền tại chỗ thiếu số (null = mất tín hiệu → đứt đường, không nối qua). */
export function segments(points: readonly (Pt | null)[]): Pt[][] {
  const out: Pt[][] = [];
  let cur: Pt[] = [];
  for (const p of points) {
    if (p) cur.push(p);
    else if (cur.length) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Vùng dưới đường monotone, khép về `baseY` (đáy vùng vẽ). */
export function areaPath(pts: readonly Pt[], baseY: number): string {
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (!first || !last || pts.length < 2) return '';
  return `${monotonePath(pts)}L${f(last.x)},${f(baseY)}L${f(first.x)},${f(baseY)}Z`;
}

/** Chỉ số điểm có X gần `x` nhất (bỏ qua vị trí null). */
export function nearestIndex(xs: readonly (number | null)[], x: number): number | null {
  let best: number | null = null;
  let dist = Infinity;
  xs.forEach((v, i) => {
    if (v === null) return;
    const d = Math.abs(v - x);
    if (d < dist) {
      dist = d;
      best = i;
    }
  });
  return best;
}

/**
 * Bỏ bớt nhãn trục X chồng nhau, luôn giữ nhãn đầu và cuối (như `interval="preserveStartEnd"` của recharts). Nhãn căn giữa
 * tại `x`, rộng `widths[i]`; hai nhãn giữ lại cách nhau ít nhất `gap`.
 */
export function thinLabels(xs: readonly number[], widths: readonly number[], gap: number): boolean[] {
  const n = xs.length;
  const keep = xs.map(() => false);
  if (!n) return keep;
  const right = (i: number) => xs[i]! + widths[i]! / 2;
  const left = (i: number) => xs[i]! - widths[i]! / 2;
  keep[0] = true;
  keep[n - 1] = true;
  let last = 0;
  for (let i = 1; i < n - 1; i++) {
    if (left(i) >= right(last) + gap && right(i) + gap <= left(n - 1)) {
      keep[i] = true;
      last = i;
    }
  }
  return keep;
}

/** Điểm trên đường tròn: góc độ tính từ 12 giờ, chiều kim đồng hồ. */
function polar(cx: number, cy: number, r: number, deg: number): Pt {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/** Path SVG của một cung vành khuyên từ `start` tới `end` (độ, từ 12 giờ theo chiều kim đồng hồ). */
export function annularSector(cx: number, cy: number, inner: number, outer: number, start: number, end: number): string {
  const sweep = Math.min(end - start, 359.999);
  const large = sweep > 180 ? 1 : 0;
  const e = start + sweep;
  const o0 = polar(cx, cy, outer, start);
  const o1 = polar(cx, cy, outer, e);
  const i1 = polar(cx, cy, inner, e);
  const i0 = polar(cx, cy, inner, start);
  return (
    `M${f(o0.x)},${f(o0.y)}A${outer},${outer} 0 ${large} 1 ${f(o1.x)},${f(o1.y)}` +
    `L${f(i1.x)},${f(i1.y)}A${inner},${inner} 0 ${large} 0 ${f(i0.x)},${f(i0.y)}Z`
  );
}

/**
 * Góc các phần donut (như recharts Pie): bắt đầu từ 12 giờ, mỗi phần khác 0 cách nhau `padding` độ; phần bằng 0 không vẽ.
 */
export function donutAngles(values: readonly number[], padding: number): ({ start: number; end: number } | null)[] {
  const sum = values.reduce((s, v) => s + Math.max(0, v), 0);
  const nonZero = values.filter((v) => v > 0).length;
  const total = 360 - nonZero * padding;
  let at = 0;
  let first = true;
  return values.map((v) => {
    if (v <= 0 || sum === 0) return null;
    if (!first) at += padding;
    first = false;
    const start = at;
    at += (v / sum) * total;
    return { start, end: at };
  });
}
