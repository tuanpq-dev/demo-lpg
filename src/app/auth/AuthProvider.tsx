import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { AuthUser } from '@demo-lpg/shared/auth';
import { can, type Permission } from '@demo-lpg/shared/roles';
import { authClient as defaultClient, type AuthClient, type AuthState } from '@/data/auth';
import { refreshDelayMs } from '@/features/auth/session';

export type AuthContextValue = AuthState & {
  login(email: string, password: string): Promise<AuthUser>;
  logout(): Promise<void>;
  /** Ẩn/hiện theo quyền – CHỈ là UX, backend kiểm tra lại mọi request. */
  can(permission: Permission): boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Phiên đăng nhập cho cả app: khôi phục phiên khi mở (refresh bằng cookie), tự refresh trước khi access token hết hạn.
 * `client` thay được trong test (`createAuthClient` với fetch giả).
 */
export function AuthProvider({ client = defaultClient, children }: { client?: AuthClient; children: ReactNode }) {
  const state = useSyncExternalStore(client.subscribe, client.getState);

  useEffect(() => {
    void client.init();
  }, [client]);

  // Mỗi phiên mới (login/refresh tạo state mới) → hẹn refresh trước hạn 60 s.
  useEffect(() => {
    const exp = client.expiresAt();
    if (state.status !== 'authenticated' || exp === null) return;
    const id = window.setTimeout(() => void client.refresh(), refreshDelayMs(exp, Date.now()));
    return () => window.clearTimeout(id);
  }, [client, state]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login: client.login,
      logout: client.logout,
      can: (p) => can(state.user?.role, p),
    }),
    [client, state],
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
