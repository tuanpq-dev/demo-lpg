import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { MockLiveSource } from './MockLiveSource';

// Nguồn dùng window.setTimeout – môi trường node: trỏ window về globalThis (timer giả của vitest).
beforeEach(() => {
  vi.useFakeTimers();
  (globalThis as { window?: unknown }).window = globalThis;
});
afterEach(() => vi.useRealTimers());

const make = () => new MockLiveSource({ base: { 'PT-1': 9.2 }, connectMs: 300, idleMs: 30_000, intervalMs: 2000 });

describe('MockLiveSource – không rớt kết nối khi chuyển trang', () => {
  test('hết người nghe rồi có người nghe mới trong idleMs → giữ kết nối, peek có số ngay', () => {
    const src = make();
    const off = src.subscribe(['PT-1'], () => {});
    expect(src.peek(['PT-1'])).toBeUndefined(); // chưa kết nối
    vi.advanceTimersByTime(300);
    expect(src.status).toBe('connected');
    off(); // trang cũ gỡ
    vi.advanceTimersByTime(50);
    const got: unknown[] = [];
    src.subscribe(['PT-1'], (d) => got.push(d)); // trang mới gắn
    expect(src.status).toBe('connected');
    expect(got).toHaveLength(1); // nhận số ngay khi đăng ký
    expect(src.peek(['PT-1'])?.['PT-1']?.value).toBe(9.2);
  });

  test('hết người nghe đủ idleMs → ngắt; lần sau kết nối lại', () => {
    const src = make();
    const off = src.subscribe(null, () => {});
    vi.advanceTimersByTime(300);
    off();
    vi.advanceTimersByTime(30_000);
    expect(src.status).toBe('disconnected');
    expect(src.peek(null)).toBeUndefined();
    src.subscribe(null, () => {});
    expect(src.status).toBe('connecting');
  });
});
