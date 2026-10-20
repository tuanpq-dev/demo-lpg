import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'ghost' | 'icon' | 'toolbar' | 'overlay' | 'link';
export type ButtonSize = 'sm' | 'md';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /**
   * - primary: nền primary, chữ tối (70:4041 "Tạo yêu cầu bảo trì")
   * - ghost:   nền surface, viền accent/30 (70:4038 "Hôm nay", 70:5211 "Xuất báo cáo")
   * - icon:    nút vuông chỉ có icon (70:4045 làm mới). `pressed` → nền accent/40 (70:2890)
   * - toolbar: nút icon trong thanh lọc, nền surface-muted, viền line, bo 6px, cao 34px (70:3028)
   * - overlay: nút icon vuông 32px nổi trên bản đồ, nền surface-raised/90, viền line/30 (53:310)
   * - link:    chữ accent, không nền (53:468 "Xem tất cả", "Chi tiết")
   */
  variant?: ButtonVariant;
  /** md = 36px (Figma). sm = 28px (nút trong toolbar/bản đồ). */
  size?: ButtonSize;
  /** Icon trước label. Với variant="icon" đây là nội dung duy nhất. */
  icon?: ReactNode;
  /** Trạng thái bật cho variant="icon" (toggle). */
  pressed?: boolean;
};

const base =
  'inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-colors ' +
  'disabled:pointer-events-none disabled:opacity-50';

const variantClass: Record<ButtonVariant, string> = {
  primary: 'rounded-lg bg-primary font-semibold text-fg-inverse backdrop-blur-[4px] hover:bg-primary/90',
  ghost:
    'rounded-lg border border-accent/30 bg-surface font-semibold text-fg backdrop-blur-[4px] hover:border-accent/60 hover:bg-surface-raised',
  icon: 'rounded-lg border border-accent/30 text-fg backdrop-blur-[4px] hover:border-accent/60',
  toolbar: 'rounded-md border border-line bg-surface-muted text-fg hover:border-accent/60',
  overlay: 'rounded-lg border border-line/30 bg-surface-raised/90 text-fg shadow-card backdrop-blur-[4px] hover:border-accent/60',
  link: 'text-accent hover:underline',
};

const sizeClass: Record<Exclude<ButtonVariant, 'link'>, Record<ButtonSize, string>> = {
  primary: { md: 'h-9 gap-2 px-4 text-base', sm: 'h-7 gap-1.5 px-3 text-sm' },
  ghost: { md: 'h-9 gap-2 px-4 text-base', sm: 'h-7 gap-1.5 px-3 text-sm' },
  // Figma 70:4045: 46×36 = padding 17 (16 + border) + icon 12
  icon: { md: 'h-9 px-4', sm: 'h-7 px-2.5' },
  toolbar: { md: 'h-[34px] px-[9px]', sm: 'h-7 px-1.5' },
  overlay: { md: 'size-8', sm: 'size-7' },
};

const linkSize: Record<ButtonSize, string> = { md: 'text-sm', sm: 'text-2xs' };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'ghost', size = 'md', icon, pressed, className, children, type = 'button', ...rest },
  ref,
) {
  const isIcon = variant === 'icon' || variant === 'toolbar' || variant === 'overlay';
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={isIcon && pressed !== undefined ? pressed : undefined}
      className={cn(
        base,
        variantClass[variant],
        variant === 'link' ? linkSize[size] : sizeClass[variant][size],
        variant === 'icon' && (pressed ? 'bg-accent/40' : 'bg-bg-app'),
        (variant === 'toolbar' || variant === 'overlay') && pressed && 'border-accent/60',
        className,
      )}
      {...rest}
    >
      {icon}
      {!isIcon && children}
    </button>
  );
});
