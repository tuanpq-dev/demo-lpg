/**
 * Phiên đăng nhập (trạng thái + các endpoint /auth/*) trên nền `ApiClient`.
 * - Mở app / F5: POST /auth/refresh (cookie) → GET /auth/me → authenticated; bị từ chối → anonymous.
 * - Đăng nhập: POST /auth/login → access token (bộ nhớ) + user. Đăng ký: POST /auth/register → {message} (tài khoản chờ duyệt).
 * - Đăng xuất: POST /auth/logout, xoá phiên kể cả khi máy chủ lỗi; báo các tab khác (BroadcastChannel).
 * - VITE_AUTH=off: `createOfflineAuthService` – phiên giả admin, không gọi backend (demo tĩnh).
 */
import { api as defaultApi, type ApiClient } from './client';
import {
  LoginResponseSchema,
  RegisterResponseSchema,
  UserSchema,
  type LoginRequest,
  type RegisterRequest,
  type User,
} from './types';
import { tokenExpiresAt } from '@/features/auth/session';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';
export type AuthState = { status: AuthStatus; user: User | null };

type Channel = Pick<BroadcastChannel, 'postMessage'> & { onmessage: ((e: MessageEvent) => void) | null };

export interface AuthService {
  getState(): AuthState;
  subscribe(cb: () => void): () => void;
  /** Khôi phục phiên khi mở app. Gọi nhiều lần chỉ chạy một lần. */
  init(): Promise<void>;
  login(input: LoginRequest): Promise<User>;
  /** Trả về thông báo của máy chủ (vd "Tài khoản đang chờ duyệt"). Không đăng nhập. */
  register(input: RegisterRequest): Promise<string>;
  logout(): Promise<void>;
  /** Refresh chủ động trước khi token hết hạn. false = hết phiên. */
  refresh(): Promise<boolean>;
  /** Hết hạn access token (ms epoch, đọc từ `exp` của JWT) – null nếu không đọc được. */
  expiresAt(): number | null;
}

export function createAuthService(client: ApiClient = defaultApi, channel?: Channel): AuthService {
  let state: AuthState = { status: 'loading', user: null };
  let initialized: Promise<void> | null = null;
  const listeners = new Set<() => void>();

  const setState = (next: AuthState) => {
    state = next;
    listeners.forEach((l) => l());
  };
  const signOut = () => {
    client.setAccessToken(null);
    if (state.status !== 'anonymous') setState({ status: 'anonymous', user: null });
  };
  const me = () => client.request('/auth/me', { schema: UserSchema });

  client.onSessionLost(signOut);
  if (channel) {
    channel.onmessage = (e) => {
      if (e.data === 'logout') signOut();
      else if (e.data === 'login' && state.status !== 'authenticated') void restore();
    };
  }

  async function restore() {
    try {
      const token = await client.refresh();
      if (!token) return signOut();
      setState({ status: 'authenticated', user: await me() });
    } catch {
      // Mất mạng / máy chủ lỗi lúc mở app → coi như chưa đăng nhập (trang /login báo lỗi khi bấm đăng nhập).
      signOut();
    }
  }

  return {
    getState: () => state,
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    init() {
      initialized ??= restore();
      return initialized;
    },
    async login(input) {
      const res = await client.request('/auth/login', { method: 'POST', body: input, auth: false, schema: LoginResponseSchema });
      client.setAccessToken(res.accessToken);
      setState({ status: 'authenticated', user: res.user });
      channel?.postMessage('login');
      return res.user;
    },
    async register(input) {
      const res = await client.request('/auth/register', { method: 'POST', body: input, auth: false, schema: RegisterResponseSchema });
      return res.message;
    },
    async logout() {
      try {
        await client.request('/auth/logout', { method: 'POST', auth: false });
      } catch {
        // Không gọi được máy chủ: vẫn xoá phiên phía trình duyệt; cookie hết hạn theo TTL của backend.
      }
      signOut();
      channel?.postMessage('logout');
    },
    async refresh() {
      try {
        if (await client.refresh()) return true;
      } catch {
        return state.status === 'authenticated'; // mất mạng: giữ phiên, lần gọi API sau thử lại
      }
      signOut();
      return false;
    },
    expiresAt() {
      const t = client.getAccessToken();
      return t ? tokenExpiresAt(t) : null;
    },
  };
}

/** Phiên giả admin (VITE_AUTH=off) – không gọi backend. */
export function createOfflineAuthService(user: User): AuthService {
  const state: AuthState = { status: 'authenticated', user };
  return {
    getState: () => state,
    subscribe: () => () => {},
    init: async () => {},
    login: async () => user,
    register: async () => '',
    logout: async () => {},
    refresh: async () => true,
    expiresAt: () => null,
  };
}

export const AUTH_MODE: 'api' | 'off' = import.meta.env.VITE_AUTH === 'off' ? 'off' : 'api';

export const OFFLINE_USER: User = { id: 'demo', email: 'demo@localhost', name: 'Admin', role: 'admin', status: 'active' };

export const authService: AuthService =
  AUTH_MODE === 'off'
    ? createOfflineAuthService(OFFLINE_USER)
    : createAuthService(defaultApi, typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('demo-lpg:auth') : undefined);
