import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Page } from '@/app/Page';
import { PageError, Placeholder } from '@/app/Placeholder';
import { Button, PageHeader } from '@/components';
import { useMaintenance } from '@/data/maintenance';
import { maintenanceListUrl, resolveMaintenanceId } from '@/data/maintenanceDetail';
import NotFoundPage from '../NotFoundPage';
import { MaintenanceDetail } from './detail/MaintenanceDetail';

/**
 * Route `/maintenance/:id`: chờ danh sách tải xong rồi chuẩn hoá mã.
 * - khác kiểu chữ (`/maintenance/mt-00128`) → mã chuẩn (giữ query + state);
 * - không có → "Không tìm thấy yêu cầu" (URL giữ nguyên, không để trang trắng).
 */
export default function MaintenanceDetailRoute() {
  const { id: raw = '' } = useParams();
  const { search, state } = useLocation();
  const navigate = useNavigate();
  const { status, data, error, refetch } = useMaintenance();
  const listUrl = maintenanceListUrl((state as { from?: unknown } | null)?.from);

  if (status !== 'success') {
    const header = (
      <PageHeader breadcrumb={[{ label: 'Bảo trì', to: '/maintenance' }, { label: 'Quản lý bảo trì', to: listUrl }, { label: raw }]} title={raw} />
    );
    return (
      <Page pageHeader={header}>
        {status === 'error' ? (
          <PageError title="Không tải được yêu cầu bảo trì" error={error} onRetry={refetch} />
        ) : (
          <>
            <Placeholder label="Đang tải…" height={94} />
            <Placeholder label="Đang tải…" height={600} />
          </>
        )}
      </Page>
    );
  }

  const id = resolveMaintenanceId(raw, data);
  if (!id) {
    return (
      <NotFoundPage
        title="Không tìm thấy yêu cầu"
        breadcrumb={[{ label: 'Bảo trì', to: '/maintenance' }, { label: 'Quản lý bảo trì', to: listUrl }, { label: raw || '—' }]}
        message={
          <>
            Không có yêu cầu bảo trì <code className="font-mono text-fg">{raw}</code>. Có thể mã đã sai hoặc yêu cầu đã bị xoá.
          </>
        }
        actions={<Button onClick={() => navigate(listUrl)}>Về danh sách bảo trì</Button>}
      />
    );
  }
  if (id !== raw) return <Navigate to={`/maintenance/${id}${search}`} replace state={state} />;
  return <MaintenanceDetail record={data.find((r) => r.id === id)!} listUrl={listUrl} />;
}
