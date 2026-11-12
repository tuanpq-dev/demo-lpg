import { AUTH_MODE } from '@/api/auth';
import type { Role } from '@/features/auth/permissions';
import { canUseEditor } from './editorAccess';

/** Trang cài đặt (menu nút Cài đặt trên header). Nhẹ – router + header dùng, không import trang. */
export const MAP_EDITOR_PATH = '/settings/map-editor';

export type SettingsRoute = { id: string; label: string; path: string };

const SETTINGS_ROUTES: readonly (SettingsRoute & { allowed: (search: string, role: Role | null | undefined) => boolean })[] = [
  { id: 'map-editor', label: 'Chỉnh sửa bản đồ 3D', path: MAP_EDITOR_PATH, allowed: canUseEditor },
];

/** Đang ở một trang cài đặt (nút Cài đặt sáng, không tab menu chính nào sáng). */
export const isSettingsPath = (pathname: string) => pathname === '/settings' || pathname.startsWith('/settings/');

/** Mục menu Cài đặt người dùng được thấy (quyền chỉ là UX – trang vẫn tự kiểm, thiếu quyền → 403). */
export function settingsMenuFor(search: string, role: Role | null | undefined): SettingsRoute[] {
  return SETTINGS_ROUTES.filter((r) => r.allowed(search, role)).map(({ id, label, path }) => ({ id, label, path }));
}

/**
 * Đường dẫn khi chọn mục. Demo tĩnh khoá Editor (`VITE_AUTH=off` + `VITE_SCENE_EDITOR=false` → chỉ mở với `?edit=1`): mang theo
 * cờ đang có trên URL hiện tại.
 */
export function settingsHref(route: SettingsRoute, search: string, mode: 'api' | 'off' = AUTH_MODE): string {
  return mode === 'off' && new URLSearchParams(search).get('edit') === '1' ? `${route.path}?edit=1` : route.path;
}
