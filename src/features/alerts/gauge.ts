/*
 * Thanh đo ngưỡng của drawer chi tiết cảnh báo (`ThresholdGauge`) – thuần, có test.
 * Thang: 0 → mức NGUY HIỂM × 1.2 khi có cấu hình tag (`danger`), không có → 0 → ngưỡng × 1.2 (ngưỡng của bản ghi).
 * Giá trị vượt thang → nới thang tới giá trị × 1.05 (vạch không dính mép, `aria-valuenow` luôn trong [min, max]).
 * CÓ vẽ thang hay không do cấu hình theo LOẠI cảnh báo (`ALERT_KINDS[kind].gauge`, false = cảnh báo tốc độ thay đổi) –
 * không đoán theo dấu của số. Ở đây chỉ còn chốt an toàn: số không hợp lệ hoặc thang suy biến (max ≤ 0) → null.
 */
import type { AlertDirection } from '@/features/alerts/types';

const GAUGE_HEADROOM = 1.2;

/** Đơn vị dính số: "25% LEL", "45°C"; còn lại cách một khoảng: "11.8 bar". */
export const withUnit = (v: string, unit: string) => (/^[%°]/.test(unit) ? `${v}${unit}` : `${v} ${unit}`);

/**
 * MỘT hàm định dạng số đo + đơn vị cho drawer cảnh báo: 1 chữ số lẻ, bỏ số 0 thừa – "25% LEL", "25.4% LEL", "11.8 bar".
 */
export const formatMeasure = (n: number, unit: string) => withUnit(String(Math.round(n * 10) / 10), unit);

/** Mức tăng có dấu: "+11% LEL" · "−3% LEL" · "0% LEL" (cùng định dạng `formatMeasure`). */
export function formatDelta(d: number, unit: string): string {
  const r = Math.round(d * 10) / 10;
  if (r === 0) return formatMeasure(0, unit);
  return `${r > 0 ? '+' : '−'}${formatMeasure(Math.abs(r), unit)}`;
}

/** Số gọn: bỏ số 0 thừa ("10.50" → "10.5", "12.0" → "12"). */
export const formatGaugeNumber = (n: number) => String(Math.round(n * 100) / 100);

/** Giá trị có vượt ngưỡng theo chiều cảnh báo không (đúng bằng ngưỡng = chưa vượt). */
export const isBreached = (value: number, threshold: number, direction: AlertDirection) =>
  direction === 'above' ? value > threshold : value < threshold;

export type GaugeScale = { min: number; max: number; value: number; threshold: number; direction: AlertDirection; breached: boolean };

export function gaugeScale({
  value,
  threshold,
  danger,
  direction,
}: {
  value: number;
  threshold: number;
  /** Mức nguy hiểm từ cấu hình tag (chiều above). */
  danger?: number;
  direction: AlertDirection;
}): GaugeScale | null {
  if (!Number.isFinite(value) || !Number.isFinite(threshold)) return null;
  const base = (danger !== undefined && danger > threshold ? danger : threshold) * GAUGE_HEADROOM;
  const max = value > base ? value * 1.05 : base;
  if (!(max > 0)) return null;
  return { min: 0, max: Math.round(max * 1000) / 1000, value, threshold, direction, breached: isBreached(value, threshold, direction) };
}

/** aria-valuetext: "11.8 bar, vượt ngưỡng 10.5 bar" · "45°C, dưới ngưỡng 50°C" · "9.6 bar, trong giới hạn (ngưỡng 10.5 bar)". */
export function gaugeValueText(s: Pick<GaugeScale, 'value' | 'threshold' | 'direction' | 'breached'>, unit: string): string {
  const v = withUnit(formatGaugeNumber(s.value), unit);
  const t = withUnit(formatGaugeNumber(s.threshold), unit);
  if (!s.breached) return `${v}, trong giới hạn (ngưỡng ${t})`;
  return `${v}, ${s.direction === 'above' ? 'vượt ngưỡng' : 'dưới ngưỡng'} ${t}`;
}
