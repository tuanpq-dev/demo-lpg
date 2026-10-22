/**
 * Hợp đồng API xác thực + quản lý người dùng (zod). FE chỉ `import type` từ file này.
 * Endpoint: POST /api/auth/login · /api/auth/refresh · /api/auth/logout · GET /api/auth/me · /api/users (admin).
 */
import { z } from 'zod';
import { ROLES } from './roles.js';

export const RoleSchema = z.enum(ROLES);

/** Email chuẩn hoá: cắt khoảng trắng + chữ thường (lưu và tra cứu cùng một dạng). */
export const EmailSchema = z.string().trim().toLowerCase().email().max(254);

/** Mật khẩu mới (tạo user / seed). Đăng nhập KHÔNG áp luật này – chỉ kiểm tra có giá trị. */
export const PasswordSchema = z.string().min(12, 'Mật khẩu tối thiểu 12 ký tự').max(128);

export const LoginRequestSchema = z
  .object({
    email: z.string().trim().toLowerCase().min(1).max(254),
    password: z.string().min(1).max(128),
  })
  .strict();
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AuthUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: RoleSchema,
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

/** Trả về khi login/refresh. Refresh token KHÔNG nằm trong body – chỉ ở cookie HttpOnly. */
export const AuthSessionSchema = z.object({
  accessToken: z.string(),
  /** Số giây access token còn hiệu lực (mặc định 900). */
  expiresIn: z.number().int().positive(),
  user: AuthUserSchema,
});
export type AuthSession = z.infer<typeof AuthSessionSchema>;

export const UserSchema = AuthUserSchema.extend({
  isActive: z.boolean(),
  createdAt: z.string(),
});
export type User = z.infer<typeof UserSchema>;

export const CreateUserSchema = z
  .object({
    email: EmailSchema,
    name: z.string().trim().min(1).max(120),
    role: RoleSchema,
    password: PasswordSchema,
  })
  .strict();
export type CreateUserRequest = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    role: RoleSchema.optional(),
    isActive: z.boolean().optional(),
    password: PasswordSchema.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Cần ít nhất một trường');
export type UpdateUserRequest = z.infer<typeof UpdateUserSchema>;

/** Thân lỗi chuẩn của API (Nest): { statusCode, message, error? }. */
export type ApiError = { statusCode: number; message: string | string[]; error?: string };
