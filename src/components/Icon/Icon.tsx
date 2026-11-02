import { icons, type IconName } from '@/assets/digital-twin';
import { cn } from '@/lib/cn';

export type IconProps = {
  name: IconName;
  /** Kích thước khung (px). Icon giữ kích thước gốc của SVG và được căn giữa trong khung. */
  box?: 9 | 12 | 14 | 16 | 18 | 20 | 24;
  className?: string;
  /** Nhãn cho trình đọc màn hình; bỏ trống = icon trang trí. */
  label?: string;
};

const boxClass = { 9: 'size-[9px]', 12: 'size-3', 14: 'size-3.5', 16: 'size-4', 18: 'size-[18px]', 20: 'size-5', 24: 'size-6' } as const;

export function Icon({ name, box = 18, className, label }: IconProps) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center', boxClass[box], className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <img src={icons[name]} alt="" className="block max-w-none" draggable={false} />
    </span>
  );
}
