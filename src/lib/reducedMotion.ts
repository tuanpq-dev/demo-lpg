import { useSyncExternalStore } from 'react';

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

function subscribe(cb: () => void) {
  const m = media();
  if (!m) return () => {};
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
}

/** Hook: true khi người dùng muốn giảm chuyển động; tự cập nhật khi đổi cài đặt hệ thống. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}
