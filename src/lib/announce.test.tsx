// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { expect, test } from 'vitest';
import { announce, useAnnouncement } from './announce';

test('announce → nội dung vùng live; lặp lại cùng câu vẫn đổi chuỗi (được đọc lại)', () => {
  const { result } = renderHook(() => useAnnouncement());
  act(() => announce('Mất kết nối'));
  const first = result.current;
  expect(first.replace(/\u200B/g, '')).toBe('Mất kết nối');
  act(() => announce('Mất kết nối'));
  expect(result.current).not.toBe(first);
  act(() => announce(''));
  expect(result.current.replace(/\u200B/g, '')).toBe('Mất kết nối');
});
