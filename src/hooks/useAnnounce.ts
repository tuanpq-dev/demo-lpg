import { useEffect, useRef, useState } from 'react';
import { announce, subscribeAnnounce } from '@/lib/announce';

/** Nội dung đang hiển thị trong vùng live (xen ký tự vô hình để thông báo lặp lại vẫn được đọc). */
export function useAnnouncement(): string {
  const [text, setText] = useState('');
  useEffect(() => {
    let n = 0;
    return subscribeAnnounce((m) => setText(`${m}${'\u200B'.repeat(++n % 2)}`));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `message` thường là hàm inline – chỉ phản ứng theo `value`.
  }, [value]);
}
