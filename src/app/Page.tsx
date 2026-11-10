import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppHeader, AppLayout, type AppLayoutProps } from '@/components';
import { useAlertList } from '@/data/alertStore';
import { ROLE_LABELS } from '@/features/auth/permissions';
import { useAuth } from './auth';
import { LiveAnnouncer } from './LiveAnnouncer';
import { OfflineBanner } from './OfflineBanner';
import { ToastHost } from './ToastHost';
import { NAV_ROUTES, navIdFromPath, navPathFromId } from './navigation';

/** Số cảnh báo chưa xác nhận (tab Cảnh báo + chuông); undefined khi chưa tải xong. */
function useUnacknowledgedCount(): number | undefined {
  const { data } = useAlertList();
  return data?.filter((a) => a.status === 'unacknowledged').length;
}

/** AppHeader gắn với React Router: tab active theo URL, chọn tab → navigate. */
function RoutedAppHeader() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const unack = useUnacknowledgedCount();
  const navItems = useMemo(() => NAV_ROUTES.map((r) => (r.id === 'alerts' ? { ...r, count: unack || undefined } : r)), [unack]);
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
