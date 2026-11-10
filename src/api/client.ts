/**
 * Fetch wrapper gọi backend (VITE_API_URL, vd http://localhost:3000) – gọi thẳng qua CORS, không proxy.
 * - `credentials: 'include'` để trình duyệt gửi/nhận cookie refresh HttpOnly.
 * - Access token chỉ trong bộ nhớ (biến trong closure) – không localStorage/sessionStorage.
 * - Lỗi luôn là `ApiError` có `code`: mã backend ({error:{code,message}}) hoặc mã FE (NETWORK_ERROR, CONTRACT_ERROR…).
 * - Response validate bằng zod (schema ở ./types) – sai hợp đồng → CONTRACT_ERROR nêu rõ trường sai.
 * - Request có xác thực gặp 401 → refresh MỘT lần (gộp mọi request cùng hết hạn thành một lần gọi
 *   /auth/refresh, Web Locks giữa các tab) rồi gọi lại; refresh thất bại → báo `onSessionLost` (đăng xuất).
 */
import type { ZodType } from 'zod';
import { ApiErrorBodySchema, RefreshResponseSchema, type ApiErrorCode } from './types';

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode | (string & {}),
    message: string,
    /** HTTP status (0 = không có response). */
    readonly status: number,
    /** Giây phải chờ (header Retry-After) – có khi RATE_LIMITED nếu backend gửi. */
    readonly retryAfter?: number,
    /** Chi tiết lỗi validate (`error.details`) nếu backend gửi. */
    readonly details?: string[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const NETWORK_MESSAGE = 'Không kết nối được máy chủ';

/** Schema zod của response (đầu vào bất kỳ – JSON chưa kiểm). */
type Schema<T> = ZodType<T>;

export type RequestOptions<T> = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Schema của response 2xx (bỏ qua với 204). */
  schema?: Schema<T>;
  /** Gắn Bearer + tự refresh khi 401. Mặc định true; endpoint đăng nhập/refresh/logout đặt false. */
  auth?: boolean;
  signal?: AbortSignal;
};

export interface ApiClient {
  request<T = void>(path: string, opts?: RequestOptions<T>): Promise<T>;
  /** Đổi cookie refresh lấy access token mới (gộp một luồng). null = máy chủ từ chối (hết phiên); ném NETWORK_ERROR khi mất mạng. */
  refresh(): Promise<string | null>;
  getAccessToken(): string | null;
  setAccessToken(token: string | null): void;
  /** Nghe sự kiện mất phiên (refresh thất bại khi đang gọi API). Trả về hàm huỷ. */
  onSessionLost(cb: () => void): () => void;
}

export type ApiClientDeps = {
  baseUrl: string;
  fetch: typeof fetch;
  /** Khoá giữa các tab (Web Locks) cho refresh – backend coi hai lần dùng cùng refresh token là bị đánh cắp. */
  lock?: <T>(fn: () => Promise<T>) => Promise<T>;
};

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return Symbol.for('invalid-json');
  }
}

/** Lỗi HTTP → ApiError: ưu tiên {error:{code,message}}; không có thì suy theo status. */
async function toApiError(res: Response): Promise<ApiError> {
  const retry = Number(res.headers.get('Retry-After')) || undefined;
  const body = ApiErrorBodySchema.safeParse(await readJson(res));
  if (body.success) {
    const { code, message, details } = body.data.error;
    return new ApiError(code, message, res.status, retry, details);
  }
  if (res.status === 401) return new ApiError('UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn', 401);
  if (res.status === 403) return new ApiError('FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này', 403);
  if (res.status === 404) return new ApiError('NOT_FOUND', 'Không tìm thấy dữ liệu', 404);
  if (res.status === 429) return new ApiError('RATE_LIMITED', 'Quá nhiều yêu cầu, thử lại sau', 429, retry);
  return new ApiError('UNKNOWN', `Máy chủ trả lỗi ${res.status} (không đúng định dạng {error:{code,message}})`, res.status);
}

function contractError(path: string, detail: string, status: number) {
  return new ApiError('CONTRACT_ERROR', `Phản hồi của ${path} không đúng hợp đồng API: ${detail}`, status);
}

function createApiClient(deps: ApiClientDeps): ApiClient {
  let accessToken: string | null = null;
  let refreshing: Promise<string | null> | null = null;
  const lostListeners = new Set<() => void>();

  const send = async (path: string, init: RequestInit, auth: boolean): Promise<Response> => {
    if (!deps.baseUrl) throw new ApiError('CONFIG_ERROR', 'Chưa cấu hình VITE_API_URL', 0);
    const headers = new Headers(init.headers);
    if (init.body !== undefined) headers.set('Content-Type', 'application/json');
    headers.set('Accept', 'application/json');
    if (auth && accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    try {
      return await deps.fetch(`${deps.baseUrl}${path}`, { ...init, headers, credentials: 'include' });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      throw new ApiError('NETWORK_ERROR', NETWORK_MESSAGE, 0);
    }
  };

  const parse = async <T>(path: string, res: Response, schema?: Schema<T>): Promise<T> => {
    if (res.status === 204 || !schema) return undefined as T;
    const json = await readJson(res);
    if (json === Symbol.for('invalid-json') || json === undefined) {
      throw contractError(path, 'không phải JSON', res.status);
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      const detail = parsed.error.issues.map((i) => `${i.path.join('.') || '(gốc)'}: ${i.message}`).join('; ');
      throw contractError(path, detail, res.status);
    }
    return parsed.data;
  };

  const doRefresh = async (): Promise<string | null> => {
    const res = await send('/auth/refresh', { method: 'POST' }, false);
    if (!res.ok) {
      accessToken = null;
      return null;
    }
    const { accessToken: token } = await parse('/auth/refresh', res, RefreshResponseSchema);
    accessToken = token;
    return token;
  };

  const refresh = () => {
    refreshing ??= (deps.lock ? deps.lock(doRefresh) : doRefresh()).finally(() => {
      refreshing = null;
    });
    return refreshing;
  };

  const request = async <T>(path: string, opts: RequestOptions<T> = {}, retried = false): Promise<T> => {
    const auth = opts.auth ?? true;
    const init: RequestInit = {
      method: opts.method ?? (opts.body === undefined ? 'GET' : 'POST'),
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
    };
    const res = await send(path, init, auth);
    if (res.status === 401 && auth) {
      // Lần đầu: refresh rồi gọi lại. Đã refresh mà vẫn 401 / refresh bị từ chối → mất phiên.
      const token = retried ? null : await refresh();
      if (token) return request(path, opts, true);
      accessToken = null;
      lostListeners.forEach((l) => l());
    }
    if (!res.ok) throw await toApiError(res);
    return parse(path, res, opts.schema);
  };

  return {
    request: (path, opts) => request(path, opts),
    refresh,
    getAccessToken: () => accessToken,
    setAccessToken: (t) => {
      accessToken = t;
    },
    onSessionLost(cb) {
      lostListeners.add(cb);
      return () => lostListeners.delete(cb);
    },
  };
}

/** Gốc URL backend: dev = .env.development (http://localhost:3000), production = biến môi trường trên Vercel. */
const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;

/** Client dùng chung của app. */
export const api: ApiClient = createApiClient({
  baseUrl: API_URL,
  fetch: (...a) => fetch(...a),
  lock: locks ? (fn) => locks.request('demo-lpg:auth-refresh', fn) : undefined,
});
