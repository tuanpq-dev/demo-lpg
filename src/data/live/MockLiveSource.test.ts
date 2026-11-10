// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { LiveData } from '@/features/live/types';
import { MockLiveSource } from './MockLiveSource';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('setBase: tag không dao động (chuỗi trạng thái, số cố định) theo giá trị nền ở bước kế tiếp; tag dao động giữ biên', () => {
  const mock = new MockLiveSource({ base: { 'HD-02.ALARM': 'alarm', K: 5, J: 10 }, jitter: { J: 1 }, intervalMs: 1000, connectMs: 10 });
  let last: LiveData = {};
  const off = mock.subscribe(null, (d) => (last = d));
  vi.advanceTimersByTime(20);
  mock.setBase('HD-02.ALARM', 'normal');
  mock.setBase('K', 7);
  vi.advanceTimersByTime(1000);
  expect(last['HD-02.ALARM']!.value).toBe('normal');
  expect(last['K']!.value).toBe(7);
  // Chạy lại – giữ nguyên
  vi.advanceTimersByTime(1000);
  expect(last['HD-02.ALARM']!.value).toBe('normal');
  expect(Math.abs((last['J']!.value as number) - 10)).toBeLessThanOrEqual(1);
  off();
});
