import type { NavTabItem } from '@/components';

export type NavRoute = NavTabItem & {
  /** Đường dẫn router; undefined → mục chưa có trang (disabled). */
  path?: string;
};

/** Menu chính – thứ tự và nhãn theo Figma 53:23. */
export const NAV_ROUTES: readonly NavRoute[] = [
  { id: 'overview', label: 'Tổng quan', path: '/overview', icon: 'navOverview', activeIcon: 'navOverviewActive' },
  { id: 'map', label: 'Bản đồ nội khu', path: '/map', icon: 'navMap' },
  { id: 'operation', label: 'Vận hành', icon: 'navOperation', disabled: true, hasSubmenu: true },
  { id: 'alerts', label: 'Cảnh báo', path: '/alerts', icon: 'navAlert', activeIcon: 'navAlertActive', count: 2 },
  { id: 'maintenance', label: 'Bảo trì', path: '/maintenance', icon: 'navMaintenance', activeIcon: 'navMaintenanceActive' },
  { id: 'reports', label: 'Báo cáo', path: '/reports', icon: 'navReport' },
];

/** Tìm mục nav ứng với pathname (khớp tiền tố, ví dụ /alerts/123 → alerts). */
export function navIdFromPath(pathname: string): string {
  return NAV_ROUTES.find((r) => r.path && (pathname === r.path || pathname.startsWith(`${r.path}/`)))?.id ?? '';
}
