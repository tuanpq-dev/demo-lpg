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
 * - `fetcher(signal)`: signal bị huỷ khi đổi key / refetch / unmount – truyền vào `api.request(…, { signal })` để huỷ
 *   request mạng đang chạy (lỗi AbortError của lượt đã huỷ bị bỏ qua).
 * - Luôn bắt lỗi (cả lỗi ném đồng bộ trong `fetcher`); lỗi không phải Error được bọc thành Error.
 * - `revision` (tuỳ chọn): đổi giá trị = dữ liệu nền của CÙNG tài nguyên đã đổi (vd vừa ghi) → tải lại NGẦM, giữ dữ liệu
 *   đang hiện tới khi có kết quả mới (không về loading – tránh nháy khung chờ). Lượt tải ngầm lỗi → giữ dữ liệu cũ.
 * - `keepPrevious` (tuỳ chọn): đổi `key` (bộ lọc / trang của bảng phân trang phía máy chủ) → GIỮ kết quả cũ (`pending: true`) tới
 *   khi có kết quả mới thay vì về loading – bảng không nháy khung chờ mỗi lần gõ / chuyển trang. Lượt mới lỗi → trạng thái lỗi.
 * `fetcher` lấy bản mới nhất mỗi lượt tải (truyền hàm inline được); chỉ `key` / `refetch` / `revision` kích hoạt tải lại.
 * Danh sách dùng chung nhiều trang (cảnh báo, bảo trì…) dùng `createCollectionStore` thay vì hook này.
 */
export function useQuery<T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
  { revision, keepPrevious = false }: { revision?: string | number; keepPrevious?: boolean } = {},
): QueryState<T> & { refetch: () => void; pending: boolean } {
  const [attempt, setAttempt] = useState(0);
  const [snap, setSnap] = useState<Snapshot<T>>({ status: 'loading', key, attempt });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  /** Lượt tải gần nhất đã bắt đầu – cùng key + attempt nghĩa là effect chạy lại chỉ vì `revision` đổi. */
  const started = useRef<{ key: string; attempt: number } | null>(null);
  const snapRef = useRef(snap);
  snapRef.current = snap;

  useEffect(() => {
    const ctrl = new AbortController();
    const background = started.current?.key === key && started.current.attempt === attempt;
    started.current = { key, attempt };
    // keepPrevious: key mới nhưng đang có dữ liệu → để nguyên snapshot cũ (render trả `pending`) tới khi lượt này xong.
    const keep = keepPrevious && snapRef.current.status === 'success';
    if (!background && !keep) setSnap({ status: 'loading', key, attempt });
    const done = (next: QueryState<T>) => {
      if (ctrl.signal.aborted) return;
      // Tải ngầm lỗi: giữ dữ liệu đang hiện (nếu có) thay vì thay cả màn bằng trang lỗi.
      setSnap((cur) => (background && next.status === 'error' && cur.status === 'success' ? cur : { ...next, key, attempt }));
    };
    let pending: Promise<T>;
    try {
      pending = Promise.resolve(fetcherRef.current(ctrl.signal));
    } catch (e) {
      pending = Promise.reject(e);
    }
    pending.then(
      (data) => done({ status: 'success', data }),
      (e: unknown) => done({ status: 'error', error: toError(e) }),
    );
    return () => ctrl.abort();
  }, [key, attempt, revision, keepPrevious]);

  const refetch = useCallback(() => setAttempt((n) => n + 1), []);
  const { key: _k, attempt: _a, ...state } = snap;
  // Snapshot của key / lượt khác (chưa kịp chạy effect hoặc đang tải key mới) → loading, hoặc dữ liệu cũ khi keepPrevious.
  if (snap.key !== key || snap.attempt !== attempt) {
    return keepPrevious && state.status === 'success'
      ? { ...(state as QueryState<T>), refetch, pending: true }
      : { status: 'loading', refetch, pending: true };
  }
  return { ...(state as QueryState<T>), refetch, pending: false };
}

/**
 * Số tăng mỗi khi `value` đổi THAM CHIẾU – dùng làm `revision` của `useQuery` khi dữ liệu phụ thuộc một bản ghi lấy từ store
 * (store commit → bản ghi là object mới).
 */
export function useIdentityRevision(value: unknown): number {
  const ref = useRef({ value, n: 0 });
  if (ref.current.value !== value) ref.current = { value, n: ref.current.n + 1 };
  return ref.current.n;
}

type QueryLike = { status: 'loading' | 'error' | 'success'; error?: Error | undefined; refetch: () => void };

/**
 * Gộp trạng thái nhiều truy vấn của một trang (danh sách + tóm tắt…) cho khung chờ / lỗi chung: lỗi nếu có truy vấn lỗi,
 * loading nếu còn truy vấn chưa xong; `refetch` tải lại tất cả.
 */
export function combineQueries(...qs: readonly QueryLike[]): { status: 'loading' | 'error' | 'success'; error?: Error; refetch: () => void } {
  const failed = qs.find((q) => q.status === 'error');
  const refetch = () => qs.forEach((q) => q.refetch());
  if (failed) return { status: 'error', error: failed.error, refetch };
  return { status: qs.every((q) => q.status === 'success') ? 'success' : 'loading', refetch };
}
