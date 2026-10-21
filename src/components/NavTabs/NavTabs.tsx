import type { IconName } from '@/assets/digital-twin';
import { cn } from '@/lib/cn';
import { useRovingFocus } from '@/lib/useRovingFocus';
import { Badge } from '../Badge';
import { Icon } from '../Icon';

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
      <div role="tablist" aria-label={label} aria-orientation="horizontal" className="flex items-center gap-11">
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
              <span>{item.label}</span>
              {!!item.count && (
                <Badge variant="count" value={item.count} tone="danger" size="md" />
              )}
              {item.hasSubmenu && <Icon name="navChevronDown" box={24} />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
