import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { useDismiss } from '@/lib/useDismiss';
import { cn } from '@/lib/cn';
import { Icon } from '../Icon';

export type SelectOption<V extends string = string> = {
  value: V;
  label: string;
  disabled?: boolean;
};

export type SelectProps<V extends string = string> = {
  /** Tên bộ lọc, ví dụ "Mức độ", "Khu vực". */
  label: string;
  options: readonly SelectOption<V>[];
  /** null = chưa chọn / "tất cả". */
  value: V | null;
  onChange: (value: V | null) => void;
  /**
   * Nếu có, thêm lựa chọn "tất cả" (value = null) ở đầu danh sách và trigger hiển thị
   * "Khu vực ( Tất cả khu vực )" như Figma 65:1602.
   */
  allLabel?: string;
  /** filter: chưa chọn → trigger chỉ hiện nhãn (ẩn "( Tất cả )") dù có `allLabel` – thanh lọc màn Báo cáo. */
  hideAllInTrigger?: boolean;
  disabled?: boolean;
  /** Căn menu theo cạnh trái/phải của trigger. */
  align?: 'start' | 'end';
  /** Menu mở xuống (mặc định) hay lên – dùng 'top' khi trigger nằm sát đáy (chân drawer). */
  side?: 'bottom' | 'top';
  /**
   * - filter: ô lọc nền sunken, hiển thị "Nhãn ( giá trị )" + chevron (65:1602)
   * - button: trigger giống Button ghost (viền accent/30, cao 36) – chỉ hiện giá trị đang chọn,
   *           hoặc `label` khi chưa chọn ("Hôm nay" 70:2883, "Phân công")
   * - field:  ô chọn trong form – rộng 100%, cao 35px như TextField, hiện giá trị hoặc `placeholder`
   *           (`label` chỉ làm aria-label; nhãn hiển thị do FormField lo)
   */
  variant?: 'filter' | 'button' | 'field';
  /** Icon đầu trigger (variant="button"). */
  icon?: ReactNode;
  /** variant="field": chữ mờ khi chưa chọn. */
  placeholder?: string;
  /** variant="field": viền đỏ + aria-invalid. */
  invalid?: boolean;
  /** id của nút trigger – để <label htmlFor> trỏ tới. */
  id?: string;
  /** aria-describedby (thông báo lỗi/gợi ý). */
  describedBy?: string;
  /** id nhãn ngoài (FormField) – variant="field" ghép thành aria-labelledby = nhãn + giá trị đang chọn. */
  labelledBy?: string;
  /**
   * filter/button: trigger giãn hết bề rộng khung (đặt bề rộng qua `className`), chevron dồn phải – giữ bề rộng cố định khi
   * giá trị đổi (ô "Thiết bị" ở chi tiết thiết bị Vận hành).
   */
  fullWidth?: boolean;
  /** variant="field": md = cao 35px chữ 14px (mặc định) · lg = cao 40px chữ 16px (màn cấu hình kịch bản mô phỏng). */
  size?: 'md' | 'lg';
  className?: string;
};

type Row<V extends string> = { value: V | null; label: string; disabled?: boolean };

type Variant = NonNullable<SelectProps['variant']>;

/** Chữ trên trigger theo variant (field: giá trị/placeholder · button: giá trị/nhãn · filter: "Nhãn ( giá trị )"). */
function triggerText(
  variant: Variant,
  label: string,
  selected: Row<string> | undefined,
  opts: { placeholder?: string; allLabel?: string; hideAllInTrigger?: boolean },
) {
  if (variant === 'field') return selected?.label ?? opts.placeholder ?? '';
  const chosen = selected && selected.value !== null ? selected.label : null;
  if (variant === 'button') return chosen ?? label;
  if (chosen) return `${label} ( ${chosen} )`;
  return opts.allLabel && !opts.hideAllInTrigger ? `${label} ( ${opts.allLabel} )` : label;
}

function triggerClass(variant: Variant, size: 'md' | 'lg', open: boolean, invalid?: boolean, fullWidth?: boolean) {
  const border = (idle: string) => (open ? 'border-accent/60' : idle);
  return cn(
    'inline-flex items-center whitespace-nowrap border text-fg transition-colors',
    variant === 'field' && size === 'lg' ? 'text-md' : 'text-base',
    'disabled:cursor-not-allowed disabled:opacity-50',
    variant === 'filter' && cn('h-[34px] gap-1 rounded-md bg-surface-sunken px-[13px]', border('border-line hover:border-accent/40')),
    fullWidth && 'w-full justify-between',
    variant === 'button' &&
      cn('h-9 gap-2 rounded-lg bg-surface px-4 font-semibold backdrop-blur-sm', border('border-accent/30 hover:border-accent/60')),
    variant === 'field' &&
      cn(
        'w-full justify-between gap-2 rounded-lg bg-surface-sunken text-left',
        size === 'lg' ? 'h-10 pl-4 pr-3' : 'h-field pl-3 pr-2',
        invalid ? 'border-danger' : border('border-line hover:border-accent/40'),
      ),
  );
}

// ---- Di chuyển trong danh sách (bỏ qua mục disabled)
const firstEnabled = (rows: readonly Row<string>[]) => rows.findIndex((r) => !r.disabled);
function lastEnabled(rows: readonly Row<string>[]) {
  for (let i = rows.length - 1; i >= 0; i--) if (!rows[i]?.disabled) return i;
  return -1;
}
function stepIndex(rows: readonly Row<string>[], from: number, dir: 1 | -1) {
  for (let i = 1; i <= rows.length; i++) {
    const next = (from + dir * i + rows.length) % rows.length;
    if (!rows[next]?.disabled) return next;
  }
  return from;
}

type OptionListProps<V extends string> = {
  uid: string;
  listId: string;
  label: string;
  rows: readonly Row<V>[];
  selectedIndex: number;
  activeIndex: number;
  align: 'start' | 'end';
  side: 'bottom' | 'top';
  listRef: RefObject<HTMLUListElement>;
  onKeyDown: (e: KeyboardEvent<HTMLUListElement>) => void;
  onHover: (index: number) => void;
  onChoose: (index: number) => void;
};

function OptionList<V extends string>({
  uid,
  listId,
  label,
  rows,
  selectedIndex,
  activeIndex,
  align,
  side,
  listRef,
  onKeyDown,
  onHover,
  onChoose,
}: OptionListProps<V>) {
  return (
    <ul
      ref={listRef}
      id={listId}
      role="listbox"
      tabIndex={-1}
      aria-label={label}
      aria-activedescendant={`${uid}-opt-${activeIndex}`}
      onKeyDown={onKeyDown}
      className={cn(
        'absolute z-20 max-h-64 min-w-full overflow-auto rounded-md border border-line bg-surface-sunken py-1 shadow-card focus:outline-none',
        align === 'end' ? 'right-0' : 'left-0',
        side === 'top' ? 'bottom-full mb-1' : 'top-full mt-1',
      )}
    >
      {rows.map((row, i) => {
        const isSelected = i === selectedIndex;
        return (
          // Bàn phím xử lý ở phần tử cha (aria-activedescendant) – option chỉ cần click chuột.
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events -- bàn phím xử lý ở listbox cha (aria-activedescendant)
          <li
            key={row.value ?? '__all__'}
            id={`${uid}-opt-${i}`}
            data-index={i}
            role="option"
            aria-selected={isSelected}
            aria-disabled={row.disabled || undefined}
            onPointerEnter={() => !row.disabled && onHover(i)}
            onClick={() => onChoose(i)}
            className={cn(
              'flex cursor-pointer items-center justify-between gap-3 whitespace-nowrap px-[13px] py-1.5 text-base',
              i === activeIndex && 'bg-surface-muted',
              isSelected ? 'text-info' : 'text-fg',
              row.disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            {row.label}
            {isSelected && <span aria-hidden="true" className="size-1.5 rounded-full bg-info" />}
          </li>
        );
      })}
    </ul>
  );
}

/** Menu mở: click ra ngoài đóng, focus vào listbox, giữ mục active trong vùng nhìn thấy. */
function useMenuEffects(
  open: boolean,
  activeIndex: number,
  rootRef: RefObject<HTMLDivElement>,
  listRef: RefObject<HTMLUListElement>,
  setOpen: (v: boolean) => void,
) {
  useDismiss(open, rootRef, () => setOpen(false));

  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open, listRef]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open, listRef]);
}

/**
 * Dropdown lọc – instance "Options" (Figma 65:1602/65:1603 trong 70:3023).
 * Listbox WAI-ARIA: Enter/Space/↓/↑ mở; ↑/↓/Home/End di chuyển; Enter/Space chọn; Esc/Tab đóng; click ra ngoài đóng.
 */
export function Select<V extends string = string>(props: SelectProps<V>) {
  const {
    label,
    options,
    value,
    onChange,
    allLabel,
    disabled,
    align = 'start',
    side = 'bottom',
    variant = 'filter',
    size = 'md',
    icon,
    invalid,
    id,
    describedBy,
    labelledBy,
    fullWidth,
    className,
  } = props;
  const uid = useId();
  const listId = `${uid}-list`;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  useMenuEffects(open, activeIndex, rootRef, listRef, setOpen);

  const rows: Row<V>[] = [...(allLabel ? [{ value: null, label: allLabel }] : []), ...options];
  const selectedIndex = rows.findIndex((r) => r.value === value);
  const selected = selectedIndex >= 0 ? rows[selectedIndex] : undefined;

  const openMenu = (index?: number) => {
    setActiveIndex(index ?? (selectedIndex >= 0 ? selectedIndex : firstEnabled(rows)));
    setOpen(true);
  };
  const close = (focusTrigger = true) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  };
  const choose = (index: number) => {
    const row = rows[index];
    if (!row || row.disabled) return;
    onChange(row.value);
    close();
  };

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) return;
    e.preventDefault();
    openMenu(e.key === 'ArrowUp' ? lastEnabled(rows) : undefined);
  };

  /** Phím trong listbox → mục active mới (undefined = không đổi). */
  const moves: Record<string, () => number> = {
    ArrowDown: () => stepIndex(rows, activeIndex, 1),
    ArrowUp: () => stepIndex(rows, activeIndex, -1),
    Home: () => firstEnabled(rows),
    End: () => lastEnabled(rows),
  };
  const onListKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const move = moves[e.key];
    if (move) {
      e.preventDefault();
      setActiveIndex(move());
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(activeIndex);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      close(false);
    }
  };

  return (
    <div ref={rootRef} className={cn('relative', variant === 'field' ? 'flex w-full' : fullWidth ? 'flex' : 'inline-flex', className)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        // Không đặt aria-invalid: không hợp lệ với role button; thông báo lỗi đã nối qua aria-describedby (FormField).
        data-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-labelledby={variant === 'field' && labelledBy ? `${labelledBy} ${uid}-value` : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onTriggerKeyDown}
        className={triggerClass(variant, size, open, invalid, fullWidth)}
      >
        {icon}
        <span id={`${uid}-value`} className={cn(variant === 'field' && 'truncate', variant === 'field' && !selected && 'text-fg-secondary/60')}>
          {triggerText(variant, label, selected, props)}
        </span>
        {variant !== 'button' && <Icon name="chevronDown" box={20} className={cn('transition-transform', open && 'rotate-180')} />}
      </button>

      {open && (
        <OptionList
          uid={uid}
          listId={listId}
          label={label}
          rows={rows}
          selectedIndex={selectedIndex}
          activeIndex={activeIndex}
          align={align}
          side={side}
          listRef={listRef}
          onKeyDown={onListKeyDown}
          onHover={setActiveIndex}
          onChoose={choose}
        />
      )}
    </div>
  );
}
