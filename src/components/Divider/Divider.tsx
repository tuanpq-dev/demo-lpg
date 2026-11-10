import { cn } from '@/lib/cn';

export type DividerProps = {
  orientation?: 'horizontal' | 'vertical';
  /**
   * - default: line/30 (viền card, header, 53:442)
   * - subtle:  line/10 (đường kẻ hàng bảng)
   * - strong:  divider #737373 (Figma variable "Line", vạch dọc header 53:89)
   */
  tone?: 'default' | 'subtle' | 'strong';
  className?: string;
};

const toneClass = {
  default: 'bg-line/30',
  subtle: 'bg-line/10',
  strong: 'bg-line-divider',
} as const;

export function Divider({ orientation = 'horizontal', tone = 'default', className }: DividerProps) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn('shrink-0', orientation === 'horizontal' ? 'h-px w-full' : 'w-px self-stretch', toneClass[tone], className)}
    />
  );
}
