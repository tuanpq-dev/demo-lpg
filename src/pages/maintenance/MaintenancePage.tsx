import { useCallback, useEffect, useMemo } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button, Icon, PageHeader } from '@/components';
import { useAuth, useCan } from '@/app/auth';
import { DateRangeSelect, ExportButton, LiveDataButton, RefreshButton } from '@/app/HeaderActions';
import { Page } from '@/app/Page';
import { pageFallback } from '@/app/Placeholder';
import { useFilterParams } from '@/app/useTableFilters';
import { useRecordSelection } from '@/app/useRecordSelection';
import {
  fetchMaintenanceList,
  useDeviceDirectory,
  useMaintenancePage,
  useMaintenanceSummary,
  type MaintenanceListQuery,
} from '@/data/maintenanceApi';
import { listSearchOnly, rememberListSearch } from '@/data/maintenanceDetail';
import { bulkAssignMessage } from '@/features/maintenance/assign';
import {
  MAINTENANCE_PARAMS,
  RANGE_OPTIONS,
  maintenanceKpis,
  priorityTask,
  scheduleEvents,
  useMaintenance,
  type MaintenanceRecord,
} from '@/data/maintenance';
import { runAction } from '@/lib/actionError';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useNotice } from '@/lib/useNotice';
import { useNow } from '@/lib/useNow';
import { combineQueries } from '@/lib/useQuery';
import { maintenanceColumns } from './list/maintenanceColumns';
import { MaintenanceListSection, PAGE_SIZE } from './list/MaintenanceListSection';
import { MaintenanceModals } from './list/MaintenanceModals';
import { MaintenanceKpiSection, PriorityTasksSection } from './list/MaintenanceSections';
import { useMaintenanceModals } from './list/useMaintenanceModals';
import { preloadMaintenanceModals } from './lazyModals';

const getId = (r: MaintenanceRecord) => r.id;
const NO_ROWS: MaintenanceRecord[] = [];
/** Ô tìm kiếm: chỉ gửi truy vấn khi ngừng gõ (URL vẫn cập nhật ngay). */
const SEARCH_DEBOUNCE_MS = 300;

/** Xuất CSV MỌI yêu cầu khớp bộ lọc (không chỉ trang đang xem). TODO(backend): GET /maintenance/export?… trả CSV. */
const exportMatching = (query: MaintenanceListQuery, total: number, now: Date) =>
  runAction(async () => {
    const [{ exportMaintenanceCsv }, all] = await Promise.all([
      import('./list/exportMaintenanceCsv'),
      fetchMaintenanceList({ ...query, page: 1, pageSize: Math.max(1, total) }),
    ]);
    exportMaintenanceCsv(all.rows, now);
  });

/**
 * Quản lý bảo trì (Figma 70:3964) – AppLayout full-width. Khối (thư mục `list/`): KPI · Công việc cần ưu tiên · Danh sách
 * yêu cầu + Lịch sắp tới · modal (tạo / tiến độ / gửi nghiệm thu / nghiệm thu / phân công – mở qua query, `useMaintenanceModals`).
 * Lọc / phân trang / đếm / KPI ở MÁY CHỦ (`data/maintenanceApi.ts`): trang chỉ giữ một trang dòng + số đếm.
 */
export default function MaintenancePage() {
  const ops = useMaintenance();
  const { user } = useAuth();
  const actor = user?.name || 'Admin';
  const navigate = useNavigate();
  const location = useLocation();
  // Tạo/sửa yêu cầu: operator trở lên (UX – backend kiểm tra lại khi có API).
  const canWrite = useCan('maintenance:write');
  const canReview = useCan('maintenance:review');
  const { notice, flash } = useNotice();
  // "Hôm nay" (quá hạn, nhãn hạn) theo giờ nhà máy – cập nhật mỗi phút; truy vấn cũng tải lại ngầm mỗi phút.
  const now = useNow(60_000);

  const params = useFilterParams(MAINTENANCE_PARAMS);
  const { values: f, setValues, search, setExtra } = params;
  const q = useDebouncedValue(f.q, SEARCH_DEBOUNCE_MS);
  const query: MaintenanceListQuery = { ...f, q, page: params.page, pageSize: PAGE_SIZE };
  const list = useMaintenancePage(query, now);
  const summary = useMaintenanceSummary(now);
  const state = combineQueries(list, summary);
  const ready = state.status === 'success';
  useEffect(() => (ready ? preloadMaintenanceModals() : undefined), [ready]);
  const result = list.data;
  // Đổi bộ lọc (không tính trang) → bỏ chọn.
  const { page: _page, ...filterKey } = query;
  const selection = useRecordSelection(result?.rows ?? NO_ROWS, getId, JSON.stringify(filterKey));

  const s = summary.data;
  const kpis = useMemo(() => (s ? maintenanceKpis(s.counts) : []), [s]);
  const priority = useMemo(() => s?.priority.map((r) => priorityTask(r, now)) ?? [], [s, now]);
  const schedule = useMemo(() => (s ? scheduleEvents(s.schedule, now) : []), [s, now]);
  // Chi tiết = trang riêng /maintenance/:id; mang theo URL danh sách hiện tại để "Quay lại" đúng bộ lọc.
  const listUrl = `${location.pathname}${listSearchOnly(location.search)}`;
  const openDetail = useCallback((id: string) => void navigate(`/maintenance/${id}`, { state: { from: listUrl } }), [navigate, listUrl]);
  useEffect(() => rememberListSearch(location.search), [location.search]);

  const modals = useMaintenanceModals({ search, setExtra, canWrite, canReview });
  /** Danh bạ thiết bị → khu vực (GET /devices) cho ô "Thiết bị"/"Khu vực" của form – chỉ tải khi mở form tạo. */
  const devices = useDeviceDirectory(modals.create.open);

  const columns = maintenanceColumns({ now, canWrite, canReview, openDetail, openModal: (modal, id) => setExtra({ [modal]: id }) });

  // Không còn "Chuyển nghiệm thu" hàng loạt: mỗi yêu cầu cần hồ sơ gửi nghiệm thu riêng (modal Gửi yêu cầu nghiệm thu).
  // Phân công hàng loạt: CHỈ dòng Chờ tiếp nhận (không đổi người hàng loạt); cảnh báo gộp khi người được chọn sẽ thành Bận.
  const runBulkAssign = (name: string) =>
    runAction(async () => {
      const { assigned, skippedBy, busyAfter, activeAfter } = await ops.bulkAssign(selection.selected, name, actor);
      flash(`${bulkAssignMessage(assigned, skippedBy)}.` + (busyAfter && assigned ? ` Lưu ý: ${name} sẽ Bận (${activeAfter} việc đang làm).` : ''));
      selection.clear();
    });

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
          <ExportButton onClick={() => void exportMatching(query, result?.total ?? 0, now)} />
          <LiveDataButton />
          <RefreshButton onClick={state.refetch} />
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

  if (state.status !== 'success' || !result)
    return pageFallback(
      { status: state.status === 'error' ? 'error' : 'loading', error: state.error, refetch: state.refetch },
      { header, errorTitle: 'Không tải được danh sách bảo trì', skeleton: [130, 190, 518] },
    );

  return (
    <Page pageHeader={header}>
      <MaintenanceKpiSection kpis={kpis} />
      <PriorityTasksSection tasks={priority} onDetail={openDetail} />
      <MaintenanceListSection
        params={params}
        result={result}
        pending={list.pending}
        selection={selection}
        columns={columns}
        notice={notice}
        schedule={schedule}
        onShowSchedule={showSchedule}
        openDetail={openDetail}
        onBulkAssign={(name) => void runBulkAssign(name)}
      />
      <MaintenanceModals
        modals={modals}
        ops={ops}
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
