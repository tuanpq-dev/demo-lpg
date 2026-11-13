/*
 * Chuyển trạng thái của `useQuery` – THUẦN (không React) để test được: bắt đầu lượt tải, lượt tải xong, trạng thái trả cho
 * render. Hook chỉ nối các hàm này với state / effect.
 */

/** Trạng thái tải dữ liệu MỘT tài nguyên (trang chi tiết, cảnh 3D…). */
export type QueryState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'error'; data?: undefined; error: Error }
  | { status: 'success'; data: T; error?: undefined };

/** Kết quả gắn với lượt tải tạo ra nó (`key` + `attempt`). */
export type Snapshot<T> = QueryState<T> & { key: string; attempt: number };

export const toError = (e: unknown) => (e instanceof Error ? e : new Error(String(e)));

/**
 * Lượt tải bắt đầu. Trả nguyên `cur` khi không cần đổi:
 * - `background` (cùng key + attempt, chỉ `revision` đổi) → giữ dữ liệu đang hiện, tải ngầm;
 * - `keepPrevious` và đang có dữ liệu → giữ snapshot cũ (render trả `pending`) tới khi lượt này xong.
 * Có kết quả đã nhớ của key này (`cached`) → hiện ngay kết quả đó trong lúc tải lại. Còn lại → loading của lượt mới.
 */
export function startSnapshot<T>(
  cur: Snapshot<T>,
  key: string,
  attempt: number,
  { background, keepPrevious, cached }: { background: boolean; keepPrevious: boolean; cached?: T },
): Snapshot<T> {
  if (cached !== undefined && !(cur.status === 'success' && cur.key === key)) return { status: 'success', data: cached, key, attempt };
  if (background || (keepPrevious && cur.status === 'success')) return cur;
  return { status: 'loading', key, attempt };
}

/** Lượt tải xong. Tải ngầm lỗi → giữ dữ liệu đang hiện thay vì thay cả màn bằng trang lỗi. */
export function settleSnapshot<T>(cur: Snapshot<T>, next: QueryState<T>, key: string, attempt: number, background: boolean): Snapshot<T> {
  if (background && next.status === 'error' && cur.status === 'success') return cur;
  return { ...next, key, attempt };
}

/**
 * Trạng thái trả cho render. Snapshot của key / lượt khác (effect chưa chạy, hoặc đang tải key mới) → kết quả đã nhớ của
 * key mới (nếu có), không thì loading, hoặc dữ liệu cũ kèm `pending` khi `keepPrevious` – không bao giờ trả lỗi / dữ liệu
 * của key cũ như thể của key mới.
 */
export function viewOf<T>(snap: Snapshot<T>, key: string, attempt: number, keepPrevious: boolean, cached?: T): QueryState<T> & { pending: boolean } {
  const { key: _k, attempt: _a, ...state } = snap;
  const current = state as QueryState<T>;
  if (snap.key === key && snap.attempt === attempt) return { ...current, pending: false };
  if (cached !== undefined) return { status: 'success', data: cached, pending: true };
  return keepPrevious && current.status === 'success' ? { ...current, pending: true } : { status: 'loading', pending: true };
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
