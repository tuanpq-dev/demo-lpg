import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { Navigate, Outlet, RouterProvider, createBrowserRouter, useLocation, useParams } from 'react-router-dom';
import './styles/global.css';
import { AuthProvider, RequireAuth, useAuth } from './app/auth';
import { canUseEditor } from './app/editorAccess';
import LoginPage from './pages/login/LoginPage';
import PendingPage from './pages/login/PendingPage';
import RegisterPage from './pages/login/RegisterPage';
import NotFoundPage from './pages/NotFoundPage';
import SimplePage from './pages/SimplePage';
import { DEFAULT_ASSET_ID, assetPath } from './app/assetRoutes';

// Mỗi trang một chunk (chart recharts, 3D, Editor, bảng lớn) – bundle chính chỉ còn React + router + layout.
const OverviewPage = lazy(() => import('./pages/overview/OverviewPage'));
const AlertsPage = lazy(() => import('./pages/alerts/AlertsPage'));
const MaintenancePage = lazy(() => import('./pages/maintenance/MaintenancePage'));
const PlaygroundPage = lazy(() => import('./pages/playground/PlaygroundPage'));
const EditorPage = lazy(() => import('./pages/editor/EditorPage'));
const AssetDetailPage = lazy(() => import('./pages/asset/AssetDetailPage'));

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

/** Đường dẫn cũ /operations/:assetId (GĐ 5D) → /map/:assetId, giữ query (?hide=, ?create=…) để link cũ không hỏng. */
function LegacyAssetRedirect() {
  const { assetId = '' } = useParams();
  const { search } = useLocation();
  return <Navigate to={`${assetPath(assetId)}${search}`} replace />;
}

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
          { path: '/', element: <Navigate to="/overview" replace /> },
          { path: '/overview', element: <OverviewPage /> },
          // Tab "Bản đồ nội khu" mở thẳng trang chi tiết bồn V-101 (như ảnh 5D); chưa có bản đồ toàn nhà máy.
          { path: '/map', element: <Navigate to={assetPath(DEFAULT_ASSET_ID)} replace /> },
          { path: '/map/:assetId', element: <AssetDetailPage /> },
          { path: '/operations/:assetId', element: <LegacyAssetRedirect /> },
          { path: '/alerts', element: <AlertsPage /> },
          { path: '/maintenance', element: <MaintenancePage /> },
          { path: '/reports', element: <SimplePage section="Báo cáo" title="Báo cáo" /> },
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
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>,
);
