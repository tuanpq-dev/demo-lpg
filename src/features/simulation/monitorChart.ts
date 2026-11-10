/** Trục / miền giá trị biểu đồ màn theo dõi mô phỏng. Tách từ monitor.ts. */
import { formatQty, type SimVariable } from './config';

export const CHART_STEP_SEC = 5;

/** Nhãn trục X: 5 mốc chia đều thời lượng ("00:00 · 02:30 · 05:00 · 07:30 · 10:00"). */
export const chartTicks = (durationSec: number) => [0, 1, 2, 3, 4].map((i) => Math.round((durationSec * i) / 4));

const NICE = [1, 2, 2.5, 5, 10];

/** Miền trục Y "đẹp" bao start / mục tiêu / ngưỡng (ảnh: 0–40 %). `intervals` = số khoảng mong muốn (theo dõi 4, kết quả 8). */
export function chartDomain(values: readonly number[], intervals = 4): { domain: [number, number]; ticks: number[] } {
  const lo0 = Math.min(...values);
  const hi0 = Math.max(...values);
  const raw = (hi0 - lo0 || Math.abs(hi0) || 1) / intervals;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = (NICE.find((n) => n * mag >= raw) ?? 10) * mag;
  let lo = Math.floor(lo0 / step) * step;
  let hi = Math.ceil(hi0 / step) * step;
  if (hi === hi0) hi += step;
  if (lo === lo0 && lo0 > 0) lo -= step;
  if (lo < 0 && lo0 >= 0) lo = 0;
  const ticks: number[] = [];
  for (let t = lo; t <= hi + step / 1e6; t += step) ticks.push(Math.round(t * 1e6) / 1e6);
  return { domain: [lo, hi], ticks };
}

/** "40%" · "12 bar" – nhãn trục Y (không qualifier). */
export const axisLabel = (v: number, variable: Pick<SimVariable, 'unit'>) =>
  v === 0 ? '0' : formatQty(v, variable.unit, Number.isInteger(v) ? 0 : 1);
