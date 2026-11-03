import { useEffect, useRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'checked'> & {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Trạng thái "chọn một phần" (header bảng khi chỉ vài hàng được chọn). */
  indeterminate?: boolean;
  /** aria-label (bắt buộc vì ô không có nhãn hiển thị) – hoặc nhãn hiển thị khi `showLabel`. */
  label: string;
  /** Hiện `label` bên phải ô (bọc <label>, bấm chữ cũng chọn) – dùng trong form/bảng thuộc tính. */
  showLabel?: boolean;
  /**
   * card = ô có viền cả dòng, nhãn 14px; được chọn → viền + nền nhạt primary ("Kết quả xác minh" – modal cập nhật xử lý
   * áp suất). Khoá dùng `aria-disabled` (vẫn focus, đọc lý do qua aria-describedby) – onChange không được gọi.
   * list = nhãn 14px chữ chính, cách ô 10px – danh sách chọn trong form ("Khu vực ảnh hưởng" màn cấu hình kịch bản).
   *        Luôn hiện nhãn (không cần `showLabel`).
   */
  variant?: 'default' | 'card' | 'list';
};

const isTrue = (v: unknown) => v === true || v === 'true';

/**
 * Ô chọn 16px – nền surface-sunken, viền line, bo 2px (Figma 70:3036).
 * Trạng thái checked/indeterminate: Figma chưa có → nền info, dấu màu fg-inverse.
 */
export function Checkbox({ showLabel, variant = 'default', ...props }: CheckboxProps) {
  if (variant === 'card') {
    const { label, className, checked, onChange, ...rest } = props;
    const locked = rest['aria-disabled'] === true || rest['aria-disabled'] === 'true';
    return (
      <label
        className={cn(
          'flex min-h-10 items-center gap-3 rounded-md border px-4 py-2 text-base transition-colors',
          checked ? 'border-primary bg-primary/10 text-fg' : 'border-line/30 bg-surface-sunken/30 text-fg',
          locked ? 'cursor-not-allowed' : 'cursor-pointer hover:border-line',
          className,
        )}
      >
        <CheckboxBox
          {...rest}
          label={label}
          aria-label={undefined}
          checked={checked}
          // Khoá: trả ô về giá trị cũ, không gọi onChange (aria-disabled không chặn click như `disabled`).
          onChange={(v) => (locked ? undefined : onChange(v))}
        />
        <span className={cn(locked && 'text-fg-secondary')}>{label}</span>
      </label>
    );
  }
  if (!showLabel && variant !== 'list') return <CheckboxBox {...props} />;
  const { label, className, disabled } = props;
  // Khoá mà vẫn focus/đọc được: aria-disabled (lý do qua aria-describedby) hoặc aria-readonly (giá trị do hệ thống quyết định).
  const locked = isTrue(props['aria-disabled']) || isTrue(props['aria-readonly']);
  return (
    <label
      className={cn(
        variant === 'list' ? 'inline-flex items-center gap-2.5 text-base text-fg' : 'inline-flex items-center gap-2 text-sm text-fg-secondary',
        disabled ? 'cursor-not-allowed opacity-50' : locked ? 'cursor-default' : 'cursor-pointer',
        className,
      )}
    >
      <CheckboxBox {...props} className={undefined} aria-label={undefined} />
      <span>{label}</span>
    </label>
  );
}

function CheckboxBox({ checked, onChange, indeterminate = false, label, className, disabled, ...rest }: Omit<CheckboxProps, 'showLabel'>) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const on = checked || indeterminate;
  const locked = isTrue(rest['aria-disabled']) || isTrue(rest['aria-readonly']);
  return (
    <span className={cn('relative inline-flex size-4 shrink-0', className)}>
      <input
        ref={ref}
        type="checkbox"
        aria-label={'aria-label' in rest ? rest['aria-label'] : label}
        checked={checked}
        disabled={disabled}
        // Khoá bằng aria-disabled / aria-readonly: không gọi onChange (ô controlled nên giữ giá trị cũ).
        onChange={(e) => (locked ? undefined : onChange(e.target.checked))}
        className={cn(
          'peer size-4 appearance-none rounded-xs border transition-colors',
          locked ? 'cursor-default' : 'cursor-pointer',
          isTrue(rest['aria-disabled']) && 'opacity-60',
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
