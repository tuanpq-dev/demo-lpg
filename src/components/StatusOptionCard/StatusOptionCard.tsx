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
  /** Tooltip khi CHƯA khoá (vd điều kiện "Chỉ khi nồng độ dưới 10% LEL"); khoá → `disabledHint`. */
  tooltip?: string;
  /** id phần tử lý do HIỂN THỊ (aria-describedby) – thay chữ ẩn `disabledHint` (modal "Cập nhật xử lý" cảnh báo gas). */
  describedBy?: string;
  /** Tô chữ nhãn theo tone kể cả khi chưa chọn (ảnh nghiệm thu: "Không đạt" chữ đỏ). */
  toneLabel?: boolean;
};

/**
 * - stacked: icon 20px trên nhãn 14px, cao ~76px (modal "Cập nhật tiến độ", "Gửi yêu cầu nghiệm thu")
 * - inline: chấm radio 18px + nhãn 16px một dòng, cao ~50px (modal "Nghiệm thu yêu cầu bảo trì")
 * - plain: radio thường – chấm 18px + nhãn 14px chữ chính, KHÔNG khung (danh sách "Điều kiện kết thúc" màn cấu hình
 *   kịch bản mô phỏng); chọn = chấm đặc theo tone, tâm trắng
 */
export type StatusOptionLayout = 'stacked' | 'inline' | 'plain';

export type StatusOptionCardProps = {
  label: string;
  icon?: ReactNode;
  checked: boolean;
  tone?: StatusOptionTone;
  disabled?: boolean;
  disabledHint?: string;
  describedBy?: string;
  tooltip?: string;
  toneLabel?: boolean;
  layout?: StatusOptionLayout;
  /** sm = ô inline chữ 14px, chấm 16px, đệm hẹp (3 ô trong modal md – "Cập nhật xử lý" báo cháy). */
  size?: 'sm' | 'md';
  tabIndex?: number;
  onSelect?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLButtonElement>) => void;
  buttonRef?: (el: HTMLElement | null) => void;
  className?: string;
};

const labelTone: Record<StatusOptionTone, string> = {
  primary: 'text-primary',
  warning: 'text-warning',
  danger: 'text-danger-text',
};

const dotTone: Record<StatusOptionTone, string> = {
  primary: 'border-primary bg-primary',
  warning: 'border-warning bg-warning',
  danger: 'border-danger bg-danger',
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
function StatusOptionCard({
  label,
  icon,
  checked,
  tone = 'primary',
  disabled,
  disabledHint,
  describedBy,
  tooltip,
  toneLabel,
  layout = 'stacked',
  size = 'md',
  tabIndex,
  onSelect,
  onKeyDown,
  buttonRef,
  className,
}: StatusOptionCardProps) {
  const inline = layout === 'inline';
  if (layout === 'plain') {
    return (
      <button
        ref={buttonRef}
        type="button"
        role="radio"
        aria-checked={checked}
        aria-disabled={disabled || undefined}
        aria-describedby={describedBy}
        tabIndex={tabIndex}
        title={disabled ? disabledHint : tooltip}
        onClick={disabled ? undefined : onSelect}
        onKeyDown={onKeyDown}
        className={cn(
          'flex min-h-6 min-w-0 items-center gap-3 rounded-sm text-start text-base text-fg',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
          className,
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'grid size-4.5 shrink-0 place-items-center rounded-full border-1.5 transition-colors',
            checked ? dotTone[tone] : 'border-fg-secondary/50',
          )}
        >
          {checked && <span className="size-1.5 rounded-full bg-fg" />}
        </span>
        <span>
          {label}
          {disabled && disabledHint && !describedBy && <span className="sr-only"> – {disabledHint}</span>}
        </span>
      </button>
    );
  }
  return (
    <button
      ref={buttonRef}
      type="button"
      role="radio"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      aria-describedby={describedBy}
      tabIndex={tabIndex}
      title={disabled ? disabledHint : tooltip}
      onClick={disabled ? undefined : onSelect}
      onKeyDown={onKeyDown}
      className={cn(
        'flex min-w-0 items-center justify-center rounded-md border transition-colors',
        inline && size === 'sm' ? 'px-2.5' : 'px-3',
        inline
          ? cn('min-h-[50px] flex-row py-2', size === 'sm' ? 'gap-2 text-base' : 'gap-2.5 text-md')
          : 'min-h-[76px] flex-col gap-2 py-3 text-base',
        checked ? cn('border-1.5 font-semibold', checkedClass[tone]) : 'border-line/30 bg-surface-sunken/30 text-fg-secondary',
        disabled ? 'cursor-not-allowed opacity-50' : !checked && 'hover:border-line hover:text-fg',
        className,
      )}
    >
      {inline && (
        <span
          aria-hidden="true"
          className={cn(
            'grid shrink-0 place-items-center rounded-full border-1.5',
            size === 'sm' ? 'size-4' : 'size-4.5',
            checked ? dotTone[tone] : 'border-fg-secondary/70',
          )}
        >
          {checked && <span className="size-1.5 rounded-full bg-surface" />}
        </span>
      )}
      {!inline && icon && (
        <span aria-hidden="true" className={cn('shrink-0', checked ? iconTone[tone] : 'text-fg-secondary')}>
          {icon}
        </span>
      )}
      <span className={cn((toneLabel || (inline && checked)) && labelTone[tone])}>
        {label}
        {disabled && disabledHint && !describedBy && <span className="sr-only"> – {disabledHint}</span>}
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
  layout?: StatusOptionLayout;
  /**
   * Số cột ở ≥ md (mặc định 4; 3 = modal nghiệm thu; 2 = luôn 2 cột – modal "Cập nhật xử lý" gas; 5 = trạng thái xử lý áp
   * suất, 2 → 3 → 5 cột theo bề rộng; auto = ô co theo chữ, xuống dòng khi hết chỗ – "Theo dõi sau xử lý").
   * Dưới md: 4 → 2 cột, 3 → 1 cột. 1 = danh sách dọc (layout plain – "Điều kiện kết thúc").
   */
  columns?: 1 | 2 | 3 | 4 | 5 | 'auto';
  /** aria-describedby cho cả nhóm (cảnh báo/ghi chú dưới nhóm). */
  describedBy?: string;
  /** sm = ô nhỏ + khoảng cách 12px (3 cột trong modal md); md = mặc định (3 cột modal nghiệm thu cách 24/48px). */
  size?: 'sm' | 'md';
  className?: string;
};

/**
 * Nhóm ô trạng thái = `role="radiogroup"`; ←/→ (↑/↓) chuyển + chọn luôn, Home/End, bỏ qua ô disabled (useRovingFocus auto).
 * Bố cục: 4 cột ở ≥ md, 2 cột dưới đó.
 */
export function StatusOptionGroup<T extends string>({
  label,
  labelledBy,
  options,
  value,
  onChange,
  layout,
  columns = 4,
  describedBy,
  size = 'md',
  className,
}: StatusOptionGroupProps<T>) {
  const roving = useRovingFocus({ items: options, value, onChange: (id) => onChange(id as T) });
  return (
    <div
      role="radiogroup"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className={cn(
        columns === 'auto' ? 'flex flex-wrap gap-3' : columns === 1 ? 'grid' : 'grid gap-3',
        columns === 'auto'
          ? ''
          : columns === 1
            ? 'grid-cols-1 gap-2.5'
            : columns === 5
              ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
              : columns === 3
                ? cn('grid-cols-1 sm:grid-cols-3', size === 'md' && 'sm:gap-6 lg:gap-12')
                : columns === 2
                  ? 'grid-cols-2'
                  : 'grid-cols-2 md:grid-cols-4',
        className,
      )}
    >
      {options.map((o) => (
        <StatusOptionCard
          key={o.id}
          label={o.label}
          icon={o.icon}
          tone={o.tone}
          toneLabel={o.toneLabel}
          layout={layout}
          size={size}
          checked={o.id === value}
          disabled={o.disabled}
          disabledHint={o.disabledHint}
          describedBy={o.describedBy}
          tooltip={o.tooltip}
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
