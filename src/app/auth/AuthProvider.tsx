import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { authService as defaultService, type AuthService, type AuthState } from '@/api/auth';
import type { LoginRequest, RegisterRequest, User } from '@/api/types';
import { can, type Permission } from '@/features/auth/permissions';
import { refreshDelayMs } from '@/features/auth/session';
import { clearRememberedQueries } from '@/lib/useQuery';

export type AuthContextValue = AuthState & {
  login(input: LoginRequest): Promise<User>;
  register(input: RegisterRequest): Promise<string>;
  logout(): Promise<void>;
  /** Ẩn/hiện theo quyền – CHỈ là UX, backend kiểm tra lại mọi request. */
  can(permission: Permission): boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Phiên đăng nhập cho cả app: khôi phục phiên khi mở (POST /auth/refresh + GET /auth/me),
 * refresh chủ động 60 s trước `exp` của access token (nếu đọc được). `service` thay được trong test.
 */
export function AuthProvider({ service = defaultService, children }: { service?: AuthService; children: ReactNode }) {
  const state = useSyncExternalStore(service.subscribe, service.getState);

  useEffect(() => {
    void service.init();
  }, [service]);

  useEffect(() => {
    const exp = service.expiresAt();
    if (state.status !== 'authenticated' || exp === null) return;
    const id = window.setTimeout(() => void service.refresh(), refreshDelayMs(exp, Date.now()));
    return () => window.clearTimeout(id);
  }, [service, state]);

  // Hết phiên (đăng xuất ở tab này / tab khác, phiên bị thu hồi) → bỏ dữ liệu trang đã nhớ của phiên đó.
  useEffect(() => {
    if (state.status === 'anonymous') clearRememberedQueries();
  }, [state.status]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login: service.login,
      register: service.register,
      logout: service.logout,
      can: (p) => can(state.user?.role, p),
    }),
    [service, state],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải nằm trong <AuthProvider>');
  return ctx;
}

/** `const canAck = useCan('alert:acknowledge')` – ẩn nút theo vai trò. */
export function useCan(permission: Permission): boolean {
  return useAuth().can(permission);
}
