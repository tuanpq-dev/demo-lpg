import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';
import { FormField, inputClass } from './FormField';

export type NumberFieldProps = {
  label: string;
  /** null/undefined → ô trống (hiện placeholder, vd giá trị mặc định). */
  value: number | null | undefined;
  /** Gọi khi CHỐT giá trị (Enter, rời ô, ↑/↓) – không gọi mỗi phím gõ (1 lần sửa = 1 bước undo). */
  onChange: (value: number) => void;
  /** Ô trống + Enter/rời ô → gọi onClear (vd bỏ tham số về mặc định). Không có → khôi phục giá trị cũ. */
  onClear?: () => void;
  step?: number;
  min?: number;
  max?: number;
  integer?: boolean;
  /** Số chữ số thập phân khi hiển thị (mặc định 3, bỏ số 0 thừa). */
  precision?: number;
  unit?: string;
  /** Tiền tố trong ô (vd "X") – dùng cho Vec3Field. */
  prefix?: string;
  /** Ẩn nhãn hiển thị (vẫn có aria-label). */
  hideLabel?: boolean;
  size?: 'sm' | 'md';
  placeholder?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  /** Màu số trong ô theo ngưỡng (ô "Sau" – thông số trước/sau xử lý). */
  tone?: 'default' | 'warning' | 'danger';
  /** Căn số trong ô. */
  align?: 'start' | 'center';
  className?: string;
};

const fmt = (v: number | null | undefined, precision: number) =>
  v === null || v === undefined || Number.isNaN(v) ? '' : String(+v.toFixed(precision));

/**
 * Ô nhập số (⚠ Figma chưa có – style theo TextField). Gõ tự do, chấp nhận dấu phẩy thập phân;
 * Enter/rời ô → kiểm tra + kẹp min/max (+ làm tròn nếu integer) rồi mới `onChange`; Esc → khôi phục.
 * ↑/↓ tăng/giảm `step` (Shift ×10) và chốt ngay.
 */
export function NumberField({
  label,
  value,
  onChange,
  onClear,
  step = 1,
  min,
  max,
  integer,
  precision = 3,
  unit,
  prefix,
  hideLabel,
  size = 'md',
  placeholder,
  hint,
  error,
  required,
  disabled,
  className,
  tone = 'default',
  align = 'start',
}: NumberFieldProps) {
  const [text, setText] = useState(() => fmt(value, precision));
  const editing = useRef(false);
  // Đã gõ từ lần chốt trước? Rời ô / Enter mà chưa gõ → không chốt (chỉ đồng bộ chữ): tránh ghi đè bằng chữ cũ khi giá trị
  // ngoài đổi trong lúc focus (số live ở ô "Sau" – modal cập nhật xử lý áp suất) hoặc làm tròn theo `precision`.
  const typed = useRef(false);
  // Giá trị ngoài đổi (undo, kéo gizmo…) khi không gõ → cập nhật ô.
  useEffect(() => {
    if (!editing.current) setText(fmt(value, precision));
  }, [value, precision]);

  const clamp = (v: number) => {
    let x = integer ? Math.round(v) : v;
    if (min !== undefined) x = Math.max(min, x);
    if (max !== undefined) x = Math.min(max, x);
    return x;
  };
  const commit = (raw: string, force = false) => {
    editing.current = false;
    if (!force && !typed.current) return setText(fmt(value, precision));
    typed.current = false;
    const t = raw.trim().replace(',', '.');
    if (t === '') {
      if (onClear) onClear();
      else setText(fmt(value, precision));
      return;
    }
    const n = Number(t);
    if (!Number.isFinite(n)) return setText(fmt(value, precision));
    const v = clamp(n);
    setText(fmt(v, precision));
    if (v !== value) onChange(v);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit(e.currentTarget.value);
    } else if (e.key === 'Escape') {
      editing.current = false;
      typed.current = false;
      setText(fmt(value, precision));
      e.currentTarget.blur();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const base = Number(text.replace(',', '.'));
      const cur = Number.isFinite(base) ? base : (value ?? 0);
      const d = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
      commit(String(+(cur + d).toFixed(6)), true);
      editing.current = true;
    }
  };

  const input = (id?: string, describedBy?: string, invalid = false) => (
    <div className={cn('relative flex items-center', hideLabel && className)}>
      {prefix && (
        <span aria-hidden="true" className="pointer-events-none absolute left-2 text-xs font-semibold text-fg-muted">
          {prefix}
        </span>
      )}
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        aria-label={hideLabel ? label : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onFocus={() => (editing.current = true)}
        onChange={(e) => {
          editing.current = true;
          typed.current = true;
          setText(e.target.value);
        }}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={onKeyDown}
        className={cn(
          inputClass(invalid, tone === 'warning' ? 'text-warning' : tone === 'danger' ? 'text-danger-text' : 'text-fg'),
          'tabular-nums',
          align === 'center' && 'text-center font-semibold',
          size === 'sm' ? 'h-7 px-2 text-sm' : 'h-[35px]',
          prefix && (size === 'sm' ? 'pl-6' : 'pl-7'),
          unit && 'pr-9',
        )}
      />
      {unit && <span className="pointer-events-none absolute right-2 text-xs text-fg-muted">{unit}</span>}
    </div>
  );

  if (hideLabel) return input();
  return (
    <FormField label={label} required={required} hint={hint} error={error} className={className}>
      {({ id, describedBy, invalid }) => input(id, describedBy, invalid)}
    </FormField>
  );
}

export type Vec3Value = [number, number, number];

export type Vec3FieldProps = {
  label: string;
  value: Vec3Value;
  onChange: (value: Vec3Value) => void;
  step?: number;
  precision?: number;
  unit?: string;
  /** Tên trục (mặc định X Y Z). */
  axes?: [string, string, string];
  /** Chỉ hiện các trục này (chỉ số 0–2), vd vị trí trên sàn `[0, 2]` (X, Z); trục ẩn giữ nguyên giá trị. */
  only?: readonly (0 | 1 | 2)[];
  disabled?: boolean;
  className?: string;
};

/** 3 ô số nhỏ X/Y/Z trên một hàng (vị trí, góc, scale) – mỗi ô chốt riêng. */
export function Vec3Field({
  label,
  value,
  onChange,
  step = 0.5,
  precision = 3,
  unit,
  axes = ['X', 'Y', 'Z'],
  only = [0, 1, 2],
  disabled,
  className,
}: Vec3FieldProps) {
  return (
    <fieldset className={cn('flex flex-col gap-1.5', className)} disabled={disabled}>
      <legend className="mb-1.5 text-sm font-semibold text-fg-secondary">
        {label}
        {unit && <span className="font-normal text-fg-muted"> ({unit})</span>}
      </legend>
      <div className={cn('grid gap-1.5', only.length === 3 ? 'grid-cols-3' : only.length === 2 ? 'grid-cols-2' : 'grid-cols-1')}>
        {axes.map((axis, i) => only.includes(i as 0 | 1 | 2) && (
          <NumberField
            key={axis}
            label={`${label} ${axis}`}
            hideLabel
            size="sm"
            prefix={axis}
            step={step}
            precision={precision}
            value={value[i]}
            disabled={disabled}
            onChange={(v) => onChange(value.map((x, k) => (k === i ? v : x)) as Vec3Value)}
          />
        ))}
      </div>
    </fieldset>
  );
}
