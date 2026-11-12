import { useCallback, useEffect, useRef, useState } from 'react';
import { settleSnapshot, startSnapshot, toError, viewOf, type QueryState, type Snapshot } from './queryState';

export type { QueryState };

/**
 * Kết quả gần nhất của các truy vấn bật `remember`, theo `<remember>:<key>` – sống theo tab trình duyệt. Mở lại trang → có
 * dữ liệu ngay ở lần vẽ đầu (không qua "đang tải" → tiêu đề / thẻ không đổi chữ, không đổi chiều cao) rồi tải lại ngầm.
 */
const remembered = new Map<string, unknown>();

/** Xoá mọi kết quả đã nhớ – gọi khi đăng xuất (người khác đăng nhập cùng tab không thấy dữ liệu phiên trước). */
export const clearRememberedQueries = () => remembered.clear();

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
 * - `remember` (tuỳ chọn, tên nhóm): nhớ kết quả gần nhất theo key. Mount lại / đổi sang key đã từng tải → trả NGAY kết quả đã
 *   nhớ (`pending: true`) và tải lại ngầm; lượt tải lại lỗi → giữ kết quả đã nhớ. Dùng cho dữ liệu của cả trang (chi tiết tài
 *   sản, tổng quan…) để quay lại trang không nháy.
 * `fetcher` lấy bản mới nhất mỗi lượt tải (truyền hàm inline được); chỉ `key` / `refetch` / `revision` kích hoạt tải lại.
 * Danh sách dùng chung nhiều trang (cảnh báo, bảo trì…) dùng `createCollectionStore` thay vì hook này.
 */
export function useQuery<T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
  { revision, keepPrevious = false, remember }: { revision?: string | number; keepPrevious?: boolean; remember?: string } = {},
): QueryState<T> & { refetch: () => void; pending: boolean } {
  const cacheId = remember ? `${remember}:${key}` : null;
  const recall = (id: string | null) => (id !== null ? (remembered.get(id) as T | undefined) : undefined);
  const [attempt, setAttempt] = useState(0);
  const [snap, setSnap] = useState<Snapshot<T>>(() => {
    const cached = recall(cacheId);
    return cached !== undefined ? { status: 'success', data: cached, key, attempt } : { status: 'loading', key, attempt };
  });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  /** Lượt tải gần nhất đã bắt đầu – cùng key + attempt nghĩa là effect chạy lại chỉ vì `revision` đổi. */
  const started = useRef<{ key: string; attempt: number } | null>(null);
  const snapRef = useRef(snap);
  snapRef.current = snap;

  useEffect(() => {
    const ctrl = new AbortController();
    const cached = cacheId !== null ? (remembered.get(cacheId) as T | undefined) : undefined;
    // Tải ngầm = chỉ `revision` đổi, hoặc đang hiện kết quả đã nhớ của key này (lỗi thì giữ dữ liệu đang hiện).
    const background = (started.current?.key === key && started.current.attempt === attempt) || cached !== undefined;
    started.current = { key, attempt };
    const first = startSnapshot(snapRef.current, key, attempt, { background, keepPrevious, cached });
    if (first !== snapRef.current) setSnap(first);
    const done = (next: QueryState<T>) => {
      if (ctrl.signal.aborted) return;
      if (cacheId !== null && next.status === 'success') remembered.set(cacheId, next.data);
      setSnap((cur) => settleSnapshot(cur, next, key, attempt, background));
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
  }, [key, attempt, revision, keepPrevious, cacheId]);

  const refetch = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...viewOf(snap, key, attempt, keepPrevious, recall(cacheId)), refetch };
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
