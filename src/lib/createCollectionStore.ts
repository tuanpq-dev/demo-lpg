import { useCallback, useEffect, useSyncExternalStore } from 'react';

export type CollectionState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'error'; data?: undefined; error: Error }
  | { status: 'success'; data: T[]; error?: undefined };

/**
 * Store danh sách dùng chung giữa các trang (giữ thay đổi khi chuyển route).
 * - `fetchAll` = nguồn dữ liệu (mock hôm nay, API sau này).
 * - `commit` = thay toàn bộ danh sách sau mutation (optimistic) rồi phát cho mọi subscriber.
 * - `useCollection()` = hook `{ status, data, error, refetch }`, tự tải lần đầu.
 *
 * Thứ tự kết quả: mỗi lượt tải có số thứ tự; chỉ lượt MỚI NHẤT được ghi vào store. `commit` cũng vô hiệu mọi lượt
 * đang chạy (dữ liệu của chúng lấy trước thao tác ghi) → kết quả cũ về muộn không đè thay đổi vừa ghi.
 * Nhiều hook mount cùng lúc dùng chung một lượt tải; `refetch` tường minh luôn tạo lượt mới.
 * Lượt bị thay thế (lượt tải / commit mới hơn) bị huỷ qua `signal` của `fetchAll` – truyền vào `api.request` để dừng
 * request mạng thừa. Rời trang KHÔNG huỷ: store dùng chung, kết quả vẫn có ích cho lần mở sau.
 */
export function createCollectionStore<T>(fetchAll: (signal: AbortSignal) => Promise<T[]>) {
  let state: CollectionState<T> = { status: 'loading' };
  /** Số thứ tự lượt tải / commit gần nhất. */
  let seq = 0;
  /** Có lượt tải (mới nhất) đang chạy. */
  let pending = false;
  /** Huỷ lượt tải đang chạy (nếu có). */
  let inflight: AbortController | null = null;
  const cancelInflight = () => {
    inflight?.abort();
    inflight = null;
  };
  const listeners = new Set<() => void>();
  /** Tăng mỗi lần dữ liệu đổi (tải xong / commit) – `revision` cho query đọc từ store (trang, tóm tắt…). */
  let version = 0;
  const emit = (next: CollectionState<T>) => {
    state = next;
    version++;
    listeners.forEach((l) => l());
  };
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };

  function load() {
    const id = ++seq;
    pending = true;
    cancelInflight();
    const ctrl = (inflight = new AbortController());
    if (state.status !== 'success') emit({ status: 'loading' });
    const settle = (next: CollectionState<T>) => {
      if (id !== seq) return; // đã có lượt tải / commit mới hơn
      pending = false;
      inflight = null;
      emit(next);
    };
    fetchAll(ctrl.signal)
      .then((data) => settle({ status: 'success', data }))
      .catch((e: unknown) => settle({ status: 'error', error: e instanceof Error ? e : new Error(String(e)) }));
  }

  function commit(data: T[]) {
    seq++;
    pending = false;
    cancelInflight();
    emit({ status: 'success', data });
  }

  function useCollection() {
    const snap = useSyncExternalStore(subscribe, () => state);
    useEffect(() => {
      if (state.status === 'loading' && !pending) load();
    }, []);
    const refetch = useCallback(() => load(), []);
    return { ...snap, refetch };
  }

  /** Số phiên bản dữ liệu (đổi → query phụ thuộc store tải lại ngầm) – KHÔNG tự tải danh sách. */
  function useVersion() {
    return useSyncExternalStore(subscribe, () => version);
  }

  return { load, commit, useCollection, useVersion, subscribe, getState: () => state };
}
