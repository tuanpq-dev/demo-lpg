import { AUTH_MODE } from '@/api/auth';
import { can, type Role } from '@/features/auth/permissions';

/**
 * Quyền vào Chỉnh sửa bản đồ 3D (/settings/map-editor – menu Cài đặt trên header) và sửa nhanh cảnh (`?edit=1` ở Tổng quan)
 * – CHỈ là UX, backend kiểm tra lại khi lưu.
 * - Theo vai trò: quyền `scene:write` (engineer, admin). `VITE_AUTH=off` (demo tĩnh) cũng vậy – phiên giả là admin nên vào được.
 * - Muốn ẩn ở bản demo công khai: build `VITE_AUTH=off` + `VITE_SCENE_EDITOR=false` → chỉ mở khi URL có `?edit=1` (như trước 12/11).
 */
export function canUseEditor(search: string, role: Role | null | undefined, mode: 'api' | 'off' = AUTH_MODE) {
  if (mode === 'off' && import.meta.env.VITE_SCENE_EDITOR === 'false') return new URLSearchParams(search).get('edit') === '1';
  return can(role, 'scene:write');
}
