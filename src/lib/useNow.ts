import { useEffect, useState } from 'react';
import { appNow } from './demoNow';

/** Thời điểm hiện tại (`appNow` – có thể dời bằng `?now=` ở dev/demo), cập nhật mỗi `intervalMs`. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(appNow);
  useEffect(() => {
    const id = window.setInterval(() => setNow(appNow()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Định dạng theo Figma 53:136: "01/06/2026 ; 08:24:00". */
export function formatDateTime(d: Date) {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ; ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
