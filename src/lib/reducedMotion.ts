/*
 * prefers-reduced-motion: người dùng bật "giảm chuyển động" trong hệ điều hành → tắt pulse, vệt chảy trong ống,
 * camera bay (nhảy thẳng tới khung), animation CSS (global.css). Dùng một nguồn cho cả app.
 */

const QUERY = '(prefers-reduced-motion: reduce)';

const media = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(QUERY) : null);

/** Giá trị hiện tại (ngoài React, vd trong vòng lặp three). */
export function prefersReducedMotion(): boolean {
  return media()?.matches ?? false;
}

/** Đăng ký nghe đổi cài đặt (cho `useReducedMotion`); trả hàm huỷ. */
export function subscribeReducedMotion(cb: () => void) {
  const m = media();
  if (!m) return () => {};
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
}
