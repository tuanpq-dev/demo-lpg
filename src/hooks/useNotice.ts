import { useCallback, useEffect, useState } from 'react';
import { announce } from '@/lib/announce';

/** Nội dung dòng thông báo; `error` = thông báo lỗi (chữ đỏ). `text` rỗng = không có thông báo. */
export type Notice = { text: string; error?: boolean };

/**
 * Dòng thông báo kết quả thao tác trong trang (vùng `role="status"` của trang – thao tác hàng loạt, thanh trạng thái
 * Editor…), tự xoá sau `ms` (mặc định 4 giây). Gọi lại – kể cả cùng câu – đặt lại giờ tắt.
 * `show` = thông báo thường; `fail` = thông báo lỗi và đọc cho trình đọc màn hình ngay qua `announce`.
 */
export function useNotice(ms = 4000) {
  const [notice, setNotice] = useState<Notice>({ text: '' });
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
