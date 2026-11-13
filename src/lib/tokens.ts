/**
 * Tên token màu (khớp `--color-<name>` trong src/styles/tokens.css).
 * Dùng cho nơi không dùng được class Tailwind – ví dụ thuộc tính SVG của chart (stroke, fill).
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

/** Đọc token → chuỗi màu CSS "rgb(r g b / a)". Chỉ gọi phía client. */
export function tokenColor(name: ColorToken, alpha = 1): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim();
  return alpha === 1 ? `rgb(${raw})` : `rgb(${raw} / ${alpha})`;
}
