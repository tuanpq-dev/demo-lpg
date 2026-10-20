import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { FormField, inputClass } from './FormField';

type Common = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
};

export type TextFieldProps = Common & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'className' | 'id'>;

/** Ô nhập một dòng có nhãn + lỗi (cao 35px như SearchInput). */
export function TextField({ label, value, onChange, required, hint, error, className, ...rest }: TextFieldProps) {
  return (
    <FormField label={label} required={required} hint={hint} error={error} className={className}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(inputClass(invalid), 'h-[35px]')}
          {...rest}
        />
      )}
    </FormField>
  );
}

export type TextareaProps = Common &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'className' | 'id'> & {
    /** Hiện bộ đếm "x/maxLength". */
    showCount?: boolean;
  };

/** Ô nhập nhiều dòng có nhãn + lỗi + bộ đếm ký tự tuỳ chọn. */
export function Textarea({
  label,
  value,
  onChange,
  required,
  hint,
  error,
  className,
  rows = 4,
  maxLength,
  showCount,
  ...rest
}: TextareaProps) {
  return (
    <FormField
      label={label}
      required={required}
      hint={showCount && maxLength && !hint ? `${value.length}/${maxLength} ký tự` : hint}
      error={error}
      className={className}
    >
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          value={value}
          rows={rows}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(inputClass(invalid), 'resize-y py-2 leading-5')}
          {...rest}
        />
      )}
    </FormField>
  );
}

export type DatePickerProps = Omit<Common, 'value' | 'onChange'> & {
  /** date: "yyyy-mm-dd" · datetime-local: "yyyy-mm-ddTHH:mm" · hoặc "" */
  value: string;
  /** Chọn ngày hoặc ngày + giờ (Thời gian bắt đầu/Hạn hoàn thành). */
  type?: 'date' | 'datetime-local';
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
};

/**
 * Chọn ngày – dùng <input type="date"> gốc (bàn phím, trình đọc màn hình, lịch của hệ điều hành),
 * style theo token; `color-scheme: dark` để lịch bật lên theo nền tối.
 */
export function DatePicker({ label, value, onChange, required, hint, error, className, min, max, disabled, type = 'date' }: DatePickerProps) {
  return (
    <FormField label={label} required={required} hint={hint} error={error} className={className}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          type={type}
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(inputClass(invalid), 'h-[35px] [color-scheme:dark]')}
        />
      )}
    </FormField>
  );
}
