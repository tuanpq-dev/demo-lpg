import { useEffect, useState } from 'react';

/** Giá trị trễ `ms` sau lần đổi cuối (ô tìm kiếm → chỉ gửi truy vấn khi ngừng gõ). Giá trị đầu dùng ngay. */
export function useDebouncedValue<T>(value: T, ms: number): T {
  const [out, setOut] = useState(value);
  useEffect(() => {
    if (Object.is(value, out)) return;
    const t = window.setTimeout(() => setOut(value), ms);
    return () => window.clearTimeout(t);
  }, [value, out, ms]);
  return out;
}
