// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { useQuery } from './useQuery';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
/** fetcher trả lần lượt các deferred; `calls[i].key` = key lúc gọi. */
function controlled<T>() {
  const calls: (ReturnType<typeof deferred<T>> & { key: string })[] = [];
  const make = (key: string) =>
    vi.fn(() => {
      const d = { ...deferred<T>(), key };
      calls.push(d);
      return d.promise;
    });
  return { calls, make };
}

describe('useQuery', () => {
  test('tải lần đầu: loading → success', async () => {
    const { calls, make } = controlled<number>();
    const { result } = renderHook(() => useQuery('a', make('a')));
    expect(result.current.status).toBe('loading');
    await act(async () => calls[0]!.resolve(1));
    expect(result.current).toMatchObject({ status: 'success', data: 1 });
  });

  test('lỗi → error; lỗi không phải Error được bọc; lỗi ném đồng bộ cũng bắt', async () => {
    const { calls, make } = controlled<number>();
    const a = renderHook(() => useQuery('a', make('a')));
    await act(async () => calls[0]!.reject('hỏng'));
    expect(a.result.current.status).toBe('error');
    expect(a.result.current.error).toBeInstanceOf(Error);
    expect(a.result.current.error?.message).toBe('hỏng');

    const b = renderHook(() =>
      useQuery('b', () => {
        throw new Error('sync');
      }),
    );
    await act(async () => {});
    expect(b.result.current).toMatchObject({ status: 'error', error: new Error('sync') });
  });

  test('refetch: về loading rồi có dữ liệu mới (cả sau lỗi)', async () => {
    const { calls, make } = controlled<number>();
    const fetcher = make('a');
    const { result } = renderHook(() => useQuery('a', fetcher));
    await act(async () => calls[0]!.reject(new Error('x')));
    act(() => result.current.refetch());
    expect(result.current.status).toBe('loading');
    await act(async () => calls[1]!.resolve(2));
    expect(result.current).toMatchObject({ status: 'success', data: 2 });
    act(() => result.current.refetch());
    expect(result.current.status).toBe('loading');
    await act(async () => calls[2]!.resolve(3));
    expect(result.current.data).toBe(3);
  });

  test('đổi key: loading NGAY (không lộ dữ liệu key cũ); kết quả key cũ về muộn bị bỏ', async () => {
    const { calls, make } = controlled<string>();
    const { result, rerender } = renderHook(({ k }) => useQuery(k, make(k)), { initialProps: { k: 'a' } });
    await act(async () => calls[0]!.resolve('A'));
    rerender({ k: 'b' });
    expect(result.current.status).toBe('loading');
    expect(result.current.data).toBeUndefined();
    rerender({ k: 'c' });
    await act(async () => calls[2]!.resolve('C'));
    await act(async () => calls[1]!.resolve('B')); // key b về muộn
    expect(result.current).toMatchObject({ status: 'success', data: 'C' });
  });

  test('hai refetch chồng nhau: lượt mới nhất thắng', async () => {
    const { calls, make } = controlled<number>();
    const fetcher = make('a');
    const { result } = renderHook(() => useQuery('a', fetcher));
    await act(async () => calls[0]!.resolve(0));
    act(() => result.current.refetch());
    act(() => result.current.refetch());
    await act(async () => calls[2]!.resolve(2));
    await act(async () => calls[1]!.resolve(1));
    expect(result.current.data).toBe(2);
  });

  test('unmount khi đang tải → không cảnh báo setState, không ném', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { calls, make } = controlled<number>();
    const { unmount } = renderHook(() => useQuery('a', make('a')));
    unmount();
    await act(async () => calls[0]!.resolve(1));
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });

  test('fetcher inline đổi mỗi render KHÔNG gây tải lại; lượt tải dùng fetcher mới nhất', async () => {
    const seen: number[] = [];
    const { result, rerender } = renderHook(({ v }) => useQuery('a', () => Promise.resolve((seen.push(v), v))), { initialProps: { v: 1 } });
    await act(async () => {});
    rerender({ v: 2 });
    rerender({ v: 3 });
    await act(async () => {});
    expect(seen).toEqual([1]);
    act(() => result.current.refetch());
    await act(async () => {});
    expect(seen).toEqual([1, 3]);
    expect(result.current.data).toBe(3);
  });
});
