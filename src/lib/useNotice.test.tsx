// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useNotice } from './useNotice';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useNotice', () => {
  test('hiện thông báo rồi tự xoá sau 4 giây', () => {
    const { result } = renderHook(() => useNotice());
    expect(result.current.notice).toBe('');
    act(() => result.current.flash('Đã lưu'));
    expect(result.current.notice).toBe('Đã lưu');
    act(() => vi.advanceTimersByTime(3999));
    expect(result.current.notice).toBe('Đã lưu');
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.notice).toBe('');
  });

  test('thông báo mới đặt lại thời gian; `ms` tuỳ chỉnh; flash ổn định giữa các lần render', () => {
    const { result, rerender } = renderHook(() => useNotice(1000));
    const flash = result.current.flash;
    act(() => flash('A'));
    act(() => vi.advanceTimersByTime(800));
    act(() => flash('B'));
    act(() => vi.advanceTimersByTime(800));
    expect(result.current.notice).toBe('B');
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.notice).toBe('');
    rerender();
    expect(result.current.flash).toBe(flash);
  });
});
