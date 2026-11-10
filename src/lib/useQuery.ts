import { useCallback, useEffect, useRef, useState } from 'react';

/** Trạng thái tải dữ liệu MỘT tài nguyên (trang chi tiết, cảnh 3D…). */
export type QueryState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'error'; data?: undefined; error: Error }
  | { status: 'success'; data: T; error?: undefined };

type Snapshot<T> = QueryState<T> & { key: string; attempt: number };

const toError = (e: unknown) => (e instanceof Error ? e : new Error(String(e)));

/**
 * Tải dữ liệu theo `key` (mã tài sản, mã cảnh…) bằng `fetcher` – `{ status, data, error, refetch }`.
 * - Đổi `key` → về loading ngay ở lần render đó (không lộ dữ liệu của key cũ) rồi tải lại.
 * - `refetch()` → về loading rồi tải lại; kết quả của lượt cũ về muộn bị bỏ.
 * - Unmount → bỏ kết quả đang chờ (không setState sau unmount).
 * - Luôn bắt lỗi (cả lỗi ném đồng bộ trong `fetcher`); lỗi không phải Error được bọc thành Error.
 * `fetcher` lấy bản mới nhất mỗi lượt tải (truyền hàm inline được); chỉ `key` / `refetch` kích hoạt tải lại.
 * Danh sách dùng chung nhiều trang (cảnh báo, bảo trì…) dùng `createCollectionStore` thay vì hook này.
 */
export function useQuery<T>(key: string, fetcher: () => Promise<T>): QueryState<T> & { refetch: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [snap, setSnap] = useState<Snapshot<T>>({ status: 'loading', key, attempt });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;
    setSnap({ status: 'loading', key, attempt });
    const done = (next: QueryState<T>) => {
      if (!cancelled) setSnap({ ...next, key, attempt });
    };
    let pending: Promise<T>;
    try {
      pending = Promise.resolve(fetcherRef.current());
    } catch (e) {
      pending = Promise.reject(e);
    }
    pending.then(
      (data) => done({ status: 'success', data }),
      (e: unknown) => done({ status: 'error', error: toError(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [key, attempt]);

  const refetch = useCallback(() => setAttempt((n) => n + 1), []);
  // Snapshot của key / lượt khác (chưa kịp chạy effect) → loading.
  if (snap.key !== key || snap.attempt !== attempt) return { status: 'loading', refetch };
  const { key: _k, attempt: _a, ...state } = snap;
  return { ...(state as QueryState<T>), refetch };
}
