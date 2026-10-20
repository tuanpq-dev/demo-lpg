import { forwardRef, useRef, type InputHTMLAttributes, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from '../Icon';

export type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'size'> & {
  value: string;
  onChange: (value: string) => void;
  /** Gọi khi bấm nút xoá hoặc Esc; mặc định chỉ gọi onChange(''). */
  onClear?: () => void;
  /** aria-label; mặc định lấy placeholder. */
  label?: string;
};

/**
 * Ô tìm kiếm – kính lúp bên trái, nút xoá bên phải khi có nội dung (Figma 70:3016).
 * Esc: xoá nội dung (nếu đang có), giữ focus trong ô.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { value, onChange, onClear, label, placeholder = 'Tìm kiếm…', className, onKeyDown, ...rest },
  ref,
) {
  const innerRef = useRef<HTMLInputElement | null>(null);

  const clear = () => {
    onChange('');
    onClear?.();
    innerRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && value) {
      e.preventDefault();
      e.stopPropagation();
      clear();
    }
    onKeyDown?.(e);
  };

  return (
    <div className={cn('relative flex min-w-[200px] items-center', className)}>
      {/* Figma: icon 13.5px đặt cách trái 8px → khung 18 lùi 2.25px */}
      <Icon name="search" box={18} className="pointer-events-none absolute left-[5.75px]" />
      <input
        ref={(el) => {
          innerRef.current = el;
          if (typeof ref === 'function') ref(el);
          else if (ref) ref.current = el;
        }}
        type="search"
        role="searchbox"
        aria-label={label ?? placeholder}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className={cn(
          'h-[35px] w-full rounded-lg border border-line bg-surface-sunken pl-[33px] text-base text-fg',
          'placeholder:text-fg-secondary/50 focus-visible:border-accent/60 focus-visible:outline-none',
          '[&::-webkit-search-cancel-button]:appearance-none',
          value ? 'pr-9' : 'pr-[13px]',
        )}
        {...rest}
      />
      {value && (
        <button
          type="button"
          aria-label="Xoá nội dung tìm kiếm"
          onClick={clear}
          className="absolute right-2 inline-flex size-5 items-center justify-center rounded-sm text-fg-secondary hover:bg-surface-muted hover:text-fg"
        >
          {/* Figma không có icon xoá – dùng dấu × tối giản theo màu chữ (currentColor). */}
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
});
