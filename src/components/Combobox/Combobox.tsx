import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useDismiss } from '@/lib/useDismiss';
import { cn } from '@/lib/cn';
import { Avatar } from '../Avatar';
import { CloseIcon } from '../Icon';

export type ComboOption = {
  value: string;
  label: string;
  /** Dòng phụ trong danh sách (phòng ban, khu vực…). */
  meta?: string;
};

type Common = {
  options: readonly ComboOption[];
  placeholder?: string;
  /** Icon đầu ô (kính lúp, người…). */
  leading?: ReactNode;
  /** Hiện avatar chữ viết tắt (nhân sự). */
  showAvatar?: boolean;
  /** Nối với FormField. */
  id?: string;
  labelledBy?: string;
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
  /** Hiện khi lọc không ra kết quả. */
  emptyText?: string;
  className?: string;
};

export type ComboboxProps = Common &
  (
    | { multiple?: false; value: string | null; onChange: (value: string | null) => void; clearable?: boolean }
    | { multiple: true; value: readonly string[]; onChange: (value: string[]) => void; clearable?: never }
  );

/** Tách giá trị theo chế độ chọn một / nhiều. */
const splitValue = (p: ComboboxProps) =>
  p.multiple ? { multiValue: p.value, singleValue: undefined } : { multiValue: undefined, singleValue: p.value };

/** Giá trị đang chọn dạng mảng (một hoặc nhiều). */
const selectedList = (multi: readonly string[] | undefined, single: string | null | undefined): string[] =>
  multi ? [...multi] : single ? [single] : [];

function frameClass(open: boolean, disabled?: boolean, invalid?: boolean) {
  const border = invalid ? 'border-danger' : open ? 'border-accent/60' : 'border-line hover:border-accent/40';
  return cn(
    'flex h-field w-full items-center gap-2 rounded-lg border bg-surface-sunken px-3 text-base',
    disabled && 'cursor-not-allowed opacity-50',
    border,
  );
}

function ClearButton({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Bỏ chọn ${label}`}
      onClick={(e) => {
        e.stopPropagation();
        onClear();
      }}
      className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-fg-secondary hover:bg-surface-muted hover:text-fg"
    >
      <CloseIcon />
    </button>
  );
}

type OptionListProps = {
  uid: string;
  listId: string;
  options: readonly ComboOption[];
  active: number;
  selected: readonly string[];
  multiple?: boolean;
  showAvatar?: boolean;
  emptyText: string;
  onHover: (index: number) => void;
  onChoose: (value: string) => void;
};

function OptionList({ uid, listId, options, active, selected, multiple, showAvatar, emptyText, onHover, onChoose }: OptionListProps) {
  return (
    <ul
      id={listId}
      role="listbox"
      aria-multiselectable={multiple || undefined}
      className="absolute left-0 top-[39px] z-30 max-h-56 w-full overflow-auto rounded-md border border-line bg-surface-sunken py-1 shadow-card"
    >
      {options.length === 0 && <li className="px-3 py-2 text-sm text-fg-muted/65">{emptyText}</li>}
      {options.map((o, i) => (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events -- Bàn phím xử lý ở phần tử cha (aria-activedescendant) – option chỉ cần click chuột.
        <li
          key={o.value}
          id={`${uid}-opt-${i}`}
          role="option"
          aria-selected={selected.includes(o.value)}
          onPointerEnter={() => onHover(i)}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => onChoose(o.value)}
          className={cn(
            'flex cursor-pointer items-center gap-2 px-3 py-1.5 text-base',
            i === active && 'bg-surface-muted',
            selected.includes(o.value) ? 'text-info' : 'text-fg',
          )}
        >
          {showAvatar && <Avatar name={o.label} />}
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{o.label}</span>
            {o.meta && <span className="truncate text-xs text-fg-muted/70">{o.meta}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Chip các giá trị đã chọn (nhiều) – nút × bỏ từng chip. */
function SelectedChips({ values, labelOf, onRemove }: { values: readonly string[]; labelOf: (v: string) => string; onRemove: (v: string) => void }) {
  if (values.length === 0) return null;
  return (
    <ul aria-label="Đã chọn" className="flex flex-wrap gap-2">
      {values.map((v) => (
        <li key={v} className="inline-flex items-center gap-1 rounded-sm bg-surface-muted py-0.5 pl-2 pr-1 text-sm text-fg">
          {labelOf(v)}
          <button
            type="button"
            aria-label={`Bỏ ${labelOf(v)}`}
            onClick={() => onRemove(v)}
            className="inline-flex size-4 items-center justify-center rounded-xs text-fg-secondary hover:bg-surface-chip hover:text-fg"
          >
            <CloseIcon size={10} />
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Ô chọn có tìm kiếm (ARIA combobox + listbox).
 * - Đơn: Thiết bị (kính lúp), Người phụ trách chính (avatar + nút xoá).
 * - Nhiều: Người phối hợp – chip bên dưới ô, Backspace khi ô trống để bỏ chip cuối.
 * Bàn phím: gõ để lọc · ↑/↓ di chuyển · Enter chọn · Esc đóng · Tab rời đi.
 * ⚠ Figma chưa có thiết kế combobox – style giống TextField/Select field.
 */
export function Combobox(props: ComboboxProps) {
  const {
    options,
    placeholder,
    leading,
    showAvatar,
    id,
    labelledBy,
    describedBy,
    invalid,
    disabled,
    emptyText = 'Không tìm thấy',
    className,
  } = props;
  const uid = useId();
  const listId = `${uid}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { multiValue, singleValue } = splitValue(props);
  const selected: string[] = useMemo(() => selectedList(multiValue, singleValue), [multiValue, singleValue]);
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter(
      (o) => (!props.multiple || !selected.includes(o.value)) && (!q || o.label.toLowerCase().includes(q) || o.meta?.toLowerCase().includes(q)),
    );
  }, [options, query, props.multiple, selected]);

  useEffect(() => setActive(0), [query, open]);

  useDismiss(open, rootRef, () => close());

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const choose = (v: string) => {
    if (props.multiple) {
      props.onChange([...props.value, v]);
      setQuery('');
      inputRef.current?.focus();
    } else {
      props.onChange(v);
      close();
    }
  };

  const remove = (v: string) => {
    if (props.multiple) props.onChange(props.value.filter((x) => x !== v));
    else props.onChange(null);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) setOpen(true);
        else setActive((i) => Math.min(filtered.length - 1, i + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        break;
      case 'Enter':
        if (open && filtered[active]) {
          e.preventDefault();
          choose(filtered[active].value);
        }
        break;
      case 'Escape':
        if (open) {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
        break;
      case 'Tab':
        close();
        break;
      case 'Backspace':
        if (props.multiple && !query) {
          const lastValue = props.value[props.value.length - 1];
          if (lastValue !== undefined) remove(lastValue);
        }
        break;
    }
  };

  // Ô đơn khi đóng: hiện nhãn đã chọn (có avatar); khi mở: hiện chuỗi đang gõ.
  const single = singleValue ?? null;
  const showSelectedInline = !props.multiple && !!single && !open;

  return (
    <div ref={rootRef} className={cn('relative flex w-full flex-col gap-2', className)}>
      {/* Click vào khung (ngoài ô nhập) chỉ là tiện ích chuột → focus ô nhập; bàn phím dùng chính ô nhập. */}
      <div role="presentation" className={frameClass(open, disabled, invalid)} onClick={() => !disabled && inputRef.current?.focus()}>
        {leading && <span className="shrink-0 text-fg-secondary">{leading}</span>}
        {showSelectedInline && showAvatar && <Avatar name={labelOf(single)} />}
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[active] ? `${uid}-opt-${active}` : undefined}
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          placeholder={showSelectedInline ? undefined : placeholder}
          value={showSelectedInline ? labelOf(single) : query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-fg placeholder:text-fg-secondary/60 focus:outline-none"
        />
        {!props.multiple && props.clearable !== false && single && <ClearButton label={labelOf(single)} onClear={() => remove(single)} />}
      </div>

      {open && (
        <OptionList
          uid={uid}
          listId={listId}
          options={filtered}
          active={active}
          selected={selected}
          multiple={props.multiple}
          showAvatar={showAvatar}
          emptyText={emptyText}
          onHover={setActive}
          onChoose={choose}
        />
      )}

      {props.multiple && <SelectedChips values={props.value} labelOf={labelOf} onRemove={remove} />}
    </div>
  );
}
