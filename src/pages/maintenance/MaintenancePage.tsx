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
import { AUTH_MODE } from '@/api/auth';
import { useAuth, useCan } from '@/app/auth';
import { DateRangeSelect, ExportButton, LiveDataButton, RefreshButton } from '@/app/HeaderActions';
import { KpiFromData } from '@/app/kpi';
import { Page } from '@/app/Page';
import { Placeholder } from '@/app/Placeholder';
import { useTableFilters } from '@/app/useTableFilters';
import { useAlerts } from '@/data/alerts';
import { listSearchOnly, rememberListSearch } from '@/data/maintenanceDetail';
import { checklistProgress } from '@/features/maintenance/checklist';
import { HOLD_LABEL, canUpdateProgress, reportedProgressOf, type ProgressFile } from '@/features/maintenance/progress';
import { REVIEW_FAILED_LABEL, resolveReviewer } from '@/features/maintenance/review';
import { bulkAssignMessage, canAssign } from '@/features/maintenance/assign';
import { linkedMaintenance } from '@/features/alerts/workflow';
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
  deriveDeviceDirectory,
  type MaintenanceRecord,
  type MaintenanceTab,
  type MaintenanceType,
} from '@/data/maintenance';
import { cn } from '@/lib/cn';
import { plantDayKey } from '@/lib/plantTime';
import { useNow } from '@/lib/useNow';
import { CreateMaintenanceModal } from './CreateMaintenanceModal';
import { ProgressUpdateModal } from './ProgressUpdateModal';
import { AssignModal } from './AssignModal';
import { ReviewModal } from './ReviewModal';
import { SubmitReviewModal } from './SubmitReviewModal';

const PAGE_SIZE = 8;
const getId = (r: MaintenanceRecord) => r.id;

function exportCsv(rows: readonly MaintenanceRecord[], now: Date) {
  const head = ['Mã yêu cầu', 'Ngày tạo', 'Nội dung', 'Thiết bị', 'Khu vực', 'Loại', 'Mức độ', 'Người PT', 'Hạn xử lý', 'Trạng thái', 'Tiến độ báo cáo (%)', 'Checklist', 'Quá hạn'];
  const pr = Object.fromEntries(PRIORITY_OPTIONS.map((o) => [o.value, o.label]));
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [r.code, formatDate(r.createdAt), r.title, r.device, r.area, TYPE_LABEL[r.type], pr[r.priority], r.assignee ?? '', formatDate(r.dueAt), r.hold ? `${STATUS_LABEL[r.status]} – ${HOLD_LABEL[r.hold.kind]}` : STATUS_LABEL[r.status], String(reportedProgressOf(r)), checklistText(r), isOverdue(r, now) ? 'Có' : '']
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

/** "2/6" hoặc "" (không có checklist). */
const checklistText = (r: MaintenanceRecord) => {
  if (!r.checklist?.length) return '';
  const p = checklistProgress(r.checklist);
  return `${p.done}/${p.total}`;
};

/** Badge trạng thái + cờ "Tạm dừng"/"Gặp sự cố" (Gặp sự cố nổi bật: nền đỏ nhạt, chữ đỏ). */
function StatusCell({ r }: { r: MaintenanceRecord }) {
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Badge variant="status" value={STATUS_BADGE[r.status]} withIcon>
        {STATUS_LABEL[r.status]}
      </Badge>
      {r.hold && (
        <Badge variant="tag" tone={r.hold.kind === 'blocked' ? 'danger' : 'warning'}>
          {r.hold.kind === 'blocked' && <span aria-hidden="true">⚠&nbsp;</span>}
          {HOLD_LABEL[r.hold.kind]}
        </Badge>
      )}
      {r.reviewFailed && r.status === 'in-progress' && (
        <Badge variant="tag" tone="danger">
          {REVIEW_FAILED_LABEL}
        </Badge>
      )}
    </span>
  );
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
  const { status, data, error, refetch, create, assign, bulkAssign, updateProgress, submitForReview, review } = useMaintenance();
  const { user } = useAuth();
  const actor = user?.name || 'Admin';
  const navigate = useNavigate();
  const location = useLocation();
  // Tạo/sửa yêu cầu: operator trở lên (UX – backend kiểm tra lại khi có API).
  const canWrite = useCan('maintenance:write');
  const canReview = useCan('maintenance:review');
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
  const fromAlert = search.get('from');
  const sourceAlert = fromAlert ? alerts.data?.find((a) => a.id === fromAlert) : undefined;
  // Cảnh báo đã có yêu cầu (chưa hủy) → không mở form tạo trùng, chuyển sang yêu cầu đó.
  const linkedFromAlert = fromAlert ? linkedMaintenance(fromAlert, all) : undefined;
  const createOpen = canWrite && search.get('create') === '1' && !linkedFromAlert;
  useEffect(() => {
    if (linkedFromAlert && search.get('create') === '1') navigate(`/maintenance/${linkedFromAlert.id}`, { replace: true });
  }, [linkedFromAlert, search, navigate]);
  const closeCreate = () => setExtra({ create: null, device: null, from: null });

  // ---- Modal cập nhật tiến độ: ?progress=<id> (badge trạng thái của dòng Đã phân công / Đang thực hiện).
  // TODO(backend): chỉ người được phân công cập nhật tiến độ (hiện: mọi vai trò có maintenance:write).
  const progressId = search.get('progress');
  const progressRecord = canWrite && progressId ? all.find((r) => r.id === progressId && canUpdateProgress(r.status)) : undefined;
  const closeProgress = () => setExtra({ progress: null });

  // ---- Gửi nghiệm thu (?submit=<id>, từ "Tiếp tục gửi nghiệm thu" của modal tiến độ) · Nghiệm thu (?review=<id>, badge "Chờ nghiệm thu").
  const [submitPrefill, setSubmitPrefill] = useState<{ text: string; files: readonly ProgressFile[] } | undefined>();
  const submitId = search.get('submit');
  const submitRecord = canWrite && submitId ? all.find((r) => r.id === submitId && r.status === 'in-progress') : undefined;
  const closeSubmit = () => {
    setSubmitPrefill(undefined);
    setExtra({ submit: null });
  };
  const reviewId = search.get('review');
  const reviewRecordRow = canReview && reviewId ? all.find((r) => r.id === reviewId && r.status === 'review') : undefined;
  const closeReview = () => setExtra({ review: null });

  // ---- Phân công (?assign=<id>, badge "Chờ tiếp nhận"): chỉ Chờ tiếp nhận (đổi người làm ở trang chi tiết).
  const assignId = search.get('assign');
  const assignRow = canWrite && assignId ? all.find((r) => r.id === assignId && canAssign(r.status)) : undefined;
  const closeAssign = () => setExtra({ assign: null });

  /** Danh bạ thiết bị → khu vực (bảo trì + cảnh báo) cho ô "Thiết bị"/"Khu vực" của form. */
  const devices = useMemo(() => deriveDeviceDirectory(all, alerts.data ?? []), [all, alerts.data]);

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
      cell: (r) =>
        canWrite && canAssign(r.status) ? (
          <button type="button" onClick={() => setExtra({ assign: r.id })} title="Phân công người xử lý" className="rounded-md text-left hover:brightness-125">
            {/* Tên = chữ ẩn + chữ hiển thị ("label in name" – WCAG 2.5.3), cùng cách badge tiến độ/nghiệm thu. */}
            <span className="sr-only">Phân công {r.code} – trạng thái: </span>
            <StatusCell r={r} />
          </button>
        ) : canReview && r.status === 'review' ? (
          <button type="button" onClick={() => setExtra({ review: r.id })} title="Nghiệm thu" className="rounded-md text-left hover:brightness-125">
            <span className="sr-only">Nghiệm thu {r.code} – trạng thái: </span>
            <StatusCell r={r} />
          </button>
        ) : canWrite && canUpdateProgress(r.status) ? (
          <button
            type="button"
            onClick={() => setExtra({ progress: r.id })}
            title="Cập nhật tiến độ"
            className="rounded-md text-left hover:brightness-125"
          >
            {/* Tên truy cập = chữ ẩn + chữ hiển thị (không dùng aria-label → khớp WCAG 2.5.3 "label in name"). */}
            <span className="sr-only">Cập nhật tiến độ {r.code} – trạng thái: </span>
            <StatusCell r={r} />
          </button>
        ) : (
          <StatusCell r={r} />
        ),
    },
    {
      id: 'progress',
      header: 'Tiến độ',
      width: 96,
      cell: (r) => {
        const list = checklistText(r);
        return (
          <span className="flex flex-col leading-tight">
            <span className="text-base tabular-nums text-fg">
              {reportedProgressOf(r)}%<span className="sr-only"> (tiến độ báo cáo)</span>
            </span>
            {list && <span className="text-xs text-fg-secondary">Checklist {list}</span>}
          </span>
        );
      },
    },
  ];

  // Không còn "Chuyển nghiệm thu" hàng loạt: mỗi yêu cầu cần hồ sơ gửi nghiệm thu riêng (modal Gửi yêu cầu nghiệm thu).
  // Phân công hàng loạt: CHỈ dòng Chờ tiếp nhận (không đổi người hàng loạt); cảnh báo gộp khi người được chọn sẽ thành Bận.
  const runBulkAssign = async (name: string) => {
    const { assigned, skippedBy, busyAfter, activeAfter } = await bulkAssign([...selected], name, actor);
    setNotice(`${bulkAssignMessage(assigned, skippedBy)}.` + (busyAfter && assigned ? ` Lưu ý: ${name} sẽ Bận (${activeAfter} việc đang làm).` : ''));
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
                  label="Phân công (chỉ Chờ tiếp nhận)"
                  options={MAINTENANCE_ASSIGNEES.map((n) => ({ value: n, label: n }))}
                  value={null}
                  onChange={(n) => n && runBulkAssign(n)}
                />
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

      {progressRecord && (
        <ProgressUpdateModal
          key={progressRecord.id}
          record={progressRecord}
          onClose={closeProgress}
          onOpenChecklist={() => navigate(`/maintenance/${progressRecord.id}#checklist`, { state: { from: listUrl } })}
          onSubmit={async (input) => {
            await updateProgress(progressRecord.id, input, actor);
            closeProgress();
            setNotice(`Đã cập nhật tiến độ ${progressRecord.code}.`);
          }}
          onContinueToSubmit={(prefill) => {
            setSubmitPrefill(prefill);
            setExtra({ progress: null, submit: progressRecord.id });
          }}
        />
      )}
      {submitRecord && (
        <SubmitReviewModal
          key={submitRecord.id}
          record={submitRecord}
          prefill={submitPrefill}
          onClose={closeSubmit}
          onSubmit={async (input) => {
            await submitForReview(submitRecord.id, input, actor);
            closeSubmit();
            setNotice(`Đã gửi nghiệm thu ${submitRecord.code} – chờ ${input.reviewer} nghiệm thu.`);
          }}
        />
      )}
      {assignRow && (
        <AssignModal
          key={assignRow.id}
          record={assignRow}
          records={all}
          onClose={closeAssign}
          onSubmit={async (form) => {
            await assign(assignRow.id, form, actor);
            closeAssign();
            // TODO(backend): thông báo đẩy/SMS cho người được phân công.
            setNotice(`Đã phân công ${assignRow.code} cho ${form.assignee}.`);
          }}
        />
      )}
      {reviewRecordRow && (
        <ReviewModal
          key={reviewRecordRow.id}
          record={reviewRecordRow}
          reviewer={resolveReviewer({ authOff: AUTH_MODE === 'off', userName: user?.name, submission: reviewRecordRow.submission })}
          onClose={closeReview}
          onSubmit={async (input) => {
            await review(reviewRecordRow.id, input);
            closeReview();
            setNotice(
              input.result === 'pass'
                ? `Đã nghiệm thu đạt ${reviewRecordRow.code} – hoàn thành.`
                : `Đã trả ${reviewRecordRow.code} về Đang thực hiện (${input.result === 'fail' ? 'không đạt' : 'cần bổ sung'}).`,
            );
          }}
        />
      )}

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
