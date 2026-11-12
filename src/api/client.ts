/**
 * Fetch wrapper gọi backend (VITE_API_URL, vd http://localhost:3000) – gọi thẳng qua CORS, không proxy.
 * - `credentials: 'include'` để trình duyệt gửi/nhận cookie refresh HttpOnly.
 * - Access token chỉ trong bộ nhớ (biến trong closure) – không localStorage/sessionStorage.
 * - Lỗi luôn là `ApiError` có `code`: mã backend ({error:{code,message}}) hoặc mã FE (NETWORK_ERROR, CONTRACT_ERROR…).
 * - Sai hợp đồng được báo về giám sát lỗi (`reportError`).
 * - Response validate bằng zod (schema ở ./schemas, TẢI LƯỜI – nạp song song khi gửi request; code tải đầu không chứa zod)
 *   – sai hợp đồng → CONTRACT_ERROR nêu rõ trường sai.
 * - Request có xác thực gặp 401 → refresh MỘT lần (gộp mọi request cùng hết hạn thành một lần gọi
 *   /auth/refresh, Web Locks giữa các tab) rồi gọi lại; refresh thất bại → báo `onSessionLost` (đăng xuất).
 * - Huỷ: `signal` của nơi gọi huỷ → ném lại `AbortError` gốc (kiểm bằng `isAbortError`, UI bỏ qua, không báo lỗi).
 *   Quá `timeoutMs` (mặc định 15 s, tính cả lúc đọc body) → `ApiError('TIMEOUT')`.
 * - Thử lại: CHỈ request GET (không đổi dữ liệu), khi lỗi tạm thời (NETWORK_ERROR, HTTP 502/503/504) – tối đa 2 lần, chờ
 *   0,3 s rồi 0,9 s (huỷ được). Không thử lại TIMEOUT (người dùng đã chờ đủ lâu) và mọi lỗi 4xx.
 */
import type { ZodMiniType, safeParse } from 'zod/mini';
import { reportError } from '@/lib/monitoring';
import type * as ApiSchemas from './schemas';
import type { ApiErrorCode } from './types';

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
const TIMEOUT_MESSAGE = 'Máy chủ phản hồi quá lâu';
/** Thời gian chờ mặc định của một request (gồm cả đọc body). */
export const DEFAULT_TIMEOUT_MS = 15_000;

/** Lỗi do huỷ request (signal của nơi gọi) – không phải lỗi cần hiện cho người dùng. */
export const isAbortError = (e: unknown): boolean => e instanceof DOMException && e.name === 'AbortError';

/**
 * Signal gộp: huỷ khi `outer` huỷ hoặc hết `ms` (0 = không giới hạn). `timedOut()` phân biệt hai trường hợp;
 * `dispose()` gỡ timer + listener khi request xong. Không dùng `AbortSignal.any` (Safari < 17.4).
 */
function timeoutSignal(outer: AbortSignal | undefined, ms: number) {
  const ctrl = new AbortController();
  let timedOut = false;
  const onAbort = () => ctrl.abort(outer?.reason);
  if (outer?.aborted) ctrl.abort(outer.reason);
  else outer?.addEventListener('abort', onAbort, { once: true });
  const timer =
    ms > 0
      ? setTimeout(() => {
          timedOut = true;
          ctrl.abort(new DOMException(TIMEOUT_MESSAGE, 'TimeoutError'));
        }, ms)
      : undefined;
  return {
    signal: ctrl.signal,
    timedOut: () => timedOut,
    dispose: () => {
      clearTimeout(timer);
      outer?.removeEventListener('abort', onAbort);
    },
  };
}

/** Schema zod của response (đầu vào bất kỳ – JSON chưa kiểm). */
type Schema<T> = ZodMiniType<T>;
/** Chọn schema từ module ./schemas (tải lười): `schema: (s) => s.UserSchema`. */
export type SchemaPick<T> = (schemas: typeof ApiSchemas) => Schema<T>;

type Validator = { schemas: typeof ApiSchemas; safeParse: typeof safeParse };
let validator: Promise<Validator> | null = null;

/**
 * Nạp zod + schema MỘT lần – gọi khi BẮT ĐẦU request (tải song song với fetch). Lỗi tải chunk (mất mạng, deploy mới
 * xoá chunk cũ) → NETWORK_ERROR, lần sau thử nạp lại.
 */
function loadValidator(): Promise<Validator> {
  validator ??= Promise.all([import('./schemas'), import('zod/mini')]).then(
    ([schemas, z]) => ({ schemas, safeParse: z.safeParse }),
    () => {
      validator = null;
      throw new ApiError('NETWORK_ERROR', NETWORK_MESSAGE, 0);
    },
  );
  // Nơi gọi có thể chưa await (request lỗi trước khi cần validate) – tránh "unhandled rejection".
  validator.catch(() => undefined);
  return validator;
}

export type RequestOptions<T> = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Schema của response 2xx (bỏ qua với 204): `(s) => s.UserSchema` – chọn từ ./schemas (tải lười). */
  schema?: SchemaPick<T>;
  /** Gắn Bearer + tự refresh khi 401. Mặc định true; endpoint đăng nhập/refresh/logout đặt false. */
  auth?: boolean;
  /** Huỷ request (rời trang, đổi tham số…) → promise bị reject bằng `AbortError`. */
  signal?: AbortSignal;
  /** Giới hạn thời gian (ms) của MỖI lượt gọi, mặc định `DEFAULT_TIMEOUT_MS`; 0 = không giới hạn (vd tải tệp lớn). */
  timeoutMs?: number;
  /** Số lần tự thử lại khi lỗi tạm thời. Mặc định 2 cho GET, 0 cho method khác (ghi dữ liệu không tự gửi lại). */
  retry?: number;
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
  /** Khoảng chờ (ms) trước từng lần thử lại – mặc định `RETRY_DELAYS_MS` (test truyền số nhỏ). */
  retryDelaysMs?: readonly number[];
};

/** Chờ trước lần thử lại thứ 1, 2 (ms). */
const RETRY_DELAYS_MS: readonly number[] = [300, 900];

/** Lỗi tạm thời đáng thử lại: không tới được máy chủ, hoặc cổng/proxy báo máy chủ tạm không phục vụ. */
const isTransient = (e: unknown) => e instanceof ApiError && (e.code === 'NETWORK_ERROR' || e.status === 502 || e.status === 503 || e.status === 504);

/** Chờ `ms`; `signal` huỷ → reject ngay bằng AbortError. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(t);
      reject(signal?.reason instanceof DOMException ? signal.reason : new DOMException('Đã huỷ', 'AbortError'));
    };
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    if (signal?.aborted) onAbort();
    else signal?.addEventListener('abort', onAbort, { once: true });
  });
}

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
  const json = await readJson(res);
  const { schemas, safeParse } = await loadValidator();
  const body = safeParse(schemas.ApiErrorBodySchema, json);
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

/** Mô tả một lỗi validate: mã + kiểu mong đợi (vd "invalid_type, cần string"). */
function issueText(i: { code: string; message: string; expected?: unknown }): string {
  const expected = i.expected === undefined ? '' : `, cần ${String(i.expected)}`;
  return i.message && i.message !== 'Invalid input' ? `${i.message} (${i.code})` : `${i.code}${expected}`;
}

function contractError(path: string, detail: string, status: number) {
  const err = new ApiError('CONTRACT_ERROR', `Phản hồi của ${path} không đúng hợp đồng API: ${detail}`, status);
  // Backend lệch hợp đồng là lỗi cần đội phát triển biết ngay (người dùng chỉ thấy "dữ liệu không đúng định dạng").
  reportError(err, { source: 'api-contract', path, status });
  return err;
}

/**
 * Kiểm `json` theo schema (nạp lười) → dữ liệu đã parse; sai → `ApiError('CONTRACT_ERROR')` nêu rõ trường sai + báo giám sát.
 * Dùng chung cho `api.request` và response mock ở lớp dữ liệu (`data/contract.ts`).
 */
export async function validateContract<T>(path: string, pick: SchemaPick<T>, json: unknown, status = 200): Promise<T> {
  const { schemas, safeParse } = await loadValidator();
  const parsed = safeParse(pick(schemas), json);
  if (parsed.success) return parsed.data;
  // zod/mini không nạp sẵn câu lỗi tiếng Anh (message chung "Invalid input") → ghi kèm mã lỗi + kiểu mong đợi.
  const detail = parsed.error.issues.map((i) => `${i.path.join('.') || '(gốc)'}: ${issueText(i)}`).join('; ');
  throw contractError(path, detail, status);
}

/** Tạo client (test / DI truyền `fetch` riêng); app dùng `api` bên dưới. */
export function createApiClient(deps: ApiClientDeps): ApiClient {
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
      if (init.signal?.aborted) throw err;
      throw new ApiError('NETWORK_ERROR', NETWORK_MESSAGE, 0);
    }
  };

  const parse = async <T>(path: string, res: Response, pick?: SchemaPick<T>): Promise<T> => {
    if (res.status === 204 || !pick) return undefined as T;
    const json = await readJson(res);
    if (json === Symbol.for('invalid-json') || json === undefined) {
      throw contractError(path, 'không phải JSON', res.status);
    }
    return validateContract(path, pick, json, res.status);
  };

  /** Chạy `fn` với signal gộp (huỷ của nơi gọi + timeout); hết giờ → `ApiError('TIMEOUT')`, huỷ → `AbortError` gốc. */
  const withTimeout = async <T>(outer: AbortSignal | undefined, ms: number, fn: (signal: AbortSignal) => Promise<T>) => {
    const t = timeoutSignal(outer, ms);
    try {
      return await fn(t.signal);
    } catch (err) {
      if (t.timedOut() && !outer?.aborted) throw new ApiError('TIMEOUT', TIMEOUT_MESSAGE, 0);
      if (t.signal.aborted) throw outer?.reason instanceof DOMException ? outer.reason : new DOMException('Đã huỷ', 'AbortError');
      throw err;
    } finally {
      t.dispose();
    }
  };

  // Refresh dùng chung cho mọi request đang chờ → không theo signal của request nào, chỉ có timeout.
  const doRefresh = () => {
    void loadValidator();
    return withTimeout(undefined, DEFAULT_TIMEOUT_MS, async (signal): Promise<string | null> => {
      const res = await send('/auth/refresh', { method: 'POST', signal }, false);
      if (!res.ok) {
        accessToken = null;
        return null;
      }
      const { accessToken: token } = await parse('/auth/refresh', res, (s) => s.RefreshResponseSchema);
      accessToken = token;
      return token;
    });
  };

  const refresh = () => {
    refreshing ??= (deps.lock ? deps.lock(doRefresh) : doRefresh()).finally(() => {
      refreshing = null;
    });
    return refreshing;
  };

  const request = async <T>(path: string, opts: RequestOptions<T> = {}, retried = false): Promise<T> => {
    const auth = opts.auth ?? true;
    void loadValidator(); // tải zod song song với request
    const res = await withTimeout(opts.signal, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS, async (signal) => {
      const init: RequestInit = {
        method: opts.method ?? (opts.body === undefined ? 'GET' : 'POST'),
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal,
      };
      const r = await send(path, init, auth);
      if (r.status === 401 && auth && !retried) return { retry: true as const, error: await toApiError(r) };
      // Đọc body trong cùng khung timeout / huỷ.
      if (!r.ok) throw await toApiError(r);
      return { retry: false as const, data: await parse(path, r, opts.schema) };
    }).catch((err: unknown) => {
      if (err instanceof ApiError && err.status === 401 && auth) {
        // Đã refresh mà vẫn 401 → mất phiên.
        accessToken = null;
        lostListeners.forEach((l) => l());
      }
      throw err;
    });
    if (!res.retry) return res.data;
    // 401 lần đầu: refresh rồi gọi lại; refresh bị từ chối → mất phiên.
    const token = await refresh();
    opts.signal?.throwIfAborted();
    if (token) return request(path, opts, true);
    accessToken = null;
    lostListeners.forEach((l) => l());
    throw res.error;
  };

  /** `request` + thử lại lỗi tạm thời (mặc định chỉ GET). */
  const requestWithRetry = async <T>(path: string, opts: RequestOptions<T> = {}): Promise<T> => {
    const delays = deps.retryDelaysMs ?? RETRY_DELAYS_MS;
    const isGet = (opts.method ?? (opts.body === undefined ? 'GET' : 'POST')) === 'GET';
    const max = Math.min(opts.retry ?? (isGet ? delays.length : 0), delays.length);
    for (let attempt = 0; ; attempt++) {
      try {
        return await request(path, opts);
      } catch (err) {
        if (attempt >= max || !isTransient(err) || opts.signal?.aborted) throw err;
        await sleep(delays[attempt] ?? 0, opts.signal);
      }
    }
  };

  return {
    request: requestWithRetry,
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
