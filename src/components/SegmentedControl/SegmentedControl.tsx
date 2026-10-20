import { cn } from '@/lib/cn';
import { useRovingFocus } from '@/lib/useRovingFocus';

export type SegmentedTone = 'neutral' | 'danger' | 'warning' | 'info';

export type SegmentedOption = {
  id: string;
  label: string;
  disabled?: boolean;
  /** Màu khi được chọn (variant="field"): danger cho "Nghiêm trọng", warning cho "Cao"… */
  tone?: SegmentedTone;
};

export type SegmentedControlProps = {
  options: readonly SegmentedOption[];
  value: string;
  onChange: (id: string) => void;
  /** aria-label của nhóm. */
  label: string;
  /**
   * - overlay: nổi trên bản đồ, rộng theo nội dung (53:302)
   * - field:   trong form – rộng 100%, cao 35px, các nút chia đều, viền line, chọn thì tô theo `tone`
   */
  variant?: 'overlay' | 'field';
  /** Chỉ cho overlay: sm = nhóm nhỏ (toggle 2.5D/3D góc bản đồ), md = 53:302. */
  size?: 'sm' | 'md';
  /** id + aria-labelledby khi dùng trong FormField. */
  id?: string;
  labelledBy?: string;
  className?: string;
};

const fieldTone: Record<SegmentedTone, string> = {
  neutral: 'bg-surface-muted text-fg',
  danger: 'bg-danger text-fg',
  warning: 'bg-warning text-fg-inverse',
  info: 'bg-info text-fg-inverse',
};

/**
 * Nhóm nút chọn 1 – "Toàn cảnh / Bồn chứa / Bơm & Lọc" (Figma 53:302).
 * Ngữ nghĩa radiogroup; ←/→/Home/End vừa di chuyển vừa chọn.
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  label,
  variant = 'overlay',
  size = 'md',
  id,
  labelledBy,
  className,
}: SegmentedControlProps) {
  const field = variant === 'field';
  const { setRef, onKeyDown, getTabIndex } = useRovingFocus({ items: options, value, onChange });

  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      className={cn(
        field
          ? 'flex h-[35px] w-full overflow-hidden rounded-lg border border-line bg-surface-sunken'
          : cn(
              'inline-flex w-fit items-start gap-1 rounded-lg border border-line/30 bg-surface-raised/90 shadow-card backdrop-blur-[4px]',
              size === 'sm' ? 'p-[3px]' : 'p-[5px]',
            ),
        className,
      )}
    >
      {options.map((opt) => {
        const selected = opt.id === value;
        return (
          <button
            key={opt.id}
            ref={setRef(opt.id)}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={opt.disabled}
            tabIndex={getTabIndex(opt.id)}
            onClick={() => onChange(opt.id)}
            onKeyDown={(e) => onKeyDown(e, opt.id)}
            className={cn(
              'whitespace-nowrap transition-colors disabled:opacity-50',
              !field && size === 'sm' ? 'text-sm' : 'text-base',
              field
                ? cn(
                    'flex-1 border-l border-line px-2 first:border-l-0',
                    selected ? cn(fieldTone[opt.tone ?? 'neutral'], 'font-semibold') : 'text-fg-muted hover:bg-surface-muted/40 hover:text-fg',
                  )
                : cn('rounded-md', size === 'sm' ? 'px-2 py-0.5' : 'px-3 py-1', selected ? 'bg-surface-muted text-fg' : 'text-fg-muted hover:text-fg'),
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
