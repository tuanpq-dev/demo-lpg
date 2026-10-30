import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { Navigate, Outlet, type LoaderFunctionArgs, RouterProvider, createBrowserRouter, redirect, useLocation } from 'react-router-dom';
import './styles/global.css';
import { AuthProvider, RequireAuth, useAuth } from './app/auth';
import { canUseEditor } from './app/editorAccess';
import LoginPage from './pages/login/LoginPage';
import PendingPage from './pages/login/PendingPage';
import RegisterPage from './pages/login/RegisterPage';
import NotFoundPage from './pages/NotFoundPage';
import { DEFAULT_ASSET_ID, assetPath } from './app/assetRoutes';

// Mỗi trang một chunk (chart recharts, 3D, Editor, bảng lớn) – bundle chính chỉ còn React + router + layout.
const OverviewPage = lazy(() => import('./pages/overview/OverviewPage'));
const AlertsPage = lazy(() => import('./pages/alerts/AlertsPage'));
const MaintenancePage = lazy(() => import('./pages/maintenance/MaintenancePage'));
const MaintenanceDetailPage = lazy(() => import('./pages/maintenance/MaintenanceDetailPage'));
const PlaygroundPage = lazy(() => import('./pages/playground/PlaygroundPage'));
const EditorPage = lazy(() => import('./pages/editor/EditorPage'));
const AssetDetailPage = lazy(() => import('./pages/asset/AssetDetailPage'));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'));
const SimplePage = lazy(() => import('./pages/SimplePage'));

function Root() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-app" aria-busy="true" />}>
      <Outlet />
    </Suspense>
  );
}

/** /editor chỉ mở khi có quyền (engineer/admin – xem canUseEditor) – không thì về Tổng quan. */
function EditorRoute() {
  const { search } = useLocation();
  const { user } = useAuth();
  return canUseEditor(search, user?.role) ? <EditorPage /> : <Navigate to="/overview" replace />;
}

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
    children: [
      // Công khai: đăng nhập, đăng ký, chờ duyệt.
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/pending', element: <PendingPage /> },
      {
        // Mọi trang còn lại cần đăng nhập (chưa đăng nhập → /login?next=…).
        element: <RequireAuth />,
        children: [
          { path: '/', loader: () => redirect('/overview') },
          { path: '/overview', element: <OverviewPage /> },
          // Tab "Bản đồ nội khu" mở thẳng trang chi tiết bồn V-101 (như ảnh 5D); chưa có bản đồ toàn nhà máy.
          { path: '/map', loader: () => redirect(assetPath(DEFAULT_ASSET_ID)) },
          { path: '/map/:assetId', element: <AssetDetailPage /> },
          // Menu "Vận hành": chưa có nội dung → SimplePage. Route tĩnh xếp hạng trên /operations/:assetId (đường dẫn cũ).
          { path: '/operations', loader: () => redirect('/operations/overview') },
          { path: '/operations/overview', element: <SimplePage section="Vận hành" title="Vận hành" /> },
          { path: '/operations/logs', element: <SimplePage section="Vận hành" title="Nhật ký vận hành" /> },
          { path: '/operations/ai-simulation', element: <SimplePage section="Vận hành" title="AI mô phỏng sự cố" /> },
          { path: '/operations/:assetId', loader: legacyAssetRedirect },
          { path: '/alerts', element: <AlertsPage /> },
          { path: '/maintenance', element: <MaintenancePage /> },
          // Chi tiết yêu cầu (ảnh MT-00128); `/maintenance?open=<id>` cũ chuyển hướng sang đây (MaintenancePage).
          { path: '/maintenance/:id', element: <MaintenanceDetailPage /> },
          { path: '/reports', element: <ReportsPage /> },
          { path: '/editor', element: <EditorRoute /> },
          { path: '/playground', element: <PlaygroundPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      {/* v7_startTransition: chuyển trang trong startTransition → khi chunk trang mới đang tải, React GIỮ trang cũ (kể cả
          header) thay vì hiện fallback trống của Suspense gốc – hết nháy màn hình khi đổi tab lần đầu. */}
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </AuthProvider>
  </React.StrictMode>,
);
