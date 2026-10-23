/**
 * Lỗi API → câu hiển thị cho người dùng (thuần, có test). Theo `code` (hợp đồng {error:{code,message}}),
 * không theo câu chữ backend – trừ VALIDATION_ERROR (backend nói rõ trường nào sai).
 */
import { ApiError } from '@/api/client';

export const AUTH_MESSAGES = {
  INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng',
  ACCOUNT_PENDING: 'Tài khoản đang chờ quản trị viên duyệt. Bạn sẽ đăng nhập được sau khi được duyệt.',
  RATE_LIMITED: 'Bạn đã thử quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.',
  NETWORK_ERROR: 'Không kết nối được máy chủ',
  CONFIG_ERROR: 'Chưa cấu hình địa chỉ máy chủ (VITE_API_URL)',
  CONTRACT_ERROR: 'Máy chủ trả dữ liệu không đúng định dạng. Báo cho quản trị hệ thống.',
  UNAUTHORIZED: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
  VALIDATION_FALLBACK: 'Thông tin chưa hợp lệ',
  UNKNOWN: 'Có lỗi xảy ra, vui lòng thử lại',
} as const;

/** Mã có câu cố định (không dùng câu chữ backend). */
const FIXED: Partial<Record<string, string>> = {
  INVALID_CREDENTIALS: AUTH_MESSAGES.INVALID_CREDENTIALS,
  ACCOUNT_PENDING: AUTH_MESSAGES.ACCOUNT_PENDING,
  RATE_LIMITED: AUTH_MESSAGES.RATE_LIMITED,
  NETWORK_ERROR: AUTH_MESSAGES.NETWORK_ERROR,
  CONFIG_ERROR: AUTH_MESSAGES.CONFIG_ERROR,
  CONTRACT_ERROR: AUTH_MESSAGES.CONTRACT_ERROR,
  UNAUTHORIZED: AUTH_MESSAGES.UNAUTHORIZED,
};

export function authErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return AUTH_MESSAGES.UNKNOWN;
  const fixed = FIXED[err.code];
  if (err.code === 'RATE_LIMITED' && err.retryAfter) return `${fixed} (khoảng ${Math.ceil(err.retryAfter / 60)} phút)`;
  if (fixed) return fixed;
  if (err.code === 'VALIDATION_ERROR') {
    // Chi tiết từng trường (nếu backend gửi `details`) cụ thể hơn câu chung.
    if (err.details?.length) return err.details.map((d) => d.replace(/^[\w.]+:\s*/, '')).join('. ');
    return err.message || AUTH_MESSAGES.VALIDATION_FALLBACK;
  }
  return err.message || AUTH_MESSAGES.UNKNOWN;
}
