import { useCallback, useEffect, useMemo } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button, Icon, PageHeader } from '@/components';
import { useAuth, useCan } from '@/app/auth';
import { DateRangeSelect, ExportButton, LiveDataButton, RefreshButton } from '@/app/HeaderActions';
import { Page } from '@/app/Page';
import { pageFallback } from '@/app/Placeholder';
import { useTableFilters } from '@/app/useTableFilters';
import { useAlerts } from '@/data/alerts';
import { listSearchOnly, rememberListSearch } from '@/data/maintenanceDetail';
import { bulkAssignMessage } from '@/features/maintenance/assign';
import {
  MAINTENANCE_PARAMS,
  RANGE_OPTIONS,
  deriveDeviceDirectory,
  deriveMaintenanceKpis,
  derivePriorityTasks,
  deriveSchedule,
  matchMaintenance,
  sortMaintenance,
  useMaintenance,
  type MaintenanceRecord,
} from '@/data/maintenance';
import { useNotice } from '@/lib/useNotice';
import { useNow } from '@/lib/useNow';
import { exportMaintenanceCsv } from './list/exportMaintenanceCsv';
import { maintenanceColumns } from './list/maintenanceColumns';
import { MaintenanceListSection, PAGE_SIZE } from './list/MaintenanceListSection';
import { MaintenanceModals } from './list/MaintenanceModals';
import { MaintenanceKpiSection, PriorityTasksSection } from './list/MaintenanceSections';
import { useMaintenanceModals } from './list/useMaintenanceModals';

const getId = (r: MaintenanceRecord) => r.id;

/**
 * Quản lý bảo trì (Figma 70:3964) – AppLayout full-width. Khối (thư mục `list/`): KPI · Công việc cần ưu tiên · Danh sách
 * yêu cầu + Lịch sắp tới · modal (tạo / tiến độ / gửi nghiệm thu / nghiệm thu / phân công – mở qua query, `useMaintenanceModals`).
 */
export default function MaintenancePage() {
  const maintenance = useMaintenance();
  const { status, data, error, refetch, bulkAssign } = maintenance;
  const { user } = useAuth();
  const actor = user?.name || 'Admin';
  const navigate = useNavigate();
  const location = useLocation();
  // Tạo/sửa yêu cầu: operator trở lên (UX – backend kiểm tra lại khi có API).
  const canWrite = useCan('maintenance:write');
  const canReview = useCan('maintenance:review');
  const alerts = useAlerts();
  const { notice, flash } = useNotice();
  const all = useMemo(() => data ?? [], [data]);
  // "Hôm nay" (quá hạn, khoảng ngày, KPI tháng) theo giờ nhà máy – cập nhật mỗi phút, truyền vào các hàm thuần.
  const now = useNow(60_000);
  const match = useCallback((r: MaintenanceRecord, v: Parameters<typeof matchMaintenance>[1]) => matchMaintenance(r, v, now), [now]);

  const table = useTableFilters({
    rows: all,
    getId,
    params: MAINTENANCE_PARAMS,
    match,
    sort: sortMaintenance,
    pageSize: PAGE_SIZE,
    tabKey: 'tab',
  });
  const { values: f, setValues, selected, setSelected, search, setExtra } = table;

  const kpis = useMemo(() => deriveMaintenanceKpis(all, now), [all, now]);
  const priority = useMemo(() => derivePriorityTasks(all, now), [all, now]);
  const schedule = useMemo(() => deriveSchedule(all, now), [all, now]);
  // Chi tiết = trang riêng /maintenance/:id; mang theo URL danh sách hiện tại để "Quay lại" đúng bộ lọc.
  const listUrl = `${location.pathname}${listSearchOnly(location.search)}`;
  const openDetail = useCallback((id: string) => void navigate(`/maintenance/${id}`, { state: { from: listUrl } }), [navigate, listUrl]);
  useEffect(() => rememberListSearch(location.search), [location.search]);

  const modals = useMaintenanceModals({ all, alerts: alerts.data, search, setExtra, canWrite, canReview });
  /** Danh bạ thiết bị → khu vực (bảo trì + cảnh báo) cho ô "Thiết bị"/"Khu vực" của form. */
  const devices = useMemo(() => deriveDeviceDirectory(all, alerts.data ?? []), [all, alerts.data]);

  const columns = maintenanceColumns({ now, canWrite, canReview, openDetail, openModal: (modal, id) => setExtra({ [modal]: id }) });

  // Không còn "Chuyển nghiệm thu" hàng loạt: mỗi yêu cầu cần hồ sơ gửi nghiệm thu riêng (modal Gửi yêu cầu nghiệm thu).
  // Phân công hàng loạt: CHỈ dòng Chờ tiếp nhận (không đổi người hàng loạt); cảnh báo gộp khi người được chọn sẽ thành Bận.
  const runBulkAssign = async (name: string) => {
    const { assigned, skippedBy, busyAfter, activeAfter } = await bulkAssign([...selected], name, actor);
    flash(`${bulkAssignMessage(assigned, skippedBy)}.` + (busyAfter && assigned ? ` Lưu ý: ${name} sẽ Bận (${activeAfter} việc đang làm).` : ''));
    setSelected([]);
  };

  const showSchedule = () => {
    setValues({ type: 'periodic', sort: 'due', tab: 'all' });
    document.getElementById('maintenance-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const header = (
    <PageHeader
      breadcrumb={[{ label: 'Bảo trì', to: '/maintenance' }, { label: 'Quản lý bảo trì' }]}
      title="Quản lý bảo trì"
      description="Theo dõi, phân công và quản lý tiến độ bảo trì thiết bị trong hệ thống LPG"
      actions={
        <>
          <DateRangeSelect value={f.range} options={RANGE_OPTIONS} onChange={(range) => setValues({ range })} />
          <ExportButton onClick={() => exportMaintenanceCsv(table.filtered, now)} />
          <LiveDataButton />
          <RefreshButton onClick={refetch} />
          {canWrite && (
            <Button variant="primary" icon={<Icon name="add" />} onClick={modals.openCreate}>
              Tạo yêu cầu bảo trì
            </Button>
          )}
        </>
      }
    />
  );

  // Link cũ `?open=<id>` (drawer đã bỏ) → trang chi tiết; bỏ `open` khỏi URL danh sách để "Quay lại" không mở lại.
  const legacyOpen = search.get('open');
  if (legacyOpen) {
    const from = `/maintenance${listSearchOnly(location.search)}`;
    return <Navigate to={`/maintenance/${encodeURIComponent(legacyOpen)}`} replace state={{ from }} />;
  }

  if (status !== 'success')
    return pageFallback({ status, error, refetch }, { header, errorTitle: 'Không tải được danh sách bảo trì', skeleton: [130, 190, 518] });

  return (
    <Page pageHeader={header}>
      <MaintenanceKpiSection kpis={kpis} />
      <PriorityTasksSection tasks={priority} onDetail={openDetail} />
      <MaintenanceListSection
        table={table}
        all={all}
        columns={columns}
        notice={notice}
        schedule={schedule}
        onShowSchedule={showSchedule}
        openDetail={openDetail}
        onBulkAssign={(name) => void runBulkAssign(name)}
      />
      <MaintenanceModals
        modals={modals}
        ops={maintenance}
        all={all}
        devices={devices}
        actor={actor}
        userName={user?.name}
        flash={flash}
        onOpenChecklist={(id) => void navigate(`/maintenance/${id}#checklist`, { state: { from: listUrl } })}
        onCreated={() =>
          setExtra({ create: null, device: null, from: null, tab: null, q: null, area: null, priority: null, type: null, sort: null, page: null })
        }
      />
    </Page>
  );
}
