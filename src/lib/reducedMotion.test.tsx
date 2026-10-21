// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { prefersReducedMotion, useReducedMotion } from './reducedMotion';

function mockMedia(initial: boolean) {
  const listeners = new Set<() => void>();
  const mql = {
    matches: initial,
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
  };
  vi.spyOn(window, 'matchMedia').mockImplementation(() => mql as unknown as MediaQueryList);
  return {
    set(v: boolean) {
      mql.matches = v;
      listeners.forEach((cb) => cb());
    },
  };
}

describe('useReducedMotion', () => {
  test('đọc cài đặt hệ thống và tự cập nhật khi đổi', () => {
    const m = mockMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
    act(() => m.set(true));
    expect(result.current).toBe(true);
    expect(prefersReducedMotion()).toBe(true);
  });
});
