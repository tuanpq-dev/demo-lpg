/**
 * Hợp đồng API backend (FE tự định nghĩa – không dùng packages/shared): mã lỗi + kiểu TS. Schema zod ở ./schemas
 * (tải lười); mọi response đi qua zod (`src/api/client.ts`): sai hợp đồng → ApiError CONTRACT_ERROR nêu rõ trường sai.
 * File này nằm trong bundle tải đầu → chỉ `import type` từ zod / ./schemas.
 *
 *   POST /auth/register {email,name,password} → 201 {message}
 *   POST /auth/login    {email,password}      → 200 {accessToken, user} (+ cookie refresh HttpOnly)
 *   POST /auth/refresh  (cookie)              → 200 {accessToken}
 *   POST /auth/logout   (cookie)              → 204
 *   GET  /auth/me       (Bearer)              → 200 user
 *   Lỗi: {error:{code,message}}
 */
import type { z } from 'zod/mini';
import type * as S from './schemas';

/** Mã lỗi backend theo hợp đồng. */
export type BackendErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_PENDING'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND';

/**
 * Mã lỗi phía FE (không do backend trả):
 * NETWORK_ERROR = không gọi được máy chủ · CONTRACT_ERROR = response sai hợp đồng · CONFIG_ERROR = thiếu VITE_API_URL ·
 * TIMEOUT = quá thời gian chờ (`timeoutMs`) ·
 * UNKNOWN = lỗi HTTP không có thân {error} hoặc mã lạ.
 */
export type ClientErrorCode = 'NETWORK_ERROR' | 'CONTRACT_ERROR' | 'CONFIG_ERROR' | 'TIMEOUT' | 'UNKNOWN';
export type ApiErrorCode = BackendErrorCode | ClientErrorCode;

export type User = z.infer<typeof S.UserSchema>;
export type LoginResponse = z.infer<typeof S.LoginResponseSchema>;
export type RefreshResponse = z.infer<typeof S.RefreshResponseSchema>;
export type RegisterResponse = z.infer<typeof S.RegisterResponseSchema>;

export type LoginRequest = { email: string; password: string };
export type RegisterRequest = { email: string; name: string; password: string };
