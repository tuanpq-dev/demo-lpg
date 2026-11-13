import { useEffect, useState } from 'react';
import { appNow } from '@/lib/demoNow';

/** Thời điểm hiện tại (`appNow` – có thể dời bằng `?now=` ở dev/demo), cập nhật mỗi `intervalMs`. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(appNow);
  useEffect(() => {
    const id = window.setInterval(() => setNow(appNow()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
