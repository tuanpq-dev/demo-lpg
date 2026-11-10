import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
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

  const multiValue = props.multiple ? props.value : undefined;
  const singleValue = props.multiple ? undefined : props.value;
  const selected: string[] = useMemo(() => (multiValue ? [...multiValue] : singleValue ? [singleValue] : []), [multiValue, singleValue]);
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter(
      (o) => (!props.multiple || !selected.includes(o.value)) && (!q || o.label.toLowerCase().includes(q) || o.meta?.toLowerCase().includes(q)),
    );
  }, [options, query, props.multiple, selected]);

  useEffect(() => setActive(0), [query, open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

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
        if (props.multiple && !query && props.value.length) remove(props.value[props.value.length - 1]);
        break;
    }
  };

  // Ô đơn khi đóng: hiện nhãn đã chọn (có avatar); khi mở: hiện chuỗi đang gõ.
  const single = !props.multiple ? props.value : null;
  const showSelectedInline = !props.multiple && !!single && !open;

  return (
    <div ref={rootRef} className={cn('relative flex w-full flex-col gap-2', className)}>
      {/* Click vào khung (ngoài ô nhập) chỉ là tiện ích chuột → focus ô nhập; bàn phím dùng chính ô nhập. */}
      <div
        role="presentation"
        className={cn(
          'flex h-[35px] w-full items-center gap-2 rounded-lg border bg-surface-sunken px-3 text-base',
          disabled && 'cursor-not-allowed opacity-50',
          invalid ? 'border-danger' : open ? 'border-accent/60' : 'border-line hover:border-accent/40',
        )}
        onClick={() => !disabled && inputRef.current?.focus()}
      >
        {leading && <span className="shrink-0 text-fg-secondary">{leading}</span>}
        {showSelectedInline && showAvatar && <Avatar name={labelOf(single!)} />}
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
          value={showSelectedInline ? labelOf(single!) : query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-fg placeholder:text-fg-secondary/60 focus:outline-none"
        />
        {!props.multiple && props.clearable !== false && single && (
          <button
            type="button"
            aria-label={`Bỏ chọn ${labelOf(single)}`}
            onClick={(e) => {
              e.stopPropagation();
              remove(single);
            }}
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-fg-secondary hover:bg-surface-muted hover:text-fg"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-multiselectable={props.multiple || undefined}
          className="absolute left-0 top-[39px] z-30 max-h-56 w-full overflow-auto rounded-md border border-line bg-surface-sunken py-1 shadow-card"
        >
          {filtered.length === 0 && <li className="px-3 py-2 text-sm text-fg-muted/65">{emptyText}</li>}
          {filtered.map((o, i) => (
            // Bàn phím xử lý ở phần tử cha (aria-activedescendant) – option chỉ cần click chuột.
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events
            <li
              key={o.value}
              id={`${uid}-opt-${i}`}
              role="option"
              aria-selected={selected.includes(o.value)}
              onPointerEnter={() => setActive(i)}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => choose(o.value)}
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
      )}

      {props.multiple && props.value.length > 0 && (
        <ul aria-label="Đã chọn" className="flex flex-wrap gap-2">
          {props.value.map((v) => (
            <li key={v} className="inline-flex items-center gap-1 rounded-sm bg-surface-muted py-0.5 pl-2 pr-1 text-sm text-fg">
              {labelOf(v)}
              <button
                type="button"
                aria-label={`Bỏ ${labelOf(v)}`}
                onClick={() => remove(v)}
                className="inline-flex size-4 items-center justify-center rounded-xs text-fg-secondary hover:bg-surface-chip hover:text-fg"
              >
                <CloseIcon size={10} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
