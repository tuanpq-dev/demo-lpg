import { useLocation, useNavigate } from 'react-router-dom';
import { AppHeader, AppLayout, type AppLayoutProps } from '@/components';
import { NAV_ROUTES, navIdFromPath } from './navigation';

/** AppHeader gắn với React Router: tab active theo URL, chọn tab → navigate. */
export function RoutedAppHeader() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <AppHeader
      navItems={NAV_ROUTES}
      navValue={navIdFromPath(pathname)}
      onNavChange={(id) => {
        const path = NAV_ROUTES.find((r) => r.id === id)?.path;
        if (path) navigate(path);
      }}
      user={{ name: 'Admin' }}
      notificationCount={2}
    />
  );
}

/** AppLayout với header đã gắn router – dùng cho mọi trang. */
export function Page(props: Omit<AppLayoutProps, 'header'>) {
  return <AppLayout header={<RoutedAppHeader />} {...props} />;
}
