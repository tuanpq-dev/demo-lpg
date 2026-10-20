/**
 * Quyền vào Scene Editor (/editor). TODO: thay bằng phân quyền thật (vai trò người dùng từ API) khi có backend.
 * Hiện bật khi URL có `?edit=1` hoặc build với `VITE_SCENE_EDITOR=true`.
 */
export function canUseEditor(search: string) {
  return import.meta.env.VITE_SCENE_EDITOR === 'true' || new URLSearchParams(search).get('edit') === '1';
}
