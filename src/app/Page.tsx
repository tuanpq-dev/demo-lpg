import { Suspense, useEffect, useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppHeader, AppMain, AppShell, preloadIcons, type AppMainProps } from '@/components';
import { useUnacknowledgedCount } from '@/data/alertApi';
import { ROLE_LABELS } from '@/features/auth/permissions';
import { whenIdle } from '@/lib/whenIdle';
import { useAuth } from './auth';
import { LiveAnnouncer } from './LiveAnnouncer';
import { OfflineBanner } from './OfflineBanner';
import { ToastHost } from './ToastHost';
import { NAV_ROUTES, navIdFromPath, navPathFromId } from './navigation';
import { isSettingsPath, settingsHref, settingsMenuFor } from './settingsRoutes';

/** AppHeader gắn với React Router: tab active theo URL, chọn tab → navigate. */
function RoutedAppHeader() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const unack = useUnacknowledgedCount();
  // Ảnh icon của trạng thái chưa hiện (tab sáng lần đầu / tab đang sáng tắt đi) → tải trước lúc rảnh để lần đầu chuyển tab không thiếu ảnh.
  useEffect(() => whenIdle(() => preloadIcons(NAV_ICONS)), []);
  const navItems = useMemo(() => NAV_ROUTES.map((r) => (r.id === 'alerts' ? { ...r, count: unack || undefined } : r)), [unack]);
  const settings = useMemo(() => settingsMenuFor(search, user?.role), [search, user?.role]);
  const onSettingsSelect = (id: string) => {
    const route = settings.find((r) => r.id === id);
    if (route) void navigate(settingsHref(route, search));
  };
  const onUserMenuSelect = (id: string) => {
    if (id !== 'logout') return;
    void logout().then(() => void navigate('/login', { replace: true }));
  };

  return (
    <AppHeader
      navItems={navItems}
      navValue={navIdFromPath(pathname)}
      onNavChange={(id) => {
        const path = navPathFromId(id);
        if (path) void navigate(path);
      }}
      user={{
        name: user?.name ?? '—',
        detail: user ? `${user.email} · ${ROLE_LABELS[user.role]}` : undefined,
      }}
      settingsMenu={settings}
      onSettingsMenuSelect={onSettingsSelect}
      settingsActive={isSettingsPath(pathname)}
      userMenu={USER_MENU}
      onUserMenuSelect={onUserMenuSelect}
      notificationCount={unack ?? 0}
    />
  );
}

/** Mỗi tab có hai ảnh (thường / đang chọn); lúc mở trang mới tải một trong hai. */
const NAV_ICONS = NAV_ROUTES.flatMap((r) => (r.activeIcon ? [r.icon, r.activeIcon] : [r.icon]));

const USER_MENU = [{ id: 'logout', label: 'Đăng xuất' }] as const;

/**
 * Khung app của mọi trang cần đăng nhập – layout route PHÍA TRÊN các trang (`main.tsx`): header, vùng thông báo, banner
 * mất mạng, toast dựng MỘT lần; chuyển trang chỉ đổi `<Outlet />`. Header không bị gỡ / dựng lại nên không nháy và giữ
 * nguyên số cảnh báo đang hiện.
 */
export function AppFrame() {
  return (
    <>
      <AppShell header={<RoutedAppHeader />}>
        {/* Chunk trang đang tải lần đầu: giữ header, chỉ phần thân hiện chờ. */}
        <Suspense
          fallback={
            <main className="flex flex-1 items-center justify-center text-sm text-fg-muted" aria-busy="true">
              Đang tải trang…
            </main>
          }
        >
          <Outlet />
        </Suspense>
      </AppShell>
      <LiveAnnouncer />
      <OfflineBanner />
      <ToastHost />
    </>
  );
}

/** Phần thân một trang (page header + nội dung) – đặt trong `AppFrame`. */
export function Page(props: AppMainProps) {
  return <AppMain {...props} />;
}
