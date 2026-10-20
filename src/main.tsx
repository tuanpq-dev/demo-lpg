import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './styles/global.css';
import AlertsPage from './pages/alerts/AlertsPage';
import MaintenancePage from './pages/maintenance/MaintenancePage';
import SimplePage from './pages/SimplePage';

// Trang có chart (recharts) tách chunk riêng để bundle chính nhẹ.
const OverviewPage = lazy(() => import('./pages/overview/OverviewPage'));
const PlaygroundPage = lazy(() => import('./pages/playground/PlaygroundPage'));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen bg-bg-app" aria-busy="true" />}>
        <Routes>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/map" element={<SimplePage section="Bản đồ nội khu" title="Bản đồ nội khu" />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/maintenance" element={<MaintenancePage />} />
          <Route path="/reports" element={<SimplePage section="Báo cáo" title="Báo cáo" />} />
          <Route path="/playground" element={<PlaygroundPage />} />
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </React.StrictMode>,
);
