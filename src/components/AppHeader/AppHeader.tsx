import { avatarAdmin } from '@/assets/digital-twin';
import { cn } from '@/lib/cn';
import { Badge } from '../Badge';
import { Divider } from '../Divider';
import { Icon } from '../Icon';
import { NavMenu, NavTabs, type NavTabItem } from '../NavTabs';

export type AppHeaderUser = {
  name: string;
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
  title = 'Plant Control',
  subtitle = 'Operational Intelligence',
  className,
}: AppHeaderProps) {
  return (
    <header
      className={cn('flex h-header items-center justify-between gap-6 bg-bg-header px-6', className)}
    >
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
            className="relative inline-flex rounded-md opacity-90 transition-opacity hover:opacity-100"
          >
            <Icon name="bell" box={24} />
            {!!notificationCount && (
              <Badge
                variant="count"
                value={notificationCount}
                tone="danger"
                className="absolute -right-2 -top-1.5"
              />
            )}
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
        <button
          type="button"
          onClick={onUserClick}
          className="flex items-center gap-3 rounded-md text-md font-semibold leading-normal text-primary"
        >
          <img src={user.avatarSrc ?? avatarAdmin} alt="" width={34} height={34} className="size-[34px] rounded-full" />
          <span className="max-w-[120px] truncate">{user.name}</span>
        </button>
      </div>
    </header>
  );
}
