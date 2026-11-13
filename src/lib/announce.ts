/*
 * Thông báo cho trình đọc màn hình (aria-live="polite") – một vùng dùng chung toàn app (`LiveAnnouncer` trong
 * src/app/LiveAnnouncer.tsx). Gọi `announce('…')` từ bất kỳ đâu; cùng nội dung gọi lại vẫn được đọc lại.
 */

export type AnnounceListener = (message: string) => void;
const listeners = new Set<AnnounceListener>();

export function announce(message: string) {
  if (!message) return;
  listeners.forEach((l) => l(message));
}

/** Đăng ký nhận thông báo (vùng live `LiveAnnouncer`); trả hàm huỷ. */
export function subscribeAnnounce(listener: AnnounceListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
