import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { loginUrl } from '@/features/auth/session';
import { useAuth } from './AuthProvider';

/** Route bảo vệ: chưa đăng nhập → /login?next=<trang định vào>; đang khôi phục phiên → màn chờ. */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-app text-sm text-fg-muted" aria-busy="true">
        Đang kiểm tra phiên đăng nhập…
      </div>
    );
  }
  if (status === 'anonymous') return <Navigate to={loginUrl(location)} replace />;
  return <Outlet />;
}
