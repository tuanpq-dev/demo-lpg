import { useEffect, useMemo, useState } from 'react';
import {
  AlertCard,
  Badge,
  Button,
  Card,
  DataTable,
  FilterBar,
  Icon,
  PageHeader,
  TableActionButton,
  Tabs,
  type DataTableColumn,
  type FilterDef,
  type Severity,
  type TabItem,
} from '@/components';
import { useAuth, useCan } from '@/app/auth';
import { DateRangeSelect, ExportButton, LiveDataButton, RefreshButton } from '@/app/HeaderActions';
import { KpiFromData } from '@/app/kpi';
import { Page } from '@/app/Page';
import { Placeholder } from '@/app/Placeholder';
import { useTableFilters } from '@/app/useTableFilters';
import { announce } from '@/lib/announce';
import { plantDayKey } from '@/lib/plantTime';
import { useNow } from '@/lib/useNow';
import { bulkMessage, linkedMaintenance } from '@/features/alerts/workflow';
import { bulkCloseMessage, planBulkClose } from '@/features/alerts/close';
import { followUpConfig, useCloseConditions } from '@/data/alertDetail';
import { DuplicateFromAlertError, setDeviceDirectory, useMaintenance } from '@/data/maintenance';
import {
  ALERT_PARAMS,
  RANGE_OPTIONS,
  alertBadgeStatus,
  SEVERITY_OPTIONS,
  SHIFT_OPTIONS,
  byNewest,
  deriveAlertKpis,
  derivePriorityCards,
  matchAlert,
  tableValue,
  uniqueOptions,
  useAlerts,
  type AlertRecord,
  type AlertShift,
  type AlertTab,
} from '@/data/alerts';
import { CreateMaintenanceModal } from '../maintenance/CreateMaintenanceModal';
import { AlertAssignModal } from './AlertAssignModal';
import { AlertBulkCloseModal } from './AlertBulkCloseModal';
import { AlertDetailDrawer } from './AlertDetailDrawer';
import { ALERT_HOLD_LABEL, FOLLOW_UP_DUE_LABEL, followUpDue, followUpLabel } from '@/features/alerts/update';

const getAlertId = (a: AlertRecord) => a.id;
const sortNewest = (a: AlertRecord, b: AlertRecord) => byNewest(a, b);

const PAGE_SIZE = 5;

const readingTone: Record<Severity, string> = {
  critical: 'text-danger-text',
  high: 'text-warning',
  medium: 'text-fg',
  low: 'text-fg',
};

const dayLabel = (d: number) => (d === 0 ? 'Hôm nay' : d === 1 ? 'Hôm qua' : `${d} ngày trước`);

/** Xuất CSV các cảnh báo đang lọc (UTF-8 BOM để Excel đọc đúng tiếng Việt). */
function exportCsv(rows: readonly AlertRecord[]) {
  const head = ['Ngày', 'Thời gian', 'Mức độ', 'Mã CB', 'Nội dung', 'Thiết bị', 'Khu vực', 'Giá trị/Ngưỡng', 'Trạng thái', 'Người xử lý'];
  const sev = Object.fromEntries(SEVERITY_OPTIONS.map((o) => [o.value, o.label]));
  const st = { unacknowledged: 'Chưa xác nhận', 'in-progress': 'Đang xử lý', resolved: 'Đã xử lý (chờ đóng)', done: 'Hoàn thành' };
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map((a) =>
    [dayLabel(a.daysAgo), a.time, sev[a.severity], a.code, a.message, a.device, a.area, tableValue(a), st[a.status], a.assignee ?? '']
      .map(esc)
      .join(','),
  );
  const blob = new Blob(['﻿' + [head.map(esc).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  // Ngày theo giờ nhà máy (toISOString là UTC → lệch ngày từ 0h đến 7h sáng).
  link.download = `canh-bao-${plantDayKey(new Date())}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Trung tâm cảnh báo (Figma 70:2809) – AppLayout full-width. */
export default function AlertsPage() {
  const { status, data, error, refetch, acknowledge, closeMany, assign, assignOne, resolve, toggleGuide, addNote, noteMaintenance, update, close, monitor, requestSupport } = useAlerts();
  const maintenance = useMaintenance();
  const { user } = useAuth();
  const actor = user?.name || 'Admin';
  const now = useNow(60_000);
  // Ẩn thao tác theo vai trò (UX) – backend kiểm tra lại quyền khi có API.
  const canAck = useCan('alert:acknowledge');
  const canCreateMaintenance = useCan('maintenance:write');
  const [notice, setNotice] = useState('');
  const all = useMemo(() => data ?? [], [data]);

  const table = useTableFilters({
    rows: all,
    getId: getAlertId,
    params: ALERT_PARAMS,
    match: matchAlert,
    sort: sortNewest,
    pageSize: PAGE_SIZE,
    tabKey: 'tab',
    openKey: 'alert',
  });
  const { values: filters, setValues: setFilters, selected, setSelected, openId, setOpenId } = table;
  const rows = table.filtered;
  const tabCounts = table.tabCounts;

  const kpis = useMemo(() => deriveAlertKpis(all, filters.range), [all, filters.range]);
  const priority = useMemo(() => derivePriorityCards(all), [all]);
  const openAlert = openId ? all.find((a) => a.id === openId) ?? null : null;

  // Thông báo kết quả thao tác tự ẩn sau 4 giây.
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const hasFilters = table.isFiltered(['range']);

  const selectedRecords = all.filter((a) => selected.includes(a.id));
  const unackSelected = selectedRecords.filter((a) => a.status === 'unacknowledged').length;
  // Đóng hàng loạt: chỉ dòng Đã xử lý đủ 3 điều kiện hệ thống (đọc live cho các dòng Đã xử lý đang chọn).
  const resolvedSelected = selectedRecords.filter((a) => a.status === 'resolved');
  const closeConds = useCloseConditions(resolvedSelected, all);
  const closePlan = planBulkClose(all, selected, (a) => closeConds[a.id] ?? [], actor);
  const [bulkCloseOpen, setBulkCloseOpen] = useState(false);

  // Hàng loạt dùng CHUNG quy tắc với drawer (features/alerts/workflow + assign): xác nhận chỉ dòng Chưa xác nhận; phân công
  // qua modal "Phân công xử lý cảnh báo" (không tự xác nhận, bỏ qua dòng Hoàn thành / đã đúng người, dòng của người khác =
  // đổi người với một lý do chung); đóng chỉ dòng Đã xử lý đủ 3 điều kiện hệ thống + một ghi chú kết luận chung (bỏ qua dòng
  // Nghiêm trọng nếu người đóng là người xử lý). Không còn thao tác hàng loạt nhảy thẳng sang Hoàn thành.
  const runAck = async () => {
    const r = await acknowledge([...selected], actor);
    setNotice(bulkMessage('Đã xác nhận', r.done, r.skipped));
    setSelected([]);
  };
  const assignableSelected = selectedRecords.filter((a) => a.status !== 'done').length;
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);

  // ---- Modal "Tạo yêu cầu bảo trì" mở TRÊN drawer (drawer vẫn mở); đóng → focus về nút đã mở.
  const [createFor, setCreateFor] = useState<{ alert: AlertRecord; title?: string } | null>(null);
  const maintRecords = maintenance.data;
  const linkedOf = (id: string) => (maintRecords ? linkedMaintenance(id, maintRecords) : undefined);
  const openLinked = openAlert ? linkedOf(openAlert.id) : undefined;
  const devices = useMemo(() => setDeviceDirectory(maintRecords ?? [], all), [maintRecords, all]);

  const tabs: TabItem[] = [
    { id: 'all', label: 'Tất cả', count: tabCounts.all },
    { id: 'unacknowledged', label: 'Chưa xác nhận', count: tabCounts.unacknowledged, countTone: 'danger' },
    { id: 'in-progress', label: 'Đang xử lý', count: tabCounts['in-progress'], countTone: 'info' },
    // Ngoài Figma (28/10/2026): cảnh báo Đã xử lý chờ xác nhận đóng – docs/figma-diffs.md.
    { id: 'resolved', label: 'Chờ đóng', count: tabCounts.resolved },
    { id: 'done', label: 'Đã hoàn thành', count: tabCounts.done },
  ];

  const filterDefs: FilterDef[] = [
    { id: 'severity', label: 'Mức độ', options: SEVERITY_OPTIONS },
    { id: 'area', label: 'Khu vực', allLabel: 'Tất cả khu vực', options: uniqueOptions(all.map((a) => a.area)) },
    { id: 'device', label: 'Thiết bị', options: uniqueOptions(all.map((a) => a.device)) },
    { id: 'shift', label: 'Thời gian', options: SHIFT_OPTIONS },
  ];

  const columns: DataTableColumn<AlertRecord>[] = [
    { id: 'time', header: 'Thời gian', width: 81, cell: (a) => (a.daysAgo === 0 ? a.time : <span title={dayLabel(a.daysAgo)}>{a.time}<span className="block text-2xs text-fg-muted/65">{dayLabel(a.daysAgo)}</span></span>) },
    { id: 'severity', header: 'Mức độ', width: 110, cell: (a) => <Badge variant="severity" value={a.severity} /> },
    { id: 'code', header: 'Mã CB', width: 90 },
    { id: 'message', header: 'Nội dung', align: 'start', width: 260, className: 'max-w-[260px] truncate text-fg', cell: (a) => <span title={a.message}>{a.message}</span> },
    { id: 'device', header: 'Thiết bị', width: 72, className: 'text-info' },
    { id: 'area', header: 'Khu vực', width: 100 },
    { id: 'reading', header: 'Giá trị/Ngưỡng', width: 116, cell: (a) => <span className={readingTone[a.severity]}>{tableValue(a)}</span> },
    {
      id: 'status',
      header: 'Trạng thái',
      width: 120,
      // Cờ Tạm dừng / Cần hỗ trợ + "Đang theo dõi đến HH:MM, mục tiêu …" + chip "Đến giờ kiểm tra lại" (docs/guide/alerts.md (4o), (4p)).
      cell: (a) => {
        const follow = followUpLabel(a, now);
        return (
          <span className="flex flex-col items-start gap-1">
            <Badge variant="status" value={alertBadgeStatus(a.status)} />
            {a.status === 'in-progress' && a.hold && (
              <Badge variant="tag" tone="warning">
                {ALERT_HOLD_LABEL[a.hold.kind]}
              </Badge>
            )}
            {follow && <span className="text-xs text-info">{follow}</span>}
            {followUpDue(a, now) && (
              <Badge variant="tag" tone="warning">
                {FOLLOW_UP_DUE_LABEL}
              </Badge>
            )}
          </span>
        );
      },
    },
    { id: 'assignee', header: 'Người xử lý', width: 110, className: 'text-fg opacity-75', cell: (a) => a.assignee ?? '–' },
  ];

  const header = (
    <PageHeader
      breadcrumb={[{ label: 'Cảnh báo', to: '/alerts' }, { label: 'Trung tâm cảnh báo' }]}
      title="Trung tâm cảnh báo"
      description="Theo dõi, xác nhận và xử lý cảnh báo trên toàn hệ thống LPG"
      actions={
        <>
          <DateRangeSelect value={filters.range} options={RANGE_OPTIONS} onChange={(range) => setFilters({ range })} />
          <ExportButton onClick={() => exportCsv(rows)} />
          <RefreshButton accent onClick={refetch} />
          <LiveDataButton />
        </>
      }
    />
  );

  if (status === 'error') {
    return (
      <Page pageHeader={header}>
        <Card title="Không tải được danh sách cảnh báo" headerVariant="plain" tone="danger">
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
        <Placeholder label="Đang tải…" height={135} />
        <Placeholder label="Đang tải…" height={92} />
        <Placeholder label="Đang tải…" height={528} />
      </Page>
    );
  }

  return (
    <Page pageHeader={header}>
      {/* 1. Cảnh báo ưu tiên – 70:2901 */}
      <section aria-labelledby="priority-heading" className="flex flex-col gap-3">
        <h2
          id="priority-heading"
          className="flex items-center gap-2 text-xl font-semibold uppercase leading-6 tracking-label text-fg-secondary"
        >
          <Icon name="dangerLg" box={24} />
          Cảnh báo ưu tiên
        </h2>
        {priority.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {priority.map((c) => (
              <AlertCard key={c.id} {...c} onClick={setOpenId} />
            ))}
          </div>
        ) : (
          <p className="text-base text-fg-muted/70">Không còn cảnh báo ưu tiên cần xử lý.</p>
        )}
      </section>

      {/* 2. KPI – 70:2957 (5 cột gap 12) */}
      <section aria-label="Thống kê cảnh báo" className="grid grid-cols-2 gap-3 lg:grid-cols-3 wide:grid-cols-5">
        {kpis.map((k) => (
          <KpiFromData key={k.id} data={k} />
        ))}
      </section>

      {/* 3. Bảng – 70:3005 */}
      <Card padding="none" radius="lg">
        <Tabs
          label="Lọc theo trạng thái"
          items={tabs}
          value={filters.tab}
          onChange={(tab) => setFilters({ tab: tab as AlertTab })}
          panelId="alerts-table"
        />
        <FilterBar
          search={filters.q}
          onSearchChange={(q) => setFilters({ q })}
          filters={filterDefs}
          values={{ severity: filters.severity, area: filters.area, device: filters.device, shift: filters.shift }}
          onValuesChange={(v) =>
            setFilters({
              severity: (v.severity as Severity | null) ?? null,
              area: v.area ?? null,
              device: v.device ?? null,
              shift: (v.shift as AlertShift | null) ?? null,
            })
          }
          advancedLabel="Xoá bộ lọc"
          advancedActive={hasFilters}
          onAdvancedFilter={() => table.reset(['range'])}
        />

        {canAck && selected.length > 0 && (
          <div
            role="toolbar"
            aria-label="Thao tác hàng loạt"
            className="flex flex-wrap items-center gap-3 border-b border-info/20 bg-info/10 px-4 py-2.5"
          >
            <span className="text-base font-semibold text-info">Đã chọn {selected.length} cảnh báo</span>
            <Button variant="primary" disabled={unackSelected === 0} onClick={() => void runAck()}>
              Xác nhận{unackSelected > 0 ? ` (${unackSelected})` : ''}
            </Button>
            <Button disabled={assignableSelected === 0} onClick={() => setBulkAssignOpen(true)}>
              Phân công…{assignableSelected > 0 ? ` (${assignableSelected})` : ''}
            </Button>
            <Button disabled={closePlan.eligible.length === 0} onClick={() => setBulkCloseOpen(true)}>
              Đóng cảnh báo{closePlan.eligible.length > 0 ? ` (${closePlan.eligible.length})` : ''}
            </Button>
            <Button variant="link" size="md" onClick={() => setSelected([])} className="ml-auto">
              Bỏ chọn
            </Button>
          </div>
        )}
        <p role="status" className={notice ? 'px-4 pt-2 text-sm text-success' : 'sr-only'}>
          {notice}
        </p>

        <div id="alerts-table">
          <DataTable
            label="Danh sách cảnh báo"
            // Khung hẹp hơn → cuộn ngang trong khung; cột "Xem" cố định mép phải.
            minWidth={1180}
            stickyActions
            columns={columns}
            rows={table.pageRows}
            getRowId={(a) => a.id}
            selectable={canAck}
            selectedIds={selected}
            onSelectionChange={setSelected}
            rowActions={(a) => <TableActionButton label={`Xem chi tiết ${a.code}`} onClick={() => setOpenId(a.id)} />}
            emptyState="Không có cảnh báo phù hợp với bộ lọc."
            pagination={{
              page: table.page,
              pageSize: PAGE_SIZE,
              total: rows.length,
              onPageChange: table.setPage,
              summary: (f, t, n) => `Hiển thị ${f}-${t} của ${n} cảnh báo`,
            }}
          />
        </div>
      </Card>

      <AlertDetailDrawer
        alert={openAlert}
        onClose={() => setOpenId(null)}
        now={now}
        allAlerts={all}
        maintenance={openLinked ? { id: openLinked.id, code: openLinked.code } : null}
        canAct={canAck}
        canCreateMaintenance={canCreateMaintenance}
        onAcknowledge={(id) => {
          void acknowledge([id], actor);
          announce('Đã xác nhận cảnh báo – chuyển sang Đang xử lý.');
        }}
        onAssign={(id, form) => assignOne(id, form, actor)}
        onResolve={(id, note) => resolve(id, note, actor)}
        onToggleGuide={(id, step) => void toggleGuide(id, step, actor)}
        onAddNote={(id, text) => void addNote(id, text, actor)}
        onCreateMaintenance={(alert, opts) => setCreateFor({ alert, title: opts?.title })}
        onUpdate={(id, input, check) => update(id, input, check, actor)}
        onCloseAlert={(id, input, conditions) => close(id, input, conditions, followUpConfig(all.find((x) => x.id === id) ?? {}), actor)}
        onMonitor={(id, input) => monitor(id, input, followUpConfig(all.find((x) => x.id === id) ?? {}), actor)}
        actor={actor}
        onRequestSupport={(id, input) => void requestSupport(id, input, actor)}
      />

      {createFor && (
        <CreateMaintenanceModal
          open
          onClose={() => setCreateFor(null)}
          devices={devices}
          defaultDevice={createFor.alert.device}
          alert={createFor.alert}
          defaultTitle={createFor.title}
          onDraftSaved={() => {
            setCreateFor(null);
            announce('Đã lưu nháp yêu cầu bảo trì.');
          }}
          onSubmit={async (input) => {
            const source = createFor.alert;
            try {
              const rec = await maintenance.create({ ...input, createdBy: actor });
              await noteMaintenance(source.id, rec.code, actor);
              announce(`Đã tạo yêu cầu ${rec.code} từ ${source.code}.`);
            } catch (e) {
              if (!(e instanceof DuplicateFromAlertError)) throw e;
              announce(e.message);
            }
            setCreateFor(null);
          }}
        />
      )}

      {bulkAssignOpen && (
        <AlertAssignModal
          alerts={selectedRecords}
          allAlerts={all}
          onClose={() => setBulkAssignOpen(false)}
          onConfirm={async (form) => {
            const r = await assign(selected, form, actor);
            setBulkAssignOpen(false);
            setSelected([]);
            setNotice(`${r.message} – người phụ trách: ${form.assignee}.`);
          }}
        />
      )}

      {bulkCloseOpen && (
        <AlertBulkCloseModal
          eligible={closePlan.eligible.length}
          skippedText={closePlan.skipped.length ? bulkCloseMessage(closePlan.eligible.length, closePlan.skipped).split(' · ')[1]! : null}
          onClose={() => setBulkCloseOpen(false)}
          onConfirm={async (note) => {
            const r = await closeMany(selected, note, closeConds, followUpConfig, actor);
            setBulkCloseOpen(false);
            setSelected([]);
            setNotice(r.message);
          }}
        />
      )}
    </Page>
  );
}
