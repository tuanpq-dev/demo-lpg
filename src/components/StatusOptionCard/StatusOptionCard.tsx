import type { KeyboardEvent, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useRovingFocus } from '@/lib/useRovingFocus';

export type StatusOptionTone = 'primary' | 'warning' | 'danger';

export type StatusOption<T extends string = string> = {
  id: T;
  label: string;
  /** Icon 20px trên nhãn (trang trí). */
  icon?: ReactNode;
  /** Màu khi được chọn (mặc định primary – ảnh chỉ vẽ "Đang thực hiện" được chọn). */
  tone?: StatusOptionTone;
  disabled?: boolean;
  /** Lý do không chọn được – đọc kèm nhãn + tooltip. */
  disabledHint?: string;
};

export type StatusOptionCardProps = {
  label: string;
  icon?: ReactNode;
  checked: boolean;
  tone?: StatusOptionTone;
  disabled?: boolean;
  disabledHint?: string;
  tabIndex?: number;
  onSelect?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLButtonElement>) => void;
  buttonRef?: (el: HTMLElement | null) => void;
  className?: string;
};

const checkedClass: Record<StatusOptionTone, string> = {
  primary: 'border-primary bg-gradient-to-b from-primary/15 to-primary/5 text-fg',
  warning: 'border-warning bg-gradient-to-b from-warning/15 to-warning/5 text-fg',
  danger: 'border-danger bg-gradient-to-b from-danger/15 to-danger/5 text-fg',
};

const iconTone: Record<StatusOptionTone, string> = {
  primary: 'text-primary',
  warning: 'text-warning',
  // eslint-disable-next-line no-restricted-syntax -- icon (currentColor), không phải chữ
  danger: 'text-danger-strong',
};

/**
 * Ô chọn trạng thái dạng radio – modal "Cập nhật tiến độ bảo trì" (ảnh thiết kế, chưa có node; số đo ước lượng):
 * icon 20px trên nhãn 14px, cao ~76px, viền line/30 bo 6px; được chọn = viền 1.5px theo tone + nền gradient nhạt, chữ đậm.
 * Dùng trong `StatusOptionGroup` (radiogroup + roving tabindex).
 */
export function StatusOptionCard({
  label,
  icon,
  checked,
  tone = 'primary',
  disabled,
  disabledHint,
  tabIndex,
  onSelect,
  onKeyDown,
  buttonRef,
  className,
}: StatusOptionCardProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      role="radio"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      tabIndex={tabIndex}
      title={disabled ? disabledHint : undefined}
      onClick={disabled ? undefined : onSelect}
      onKeyDown={onKeyDown}
      className={cn(
        'flex min-h-[76px] min-w-0 flex-col items-center justify-center gap-2 rounded-md border px-3 py-3 text-base transition-colors',
        checked ? cn('border-[1.5px] font-semibold', checkedClass[tone]) : 'border-line/30 bg-surface-sunken/30 text-fg-secondary',
        disabled ? 'cursor-not-allowed opacity-50' : !checked && 'hover:border-line hover:text-fg',
        className,
      )}
    >
      {icon && (
        <span aria-hidden="true" className={cn('shrink-0', checked ? iconTone[tone] : 'text-fg-secondary')}>
          {icon}
        </span>
      )}
      <span>
        {label}
        {disabled && disabledHint && <span className="sr-only"> – {disabledHint}</span>}
      </span>
    </button>
  );
}

export type StatusOptionGroupProps<T extends string> = {
  /** Tên nhóm (aria-labelledby ưu tiên khi có `labelledBy`). */
  label: string;
  labelledBy?: string;
  options: readonly StatusOption<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
};

/**
 * Nhóm ô trạng thái = `role="radiogroup"`; ←/→ (↑/↓) chuyển + chọn luôn, Home/End, bỏ qua ô disabled (useRovingFocus auto).
 * Bố cục: 4 cột ở ≥ md, 2 cột dưới đó.
 */
export function StatusOptionGroup<T extends string>({ label, labelledBy, options, value, onChange, className }: StatusOptionGroupProps<T>) {
  const roving = useRovingFocus({ items: options, value, onChange: (id) => onChange(id as T) });
  return (
    <div
      role="radiogroup"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      className={cn('grid grid-cols-2 gap-3 md:grid-cols-4', className)}
    >
      {options.map((o) => (
        <StatusOptionCard
          key={o.id}
          label={o.label}
          icon={o.icon}
          tone={o.tone}
          checked={o.id === value}
          disabled={o.disabled}
          disabledHint={o.disabledHint}
          tabIndex={roving.getTabIndex(o.id)}
          buttonRef={roving.setRef(o.id)}
          onSelect={() => onChange(o.id)}
          onKeyDown={(e) => {
            // Space/Enter trên ô đang focus = chọn (nút đã tự click; chặn cuộn trang khi Space).
            if (e.key === ' ') e.preventDefault();
            if ((e.key === ' ' || e.key === 'Enter') && !o.disabled) {
              e.preventDefault();
              onChange(o.id);
              return;
            }
            roving.onKeyDown(e, o.id);
          }}
        />
      ))}
    </div>
  );
}
