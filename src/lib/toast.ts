import { announce } from './announce';

/*
 * Thông báo nổi (toast) tối thiểu dùng chung toàn app – khối nhìn thấy cho các thao tác không có chỗ hiện kết quả riêng
 * (tick checklist, thêm ghi chú, xác nhận cảnh báo từ drawer…). Trình đọc màn hình nhận cùng câu qua `announce()`
 * (vùng aria-live polite DUY NHẤT của `LiveAnnouncer`) – khung toast không phải vùng live thứ hai (tránh đọc 2 lần).
 * Hiển thị: `ToastList` (components/Toast) gắn ở `app/Page.tsx` qua `ToastHost`.
 */

export type ToastTone = 'info' | 'success' | 'error';
export type ToastItem = { id: number; text: string; tone: ToastTone };

/** Thời gian tự tắt – lỗi giữ lâu hơn để kịp đọc. */
const TOAST_DURATION_MS: Readonly<Record<ToastTone, number>> = { info: 5000, success: 5000, error: 8000 };
/** Tối đa hiện cùng lúc; thêm mới thì bỏ cái cũ nhất. */
const MAX_TOASTS = 3;

let items: readonly ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function emit(next: readonly ToastItem[]) {
  items = next;
  listeners.forEach((l) => l());
}

function clearTimer(id: number) {
  const t = timers.get(id);
  if (t !== undefined) clearTimeout(t);
  timers.delete(id);
}

/** Hiện toast + đọc qua `announce`. Cùng câu cùng loại đang hiện → thay bằng bản mới (đặt lại giờ tắt), không chồng. */
function showToast(text: string, tone: ToastTone = 'info'): number {
  if (!text) return 0;
  announce(text);
  const id = nextId++;
  const same = items.filter((t) => t.text === text && t.tone === tone);
  same.forEach((t) => clearTimer(t.id));
  const next = [...items.filter((t) => !same.includes(t)), { id, text, tone }];
  next.slice(0, Math.max(0, next.length - MAX_TOASTS)).forEach((t) => clearTimer(t.id));
  emit(next.slice(-MAX_TOASTS));
  timers.set(
    id,
    setTimeout(() => dismissToast(id), TOAST_DURATION_MS[tone]),
  );
  return id;
}

export function dismissToast(id: number) {
  clearTimer(id);
  if (items.some((t) => t.id === id)) emit(items.filter((t) => t.id !== id));
}

/** Toast lỗi (dùng làm `onError` của `runAction`). */
export const toastError = (text: string) => {
  showToast(text, 'error');
};

/** Đăng ký nghe đổi danh sách toast (cho `useToasts`); trả hàm huỷ. */
export const subscribeToasts = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
/** Danh sách toast đang hiện (ảnh chụp bất biến). */
export const readToasts = () => items;
