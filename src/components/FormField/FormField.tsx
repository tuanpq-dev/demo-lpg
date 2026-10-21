import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type FormFieldRenderProps = {
  id: string;
  /** id của <label> – dùng cho aria-labelledby (Select field). */
  labelId: string;
  describedBy: string | undefined;
  invalid: boolean;
};

export type FormFieldProps = {
  label: string;
  required?: boolean;
  hint?: string;
  /** Thông báo lỗi – có thì control chuyển trạng thái invalid. */
  error?: string;
  /** Render control với id/aria-describedby/invalid đã nối sẵn. */
  children: (p: FormFieldRenderProps) => ReactNode;
  className?: string;
};

/**
 * Khung một trường form: nhãn (dấu * nếu bắt buộc) · control · gợi ý/lỗi.
 * ⚠ Figma chưa có form – style theo token: nhãn 12px text-fg-secondary, lỗi text-danger.
 * Dùng chung cho TextField, Textarea, DatePicker và Select variant="field".
 */
export function FormField({ label, required, hint, error, children, className }: FormFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const labelId = `${id}-label`;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label id={labelId} htmlFor={id} className="text-sm font-semibold text-fg-secondary">
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children({ id, labelId, describedBy, invalid: !!error })}
      {error ? (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="text-sm text-fg-muted/65">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** Class chung cho ô nhập (TextField/Textarea/DatePicker) – cùng kiểu SearchInput 70:3018. */
export const inputClass = (invalid: boolean) =>
  cn(
    'w-full rounded-lg border bg-surface-sunken px-3 text-base text-fg placeholder:text-fg-secondary/60',
    'focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
    invalid ? 'border-danger focus-visible:border-danger' : 'border-line hover:border-accent/40 focus-visible:border-accent/60',
  );
