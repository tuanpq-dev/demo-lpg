import { useEffect, useRef, useState } from 'react';

/*
 * Thông báo cho trình đọc màn hình (aria-live="polite") – một vùng dùng chung toàn app (`LiveAnnouncer` trong
 * src/app/LiveAnnouncer.tsx). Gọi `announce('…')` từ bất kỳ đâu; cùng nội dung gọi lại vẫn được đọc lại.
 */

type Listener = (message: string) => void;
const listeners = new Set<Listener>();

export function announce(message: string) {
  if (!message) return;
  listeners.forEach((l) => l(message));
}

/** Nội dung đang hiển thị trong vùng live (xen ký tự vô hình để thông báo lặp lại vẫn được đọc). */
export function useAnnouncement(): string {
  const [text, setText] = useState('');
  useEffect(() => {
    let n = 0;
    const l: Listener = (m) => setText(`${m}${'\u200B'.repeat(++n % 2)}`);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return text;
}

/** Gọi `announce(message(value, prev))` mỗi khi `value` đổi (bỏ lần đầu). Chuỗi rỗng = không báo. */
export function useAnnounceChange<T>(value: T, message: (value: T, prev: T) => string) {
  const prev = useRef(value);
  useEffect(() => {
    if (Object.is(prev.current, value)) return;
    const before = prev.current;
    prev.current = value;
    announce(message(value, before));
    // `message` thường là hàm inline – chỉ phản ứng theo `value`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
}
