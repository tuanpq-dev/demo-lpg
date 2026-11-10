import { useCallback, useEffect, useState } from 'react';
import { announce } from './announce';

export type TimedNotice = { text: string; error?: boolean };

/**
 * Dòng thông báo kết quả thao tác (vd thao tác hàng loạt) tự ẩn sau `ms`. `fail` = thông báo lỗi (chữ đỏ) và đọc cho
 * trình đọc màn hình ngay.
 */
export function useTimedNotice(ms = 4000) {
  const [notice, setNotice] = useState<TimedNotice>({ text: '' });
  useEffect(() => {
    if (!notice.text) return;
    const t = window.setTimeout(() => setNotice({ text: '' }), ms);
    return () => window.clearTimeout(t);
  }, [notice, ms]);
  const show = useCallback((text: string) => setNotice({ text }), []);
  const fail = useCallback((text: string) => {
    setNotice({ text, error: true });
    announce(text);
  }, []);
  return { notice, show, fail };
}
