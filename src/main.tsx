import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { Navigate, Outlet, RouterProvider, createBrowserRouter, useLocation } from 'react-router-dom';
import './styles/global.css';
import { canUseEditor } from './app/editorAccess';
import SimplePage from './pages/SimplePage';

// Mỗi trang một chunk (chart recharts, 3D, Editor, bảng lớn) – bundle chính chỉ còn React + router + layout.
const OverviewPage = lazy(() => import('./pages/overview/OverviewPage'));
const AlertsPage = lazy(() => import('./pages/alerts/AlertsPage'));
const MaintenancePage = lazy(() => import('./pages/maintenance/MaintenancePage'));
const PlaygroundPage = lazy(() => import('./pages/playground/PlaygroundPage'));
const EditorPage = lazy(() => import('./pages/editor/EditorPage'));

function Root() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-app" aria-busy="true" />}>
      <Outlet />
    </Suspense>
  );
}

/** /editor chỉ mở khi có quyền (xem canUseEditor) – không thì về Tổng quan. */
function EditorRoute() {
  const { search } = useLocation();
  return canUseEditor(search) ? <EditorPage /> : <Navigate to="/overview" replace />;
}

// Data router (createBrowserRouter) để dùng useBlocker – Editor chặn rời trang khi chưa lưu.
const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/', element: <Navigate to="/overview" replace /> },
      { path: '/overview', element: <OverviewPage /> },
      { path: '/map', element: <SimplePage section="Bản đồ nội khu" title="Bản đồ nội khu" /> },
      { path: '/alerts', element: <AlertsPage /> },
      { path: '/maintenance', element: <MaintenancePage /> },
      { path: '/reports', element: <SimplePage section="Báo cáo" title="Báo cáo" /> },
      { path: '/editor', element: <EditorRoute /> },
      { path: '/playground', element: <PlaygroundPage /> },
      { path: '*', element: <Navigate to="/overview" replace /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
