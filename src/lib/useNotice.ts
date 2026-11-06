import { useCallback, useEffect, useState } from 'react';

/** Thông báo ngắn trong trang (vùng `role="status"` của trang) – tự xoá sau `ms` (mặc định 4 giây). */
export function useNotice(ms = 4000) {
  const [notice, setNotice] = useState('');
  const flash = useCallback((msg: string) => setNotice(msg), []);
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(''), ms);
    return () => window.clearTimeout(t);
  }, [notice, ms]);
  return { notice, flash };
}
