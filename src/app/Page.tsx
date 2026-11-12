import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppHeader, AppLayout, type AppLayoutProps } from '@/components';
import { useUnacknowledgedCount } from '@/data/alertApi';
import { ROLE_LABELS } from '@/features/auth/permissions';
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

const USER_MENU = [{ id: 'logout', label: 'Đăng xuất' }] as const;

/** AppLayout với header đã gắn router – dùng cho mọi trang. */
export function Page(props: Omit<AppLayoutProps, 'header'>) {
  return (
    <>
      <AppLayout header={<RoutedAppHeader />} {...props} />
      <LiveAnnouncer />
      <OfflineBanner />
      <ToastHost />
    </>
  );
}
