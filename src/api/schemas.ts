/**
 * Schema zod của response API (hợp đồng FE tự định nghĩa – kiểu TS tương ứng ở ./types). Module này được TẢI LƯỜI:
 * `api.request` nhận `schema: (s) => s.XxxSchema` và chỉ nạp file này (+ zod) khi có request thật – bản demo
 * `VITE_AUTH=off` không bao giờ tải zod; có backend thì nạp song song với request đầu tiên.
 * Dùng `zod/mini` (API dạng hàm, tree-shake được). KHÔNG import file này (giá trị) từ code tải đầu – chỉ `import type`.
 */
import { z } from 'zod/mini';
import { ROLES } from '@/features/auth/permissions';

// CSP của bản deploy không cho `eval` / `new Function` (script-src 'self') – tắt bộ biên dịch JIT của zod để nó không thử
// (thử là trình duyệt ghi lỗi vi phạm CSP vào console). Chậm hơn không đáng kể với response cỡ app này.
z.config({ jitless: true });

export const ApiErrorBodySchema = z.object({
  error: z.object({
    code: z.string().check(z.minLength(1)),
    message: z.string(),
    /** ⚠ Ngoài hợp đồng gốc: backend gửi kèm chi tiết khi VALIDATION_ERROR (vd "password: Mật khẩu tối thiểu 12 ký tự"). Tuỳ chọn. */
    details: z.optional(z.array(z.string())),
  }),
});

export const UserSchema = z.object({
  id: z.string().check(z.minLength(1)),
  email: z.string().check(z.minLength(1)),
  name: z.string(),
  role: z.enum(ROLES),
  /** ⚠ Hợp đồng chưa liệt kê giá trị (vd "active"/"pending") → nhận mọi chuỗi. */
  status: z.string().check(z.minLength(1)),
});

export const LoginResponseSchema = z.object({ accessToken: z.string().check(z.minLength(1)), user: UserSchema });

export const RefreshResponseSchema = z.object({ accessToken: z.string().check(z.minLength(1)) });

export const RegisterResponseSchema = z.object({ message: z.string() });
