// @vitest-environment jsdom
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ToastHost } from '@/app/ToastHost';
import { runAction } from './actionError';
import { MAX_TOASTS, TOAST_DURATION_MS, dismissToast, resetToasts, showToast, useToasts } from './toast';

const announced: string[] = [];
vi.mock('./announce', () => ({ announce: (m: string) => announced.push(m) }));

beforeEach(() => {
  announced.length = 0;
  resetToasts();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('lib/toast', () => {
  test('showToast: thêm vào danh sách + đọc qua announce; chuỗi rỗng bỏ qua', () => {
    const { result } = renderHook(() => useToasts());
    act(() => {
      showToast('Đã lưu');
      showToast('');
    });
    expect(result.current).toMatchObject([{ text: 'Đã lưu', tone: 'info' }]);
    expect(announced).toEqual(['Đã lưu']);
  });

  test('tự tắt sau thời gian theo loại (lỗi giữ lâu hơn)', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToasts());
    act(() => {
      showToast('a', 'info');
      showToast('b', 'error');
    });
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS.info));
    expect(result.current.map((t) => t.text)).toEqual(['b']);
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS.error - TOAST_DURATION_MS.info));
    expect(result.current).toEqual([]);
  });

  test('tối đa MAX_TOASTS – bỏ cái cũ nhất', () => {
    const { result } = renderHook(() => useToasts());
    act(() => {
      for (let i = 1; i <= MAX_TOASTS + 2; i++) showToast(`t${i}`);
    });
    expect(result.current.map((t) => t.text)).toEqual(Array.from({ length: MAX_TOASTS }, (_, i) => `t${i + 3}`));
  });

  test('cùng câu cùng loại → thay bản cũ (không chồng), đặt lại giờ tắt', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToasts());
    act(() => {
      showToast('lỗi', 'error');
    });
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS.error - 100));
    act(() => {
      showToast('lỗi', 'error');
    });
    expect(result.current).toHaveLength(1);
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toHaveLength(1);
  });

  test('dismissToast bỏ đúng một mục; id lạ không làm gì', () => {
    const { result } = renderHook(() => useToasts());
    let id = 0;
    act(() => {
      id = showToast('x');
      showToast('y');
    });
    act(() => {
      dismissToast(id);
      dismissToast(9999);
    });
    expect(result.current.map((t) => t.text)).toEqual(['y']);
  });
});

describe('ToastHost + runAction', () => {
  test('thao tác lỗi (onError mặc định) → toast lỗi nhìn thấy; × đóng', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<ToastHost />);
    expect(screen.queryByRole('region', { name: 'Thông báo' })).toBeNull();
    await act(() => runAction(() => Promise.reject(new Error('Mất kết nối máy chủ'))));
    const region = screen.getByRole('region', { name: 'Thông báo' });
    expect(region).toHaveTextContent('Không thực hiện được thao tác: Mất kết nối máy chủ');
    expect(region).not.toHaveAttribute('aria-live'); // câu đã đọc qua announce – không đọc 2 lần
    expect(announced).toEqual(['Không thực hiện được thao tác: Mất kết nối máy chủ']);
    await user.click(screen.getByRole('button', { name: 'Đóng thông báo' }));
    expect(screen.queryByRole('region', { name: 'Thông báo' })).toBeNull();
  });
});
