import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EventTimeline,
  FilterBar,
  Icon,
  PageHeader,
  PriorityTaskCard,
  Select,
  TableActionButton,
  Tabs,
  type DataTableColumn,
  type FilterDef,
  type Severity,
  type TabItem,
} from '@/components';
import { useCan } from '@/app/auth';
import { DateRangeSelect, ExportButton, LiveDataButton, RefreshButton } from '@/app/HeaderActions';
import { KpiFromData } from '@/app/kpi';
import { Page } from '@/app/Page';
import { Placeholder } from '@/app/Placeholder';
import { useTableFilters } from '@/app/useTableFilters';
import { useAlerts } from '@/data/alerts';
import { listSearchOnly, rememberListSearch } from '@/data/maintenanceDetail';
import {
  MAINTENANCE_ASSIGNEES,
  MAINTENANCE_PARAMS,
  PRIORITY_OPTIONS,
  RANGE_OPTIONS,
  STATUS_BADGE,
  STATUS_LABEL,
  TYPE_LABEL,
  TYPE_OPTIONS,
  deriveMaintenanceKpis,
  derivePriorityTasks,
  deriveSchedule,
  dueLabel,
  formatDate,
  isOverdue,
  matchMaintenance,
  sortMaintenance,
  useMaintenance,
  setDeviceDirectory,
  type MaintenanceRecord,
  type MaintenanceTab,
  type MaintenanceType,
} from '@/data/maintenance';
import { cn } from '@/lib/cn';
import { plantDayKey } from '@/lib/plantTime';
import { useNow } from '@/lib/useNow';
import { CreateMaintenanceModal } from './CreateMaintenanceModal';

const PAGE_SIZE = 8;
const getId = (r: MaintenanceRecord) => r.id;

function exportCsv(rows: readonly MaintenanceRecord[], now: Date) {
  const head = ['Mã yêu cầu', 'Ngày tạo', 'Nội dung', 'Thiết bị', 'Khu vực', 'Loại', 'Mức độ', 'Người PT', 'Hạn xử lý', 'Trạng thái', 'Tiến độ (%)', 'Quá hạn'];
  const pr = Object.fromEntries(PRIORITY_OPTIONS.map((o) => [o.value, o.label]));
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [r.code, formatDate(r.createdAt), r.title, r.device, r.area, TYPE_LABEL[r.type], pr[r.priority], r.assignee ?? '', formatDate(r.dueAt), STATUS_LABEL[r.status], String(r.progress), isOverdue(r, now) ? 'Có' : '']
      .map(esc)
      .join(','),
  );
  const blob = new Blob(['﻿' + [head.map(esc).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  // Ngày theo giờ nhà máy (toISOString là UTC → lệch ngày từ 0h đến 7h sáng).
  a.download = `bao-tri-${plantDayKey(now)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function SectionHeading({ icon, children, id }: { icon: 'sectionWarning' | 'sectionTimer'; children: string; id: string }) {
  return (
    <h2 id={id} className="flex items-center gap-2 text-xl font-semibold text-fg">
      <Icon name={icon} box={24} />
      {children}
    </h2>
  );
}

/** Quản lý bảo trì (Figma 70:3964) – AppLayout full-width. */
export default function MaintenancePage() {
  const { status, data, error, refetch, create, assign, complete } = useMaintenance();
  const navigate = useNavigate();
  const location = useLocation();
  // Tạo/sửa yêu cầu: operator trở lên (UX – backend kiểm tra lại khi có API).
  const canWrite = useCan('maintenance:write');
  const alerts = useAlerts();
  const [notice, setNotice] = useState('');
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
  const openDetail = useCallback((id: string) => navigate(`/maintenance/${id}`, { state: { from: listUrl } }), [navigate, listUrl]);
  useEffect(() => rememberListSearch(location.search), [location.search]);

  // ---- Modal tạo yêu cầu: điều khiển qua URL (?create=1&device=&from=) để /alerts mở sẵn được.
  const createOpen = canWrite && search.get('create') === '1';
  const fromAlert = search.get('from');
  const sourceAlert = fromAlert ? alerts.data?.find((a) => a.id === fromAlert) : undefined;
  const closeCreate = () => setExtra({ create: null, device: null, from: null });

  /** Danh bạ thiết bị → khu vực (bảo trì + cảnh báo) cho ô "Thiết bị"/"Khu vực" của form. */
  const devices = useMemo(() => setDeviceDirectory(all, alerts.data ?? []), [all, alerts.data]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const tc = table.tabCounts as Record<MaintenanceTab, number>;
  const tabs: TabItem[] = [
    { id: 'all', label: 'Tất cả' },
    { id: 'pending', label: 'Chờ tiếp nhận', count: tc.pending },
    { id: 'assigned', label: 'Đã phân công' },
    { id: 'in-progress', label: 'Đang thực hiện', count: tc['in-progress'], countTone: 'info' },
    { id: 'review', label: 'Chờ nghiệm thu' },
    { id: 'done', label: 'Hoàn thành' },
    { id: 'overdue', label: 'Quá hạn', count: tc.overdue, countTone: 'danger' },
  ];

  const filterDefs: FilterDef[] = [
    { id: 'area', label: 'Khu vực', allLabel: 'Tất cả khu vực', options: [...new Set(all.map((r) => r.area))].sort().map((a) => ({ value: a, label: a })) },
    { id: 'priority', label: 'Mức độ', options: PRIORITY_OPTIONS },
    { id: 'type', label: 'Loại bảo trì', options: TYPE_OPTIONS },
  ];

  const columns: DataTableColumn<MaintenanceRecord>[] = [
    {
      id: 'code',
      header: 'Mã yêu cầu',
      width: 100,
      cell: (r) => (
        <button
          type="button"
          onClick={() => openDetail(r.id)}
          className={cn('rounded-sm text-base text-info hover:underline', r.status === 'done' && 'text-fg-secondary line-through')}
        >
          {r.code}
        </button>
      ),
    },
    { id: 'createdAt', header: 'Ngày tạo', width: 100, className: 'text-base text-fg', cell: (r) => formatDate(r.createdAt) },
    { id: 'title', header: 'Nội dung', align: 'start', width: 240, className: 'max-w-[240px] truncate text-fg', cell: (r) => <span title={r.title}>{r.title}</span> },
    { id: 'device', header: 'Thiết bị', width: 80, className: 'text-base text-fg' },
    { id: 'priority', header: 'Mức độ', width: 100, cell: (r) => <Badge variant="severity" value={r.priority} /> },
    { id: 'assignee', header: 'Người PT', width: 110, className: 'text-base text-fg-secondary', cell: (r) => r.assignee ?? '–' },
    {
      id: 'dueAt',
      header: 'Hạn xử lý',
      width: 100,
      cell: (r) => (
        <span className={cn('text-base', isOverdue(r, now) ? 'text-danger-text' : 'text-fg')} title={dueLabel(r, now)}>
          {formatDate(r.dueAt)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Trạng thái',
      width: 120,
      cell: (r) => (
        <Badge variant="status" value={STATUS_BADGE[r.status]} withIcon>
          {STATUS_LABEL[r.status]}
        </Badge>
      ),
    },
  ];

  const runBulk = async (kind: 'assign' | 'complete', name?: string) => {
    const ids = [...selected];
    if (kind === 'assign' && name) {
      await assign(ids, name);
      setNotice(`Đã phân công ${ids.length} yêu cầu cho ${name}.`);
    } else if (kind === 'complete') {
      await complete(ids);
      setNotice(`Đã đánh dấu hoàn thành ${ids.length} yêu cầu.`);
    }
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
          <ExportButton onClick={() => exportCsv(table.filtered, now)} />
          <LiveDataButton />
          <RefreshButton onClick={refetch} />
          {canWrite && (
            <Button variant="primary" icon={<Icon name="add" />} onClick={() => setExtra({ create: '1' })}>
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

  if (status === 'error') {
    return (
      <Page pageHeader={header}>
        <Card title="Không tải được danh sách bảo trì" headerVariant="plain" tone="danger">
          <p className="mb-4 text-base text-fg-secondary">{error.message}</p>
          <Button onClick={refetch} className="self-start">
            Thử lại
          </Button>
        </Card>
      </Page>
    );
  }

  if (status === 'loading') {
    return (
      <Page pageHeader={header}>
        <Placeholder label="Đang tải…" height={130} />
        <Placeholder label="Đang tải…" height={190} />
        <Placeholder label="Đang tải…" height={518} />
      </Page>
    );
  }

  return (
    <Page pageHeader={header}>
      {/* 1. KPI – 70:5207 (6 cột gap 18) */}
      <section aria-label="Thống kê bảo trì" className="grid grid-cols-2 gap-[18px] md:grid-cols-3 wide:grid-cols-6">
        {kpis.map((k) => (
          <KpiFromData key={k.id} data={k} />
        ))}
      </section>

      {/* 2. Công việc cần ưu tiên – 70:5208 */}
      <section aria-labelledby="mt-priority" className="flex flex-col gap-3">
        <SectionHeading id="mt-priority" icon="sectionWarning">
          Công việc cần ưu tiên
        </SectionHeading>
        {priority.length ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {priority.map((p) => (
              <PriorityTaskCard key={p.id} {...p} onDetail={openDetail} />
            ))}
          </div>
        ) : (
          <p className="text-base text-fg-muted/70">Không có công việc ưu tiên.</p>
        )}
      </section>

      {/* 3. Danh sách yêu cầu + Lịch sắp tới – 70:5642 */}
      <section aria-labelledby="mt-list" id="maintenance-list" className="flex scroll-mt-20 flex-col gap-6">
        <SectionHeading id="mt-list" icon="sectionTimer">
          Danh sách yêu cầu bảo trì
        </SectionHeading>
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_346px]">
          <Card padding="none" radius="lg">
            <Tabs
              label="Lọc theo trạng thái"
              items={tabs}
              value={f.tab}
              onChange={(tab) => setValues({ tab: tab as MaintenanceTab })}
              panelId="maintenance-table"
            />
            <FilterBar
              search={f.q}
              onSearchChange={(q) => setValues({ q })}
              searchPlaceholder="Tìm kiếm mã yêu cầu, thiết bị, nội dung..."
              filters={filterDefs}
              values={{ area: f.area, priority: f.priority, type: f.type }}
              onValuesChange={(v) =>
                setValues({
                  area: v.area ?? null,
                  priority: (v.priority as Severity | null) ?? null,
                  type: (v.type as MaintenanceType | null) ?? null,
                })
              }
              advancedLabel="Xoá bộ lọc"
              advancedActive={table.isFiltered(['range'])}
              onAdvancedFilter={() => table.reset(['range'])}
            />

            {selected.length > 0 && (
              <div
                role="toolbar"
                aria-label="Thao tác hàng loạt"
                className="flex flex-wrap items-center gap-3 border-b border-info/20 bg-info/10 px-4 py-2.5"
              >
                <span className="text-base font-semibold text-info">Đã chọn {selected.length} yêu cầu</span>
                <Select
                  variant="button"
                  label="Phân công"
                  options={MAINTENANCE_ASSIGNEES.map((n) => ({ value: n, label: n }))}
                  value={null}
                  onChange={(n) => n && runBulk('assign', n)}
                />
                <Button onClick={() => runBulk('complete')}>Đánh dấu hoàn thành</Button>
                <Button variant="link" onClick={() => setSelected([])} className="ml-auto">
                  Bỏ chọn
                </Button>
              </div>
            )}
            <p role="status" className={notice ? 'px-4 pt-2 text-sm text-success' : 'sr-only'}>
              {notice}
            </p>

            <div id="maintenance-table">
              <DataTable
                label="Danh sách yêu cầu bảo trì"
                // Khung hẹp hơn → cuộn ngang trong khung; mã yêu cầu + cột "Xem" cố định khi cuộn.
                minWidth={1100}
                stickyFirst
                stickyActions
                columns={columns}
                rows={table.pageRows}
                getRowId={getId}
                selectable
                selectedIds={selected}
                onSelectionChange={setSelected}
                rowActions={(r) => <TableActionButton label={`Xem chi tiết ${r.code}`} onClick={() => openDetail(r.id)} />}
                onRowClick={(r) => openDetail(r.id)}
                emptyState="Không có yêu cầu bảo trì phù hợp."
                pagination={{
                  page: table.page,
                  pageSize: PAGE_SIZE,
                  total: table.filtered.length,
                  onPageChange: table.setPage,
                  summary: (a, b, n) => `Hiển thị ${a}-${b} của ${n} yêu cầu`,
                }}
              />
            </div>
          </Card>

          {/* Lịch sắp tới – 70:4889 */}
          <Card title="Lịch sắp tới" headerVariant="plain" action={{ label: 'Xem lịch', onClick: showSchedule }}>
            {schedule.length ? (
              <EventTimeline variant="schedule" events={schedule} onEventClick={openDetail} />
            ) : (
              <p className="text-sm text-fg-muted/70">Không có lịch bảo trì định kỳ sắp tới.</p>
            )}
          </Card>
        </div>
      </section>

      {/* Mount khi mở để form khởi tạo đúng ngay lần vẽ đầu (không nháy giá trị cũ). */}
      {createOpen && (
        <CreateMaintenanceModal
          open
          onClose={closeCreate}
          devices={devices}
          defaultDevice={search.get('device') ?? undefined}
          alert={sourceAlert}
          onDraftSaved={() => {
            closeCreate();
            setNotice('Đã lưu nháp yêu cầu bảo trì.');
          }}
          onSubmit={async (input) => {
            const rec = await create(input);
            setExtra({ create: null, device: null, from: null, tab: null, q: null, area: null, priority: null, type: null, sort: null, page: null });
            setNotice(`Đã tạo yêu cầu ${rec.code}.`);
          }}
        />
      )}
    </Page>
  );
}
