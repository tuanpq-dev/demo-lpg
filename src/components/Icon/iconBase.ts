import type { SVGProps } from 'react';

export type TempIconProps = SVGProps<SVGSVGElement> & { size?: number };
/** Thuộc tính chung của icon tạm (24×24, nét 1.6, currentColor, aria-hidden). */
export const tempIconBase = (size: number, props: SVGProps<SVGSVGElement>) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...props,
});
