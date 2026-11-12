import React, { Suspense, lazy, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import {
  Outlet,
  type LoaderFunctionArgs,
  RouterProvider,
  ScrollRestoration,
  createBrowserRouter,
  redirect,
  useLocation,
  useMatches,
} from 'react-router-dom';
import './styles/global.css';
import { AuthProvider, RequireAuth, useAuth } from './app/auth';
import { canUseEditor } from './app/editorAccess';
import { MAP_EDITOR_PATH } from './app/settingsRoutes';
import { reloadForNewVersion } from './lib/chunkReload';
import { initMonitoring } from './lib/monitoring';
import ForbiddenPage from './pages/errors/ForbiddenPage';
import NotFoundPage from './pages/errors/NotFoundPage';
import RouteError from './pages/errors/RouteError';
import { DEFAULT_ASSET_ID, DEFAULT_OPERATION_DEVICE, assetPath, operationDevicePath } from './app/assetRoutes';

// Mỗi trang một chunk (chart, 3D, Editor, bảng lớn) – bundle chính chỉ còn React + router + layout.
const OverviewPage = lazy(() => import('./pages/overview/OverviewPage'));
const AlertsPage = lazy(() => import('./pages/alerts/AlertsPage'));
const MaintenancePage = lazy(() => import('./pages/maintenance/MaintenancePage'));
const MaintenanceDetailPage = lazy(() => import('./pages/maintenance/MaintenanceDetailPage'));
const EditorPage = lazy(() => import('./pages/editor/EditorPage'));
const AssetDetailPage = lazy(() => import('./pages/asset/AssetDetailPage'));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'));
const DailyReportDetailPage = lazy(() => import('./pages/reports/DailyReportDetailPage'));
const DeviceDetailPage = lazy(() => import('./pages/operations/DeviceDetailPage'));
const OperationLogsPage = lazy(() => import('./pages/operations/OperationLogsPage'));
const AiSimulationPage = lazy(() => import('./pages/operations/AiSimulationPage'));
const ScenarioConfigPage = lazy(() => import('./pages/operations/ScenarioConfigPage'));
const SimulationMonitorPage = lazy(() => import('./pages/operations/SimulationMonitorPage'));
const SimulationResultPage = lazy(() => import('./pages/operations/SimulationResultPage'));
// Đăng nhập / đăng ký / chờ duyệt: người đã có phiên (và bản demo VITE_AUTH=off) không cần tải.
const LoginPage = lazy(() => import('./pages/login/LoginPage'));
const RegisterPage = lazy(() => import('./pages/login/RegisterPage'));
const PendingPage = lazy(() => import('./pages/login/PendingPage'));

const APP_TITLE = 'Plant Control – Digital Twin';

/** Tiêu đề tab trình duyệt: `handle.title` của route sâu nhất có khai báo. */
type RouteHandle = { title?: string };
function useDocumentTitle() {
  const matches = useMatches();
  const title = [...matches]
    .reverse()
    .map((m) => (m.handle as RouteHandle | undefined)?.title)
    .find(Boolean);
  useEffect(() => {
    document.title = title ? `${title} · ${APP_TITLE}` : APP_TITLE;
  }, [title]);
}

function Root() {
  useDocumentTitle();
  return (
    <>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-bg-app text-sm text-fg-muted" aria-busy="true">
            Đang tải trang…
          </div>
        }
      >
        <Outlet />
      </Suspense>
      {/* Giữ vị trí cuộn theo pathname: đổi query (mở modal, lọc bảng) không nhảy lên đầu; sang trang khác thì lên đầu. */}
      <ScrollRestoration getKey={(location) => location.pathname} />
    </>
  );
}

/** Chỉnh sửa bản đồ 3D (/settings/map-editor) chỉ mở khi có quyền (engineer/admin – xem canUseEditor); không có quyền → trang 403. */
function EditorRoute() {
  const { search } = useLocation();
  const { user } = useAuth();
  return canUseEditor(search, user?.role) ? <EditorPage /> : <ForbiddenPage feature="Chỉnh sửa bản đồ 3D" />;
}

/** Tab mở từ trước khi deploy: preload chunk cũ (đã xoá) lỗi → tải lại trang một lần để nhận bản mới. */
window.addEventListener('vite:preloadError', (event) => {
  if (reloadForNewVersion()) event.preventDefault();
});

const t = (title: string): { handle: RouteHandle } => ({ handle: { title } });

/**
 * Chuyển hướng cố định làm bằng `loader` (chạy trước khi render) thay vì phần tử `<Navigate>`: `<Navigate>` render một
 * khung trống rồi mới chuyển trong effect → màn hình nháy (header biến mất) khi bấm tab "Bản đồ nội khu".
 * Đường dẫn cũ /operations/:assetId (GĐ 5D) → /map/:assetId, giữ query (?hide=, ?create=…) để link cũ không hỏng.
 */
const legacyAssetRedirect = ({ params, request }: LoaderFunctionArgs) => redirect(`${assetPath(params.assetId ?? '')}${new URL(request.url).search}`);

// Data router (createBrowserRouter) để dùng useBlocker – Editor chặn rời trang khi chưa lưu.
const router = createBrowserRouter([
  {
    element: <Root />,
    // Tầng gốc: trang lỗi trần (không header – header có thể chính là chỗ lỗi).
    errorElement: <RouteError withHeader={false} />,
    children: [
      // Công khai: đăng nhập, đăng ký, chờ duyệt.
      { path: '/login', element: <LoginPage />, ...t('Đăng nhập') },
      { path: '/register', element: <RegisterPage />, ...t('Đăng ký') },
      { path: '/pending', element: <PendingPage />, ...t('Chờ duyệt tài khoản') },
      {
        // Mọi trang còn lại cần đăng nhập (chưa đăng nhập → /login?next=…).
        element: <RequireAuth />,
        // Lỗi trong một trang → trang lỗi vẫn giữ header/menu.
        errorElement: <RouteError />,
        children: [
          { path: '/', loader: () => redirect('/overview') },
          { path: '/overview', element: <OverviewPage />, ...t('Tổng quan') },
          // Tab "Bản đồ nội khu" mở thẳng trang chi tiết bồn V-101 (như ảnh 5D); chưa có bản đồ toàn nhà máy.
          { path: '/map', loader: () => redirect(assetPath(DEFAULT_ASSET_ID)) },
          { path: '/map/:assetId', element: <AssetDetailPage />, ...t('Chi tiết tài sản') },
          // Menu "Vận hành" → "Giám sát thiết bị" (chưa có danh sách thiết bị → mở E-101A, ảnh op-device-*.png).
          // Route tĩnh xếp hạng trên /operations/:assetId (đường dẫn cũ). /operations/overview = link cũ của mục menu.
          { path: '/operations', loader: () => redirect('/operations/devices') },
          { path: '/operations/overview', loader: () => redirect('/operations/devices') },
          { path: '/operations/devices', loader: () => redirect(operationDevicePath(DEFAULT_OPERATION_DEVICE)) },
          { path: '/operations/devices/:deviceId', element: <DeviceDetailPage />, ...t('Giám sát thiết bị') },
          { path: '/operations/logs', element: <OperationLogsPage />, ...t('Nhật ký vận hành') },
          { path: '/operations/ai-simulation', element: <AiSimulationPage />, ...t('AI mô phỏng sự cố') },
          // Cấu hình kịch bản mô phỏng (ảnh 03/11/2026).
          { path: '/operations/ai-simulation/:scenarioId/config', element: <ScenarioConfigPage />, ...t('Cấu hình kịch bản') },
          { path: '/operations/ai-simulation/:scenarioId/monitor', element: <SimulationMonitorPage />, ...t('Theo dõi mô phỏng') },
          { path: '/operations/ai-simulation/:scenarioId/result', element: <SimulationResultPage />, ...t('Kết quả mô phỏng') },
          { path: '/operations/:assetId', loader: legacyAssetRedirect },
          { path: '/alerts', element: <AlertsPage />, ...t('Cảnh báo') },
          { path: '/maintenance', element: <MaintenancePage />, ...t('Bảo trì') },
          // Chi tiết yêu cầu (ảnh MT-00128); `/maintenance?open=<id>` cũ chuyển hướng sang đây (MaintenancePage).
          { path: '/maintenance/:id', element: <MaintenanceDetailPage />, ...t('Chi tiết bảo trì') },
          { path: '/reports', element: <ReportsPage />, ...t('Báo cáo') },
          // Chi tiết báo cáo ngày (Figma 117:4250); tháng/quý/năm chưa có thiết kế.
          { path: '/reports/daily/:code', element: <DailyReportDetailPage />, ...t('Báo cáo ngày') },
          // Chỉnh sửa bản đồ 3D (Scene Editor) – mở từ menu Cài đặt trên header. /settings và /editor (link cũ) chuyển sang, giữ query.
          { path: MAP_EDITOR_PATH, element: <EditorRoute />, ...t('Chỉnh sửa bản đồ 3D') },
          { path: '/settings', loader: () => redirect(MAP_EDITOR_PATH) },
          { path: '/editor', loader: ({ request }) => redirect(`${MAP_EDITOR_PATH}${new URL(request.url).search}`) },
          { path: '*', element: <NotFoundPage />, ...t('Không tìm thấy trang') },
        ],
      },
    ],
  },
]);

initMonitoring();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      {/* React Router 7: chuyển trang luôn trong startTransition → khi chunk trang mới đang tải, React GIỮ trang cũ (kể cả
          header) thay vì hiện fallback trống của Suspense gốc – không nháy màn hình khi đổi tab lần đầu. */}
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>,
);
