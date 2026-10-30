import { useLocation, useNavigate } from 'react-router-dom';
import { AppHeader, AppLayout, type AppLayoutProps } from '@/components';
import { ROLE_LABELS } from '@/features/auth/permissions';
import { useAuth } from './auth';
import { LiveAnnouncer } from './LiveAnnouncer';
import { NAV_ROUTES, navIdFromPath, navPathFromId } from './navigation';

/** AppHeader gắn với React Router: tab active theo URL, chọn tab → navigate. */
export function RoutedAppHeader() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <AppHeader
      navItems={NAV_ROUTES}
      navValue={navIdFromPath(pathname)}
      onNavChange={(id) => {
        const path = navPathFromId(id);
        if (path) navigate(path);
      }}
      user={{
        name: user?.name ?? '—',
        detail: user ? `${user.email} · ${ROLE_LABELS[user.role]}` : undefined,
      }}
      userMenu={USER_MENU}
      onUserMenuSelect={async (id) => {
        if (id !== 'logout') return;
        await logout();
        navigate('/login', { replace: true });
      }}
      notificationCount={2}
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
    </>
  );
}
