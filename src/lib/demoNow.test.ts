import { describe, expect, test } from 'vitest';
import { nowOffsetFrom, parseNowParam } from './demoNow';

describe('parseNowParam – ?now=', () => {
  test('không múi giờ = giờ nhà máy (UTC+7)', () => {
    expect(parseNowParam('2026-10-26T11:45')!.toISOString()).toBe('2026-10-26T04:45:00.000Z');
    expect(parseNowParam('2026-10-26T11:45:30')!.toISOString()).toBe('2026-10-26T04:45:30.000Z');
  });
  test('ISO có Z / offset giữ nguyên', () => {
    expect(parseNowParam('2026-10-26T04:45:00Z')!.toISOString()).toBe('2026-10-26T04:45:00.000Z');
    expect(parseNowParam('2026-10-26T11:45:00+07:00')!.toISOString()).toBe('2026-10-26T04:45:00.000Z');
  });
  test('sai / trống → null', () => {
    for (const v of [null, undefined, '', 'abc', '2026-10-26', '2026-13-01T10:00', '2026-10-26T25:00']) expect(parseNowParam(v)).toBeNull();
  });
});

describe('nowOffsetFrom', () => {
  const REAL = Date.parse('2026-10-26T00:00:00Z');
  test('bật + hợp lệ → độ lệch', () => {
    expect(nowOffsetFrom('?now=2026-10-26T11:45', true, REAL)).toBe(4.75 * 3_600_000);
  });
  test('tắt (bản build không VITE_DEMO) → 0 dù có ?now=', () => {
    expect(nowOffsetFrom('?now=2026-10-26T11:45', false, REAL)).toBe(0);
  });
  test('VITE_FIXED_NOW (build-time) dùng khi không có ?now= hợp lệ – kể cả khi ?now= bị tắt', () => {
    expect(nowOffsetFrom('', false, REAL, '2026-10-26T11:45')).toBe(4.75 * 3_600_000);
    expect(nowOffsetFrom('?now=2026-10-26T09:00', false, REAL, '2026-10-26T11:45')).toBe(4.75 * 3_600_000);
    expect(nowOffsetFrom('?now=xyz', true, REAL, '2026-10-26T11:45')).toBe(4.75 * 3_600_000);
  });
  test('?now= hợp lệ và được phép thắng VITE_FIXED_NOW; VITE_FIXED_NOW sai / trống → 0', () => {
    expect(nowOffsetFrom('?now=2026-10-26T09:00', true, REAL, '2026-10-26T11:45')).toBe(2 * 3_600_000);
    expect(nowOffsetFrom('', true, REAL, 'abc')).toBe(0);
    expect(nowOffsetFrom('', true, REAL, '')).toBe(0);
  });
  test('không có / sai ?now= → 0', () => {
    expect(nowOffsetFrom('', true, REAL)).toBe(0);
    expect(nowOffsetFrom('?now=xyz', true, REAL)).toBe(0);
  });
});
