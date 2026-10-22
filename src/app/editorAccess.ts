import { AUTH_MODE } from '@/api/auth';
import { can, type Role } from '@/features/auth/permissions';

/**
 * Quyền vào Scene Editor (/editor) và sửa nhanh cảnh (`?edit=1` ở Tổng quan) – CHỈ là UX, backend kiểm tra lại khi lưu.
 * - Có đăng nhập (mặc định): vai trò có quyền `scene:write` (engineer, admin).
 * - VITE_AUTH=off (demo tĩnh): như trước – `?edit=1` hoặc build với `VITE_SCENE_EDITOR=true`.
 */
export function canUseEditor(search: string, role: Role | null | undefined, mode: 'api' | 'off' = AUTH_MODE) {
  if (mode === 'off') {
    return import.meta.env.VITE_SCENE_EDITOR === 'true' || new URLSearchParams(search).get('edit') === '1';
  }
  return can(role, 'scene:write');
}
