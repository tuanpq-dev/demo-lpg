import type { NavSubItem, NavTabItem } from '@/components';

export type NavSubRoute = NavSubItem & { path: string };

export type NavRoute = Omit<NavTabItem, 'children'> & {
  /** Đường dẫn router; undefined → mục chỉ mở menu con (có `children`) hoặc chưa có trang (disabled). */
  path?: string;
  children?: readonly NavSubRoute[];
};

/** Menu chính – thứ tự và nhãn theo Figma 53:23. */
export const NAV_ROUTES: readonly NavRoute[] = [
  { id: 'overview', label: 'Tổng quan', path: '/overview', icon: 'navOverview', activeIcon: 'navOverviewActive' },
  { id: 'map', label: 'Bản đồ nội khu', path: '/map', icon: 'navMap' },
  {
    id: 'operation',
    label: 'Vận hành',
    icon: 'navOperation',
    // Menu con chưa có trong Figma (questions.md 1.3) – theo yêu cầu khách 30/10/2026.
    children: [
      // Mục đầu = "Giám sát thiết bị" (breadcrumb ảnh op-device-header.png); giữ nhãn "Vận hành" theo yêu cầu khách 30/10.
      { id: 'operation-main', label: 'Vận hành', path: '/operations/devices' },
      { id: 'operation-logs', label: 'Nhật ký vận hành', path: '/operations/logs' },
      { id: 'operation-ai-simulation', label: 'AI mô phỏng sự cố', path: '/operations/ai-simulation' },
    ],
  },
  { id: 'alerts', label: 'Cảnh báo', path: '/alerts', icon: 'navAlert', activeIcon: 'navAlertActive' },
  { id: 'maintenance', label: 'Bảo trì', path: '/maintenance', icon: 'navMaintenance', activeIcon: 'navMaintenanceActive' },
  { id: 'reports', label: 'Báo cáo', path: '/reports', icon: 'navReport' },
];

/** Mọi mục có đường dẫn (cấp 1 + menu con). */
const NAV_PATHS: readonly { id: string; path: string }[] = NAV_ROUTES.flatMap((r) => [
  ...(r.path ? [{ id: r.id, path: r.path }] : []),
  ...(r.children ?? []),
]);

const matches = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/**
 * Tìm mục nav ứng với pathname theo tiền tố, ưu tiên đường dẫn dài nhất
 * (/alerts/123 → alerts; /map, /map/V-101 → map; /operations/logs → operation-logs).
 */
export function navIdFromPath(pathname: string): string {
  let best: { id: string; path: string } | undefined;
  for (const r of NAV_PATHS) {
    if (matches(pathname, r.path) && (!best || r.path.length > best.path.length)) best = r;
  }
  return best?.id ?? '';
}

/** Đường dẫn của mục nav (cấp 1 hoặc menu con); undefined nếu không có. */
export function navPathFromId(id: string): string | undefined {
  return NAV_PATHS.find((r) => r.id === id)?.path;
}
