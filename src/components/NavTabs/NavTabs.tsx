import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useDismiss } from '@/lib/useDismiss';
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
  /**
   * Menu con (vd "Vận hành" → Vận hành · Nhật ký vận hành · AI mô phỏng sự cố). Có → mục hiện chevron ▾, bấm mở
   * dropdown thay vì chọn; `onChange` nhận id mục con. Mục cha sáng khi `value` là id một mục con.
   */
  children?: readonly NavSubItem[];
};

export type NavSubItem = { id: string; label: string; disabled?: boolean };

/** id mục cấp 1 đang sáng: chính `value` hoặc mục cha chứa `value`. */
function navTopId(items: readonly NavTabItem[], value: string): string {
  return items.find((i) => i.id === value || i.children?.some((c) => c.id === value))?.id ?? value;
}

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
  const topValue = navTopId(items, value);
  const [openId, setOpenId] = useState<string | null>(null);
  /** Mục con nhận focus khi menu vừa mở: 'first' | 'last'. */
  const [initialFocus, setInitialFocus] = useState<'first' | 'last'>('first');
  const [menuLeft, setMenuLeft] = useState(0);
  const root = useRef<HTMLElement>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const menuId = useId();

  const openMenu = (id: string, focus: 'first' | 'last' = 'first') => {
    setMenuLeft(tabRefs.current.get(id)?.offsetLeft ?? 0);
    setInitialFocus(focus);
    setOpenId(id);
  };
  const closeMenu = (returnFocus: boolean) => {
    const id = openId;
    setOpenId(null);
    if (returnFocus && id) tabRefs.current.get(id)?.focus();
  };

  const select = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (item?.children?.length) {
      if (openId === id) closeMenu(false);
      else openMenu(id);
      return;
    }
    onChange(id);
  };
  const { setRef, onKeyDown, getTabIndex } = useRovingFocus({ items, value: topValue, onChange: select, activation: 'manual' });

  // Click ra ngoài → đóng (không kéo focus).
  useDismiss(!!openId, root, () => setOpenId(null));

  // ↓/↑ trên tab có menu → mở menu (focus mục đầu/cuối); Esc → đóng menu; phím khác → roving focus giữa các tab.
  const onTabKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>, id: string, hasMenu: boolean, expanded: boolean) => {
    if (hasMenu && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      openMenu(id, e.key === 'ArrowUp' ? 'last' : 'first');
    } else if (hasMenu && e.key === 'Escape' && expanded) {
      e.preventDefault();
      closeMenu(true);
    } else onKeyDown(e, id);
  };

  const openItem = items.find((i) => i.id === openId);

  return (
    <nav aria-label={label} className={cn('relative', className)} ref={root}>
      {/* xl–wide (1280–1519): chỉ icon (mục đang mở giữ chữ), tên ẩn cho trình đọc màn hình + tooltip. ≥ wide: như Figma. */}
      <div role="tablist" aria-label={label} aria-orientation="horizontal" className="flex items-center gap-7 wide:gap-11">
        {items.map((item) => {
          const active = item.id === topValue;
          const hasMenu = !!item.children?.length;
          const expanded = openId === item.id;
          // Đang ở trang con → tab hiện tên trang con (vd "Nhật ký vận hành"); tên mục cha vẫn đọc cho trình đọc màn hình.
          const currentChild = item.children?.find((c) => c.id === value);
          const childLabel = currentChild && currentChild.label !== item.label ? currentChild.label : undefined;
          return (
            <button
              key={item.id}
              ref={(el) => {
                setRef(item.id)(el);
                if (el) tabRefs.current.set(item.id, el);
                else tabRefs.current.delete(item.id);
              }}
              type="button"
              role="tab"
              aria-selected={active}
              aria-disabled={item.disabled || undefined}
              aria-haspopup={hasMenu ? 'menu' : undefined}
              aria-expanded={hasMenu ? expanded : undefined}
              aria-controls={expanded ? menuId : undefined}
              disabled={item.disabled}
              tabIndex={getTabIndex(item.id)}
              onClick={() => select(item.id)}
              onKeyDown={(e) => onTabKeyDown(e, item.id, hasMenu, expanded)}
              title={childLabel ? `${item.label} – ${childLabel}` : item.label}
              className={cn(
                'group flex h-[41px] shrink-0 items-center gap-2.5 rounded-md text-md font-semibold leading-normal transition-opacity',
                active && 'text-primary',
                // Chữ mục chưa chọn: fg-secondary/70 (5.6:1 trên header) – Figma line-divider + opacity 70 chỉ 2.43:1 (duyệt 26/10/2026).
                !active && !item.disabled && 'text-fg-secondary/70 hover:text-fg-secondary',
                item.disabled && 'cursor-not-allowed text-fg-disabled opacity-70',
              )}
            >
              <NavTabContent item={item} active={active} expanded={expanded} shownLabel={currentChild?.label ?? item.label} childLabel={childLabel} />
            </button>
          );
        })}
      </div>
      {openItem?.children && (
        <SubMenu
          id={menuId}
          label={openItem.label}
          items={openItem.children}
          value={value}
          initialFocus={initialFocus}
          style={{ left: menuLeft }}
          onSelect={(id) => {
            closeMenu(true);
            onChange(id);
          }}
          onClose={closeMenu}
        />
      )}
    </nav>
  );
}

/** Nội dung một tab: icon · (tên mục cha cho trình đọc) · tên hiện · số đếm · mũi tên menu. */
function NavTabContent({
  item,
  active,
  expanded,
  shownLabel,
  childLabel,
}: {
  item: NavTabsProps['items'][number];
  active: boolean;
  expanded: boolean;
  shownLabel: string;
  childLabel?: string;
}) {
  return (
    <>
      <Icon name={active && item.activeIcon ? item.activeIcon : item.icon} box={24} className={cn(!active && 'opacity-70 group-hover:opacity-100')} />
      {childLabel && <span className="sr-only">{item.label} – </span>}
      <span className={cn(!active && 'sr-only wide:not-sr-only')}>{shownLabel}</span>
      {!!item.count && <Badge variant="count" value={item.count} tone="danger" size="md" />}
      {!!item.children?.length && (
        <Icon name="navChevronDown" box={24} className={cn('hidden transition-transform wide:block', expanded && 'rotate-180')} />
      )}
    </>
  );
}

/**
 * Dropdown menu con của NavTabs (WAI-ARIA menu button): ↑/↓/Home/End di chuyển, Enter/Space chọn,
 * Esc đóng + trả focus về tab cha, Tab đóng và để focus đi tiếp.
 */
function SubMenu({
  id,
  label,
  items,
  value,
  initialFocus,
  style,
  onSelect,
  onClose,
}: {
  id: string;
  label: string;
  items: readonly NavSubItem[];
  value: string;
  initialFocus: 'first' | 'last';
  style: CSSProperties;
  onSelect: (id: string) => void;
  onClose: (returnFocus: boolean) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0);

  useEffect(() => {
    const target = initialFocus === 'last' ? enabled[enabled.length - 1] : enabled[0];
    if (target !== undefined) refs.current[target]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Chỉ khi vừa mở.
  }, []);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    const pos = enabled.indexOf(index);
    let next: number | undefined;
    switch (e.key) {
      case 'ArrowDown':
        next = enabled[(pos + 1) % enabled.length];
        break;
      case 'ArrowUp':
        next = enabled[(pos - 1 + enabled.length) % enabled.length];
        break;
      case 'Home':
        next = enabled[0];
        break;
      case 'End':
        next = enabled[enabled.length - 1];
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        onClose(true);
        return;
      case 'Tab':
        onClose(false);
        return;
      default:
        return;
    }
    e.preventDefault();
    if (next !== undefined) refs.current[next]?.focus();
  };

  return (
    <ul
      id={id}
      role="menu"
      aria-label={label}
      style={style}
      className="absolute top-full z-40 mt-2 min-w-60 rounded-lg border border-line/30 bg-surface-raised p-1 shadow-card"
    >
      {items.map((item, i) => {
        const current = item.id === value;
        return (
          <li key={item.id} role="none">
            <button
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              aria-current={current ? 'page' : undefined}
              aria-disabled={item.disabled || undefined}
              onClick={() => !item.disabled && onSelect(item.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                'flex w-full items-center rounded-md px-3 py-2 text-left text-md hover:bg-surface-muted/50',
                current ? 'font-semibold text-primary' : 'text-fg-secondary',
                item.disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              {item.label}
            </button>
          </li>
        );
      })}
    </ul>
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
  const current = items.flatMap((i) => [i, ...(i.children ?? [])]).find((i) => i.id === value);

  useDismiss(
    open,
    root,
    (reason) => {
      setOpen(false);
      if (reason === 'escape') button.current?.focus();
    },
    { escape: true },
  );

  return (
    <nav aria-label={label} className={cn('relative', className)} ref={root}>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className="flex h-[41px] max-w-full items-center gap-2 rounded-md px-2 text-md font-semibold text-primary hover:bg-surface-muted/40"
      >
        <MenuIcon />
        {/* Nhãn dài ("Bản đồ nội khu") không xuống dòng; không đủ chỗ (điện thoại) thì co lại và cắt "…". */}
        <span className="min-w-0 truncate whitespace-nowrap">{current?.label ?? 'Menu'}</span>
        <span className="sr-only">– mở menu điều hướng</span>
      </button>
      {open && (
        <ul id={listId} className="absolute left-0 top-full z-40 mt-1 min-w-56 rounded-lg border border-line/30 bg-surface-raised p-1 shadow-card">
          {items.map((item) => {
            const active = item.id === value;
            const choose = (id: string) => {
              setOpen(false);
              onChange(id);
              button.current?.focus();
            };
            // Mục có menu con: tên mục làm tiêu đề nhóm, các mục con thụt vào bên dưới.
            if (item.children?.length) {
              const groupId = `${listId}-${item.id}`;
              const inGroup = item.children.some((c) => c.id === value);
              return (
                <li key={item.id}>
                  <span
                    id={groupId}
                    className={cn('flex items-center gap-2.5 px-3 py-2 text-md', inGroup ? 'font-semibold text-primary' : 'text-fg-secondary')}
                  >
                    <Icon name={item.icon} box={24} />
                    {item.label}
                  </span>
                  <ul aria-labelledby={groupId}>
                    {item.children.map((child) => {
                      const childActive = child.id === value;
                      return (
                        <li key={child.id}>
                          <button
                            type="button"
                            aria-current={childActive ? 'page' : undefined}
                            disabled={child.disabled}
                            onClick={() => choose(child.id)}
                            className={cn(
                              'flex w-full items-center rounded-md py-2 pl-[46px] pr-3 text-left text-md hover:bg-surface-muted/50',
                              childActive ? 'font-semibold text-primary' : 'text-fg-secondary',
                              child.disabled && 'cursor-not-allowed opacity-50',
                            )}
                          >
                            {child.label}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            }
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  disabled={item.disabled}
                  onClick={() => choose(item.id)}
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
