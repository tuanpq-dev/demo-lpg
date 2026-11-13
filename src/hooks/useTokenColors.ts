import { useEffect, useState } from 'react';
import { tokenColor } from '@/lib/tokens';

/**
 * Hook trả về hàm `c(name, alpha?)` đọc màu token cho chart.
 * Đọc lại khi `data-theme` trên <html> đổi, để chart theo theme.
 */
export function useTokenColors() {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const obs = new MutationObserver(() => setVersion((v) => v + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => obs.disconnect();
  }, []);

  // `version` chỉ để buộc component render lại khi theme đổi.
  void version;
  return tokenColor;
}
