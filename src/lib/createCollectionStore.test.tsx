// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { createCollectionStore } from './createCollectionStore';

/** Promise điều khiển tay: test tự quyết lúc nào fetch xong. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** fetchAll trả lần lượt các deferred theo thứ tự gọi. */
function controlledFetch<T>() {
  const calls: ReturnType<typeof deferred<T[]>>[] = [];
  const fetchAll = vi.fn(() => {
    const d = deferred<T[]>();
    calls.push(d);
    return d.promise;
  });
  return { fetchAll, calls };
}

describe('createCollectionStore – hành vi hiện có', () => {
  test('ban đầu là loading, chưa gọi fetch khi chưa có ai dùng', () => {
    const { fetchAll } = controlledFetch<number>();
    const store = createCollectionStore(fetchAll);
    expect(store.getState()).toEqual({ status: 'loading' });
    expect(fetchAll).not.toHaveBeenCalled();
  });

  test('hook tự tải lần đầu → success', async () => {
    const { fetchAll, calls } = controlledFetch<number>();
    const store = createCollectionStore(fetchAll);
    const { result } = renderHook(() => store.useCollection());
    expect(result.current.status).toBe('loading');
    await act(async () => calls[0]!.resolve([1, 2]));
    expect(result.current.status).toBe('success');
    expect(result.current.data).toEqual([1, 2]);
  });

  test('fetch lỗi → error; lỗi không phải Error được bọc thành Error', async () => {
    const a = controlledFetch<number>();
    const storeA = createCollectionStore(a.fetchAll);
    const hookA = renderHook(() => storeA.useCollection());
    const boom = new Error('hỏng');
    await act(async () => a.calls[0]!.reject(boom));
    expect(hookA.result.current.status).toBe('error');
    expect(hookA.result.current.error).toBe(boom);

    const b = controlledFetch<number>();
    const storeB = createCollectionStore(b.fetchAll);
    const hookB = renderHook(() => storeB.useCollection());
    await act(async () => b.calls[0]!.reject('chuỗi lỗi'));
    expect(hookB.result.current.error).toBeInstanceOf(Error);
    expect(hookB.result.current.error?.message).toBe('chuỗi lỗi');
  });

  test('refetch khi đã có dữ liệu: giữ success (không nháy loading) tới khi có dữ liệu mới', async () => {
    const { fetchAll, calls } = controlledFetch<number>();
    const store = createCollectionStore(fetchAll);
    const { result } = renderHook(() => store.useCollection());
    await act(async () => calls[0]!.resolve([1]));
    act(() => result.current.refetch());
    expect(fetchAll).toHaveBeenCalledTimes(2);
    expect(result.current).toMatchObject({ status: 'success', data: [1] });
    await act(async () => calls[1]!.resolve([1, 2]));
    expect(result.current.data).toEqual([1, 2]);
  });

  test('refetch sau lỗi: về loading rồi success', async () => {
    const { fetchAll, calls } = controlledFetch<number>();
    const store = createCollectionStore(fetchAll);
    const { result } = renderHook(() => store.useCollection());
    await act(async () => calls[0]!.reject(new Error('x')));
    act(() => result.current.refetch());
    expect(result.current.status).toBe('loading');
    await act(async () => calls[1]!.resolve([3]));
    expect(result.current).toMatchObject({ status: 'success', data: [3] });
  });

  test('commit thay danh sách và báo cho mọi hook đang dùng', async () => {
    const { fetchAll, calls } = controlledFetch<number>();
    const store = createCollectionStore(fetchAll);
    const a = renderHook(() => store.useCollection());
    await act(async () => calls[0]!.resolve([1]));
    const b = renderHook(() => store.useCollection());
    act(() => store.commit([9, 8]));
    expect(a.result.current.data).toEqual([9, 8]);
    expect(b.result.current.data).toEqual([9, 8]);
    expect(store.getState()).toEqual({ status: 'success', data: [9, 8] });
  });

  test('mount thêm hook khi đã có dữ liệu: không tải lại', async () => {
    const { fetchAll, calls } = controlledFetch<number>();
    const store = createCollectionStore(fetchAll);
    renderHook(() => store.useCollection());
    await act(async () => calls[0]!.resolve([1]));
    renderHook(() => store.useCollection());
    expect(fetchAll).toHaveBeenCalledTimes(1);
  });

  test('mount sau khi lỗi: không tự tải lại (chỉ "Thử lại" mới tải)', async () => {
    const { fetchAll, calls } = controlledFetch<number>();
    const store = createCollectionStore(fetchAll);
    renderHook(() => store.useCollection());
    await act(async () => calls[0]!.reject(new Error('x')));
    renderHook(() => store.useCollection());
    expect(fetchAll).toHaveBeenCalledTimes(1);
  });
});

describe('createCollectionStore – tải trùng và kết quả cũ', () => {
  test('nhiều hook mount cùng lúc khi đang loading → chỉ gọi fetch MỘT lần', async () => {
    const { fetchAll, calls } = controlledFetch<number>();
    const store = createCollectionStore(fetchAll);
    const a = renderHook(() => store.useCollection());
    const b = renderHook(() => store.useCollection());
    const c = renderHook(() => store.useCollection());
    expect(fetchAll).toHaveBeenCalledTimes(1);
    await act(async () => calls[0]!.resolve([5]));
    for (const h of [a, b, c]) expect(h.result.current.data).toEqual([5]);
  });

  test('commit trong lúc refetch đang chạy → kết quả fetch cũ KHÔNG đè thay đổi vừa commit', async () => {
    const { fetchAll, calls } = controlledFetch<number>();
    const store = createCollectionStore(fetchAll);
    const { result } = renderHook(() => store.useCollection());
    await act(async () => calls[0]!.resolve([1]));
    act(() => result.current.refetch()); // bắt đầu trước thao tác ghi
    act(() => store.commit([1, 2])); // thao tác ghi (optimistic)
    await act(async () => calls[1]!.resolve([1])); // dữ liệu cũ về sau
    expect(result.current.data).toEqual([1, 2]);
  });

  test('hai lượt refetch chồng nhau: lượt mới nhất thắng dù lượt cũ về sau', async () => {
    const { fetchAll, calls } = controlledFetch<number>();
    const store = createCollectionStore(fetchAll);
    const { result } = renderHook(() => store.useCollection());
    await act(async () => calls[0]!.resolve([0]));
    act(() => result.current.refetch());
    act(() => result.current.refetch());
    await act(async () => calls[2]!.resolve([2]));
    await act(async () => calls[1]!.resolve([1]));
    expect(result.current.data).toEqual([2]);
  });

  test('lỗi của lượt cũ không đè dữ liệu của lượt mới', async () => {
    const { fetchAll, calls } = controlledFetch<number>();
    const store = createCollectionStore(fetchAll);
    const { result } = renderHook(() => store.useCollection());
    await act(async () => calls[0]!.resolve([0]));
    act(() => result.current.refetch());
    act(() => result.current.refetch());
    await act(async () => calls[2]!.resolve([2]));
    await act(async () => calls[1]!.reject(new Error('cũ')));
    expect(result.current).toMatchObject({ status: 'success', data: [2] });
  });

  test('refetch tường minh khi đang tải lần đầu vẫn tạo lượt mới; lượt mới quyết định kết quả', async () => {
    const { fetchAll, calls } = controlledFetch<number>();
    const store = createCollectionStore(fetchAll);
    const { result } = renderHook(() => store.useCollection());
    act(() => result.current.refetch());
    expect(fetchAll).toHaveBeenCalledTimes(2);
    await act(async () => calls[1]!.resolve([2]));
    await act(async () => calls[0]!.resolve([1]));
    await waitFor(() => expect(result.current.data).toEqual([2]));
  });
});
