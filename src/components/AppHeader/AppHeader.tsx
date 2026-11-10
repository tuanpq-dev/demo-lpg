import { useEffect, useId, useRef, useState } from 'react';
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

export type AppHeaderProps = {
  navItems: readonly NavTabItem[];
  navValue: string;
  onNavChange: (id: string) => void;
  user: AppHeaderUser;
  /** Số thông báo chưa đọc; 0/undefined → ẩn badge. */
  notificationCount?: number;
  onNotificationsClick?: () => void;
  onSettingsClick?: () => void;
  onUserClick?: () => void;
  /** Có → nút người dùng mở menu tài khoản (vd "Đăng xuất"); chọn mục → `onUserMenuSelect(id)`. */
  userMenu?: readonly { id: string; label: string }[];
  onUserMenuSelect?: (id: string) => void;
  /** Mặc định "Plant Control" / "Operational Intelligence". */
  title?: string;
  subtitle?: string;
  className?: string;
};

/** Thanh trên cùng cao 60px (Figma 53:13): logo · NavTabs · thông báo/cài đặt/người dùng. */
export function AppHeader({
  navItems,
  navValue,
  onNavChange,
  user,
  notificationCount,
  onNotificationsClick,
  onSettingsClick,
  onUserClick,
  userMenu,
  onUserMenuSelect,
  title = 'Plant Control',
  subtitle = 'Operational Intelligence',
  className,
}: AppHeaderProps) {
  return (
    <header className={cn('flex h-header items-center justify-between gap-6 bg-bg-header px-6', className)}>
      {/* Logo – 53:14 */}
      <div className="flex shrink-0 items-center gap-3 px-2">
        <span className="flex size-10 items-center justify-center rounded-lg border border-accent/20 bg-accent/10">
          <Icon name="logo" box={20} />
        </span>
        <div className="flex flex-col">
          <span className="text-lg text-fg">{title}</span>
          <span className="text-2xs text-fg-muted">{subtitle}</span>
        </div>
      </div>

      {/* ≥ xl: menu ngang (chỉ icon tới wide); < xl: nút Menu xổ danh sách. */}
      <NavTabs items={navItems} value={navValue} onChange={onNavChange} className="hidden min-w-0 xl:block" />
      <NavMenu items={navItems} value={navValue} onChange={onNavChange} className="mr-auto xl:hidden" />

      {/* Nhóm phải – 53:76 */}
      <div className="flex shrink-0 items-center gap-[26px] pl-2.5 pr-2">
        <div className="flex items-center gap-[22px]">
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
          <button
            type="button"
            aria-label="Cài đặt"
            onClick={onSettingsClick}
            className="inline-flex rounded-md opacity-90 transition-opacity hover:opacity-100"
          >
            <Icon name="settings" box={24} />
          </button>
          <Divider orientation="vertical" tone="strong" className="h-[23px] self-center" />
        </div>
        {userMenu?.length ? (
          <UserMenu user={user} items={userMenu} onSelect={(id) => onUserMenuSelect?.(id)} />
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

function UserButtonContent({ user }: { user: AppHeaderUser }) {
  return (
    <>
      <img src={user.avatarSrc ?? avatarAdmin} alt="" width={34} height={34} className="size-[34px] rounded-full" />
      <span className="max-w-[120px] truncate">{user.name}</span>
    </>
  );
}

/** Menu tài khoản (disclosure như NavMenu): Esc / click ra ngoài đóng và trả focus về nút. */
function UserMenu({
  user,
  items,
  onSelect,
}: {
  user: AppHeaderUser;
  items: readonly { id: string; label: string }[];
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();

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
    <div className="relative" ref={root}>
      <button ref={button} type="button" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((o) => !o)} className={userButtonClass}>
        <UserButtonContent user={user} />
        <span className="sr-only">– mở menu tài khoản</span>
      </button>
      {open && (
        <div id={listId} className="absolute right-0 top-full z-40 mt-2 min-w-56 rounded-lg border border-line/30 bg-surface-raised p-1 shadow-card">
          <div className="border-b border-line/30 px-3 py-2">
            <p className="truncate text-md font-semibold text-fg">{user.name}</p>
            {user.detail && <p className="truncate text-xs text-fg-muted">{user.detail}</p>}
          </div>
          <ul className="pt-1">
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
