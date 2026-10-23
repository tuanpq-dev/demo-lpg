import { useEffect, useId, useRef, useState } from 'react';
import type { IconName } from '@/assets/digital-twin';
import { cn } from '@/lib/cn';
import { useRovingFocus } from '@/lib/useRovingFocus';
import { Badge } from '../Badge';
import { Icon, MenuIcon } from '../Icon';

export type NavTabItem = {
  id: string;
  label: string;
  /** Icon trạng thái thường (xám). */
  icon: IconName;
  /** Icon khi active (cyan). Bỏ trống → dùng `icon`. */
  activeIcon?: IconName;
  /** Số hiển thị trong vòng tròn đỏ cạnh label (70:349). 0/undefined → ẩn. */
  count?: number;
  disabled?: boolean;
  /** Hiện chevron ▾ (mục có menu con – "Vận hành"). */
  hasSubmenu?: boolean;
};

export type NavTabsProps = {
  items: readonly NavTabItem[];
  value: string;
  onChange: (id: string) => void;
  /** aria-label cho vùng điều hướng. */
  label?: string;
  className?: string;
};

/**
 * Menu chính trên AppHeader (Figma 53:23 "Dash").
 * Bàn phím: ←/→/Home/End chuyển focus, Enter/Space để chọn (manual activation vì đổi trang).
 */
export function NavTabs({ items, value, onChange, label = 'Điều hướng chính', className }: NavTabsProps) {
  const { setRef, onKeyDown, getTabIndex } = useRovingFocus({ items, value, onChange, activation: 'manual' });

  return (
    <nav aria-label={label} className={className}>
      {/* xl–wide (1280–1519): chỉ icon (mục đang mở giữ chữ), tên ẩn cho trình đọc màn hình + tooltip. ≥ wide: như Figma. */}
      <div role="tablist" aria-label={label} aria-orientation="horizontal" className="flex items-center gap-7 wide:gap-11">
        {items.map((item) => {
          const active = item.id === value;
          return (
            <button
              key={item.id}
              ref={setRef(item.id)}
              type="button"
              role="tab"
              aria-selected={active}
              aria-disabled={item.disabled || undefined}
              disabled={item.disabled}
              tabIndex={getTabIndex(item.id)}
              onClick={() => onChange(item.id)}
              onKeyDown={(e) => onKeyDown(e, item.id)}
              title={item.label}
              className={cn(
                'group flex h-[41px] shrink-0 items-center gap-2.5 rounded-md text-md font-semibold leading-normal transition-opacity',
                active && 'text-primary',
                !active && !item.disabled && 'text-line-divider opacity-70 hover:opacity-100',
                item.disabled && 'cursor-not-allowed text-fg-disabled opacity-70',
              )}
            >
              <Icon
                name={active && item.activeIcon ? item.activeIcon : item.icon}
                box={24}
                className={cn(!active && 'opacity-70 group-hover:opacity-100')}
              />
              <span className={cn(!active && 'sr-only wide:not-sr-only')}>{item.label}</span>
              {!!item.count && (
                <Badge variant="count" value={item.count} tone="danger" size="md" />
              )}
              {item.hasSubmenu && <Icon name="navChevronDown" box={24} className="hidden wide:block" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * Menu điều hướng thu gọn cho màn hẹp (< xl): nút "Menu" (aria-expanded) mở danh sách mục; mục hiện tại có
 * aria-current="page". Esc / click ra ngoài / chọn mục → đóng và trả focus về nút.
 */
export function NavMenu({ items, value, onChange, label = 'Điều hướng chính', className }: NavTabsProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const current = items.find((i) => i.id === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <nav aria-label={label} className={cn('relative', className)} ref={root}>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className="flex h-[41px] items-center gap-2 rounded-md px-2 text-md font-semibold text-primary hover:bg-surface-muted/40"
      >
        <MenuIcon />
        {/* Nhãn dài ("Bản đồ nội khu") không xuống dòng; màn rất hẹp thì cắt "…". */}
        <span className="max-w-[40vw] truncate whitespace-nowrap">{current?.label ?? 'Menu'}</span>
        <span className="sr-only">– mở menu điều hướng</span>
      </button>
      {open && (
        <ul id={listId} className="absolute left-0 top-full z-40 mt-1 min-w-56 rounded-lg border border-line/30 bg-surface-raised p-1 shadow-card">
          {items.map((item) => {
            const active = item.id === value;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    onChange(item.id);
                    button.current?.focus();
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-md hover:bg-surface-muted/50',
                    active ? 'font-semibold text-primary' : 'text-fg-secondary',
                    item.disabled && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <Icon name={active && item.activeIcon ? item.activeIcon : item.icon} box={24} />
                  <span className="flex-1">{item.label}</span>
                  {!!item.count && <Badge variant="count" value={item.count} tone="danger" size="md" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
