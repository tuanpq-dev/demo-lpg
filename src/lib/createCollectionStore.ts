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
 */
export function createCollectionStore<T>(fetchAll: () => Promise<T[]>) {
  let state: CollectionState<T> = { status: 'loading' };
  const listeners = new Set<() => void>();
  const emit = (next: CollectionState<T>) => {
    state = next;
    listeners.forEach((l) => l());
  };
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };

  function load() {
    if (state.status !== 'success') emit({ status: 'loading' });
    fetchAll()
      .then((data) => emit({ status: 'success', data }))
      .catch((e: unknown) => emit({ status: 'error', error: e instanceof Error ? e : new Error(String(e)) }));
  }

  function commit(data: T[]) {
    emit({ status: 'success', data });
  }

  function useCollection() {
    const snap = useSyncExternalStore(subscribe, () => state);
    useEffect(() => {
      if (state.status === 'loading') load();
    }, []);
    const refetch = useCallback(() => load(), []);
    return { ...snap, refetch };
  }

  return { load, commit, useCollection, getState: () => state };
}
