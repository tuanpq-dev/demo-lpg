/*
 * Điều kiện "Đã xử lý" của cảnh báo áp suất (modal cập nhật – khung chung `update.ts`, docs/guide/alerts.md (4o)) – thuần,
 * có test (pressure.test.ts). Số live do UI đọc rồi truyền vào – hàm kiểm lại.
 *   Đã xử lý CHỈ khi áp suất LIVE < ngưỡng cảnh báo VÀ giá trị "sau xử lý" < ngưỡng; mất tín hiệu → nguồn xác minh phải có
 *   đồng hồ cơ + số đo tay < ngưỡng.
 */
import type { VerificationSource } from '@/features/alerts/types';
import { formatMeasure } from './gauge';

export type { VerificationSource };

/** Nguồn có đồng hồ cơ / máy đo cầm tay → ô "Sau" sửa tay được; mất tín hiệu bắt buộc. */
export const hasGauge = (s: VerificationSource) => s !== 'sensor';

// ---- Điều kiện "Đã xử lý" ----

export type LiveState = 'ok' | 'lost' | 'pending' | 'none';
export type CloseInput = {
  liveState: LiveState;
  live?: number;
  /** Giá trị "sau xử lý" của dòng áp suất chính (live khi nguồn = cảm biến, số đo tay khi có đồng hồ cơ). */
  after?: number;
  source: VerificationSource;
  /** Ngưỡng cảnh báo (cấu hình tag; thiếu → ngưỡng bản ghi). */
  warn: number;
  unit: string;
};
export type CloseCheck =
  | { ok: true; value: number }
  | { ok: false; reason: 'pending' | 'live-high' | 'need-gauge' | 'need-after' | 'after-high'; message: string };

export function canClosePressure(c: CloseInput): CloseCheck {
  const f = (n: number) => formatMeasure(n, c.unit);
  if (c.liveState === 'pending') return { ok: false, reason: 'pending', message: 'Đang đọc áp suất hiện tại…' };
  const lost = c.liveState !== 'ok' || c.live === undefined;
  if (lost && !hasGauge(c.source))
    return { ok: false, reason: 'need-gauge', message: 'Mất tín hiệu áp suất – chọn nguồn xác minh có "Đồng hồ cơ" và nhập giá trị đo tay.' };
  if (!lost && c.live! >= c.warn)
    return { ok: false, reason: 'live-high', message: `Áp suất hiện tại ${f(c.live!)} vẫn chưa dưới ngưỡng cảnh báo ${f(c.warn)}.` };
  if (c.after === undefined)
    return { ok: false, reason: 'need-after', message: lost ? 'Nhập áp suất sau xử lý đo bằng đồng hồ cơ.' : 'Nhập áp suất sau xử lý.' };
  if (c.after >= c.warn)
    return { ok: false, reason: 'after-high', message: `Áp suất sau xử lý ${f(c.after)} vẫn chưa dưới ngưỡng cảnh báo ${f(c.warn)}.` };
  return { ok: true, value: c.after };
}
