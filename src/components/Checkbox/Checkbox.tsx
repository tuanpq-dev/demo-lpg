import { useEffect, useRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'checked'> & {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Trạng thái "chọn một phần" (header bảng khi chỉ vài hàng được chọn). */
  indeterminate?: boolean;
  /** aria-label (bắt buộc vì ô không có nhãn hiển thị). */
  label: string;
};

/**
 * Ô chọn 16px – nền surface-sunken, viền line, bo 2px (Figma 70:3036).
 * Trạng thái checked/indeterminate: Figma chưa có → nền info, dấu màu fg-inverse.
 */
export function Checkbox({ checked, onChange, indeterminate = false, label, className, disabled, ...rest }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const on = checked || indeterminate;
  return (
    <span className={cn('relative inline-flex size-4 shrink-0', className)}>
      <input
        ref={ref}
        type="checkbox"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className={cn(
          'peer size-4 cursor-pointer appearance-none rounded-xs border transition-colors',
          'disabled:cursor-not-allowed disabled:opacity-50',
          on ? 'border-info bg-info' : 'border-line bg-surface-sunken hover:border-accent/60',
        )}
        {...rest}
      />
      {on && (
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="pointer-events-none absolute inset-0 size-4 text-fg-inverse"
        >
          {indeterminate ? (
            <path d="M4 8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          ) : (
            <path d="M4 8.5l2.5 2.5L12 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
      )}
    </span>
  );
}
