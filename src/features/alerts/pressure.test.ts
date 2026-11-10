import { describe, expect, test } from 'vitest';
import { canClosePressure, type CloseInput } from './pressure';

// Tách từ pressure.test.ts cũ (28/10/2026): phần khung chung chuyển sang update.test.ts; điều kiện áp suất giữ nguyên.
const closeIn = (p: Partial<CloseInput> = {}): CloseInput => ({
  liveState: 'ok',
  live: 9.2,
  after: 9.2,
  source: 'sensor',
  warn: 10.5,
  unit: 'bar',
  ...p,
});

describe('điều kiện "Đã xử lý"', () => {
  test('live < ngưỡng VÀ sau xử lý < ngưỡng → đóng được', () => {
    expect(canClosePressure(closeIn())).toEqual({ ok: true, value: 9.2 });
  });
  test('live còn ≥ ngưỡng → khoá, kể cả khi số đo tay dưới ngưỡng (ranh giới = ngưỡng cũng khoá)', () => {
    expect(canClosePressure(closeIn({ live: 10.5, after: 9 })).ok).toBe(false);
    const c = canClosePressure(closeIn({ live: 11.2, after: 9, source: 'both' }));
    expect(c).toMatchObject({ ok: false, reason: 'live-high' });
  });
  test('sau xử lý ≥ ngưỡng (ảnh 10.8 bar) hoặc trống → khoá', () => {
    expect(canClosePressure(closeIn({ after: 10.8, source: 'both' }))).toMatchObject({ ok: false, reason: 'after-high' });
    expect(canClosePressure(closeIn({ after: undefined }))).toMatchObject({ ok: false, reason: 'need-after' });
  });
  test('mất tín hiệu: nguồn chỉ cảm biến → khoá; có đồng hồ cơ → bắt buộc số đo tay < ngưỡng', () => {
    expect(canClosePressure(closeIn({ liveState: 'lost', live: undefined, after: undefined }))).toMatchObject({ ok: false, reason: 'need-gauge' });
    expect(canClosePressure(closeIn({ liveState: 'lost', live: undefined, after: undefined, source: 'gauge' }))).toMatchObject({
      ok: false,
      reason: 'need-after',
    });
    expect(canClosePressure(closeIn({ liveState: 'lost', live: undefined, after: 11, source: 'both' }))).toMatchObject({
      ok: false,
      reason: 'after-high',
    });
    expect(canClosePressure(closeIn({ liveState: 'lost', live: undefined, after: 9.8, source: 'gauge' }))).toEqual({ ok: true, value: 9.8 });
    // không có tag = như mất tín hiệu
    expect(canClosePressure(closeIn({ liveState: 'none', live: undefined, after: 9.8, source: 'gauge' })).ok).toBe(true);
  });
  test('đang đọc số đầu tiên → khoá (không một nhịp chọn được)', () => {
    expect(canClosePressure(closeIn({ liveState: 'pending', live: undefined }))).toMatchObject({ ok: false, reason: 'pending' });
  });
});
