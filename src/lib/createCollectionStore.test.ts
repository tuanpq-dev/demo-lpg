import { describe, expect, test } from 'vitest';
import { createCollectionStore } from './createCollectionStore';

/** fetchAll giả: mỗi lượt trả promise điều khiển tay + ghi lại signal. */
function deferredFetch() {
  const calls: { signal: AbortSignal; resolve: (v: number[]) => void; reject: (e: unknown) => void }[] = [];
  const fetchAll = (signal: AbortSignal) =>
    new Promise<number[]>((resolve, reject) => {
      calls.push({ signal, resolve, reject });
    });
  return { fetchAll, calls };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('createCollectionStore', () => {
  test('load → success; lỗi → error (bọc thành Error)', async () => {
    const { fetchAll, calls } = deferredFetch();
    const s = createCollectionStore(fetchAll);
    s.load();
    expect(s.getState().status).toBe('loading');
    calls[0]!.resolve([1, 2]);
    await flush();
    expect(s.getState()).toEqual({ status: 'success', data: [1, 2] });
    s.load();
    calls[1]!.reject('hỏng');
    await flush();
    // Đã có dữ liệu → giữ success tới khi lượt mới xong; lượt mới lỗi → error.
    expect(s.getState().status).toBe('error');
    expect(s.getState().error).toBeInstanceOf(Error);
  });

  test('lượt mới huỷ lượt cũ; kết quả lượt cũ về muộn bị bỏ', async () => {
    const { fetchAll, calls } = deferredFetch();
    const s = createCollectionStore(fetchAll);
    s.load();
    s.load();
    expect(calls[0]!.signal.aborted).toBe(true);
    expect(calls[1]!.signal.aborted).toBe(false);
    calls[1]!.resolve([2]);
    calls[0]!.resolve([1]);
    await flush();
    expect(s.getState().data).toEqual([2]);
  });

  test('commit (ghi optimistic) huỷ lượt đang tải – dữ liệu cũ không đè thay đổi vừa ghi', async () => {
    const { fetchAll, calls } = deferredFetch();
    const s = createCollectionStore(fetchAll);
    s.load();
    s.commit([9]);
    expect(calls[0]!.signal.aborted).toBe(true);
    calls[0]!.resolve([1]);
    await flush();
    expect(s.getState()).toEqual({ status: 'success', data: [9] });
  });
});
