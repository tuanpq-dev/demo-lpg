import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type SwitchProps = {
  /** Nhãn hiển thị bên phải (tên truy cập). */
  label: ReactNode;
  /** Dòng phụ dưới nhãn (đọc qua aria-describedby). */
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Công tắc bật/tắt – `role="switch"` + `aria-checked` (WAI-ARIA), Space/Enter đổi (nút gốc). Bật = rãnh `primary`.
 * Rãnh 36×20, nút tròn 16px; focus-visible theo outline accent chung.
 */
export function Switch({ label, description, checked, onChange, disabled, className }: SwitchProps) {
  const id = useId();
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-desc` : undefined}
        aria-labelledby={`${id}-label`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-px inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'border-primary bg-primary' : 'border-line bg-surface-muted',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'inline-block size-4 rounded-full transition-transform',
            checked ? 'translate-x-[17px] bg-surface' : 'translate-x-0.5 bg-fg-secondary',
          )}
        />
      </button>
      <span className="flex min-w-0 flex-col gap-0.5">
        <label id={`${id}-label`} htmlFor={id} className="cursor-pointer text-base text-fg">
          {label}
        </label>
        {description && (
          <span id={`${id}-desc`} className="text-sm text-fg-secondary">
            {description}
          </span>
        )}
      </span>
    </div>
  );
}
