/**
 * Logic phiên đăng nhập phía FE – thuần (thời gian qua tham số), có test.
 * Quyền thật kiểm tra ở backend; FE chỉ dùng để ẩn/hiện (UX).
 */

/** Refresh trước khi access token hết hạn `leadMs` (mặc định 60 s), tối thiểu sau 5 s (tránh vòng lặp khi TTL rất ngắn). */
export function refreshDelayMs(expiresAt: number, now: number, leadMs = 60_000): number {
  return Math.max(5_000, expiresAt - now - leadMs);
}

/**
 * Thời điểm hết hạn (ms epoch) đọc từ claim `exp` của JWT – CHỈ để hẹn refresh sớm, không xác thực chữ ký.
 * Không phải JWT / không có exp → null (khi đó chỉ refresh lúc gặp 401).
 */
export function tokenExpiresAt(token: string): number | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const json = atob(
      part
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(Math.ceil(part.length / 4) * 4, '='),
    );
    const exp = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : null;
  } catch {
    return null;
  }
}

const DEFAULT_AFTER_LOGIN = '/overview';

/**
 * Trang quay về sau đăng nhập (`?next=`). Chỉ nhận đường dẫn nội bộ ("/…"), chặn chuyển hướng mở
 * ("//evil.com", "/\\evil.com", "https://…", "javascript:") và vòng lặp về /login.
 */
export function safeRedirect(target: string | null | undefined, fallback = DEFAULT_AFTER_LOGIN): string {
  if (!target || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) return fallback;
  // Ký tự điều khiển (xuống dòng, tab…) – trình duyệt có thể bỏ qua → "/\t/evil.com" thành "//evil.com".
  if ([...target].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f)) return fallback;
  const path = target.split(/[?#]/)[0] ?? target;
  if (['/login', '/register', '/pending'].some((p) => path === p || path.startsWith(`${p}/`))) return fallback;
  return target;
}

/** URL trang đăng nhập nhớ trang định vào. */
export function loginUrl(location: { pathname: string; search?: string; hash?: string }): string {
  const target = `${location.pathname}${location.search ?? ''}${location.hash ?? ''}`;
  const next = safeRedirect(target, '');
  return next && next !== DEFAULT_AFTER_LOGIN ? `/login?next=${encodeURIComponent(next)}` : '/login';
}
