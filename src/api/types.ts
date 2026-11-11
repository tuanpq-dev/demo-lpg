/**
 * Hợp đồng API backend (FE tự định nghĩa – không dùng packages/shared). Mọi response đi qua zod
 * (`src/api/client.ts`): sai hợp đồng → ApiError CONTRACT_ERROR có mô tả rõ trường nào sai.
 *
 *   POST /auth/register {email,name,password} → 201 {message}
 *   POST /auth/login    {email,password}      → 200 {accessToken, user} (+ cookie refresh HttpOnly)
 *   POST /auth/refresh  (cookie)              → 200 {accessToken}
 *   POST /auth/logout   (cookie)              → 204
 *   GET  /auth/me       (Bearer)              → 200 user
 *   Lỗi: {error:{code,message}}
 */
import { z } from 'zod';
import { ROLES } from '@/features/auth/permissions';

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

export const ApiErrorBodySchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string(),
    /** ⚠ Ngoài hợp đồng gốc: backend gửi kèm chi tiết khi VALIDATION_ERROR (vd "password: Mật khẩu tối thiểu 12 ký tự"). Tuỳ chọn. */
    details: z.array(z.string()).optional(),
  }),
});

export const UserSchema = z.object({
  id: z.string().min(1),
  email: z.string().min(1),
  name: z.string(),
  role: z.enum(ROLES),
  /** ⚠ Hợp đồng chưa liệt kê giá trị (vd "active"/"pending") → nhận mọi chuỗi. */
  status: z.string().min(1),
});
export type User = z.infer<typeof UserSchema>;

export const LoginResponseSchema = z.object({ accessToken: z.string().min(1), user: UserSchema });
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const RefreshResponseSchema = z.object({ accessToken: z.string().min(1) });
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;

export const RegisterResponseSchema = z.object({ message: z.string() });
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;

export type LoginRequest = { email: string; password: string };
export type RegisterRequest = { email: string; name: string; password: string };
