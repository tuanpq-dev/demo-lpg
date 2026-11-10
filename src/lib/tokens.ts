import { useEffect, useState } from 'react';

/**
 * Tên token màu (khớp `--color-<name>` trong src/styles/tokens.css).
 * Dùng cho nơi không dùng được class Tailwind – ví dụ thuộc tính SVG của recharts (stroke, fill).
 */
export type ColorToken =
  | 'bg-app'
  | 'surface'
  | 'surface-raised'
  | 'surface-sunken'
  | 'surface-muted'
  | 'line'
  | 'text-primary'
  | 'text-secondary'
  | 'text-muted'
  | 'bg-header'
  | 'primary'
  | 'accent'
  | 'info'
  | 'success'
  | 'live'
  | 'warning'
  | 'warning-soft'
  | 'danger'
  | 'danger-text'
  | 'danger-solid'
  | 'danger-strong'
  | 'neutral'
  | 'bg-canvas'
  | 'scene-ground'
  | 'scene-grid'
  | 'scene-asset'
  | 'scene-flow';

/** Giá trị hex "#RRGGBB" của token màu (đọc biến CSS `--color-<name>`, kể cả alias var()). Chỉ gọi phía client. */
export function tokenHex(name: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim();
  const rgb = raw.split(/\s+/).map(Number);
  if (rgb.length !== 3 || rgb.some((v) => !Number.isFinite(v))) return raw || '—';
  return (
    '#' +
    rgb
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/** Đọc token → chuỗi màu CSS "rgb(r g b / a)". Chỉ gọi phía client. */
export function tokenColor(name: ColorToken, alpha = 1): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim();
  return alpha === 1 ? `rgb(${raw})` : `rgb(${raw} / ${alpha})`;
}

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
