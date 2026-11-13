import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { useDismiss } from '@/hooks/useDismiss';
import { avatarAdmin } from '@/assets/digital-twin';
import { cn } from '@/lib/cn';
import { Badge } from '../Badge';
import { Divider } from '../Divider';
import { Icon } from '../Icon';
import { NavMenu, NavTabs, type NavTabItem } from '../NavTabs';

export type AppHeaderUser = {
  name: string;
  /** Dòng phụ trong menu tài khoản (vd email · vai trò). Không hiện trên thanh header (giữ đúng Figma). */
  detail?: string;
  /** Ảnh đại diện 34px; mặc định ảnh mẫu từ Figma (53:91). */
  avatarSrc?: string;
};

export type HeaderMenuItem = { id: string; label: string };

export type AppHeaderProps = {
  navItems: readonly NavTabItem[];
  navValue: string;
  onNavChange: (id: string) => void;
  user: AppHeaderUser;
  /** Số thông báo chưa đọc; 0/undefined → ẩn badge. */
  notificationCount?: number;
  onNotificationsClick?: () => void;
  onSettingsClick?: () => void;
  /** Có (≥ 1 mục) → nút Cài đặt mở menu (vd "Chỉnh sửa bản đồ 3D"); chọn mục → `onSettingsMenuSelect(id)`. */
  settingsMenu?: readonly HeaderMenuItem[];
  onSettingsMenuSelect?: (id: string) => void;
  /** Đang ở một trang cài đặt → nút Cài đặt có nền + viền màu nhấn (không tab menu chính nào sáng). */
  settingsActive?: boolean;
  onUserClick?: () => void;
  /** Có → nút người dùng mở menu tài khoản (vd "Đăng xuất"); chọn mục → `onUserMenuSelect(id)`. */
  userMenu?: readonly HeaderMenuItem[];
  onUserMenuSelect?: (id: string) => void;
  /** Mặc định "Plant Control" / "Operational Intelligence". */
  title?: string;
  subtitle?: string;
  className?: string;
};

/**
 * Thanh trên cùng cao 60px (Figma 53:13): logo · NavTabs · thông báo/cài đặt/người dùng.
 * < sm (điện thoại): thu gọn để KHÔNG tràn ngang – chỉ icon logo (tên app chỉ còn cho trình đọc màn hình), khoảng cách hẹp,
 * tên người dùng ẩn (vẫn có trong menu tài khoản + tên truy cập của nút), nhãn nút Menu co lại và cắt "…".
 */
export function AppHeader({
  navItems,
  navValue,
  onNavChange,
  user,
  notificationCount,
  onNotificationsClick,
  onSettingsClick,
  settingsMenu,
  onSettingsMenuSelect,
  settingsActive,
  onUserClick,
  userMenu,
  onUserMenuSelect,
  title = 'Plant Control',
  subtitle = 'Operational Intelligence',
  className,
}: AppHeaderProps) {
  return (
    <header className={cn('flex h-header items-center justify-between gap-2 bg-bg-header px-3 sm:gap-6 sm:px-6', className)}>
      {/* Logo – 53:14 */}
      <div className="flex shrink-0 items-center gap-3 sm:px-2">
        <span className="flex size-10 items-center justify-center rounded-lg border border-accent/20 bg-accent/10">
          <Icon name="logo" box={20} />
        </span>
        <div className="sr-only flex-col sm:not-sr-only sm:flex">
          <span className="text-lg text-fg">{title}</span>
          <span className="text-2xs text-fg-muted">{subtitle}</span>
        </div>
      </div>

      {/* ≥ xl: menu ngang (chỉ icon tới wide); < xl: nút Menu xổ danh sách. */}
      <NavTabs items={navItems} value={navValue} onChange={onNavChange} className="hidden min-w-0 xl:block" />
      <NavMenu items={navItems} value={navValue} onChange={onNavChange} className="mr-auto min-w-0 xl:hidden" />

      {/* Nhóm phải – 53:76 */}
      <div className="flex shrink-0 items-center gap-3.5 sm:gap-[26px] sm:pl-2.5 sm:pr-2">
        <div className="flex items-center gap-3.5 sm:gap-[22px]">
          <button
            type="button"
            aria-label={notificationCount ? `Thông báo (${notificationCount} chưa đọc)` : 'Thông báo'}
            onClick={onNotificationsClick}
            className="group relative inline-flex rounded-md"
          >
            {/* Chỉ icon mờ 90 % (Figma) – huy hiệu số không bị làm mờ theo (giữ tương phản chữ). */}
            <span className="inline-flex opacity-90 transition-opacity group-hover:opacity-100">
              <Icon name="bell" box={24} />
            </span>
            {!!notificationCount && <Badge variant="count" value={notificationCount} tone="danger" outlined className="absolute -right-2 -top-1.5" />}
          </button>
          {settingsMenu?.length ? (
            <HeaderMenu
              triggerClass={settingsButtonClass(settingsActive)}
              trigger={<Icon name="settings" box={24} />}
              triggerLabel="Cài đặt"
              items={settingsMenu}
              onSelect={(id) => onSettingsMenuSelect?.(id)}
            />
          ) : (
            <button type="button" aria-label="Cài đặt" onClick={onSettingsClick} className={settingsButtonClass(settingsActive)}>
              <Icon name="settings" box={24} />
            </button>
          )}
          <Divider orientation="vertical" tone="strong" className="h-[23px] self-center" />
        </div>
        {userMenu?.length ? (
          <HeaderMenu
            triggerClass={userButtonClass}
            trigger={
              <>
                <UserButtonContent user={user} />
                <span className="sr-only">– mở menu tài khoản</span>
              </>
            }
            heading={
              <div className="border-b border-line/30 px-3 py-2">
                <p className="truncate text-md font-semibold text-fg">{user.name}</p>
                {user.detail && <p className="truncate text-xs text-fg-muted">{user.detail}</p>}
              </div>
            }
            items={userMenu}
            onSelect={(id) => onUserMenuSelect?.(id)}
          />
        ) : (
          <button type="button" onClick={onUserClick} className={userButtonClass}>
            <UserButtonContent user={user} />
          </button>
        )}
      </div>
    </header>
  );
}

const userButtonClass = 'flex items-center gap-3 rounded-md text-md font-semibold leading-normal text-primary';

/** Icon là ảnh (màu cố định) → trang cài đặt đang mở hiện bằng nền + viền màu nhấn quanh icon. */
const settingsButtonClass = (active?: boolean) =>
  cn('inline-flex rounded-md transition-opacity hover:opacity-100', active ? 'bg-accent/15 opacity-100 ring-1 ring-accent/40' : 'opacity-90');

function UserButtonContent({ user }: { user: AppHeaderUser }) {
  return (
    <>
      <img src={user.avatarSrc ?? avatarAdmin} alt="" width={34} height={34} className="size-[34px] rounded-full" />
      {/* < sm: chỉ avatar – tên vẫn là tên truy cập của nút và hiện trong menu tài khoản. */}
      <span className="sr-only max-w-[120px] truncate sm:not-sr-only">{user.name}</span>
    </>
  );
}

/**
 * Menu xổ của header (tài khoản, cài đặt) – disclosure như NavMenu: nút `aria-expanded`, Esc / click ra ngoài đóng và trả focus
 * về nút; chọn mục → đóng rồi `onSelect(id)`.
 */
function HeaderMenu({
  trigger,
  triggerLabel,
  triggerClass,
  heading,
  items,
  onSelect,
}: {
  trigger: ReactNode;
  /** Tên truy cập của nút khi `trigger` chỉ là icon. */
  triggerLabel?: string;
  triggerClass: string;
  /** Khối đầu menu (vd tên + email người dùng). */
  heading?: ReactNode;
  items: readonly HeaderMenuItem[];
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const listId = useId();
  const place = useMenuPlacement(open, root, button, menu);

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
    <div className="relative" ref={root}>
      <button
        ref={button}
        type="button"
        aria-label={triggerLabel}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className={triggerClass}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={menu}
          id={listId}
          style={place.menu}
          className="absolute left-0 top-full z-40 mt-3 w-max min-w-56 max-w-[calc(100vw-2rem)] rounded-lg border border-line/50 bg-surface-raised p-1 shadow-card"
        >
          {/* Mũi tên chỉ vào giữa nút (kể cả khi menu bị dịch vào trong vì sát mép màn). */}
          <span
            aria-hidden="true"
            style={place.arrow}
            className="absolute -top-1.5 size-3 -translate-x-1/2 rotate-45 rounded-tl-xs border-l border-t border-line/50 bg-surface-raised"
          />
          {heading}
          <ul className={heading ? 'pt-1' : undefined}>
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onSelect(item.id);
                  }}
                  className="flex w-full items-center rounded-md px-3 py-2 text-left text-md text-fg-secondary hover:bg-surface-muted/50"
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Khoảng cách tối thiểu từ menu tới mép màn hình (= lề trang 16 px). */
const MENU_GUTTER = 16;

/**
 * Vị trí menu xổ của header: căn GIỮA dưới nút; không đủ chỗ (màn nhỏ, nút sát mép) → dịch vào trong, luôn cách mép màn
 * `MENU_GUTTER`; mũi tên vẫn chỉ đúng giữa nút. Tính trước khi vẽ (layout effect) + khi đổi kích thước cửa sổ.
 */
function useMenuPlacement(
  open: boolean,
  root: RefObject<HTMLElement>,
  button: RefObject<HTMLElement>,
  menu: RefObject<HTMLElement>,
): { menu?: CSSProperties; arrow?: CSSProperties } {
  const [pos, setPos] = useState<{ left: number; arrow: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const update = () => {
      const r = root.current?.getBoundingClientRect();
      const b = button.current?.getBoundingClientRect();
      const w = menu.current?.offsetWidth;
      if (!r || !b || !w) return;
      const center = b.left + b.width / 2;
      const max = Math.max(MENU_GUTTER, document.documentElement.clientWidth - MENU_GUTTER - w);
      const left = Math.min(Math.max(center - w / 2, MENU_GUTTER), max);
      setPos({ left: left - r.left, arrow: Math.min(Math.max(center - left, 14), w - 14) });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [open, root, button, menu]);
  // Lần vẽ đầu (chưa đo) ẩn để không nháy ở vị trí sai.
  if (!pos) return { menu: { visibility: 'hidden' } };
  return { menu: { transform: `translateX(${pos.left}px)` }, arrow: { left: pos.arrow } };
}
