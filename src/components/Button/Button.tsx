import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'danger' | 'info' | 'ghost' | 'outline' | 'outline-warning' | 'subtle' | 'plain' | 'icon' | 'toolbar' | 'overlay' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /**
   * - primary: nền primary, chữ tối (70:4041 "Tạo yêu cầu bảo trì")
   * - danger:  nền đặc `danger-solid` + chữ trắng đậm (drawer cảnh báo "Xác nhận cảnh báo"; ảnh nền #D34957 – đổi sang
   *            danger-solid cho chữ trắng đủ tương phản, docs/figma-diffs.md). KHÔNG dùng nền danger nhạt + chữ trắng.
   * - info:    nền `info` #87CFFF chữ tối đậm – "Cập nhật xử lý" ở drawer cảnh báo gas (ảnh: xanh nhạt; token có sẵn trùng màu)
   * - ghost:   nền surface, viền accent/30 (70:4038 "Hôm nay", 70:5211 "Xuất báo cáo")
   * - icon:    nút vuông chỉ có icon (70:4045 làm mới). `pressed` → nền accent/40 (70:2890)
   * - toolbar: nút icon trong thanh lọc, nền surface-muted, viền line, bo 6px, cao 34px (70:3028)
   * - overlay: nút icon vuông 32px nổi trên bản đồ, nền surface-raised/90, viền line/30 (53:310)
   * - outline: viền + chữ primary, nền trong (ảnh MT-00128: "Tiếp nhận ngay", "Phân công người xử lý")
   * - outline-warning: viền + chữ vàng (ảnh AI mô phỏng sự cố: "Cấu hình trước khi chạy" – kịch bản thiếu mapping)
   * - subtle:  nền chip xám, chữ fg, không viền màu (ảnh MT-00128: "Hủy yêu cầu", "Thêm ghi chú")
   * - plain:   chỉ chữ phụ, không nền/viền (modal "Cập nhật tiến độ bảo trì": "Hủy" ở chân modal)
   * - link:    chữ accent, không nền (53:468 "Xem tất cả", "Chi tiết")
   */
  variant?: ButtonVariant;
  /** md = 36px (Figma). sm = 28px (nút trong toolbar/bản đồ). lg = 44px chữ 16px (nút chính chân drawer cảnh báo). */
  size?: ButtonSize;
  /** Icon trước label. Với variant="icon" đây là nội dung duy nhất. */
  icon?: ReactNode;
  /** Trạng thái bật cho variant="icon" (toggle). */
  pressed?: boolean;
};

const base =
  'inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-colors ' +
  'disabled:pointer-events-none disabled:opacity-50 ' +
  // aria-disabled: trông như khoá nhưng VẪN nhận focus → trình đọc đọc được lý do (aria-describedby); click bị chặn bên dưới.
  'aria-disabled:cursor-not-allowed aria-disabled:opacity-50';

const variantClass: Record<ButtonVariant, string> = {
  primary: 'rounded-lg bg-primary font-semibold text-fg-inverse backdrop-blur-[4px] hover:bg-primary/90',
  danger: 'rounded-lg bg-danger-solid font-semibold text-fg hover:bg-danger-solid/90',
  info: 'rounded-lg bg-info font-semibold text-fg-inverse hover:bg-info/90',
  ghost:
    'rounded-lg border border-accent/30 bg-surface font-semibold text-fg backdrop-blur-[4px] hover:border-accent/60 hover:bg-surface-raised',
  outline: 'rounded-md border border-primary/80 bg-transparent font-semibold text-primary hover:bg-primary/10',
  'outline-warning': 'rounded-md border border-warning/80 bg-transparent font-semibold text-warning hover:bg-warning/10',
  subtle: 'rounded-md border border-line/30 bg-surface-chip/70 text-fg hover:bg-surface-chip',
  plain: 'rounded-md text-fg-secondary hover:bg-surface-muted/60 hover:text-fg',
  icon: 'rounded-lg border border-accent/30 text-fg backdrop-blur-[4px] hover:border-accent/60',
  toolbar: 'rounded-md border border-line bg-surface-muted text-fg hover:border-accent/60',
  overlay: 'rounded-lg border border-line/30 bg-surface-raised/90 text-fg shadow-card backdrop-blur-[4px] hover:border-accent/60',
  link: 'text-accent hover:underline',
};

const sizeClass: Record<Exclude<ButtonVariant, 'link'>, Record<ButtonSize, string>> = {
  primary: { md: 'h-9 gap-2 px-4 text-base', sm: 'h-7 gap-1.5 px-3 text-sm', lg: 'h-11 gap-2 px-5 text-md' },
  danger: { md: 'h-9 gap-2 px-4 text-base', sm: 'h-7 gap-1.5 px-3 text-sm', lg: 'h-11 gap-2 px-5 text-md' },
  info: { md: 'h-9 gap-2 px-4 text-base', sm: 'h-7 gap-1.5 px-3 text-sm', lg: 'h-11 gap-2 px-5 text-md' },
  ghost: { md: 'h-9 gap-2 px-4 text-base', sm: 'h-7 gap-1.5 px-3 text-sm', lg: 'h-11 gap-2 px-5 text-md' },
  outline: { md: 'h-9 gap-2 px-4 text-base', sm: 'h-7 gap-1.5 px-3 text-sm', lg: 'h-11 gap-2 px-5 text-md' },
  'outline-warning': { md: 'h-9 gap-2 px-4 text-base', sm: 'h-7 gap-1.5 px-3 text-sm', lg: 'h-11 gap-2 px-5 text-md' },
  subtle: { md: 'h-9 gap-2 px-4 text-base', sm: 'h-7 gap-1.5 px-3 text-xs', lg: 'h-11 gap-2 px-5 text-md' },
  plain: { md: 'h-9 gap-2 px-4 text-base', sm: 'h-7 gap-1.5 px-3 text-sm', lg: 'h-11 gap-2 px-5 text-md' },
  // Figma 70:4045: 46×36 = padding 17 (16 + border) + icon 12
  icon: { md: 'h-9 px-4', sm: 'h-7 px-2.5', lg: 'h-11 px-5' },
  toolbar: { md: 'h-[34px] px-[9px]', sm: 'h-7 px-1.5', lg: 'h-11 px-3' },
  overlay: { md: 'size-8', sm: 'size-7', lg: 'size-11' },
};

const linkSize: Record<ButtonSize, string> = { lg: 'text-base', md: 'text-sm', sm: 'text-2xs' };

/**
 * Class của nút theo variant/size – cho phần tử KHÔNG phải <button> cần trông như nút (vd `<Link>` "Xem MT-00129" ở chân
 * drawer cảnh báo, thay chỗ nút "Tạo yêu cầu bảo trì").
 */
export const buttonClass = (variant: Exclude<ButtonVariant, 'icon' | 'toolbar' | 'overlay'> = 'ghost', size: ButtonSize = 'md') =>
  cn(base, variantClass[variant], variant === 'link' ? linkSize[size] : sizeClass[variant][size]);

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'ghost', size = 'md', icon, pressed, className, children, type = 'button', onClick, ...rest },
  ref,
) {
  const isIcon = variant === 'icon' || variant === 'toolbar' || variant === 'overlay';
  // aria-disabled: vẫn focus được (đọc được lý do qua aria-describedby) nhưng KHÔNG hành động. Enter/Space trên nút và
  // gửi form ngầm (Enter trong ô nhập → "click" nút submit mặc định) đều đi qua sự kiện click → chặn tại đây
  // (preventDefault = không submit form, không gọi onClick).
  const inert = rest['aria-disabled'] === true || rest['aria-disabled'] === 'true';
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
      onClick={(e) => {
        if (inert) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onClick?.(e);
      }}
    >
      {icon}
      {!isIcon && children}
    </button>
  );
});
