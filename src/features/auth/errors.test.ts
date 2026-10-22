import { describe, expect, test } from 'vitest';
import { ApiError } from '@/api/client';
import { AUTH_MESSAGES, authErrorMessage } from './errors';

describe('authErrorMessage', () => {
  test('theo mã, không theo câu chữ backend', () => {
    expect(authErrorMessage(new ApiError('INVALID_CREDENTIALS', 'Invalid', 401))).toBe(AUTH_MESSAGES.INVALID_CREDENTIALS);
    expect(authErrorMessage(new ApiError('ACCOUNT_PENDING', 'Pending', 403))).toContain('chờ quản trị viên duyệt');
    expect(authErrorMessage(new ApiError('RATE_LIMITED', 'x', 429))).toContain('quá nhiều lần');
    expect(authErrorMessage(new ApiError('NETWORK_ERROR', 'x', 0))).toBe('Không kết nối được máy chủ');
  });
  test('RATE_LIMITED có Retry-After → kèm số phút (làm tròn lên)', () => {
    expect(authErrorMessage(new ApiError('RATE_LIMITED', 'x', 429, 840))).toContain('khoảng 14 phút');
    expect(authErrorMessage(new ApiError('RATE_LIMITED', 'x', 429, 61))).toContain('khoảng 2 phút');
  });
  test('VALIDATION_ERROR → giữ thông báo backend (rỗng → câu chung)', () => {
    expect(authErrorMessage(new ApiError('VALIDATION_ERROR', 'Mật khẩu tối thiểu 12 ký tự', 400))).toBe('Mật khẩu tối thiểu 12 ký tự');
    expect(authErrorMessage(new ApiError('VALIDATION_ERROR', '', 400))).toBe(AUTH_MESSAGES.VALIDATION_FALLBACK);
  });
  test('VALIDATION_ERROR có details → dùng chi tiết (bỏ tiền tố tên trường)', () => {
    const err = new ApiError('VALIDATION_ERROR', 'Dữ liệu gửi lên không hợp lệ', 400, undefined, [
      'password: Mật khẩu tối thiểu 12 ký tự',
      'email: Invalid email',
    ]);
    expect(authErrorMessage(err)).toBe('Mật khẩu tối thiểu 12 ký tự. Invalid email');
  });
  test('mã lạ → thông báo backend; không phải ApiError → câu chung', () => {
    expect(authErrorMessage(new ApiError('EMAIL_TAKEN', 'Email đã dùng', 409))).toBe('Email đã dùng');
    expect(authErrorMessage(new Error('boom'))).toBe(AUTH_MESSAGES.UNKNOWN);
    expect(authErrorMessage(undefined)).toBe(AUTH_MESSAGES.UNKNOWN);
  });
});
