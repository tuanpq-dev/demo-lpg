import { describe, expect, test } from 'vitest';
import { CreateUserSchema, LoginRequestSchema, UpdateUserSchema } from './auth';
import { TagValueSchema } from './live';

describe('schema auth', () => {
  test('login: chuẩn hoá email, từ chối trường lạ, thiếu mật khẩu', () => {
    expect(LoginRequestSchema.parse({ email: ' A@B.Com ', password: 'x' })).toEqual({ email: 'a@b.com', password: 'x' });
    expect(LoginRequestSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
    expect(LoginRequestSchema.safeParse({ email: 'a@b.com', password: 'x', role: 'admin' }).success).toBe(false);
  });

  test('tạo user: mật khẩu ≥ 12, vai trò hợp lệ, email hợp lệ', () => {
    const ok = { email: 'a@b.com', name: 'A', role: 'viewer', password: '123456789012' };
    expect(CreateUserSchema.safeParse(ok).success).toBe(true);
    expect(CreateUserSchema.safeParse({ ...ok, password: '12345678901' }).success).toBe(false);
    expect(CreateUserSchema.safeParse({ ...ok, role: 'root' }).success).toBe(false);
    expect(CreateUserSchema.safeParse({ ...ok, email: 'not-an-email' }).success).toBe(false);
    expect(CreateUserSchema.safeParse({ ...ok, name: '   ' }).success).toBe(false);
  });

  test('sửa user: rỗng → lỗi, trường lạ → lỗi', () => {
    expect(UpdateUserSchema.safeParse({}).success).toBe(false);
    expect(UpdateUserSchema.safeParse({ isActive: false }).success).toBe(true);
    expect(UpdateUserSchema.safeParse({ email: 'x@y.z' }).success).toBe(false);
  });
});

describe('schema live', () => {
  test('TagValue', () => {
    expect(TagValueSchema.safeParse({ value: 72.4, unit: '%', ts: 1, quality: 'good' }).success).toBe(true);
    expect(TagValueSchema.safeParse({ value: 'running', ts: 0, quality: 'bad' }).success).toBe(true);
    expect(TagValueSchema.safeParse({ value: Number.NaN, ts: 0, quality: 'good' }).success).toBe(false);
    expect(TagValueSchema.safeParse({ value: 1, ts: -1, quality: 'good' }).success).toBe(false);
    expect(TagValueSchema.safeParse({ value: 1, ts: 0, quality: 'ok' }).success).toBe(false);
  });
});
