/**
 * Client xác thực + gọi API có token (lớp dữ liệu – chỗ duy nhất biết endpoint /auth/*).
 * - Access token CHỈ trong bộ nhớ (biến của module) – không localStorage. F5 → khôi phục bằng POST /auth/refresh (cookie HttpOnly).
 * - Refresh một luồng: trong tab gộp lời gọi đồng thời; giữa các tab xếp hàng bằng Web Locks
 *   (backend coi hai lần dùng cùng refresh token là "dùng lại" → thu hồi cả chuỗi).
 * - `apiFetch`: gắn Bearer, gặp 401 → refresh 1 lần rồi gọi lại; refresh thất bại → về trạng thái chưa đăng nhập.
 * - VITE_AUTH=off: không gọi backend, phiên giả admin (demo tĩnh / Netlify) – xem `createOfflineAuthClient`.
 */
import type { AuthSession, AuthUser } from '@demo-lpg/shared/auth';
import { isExpiring } from '@/features/auth/session';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';
export type AuthState = { status: AuthStatus; user: AuthUser | null };

export type AuthErrorKind = 'invalid' | 'locked' | 'rate-limited' | 'network' | 'server';

export class AuthError extends Error {
  constructor(
    readonly kind: AuthErrorKind,
    message: string,
    /** Giây phải chờ (header Retry-After) khi bị khoá / giới hạn tần suất. */
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface AuthClient {
  getState(): AuthState;
  subscribe(cb: () => void): () => void;
  /** Khôi phục phiên khi mở app (refresh bằng cookie). Gọi nhiều lần an toàn. */
  init(): Promise<void>;
  login(email: string, password: string): Promise<AuthUser>;
  /** true = có phiên mới; false = hết phiên (đã chuyển sang anonymous). */
  refresh(): Promise<boolean>;
  logout(): Promise<void>;
  /** Thời điểm access token hết hạn (ms epoch), null khi chưa đăng nhập. */
  expiresAt(): number | null;
  apiFetch(path: string, init?: RequestInit): Promise<Response>;
}

type Deps = {
  baseUrl: string;
  fetch: typeof fetch;
  now: () => number;
  /** Khoá giữa các tab (Web Locks). Không có → chỉ gộp trong tab. */
  lock?: <T>(fn: () => Promise<T>) => Promise<T>;
  /** Đồng bộ đăng nhập/đăng xuất giữa các tab. */
  channel?: Pick<BroadcastChannel, 'postMessage'> & { onmessage: ((e: MessageEvent) => void) | null };
};

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    const m = Array.isArray(body.message) ? body.message[0] : body.message;
    return m || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Đọc phiên từ response 200. Không phải JSON phiên hợp lệ (vd host tĩnh trả index.html cho /api/*) → null,
 * coi như thất bại thay vì treo ở trạng thái "loading".
 */
async function readSession(res: Response): Promise<AuthSession | null> {
  try {
    const s = (await res.json()) as Partial<AuthSession>;
    return typeof s.accessToken === 'string' && typeof s.expiresIn === 'number' && s.user?.role ? (s as AuthSession) : null;
  } catch {
    return null;
  }
}

export function createAuthClient(deps: Deps): AuthClient {
  let session: { accessToken: string; expiresAt: number } | null = null;
  let state: AuthState = { status: 'loading', user: null };
  let inflight: Promise<boolean> | null = null;
  let initialized: Promise<void> | null = null;
  const listeners = new Set<() => void>();

  const setState = (next: AuthState) => {
    state = next;
    listeners.forEach((l) => l());
  };
  const accept = (s: AuthSession) => {
    session = { accessToken: s.accessToken, expiresAt: deps.now() + s.expiresIn * 1000 };
    setState({ status: 'authenticated', user: s.user });
  };
  const clear = () => {
    session = null;
    if (state.status !== 'anonymous' || state.user) setState({ status: 'anonymous', user: null });
  };

  const post = (path: string, body?: unknown) =>
    deps.fetch(`${deps.baseUrl}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

  const doRefresh = async (): Promise<boolean> => {
    let res: Response;
    try {
      res = await post('/auth/refresh');
    } catch {
      // Mất mạng: giữ phiên hiện có (nếu còn), lần sau thử lại; lúc khởi động → coi như chưa đăng nhập.
      if (!session) clear();
      return false;
    }
    const s = res.ok ? await readSession(res) : null;
    if (s) {
      accept(s);
      return true;
    }
    clear();
    return false;
  };

  const refresh = () => {
    inflight ??= (deps.lock ? deps.lock(doRefresh) : doRefresh()).finally(() => {
      inflight = null;
    });
    return inflight;
  };

  if (deps.channel) {
    deps.channel.onmessage = (e) => {
      if (e.data === 'logout') clear();
      else if (e.data === 'login' && state.status !== 'authenticated') void refresh();
    };
  }

  return {
    getState: () => state,
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    init() {
      initialized ??= refresh().then(() => undefined);
      return initialized;
    },
    async login(email, password) {
      let res: Response;
      try {
        res = await post('/auth/login', { email, password });
      } catch {
        throw new AuthError('network', 'Không kết nối được máy chủ. Kiểm tra mạng hoặc thử lại sau.');
      }
      if (res.ok) {
        const s = await readSession(res);
        if (!s) throw new AuthError('server', 'Không kết nối được máy chủ xác thực (phản hồi không hợp lệ).');
        accept(s);
        deps.channel?.postMessage('login');
        return s.user;
      }
      const retry = Number(res.headers.get('Retry-After')) || undefined;
      if (res.status === 401) throw new AuthError('invalid', await errorMessage(res, 'Email hoặc mật khẩu không đúng'));
      if (res.status === 429) {
        const msg = await errorMessage(res, 'Thử lại sau ít phút.');
        throw new AuthError(/tạm khoá/i.test(msg) ? 'locked' : 'rate-limited', msg, retry);
      }
      if (res.status === 400) throw new AuthError('invalid', 'Nhập email và mật khẩu');
      throw new AuthError('server', 'Máy chủ gặp lỗi, thử lại sau.');
    },
    refresh,
    async logout() {
      try {
        await post('/auth/logout');
      } catch {
        // Không gọi được server: vẫn xoá phiên phía trình duyệt; cookie sẽ hết hạn theo TTL.
      }
      clear();
      deps.channel?.postMessage('logout');
    },
    expiresAt: () => session?.expiresAt ?? null,
    async apiFetch(path, init = {}) {
      if (session && isExpiring(session.expiresAt, deps.now())) await refresh();
      const call = () => {
        const headers = new Headers(init.headers);
        if (session) headers.set('Authorization', `Bearer ${session.accessToken}`);
        return deps.fetch(`${deps.baseUrl}${path}`, { ...init, headers, credentials: 'include' });
      };
      const res = await call();
      if (res.status !== 401 || !session) return res;
      return (await refresh()) ? call() : res;
    },
  };
}

/** VITE_AUTH=off: phiên giả admin, không gọi backend (demo tĩnh). Quyền thật vẫn ở backend khi có. */
export function createOfflineAuthClient(user: AuthUser): AuthClient {
  const state: AuthState = { status: 'authenticated', user };
  return {
    getState: () => state,
    subscribe: () => () => {},
    init: async () => {},
    login: async () => user,
    refresh: async () => true,
    logout: async () => {},
    expiresAt: () => null,
    apiFetch: (path, init) => fetch(`${API_BASE}${path}`, init),
  };
}

export const AUTH_MODE: 'api' | 'off' = import.meta.env.VITE_AUTH === 'off' ? 'off' : 'api';
export const API_BASE = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');

export const OFFLINE_USER: AuthUser = { id: 'demo', email: 'demo@localhost', name: 'Admin', role: 'admin' };

function browserDeps(): Deps {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('demo-lpg:auth') : undefined;
  return {
    baseUrl: API_BASE,
    fetch: (...a) => fetch(...a),
    now: () => Date.now(),
    lock: locks ? (fn) => locks.request('demo-lpg:auth-refresh', fn) : undefined,
    channel,
  };
}

export const authClient: AuthClient =
  AUTH_MODE === 'off' ? createOfflineAuthClient(OFFLINE_USER) : createAuthClient(browserDeps());

/** Gọi API backend có xác thực – dùng trong `src/data/*` khi thay mock bằng API. */
export const apiFetch = (path: string, init?: RequestInit) => authClient.apiFetch(path, init);
