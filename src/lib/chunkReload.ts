/*
 * Lỗi tải chunk sau khi deploy bản mới: tab đang mở vẫn giữ index cũ, bấm sang trang khác thì trình duyệt xin file
 * `assets/<tên>-<hash cũ>.js` đã bị xoá → import() lỗi. Cách xử lý: tải lại trang MỘT lần để nhận bản mới.
 */

const KEY = 'demo-lpg:chunk-reload-at';
/** Không reload lại nếu lần trước mới cách đây chưa tới 30 s (tránh vòng lặp khi máy chủ lỗi thật). */
const MIN_INTERVAL_MS = 30_000;

/** Thông điệp lỗi import() động / preload của Chrome, Firefox, Safari. */
const CHUNK_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /Unable to preload CSS/i,
  /ChunkLoadError/i,
];

export function isChunkLoadError(err: unknown): boolean {
  const text = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return CHUNK_ERROR_PATTERNS.some((p) => p.test(text));
}

/** Tải lại trang để nhận bản mới. true = đã gọi reload; false = vừa reload gần đây (hoặc không đọc được sessionStorage). */
export function reloadForNewVersion(now: number = Date.now()): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY));
    if (last && now - last < MIN_INTERVAL_MS) return false;
    sessionStorage.setItem(KEY, String(now));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
