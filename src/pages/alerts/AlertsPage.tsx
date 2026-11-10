import { useMemo, useState } from 'react';
import { Card, DataTable, FilterBar, PageHeader, TableActionButton, Tabs, type Severity } from '@/components';
import { useAuth, useCan } from '@/app/auth';
import { DateRangeSelect, ExportButton, LiveDataButton, RefreshButton } from '@/app/HeaderActions';
import { KpiFromData } from '@/app/kpi';
import { Page } from '@/app/Page';
import { PageError, Placeholder } from '@/app/Placeholder';
import { useTableFilters } from '@/app/useTableFilters';
import { runAction } from '@/lib/actionError';
import { announce } from '@/lib/announce';
import { cn } from '@/lib/cn';
import { useNow } from '@/lib/useNow';
import { useTimedNotice } from '@/lib/useTimedNotice';
import { bulkMessage, linkedMaintenance } from '@/features/alerts/workflow';
import { bulkCloseMessage, planBulkClose } from '@/features/alerts/close';
import { followUpConfig, useCloseConditions } from '@/data/alertDetail';
import { DuplicateFromAlertError, deriveDeviceDirectory, useMaintenance } from '@/data/maintenance';
import {
  ALERT_PARAMS,
  RANGE_OPTIONS,
  byNewest,
  deriveAlertKpis,
  derivePriorityCards,
  matchAlert,
  useAlerts,
  type AlertRecord,
  type AlertShift,
  type AlertTab,
} from '@/data/alerts';
import { CreateMaintenanceModal } from '../shared/maintenance/CreateMaintenanceModal';
import { AlertAssignModal } from './AlertAssignModal';
import { AlertBulkCloseModal } from './AlertBulkCloseModal';
import { AlertDetailDrawer } from './AlertDetailDrawer';
import { alertColumns, alertFilterDefs, alertTabs } from './list/alertTable';
import { BulkActionsBar, PriorityAlerts } from './list/AlertsSections';
import { exportAlertsCsv } from './list/exportAlertsCsv';

const getAlertId = (a: AlertRecord) => a.id;
const sortNewest = (a: AlertRecord, b: AlertRecord) => byNewest(a, b);

const PAGE_SIZE = 5;

/** Trung tâm cảnh báo (Figma 70:2809) – AppLayout full-width. */
export default function AlertsPage() {
  const alerts = useAlerts();
  const { status, data, error, refetch } = alerts;
  const maintenance = useMaintenance();
  const { user } = useAuth();
  const actor = user?.name || 'Admin';
  const now = useNow(60_000);
  // Ẩn thao tác theo vai trò (UX) – backend kiểm tra lại quyền khi có API.
  const canAck = useCan('alert:acknowledge');
  const canCreateMaintenance = useCan('maintenance:write');
  // Thông báo kết quả thao tác hàng loạt (lỗi → chữ đỏ), tự ẩn sau 4 giây.
  const { notice, show: setNotice, fail: failNotice } = useTimedNotice();
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

  const kpis = useMemo(() => deriveAlertKpis(all, filters.range), [all, filters.range]);
  const priority = useMemo(() => derivePriorityCards(all), [all]);
  const openAlert = openId ? (all.find((a) => a.id === openId) ?? null) : null;

  // Hàng loạt dùng CHUNG quy tắc với drawer (features/alerts/workflow + assign): xác nhận chỉ dòng Chưa xác nhận; phân công
  // qua modal (không tự xác nhận, bỏ qua dòng Hoàn thành / đã đúng người, dòng của người khác = đổi người với một lý do
  // chung); đóng chỉ dòng Đã xử lý đủ 3 điều kiện hệ thống + một ghi chú kết luận chung (bỏ qua dòng Nghiêm trọng nếu
  // người đóng là người xử lý).
  const selectedRecords = all.filter((a) => selected.includes(a.id));
  const closeConds = useCloseConditions(
    selectedRecords.filter((a) => a.status === 'resolved'),
    all,
  );
  const closePlan = planBulkClose(all, selected, (a) => closeConds[a.id] ?? [], actor);
  const [bulkCloseOpen, setBulkCloseOpen] = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const runAck = () =>
    runAction(async () => {
      const r = await alerts.acknowledge([...selected], actor);
      setNotice(bulkMessage('Đã xác nhận', r.done, r.skipped));
      setSelected([]);
    }, failNotice);

  // Modal "Tạo yêu cầu bảo trì" mở TRÊN drawer (drawer vẫn mở); đóng → focus về nút đã mở.
  const [createFor, setCreateFor] = useState<{ alert: AlertRecord; title?: string } | null>(null);
  const maintRecords = maintenance.data;
  const openLinked = openAlert && maintRecords ? linkedMaintenance(openAlert.id, maintRecords) : undefined;
  const devices = useMemo(() => deriveDeviceDirectory(maintRecords ?? [], all), [maintRecords, all]);
  const followOf = (id: string) => followUpConfig(all.find((x) => x.id === id) ?? {});

  const header = (
    <PageHeader
      breadcrumb={[{ label: 'Cảnh báo', to: '/alerts' }, { label: 'Trung tâm cảnh báo' }]}
      title="Trung tâm cảnh báo"
      description="Theo dõi, xác nhận và xử lý cảnh báo trên toàn hệ thống LPG"
      actions={
        <>
          <DateRangeSelect value={filters.range} options={RANGE_OPTIONS} onChange={(range) => setFilters({ range })} />
          <ExportButton onClick={() => exportAlertsCsv(rows)} />
          <RefreshButton accent onClick={refetch} />
          <LiveDataButton />
        </>
      }
    />
  );

  if (status === 'error') {
    return (
      <Page pageHeader={header}>
        <PageError title="Không tải được danh sách cảnh báo" error={error} onRetry={refetch} />
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
      <PriorityAlerts cards={priority} onOpen={setOpenId} />

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
          items={alertTabs(table.tabCounts)}
          value={filters.tab}
          onChange={(tab) => setFilters({ tab: tab as AlertTab })}
          panelId="alerts-table"
        />
        <FilterBar
          search={filters.q}
          onSearchChange={(q) => setFilters({ q })}
          filters={alertFilterDefs(all)}
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
          advancedActive={table.isFiltered(['range'])}
          onAdvancedFilter={() => table.reset(['range'])}
        />

        {canAck && selected.length > 0 && (
          <BulkActionsBar
            selected={selected.length}
            acknowledgeable={selectedRecords.filter((a) => a.status === 'unacknowledged').length}
            assignable={selectedRecords.filter((a) => a.status !== 'done').length}
            closable={closePlan.eligible.length}
            onAcknowledge={() => void runAck()}
            onAssign={() => setBulkAssignOpen(true)}
            onClose={() => setBulkCloseOpen(true)}
            onClear={() => setSelected([])}
          />
        )}
        <p role="status" className={notice.text ? cn('px-4 pt-2 text-sm', notice.error ? 'text-danger-text' : 'text-success') : 'sr-only'}>
          {notice.text}
        </p>

        <div id="alerts-table">
          <DataTable
            label="Danh sách cảnh báo"
            // Khung hẹp hơn → cuộn ngang trong khung; cột "Xem" cố định mép phải.
            minWidth={1180}
            stickyActions
            columns={alertColumns(now)}
            rows={table.pageRows}
            getRowId={getAlertId}
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
        onAcknowledge={async (id) => {
          await alerts.acknowledge([id], actor);
          announce('Đã xác nhận cảnh báo – chuyển sang Đang xử lý.');
        }}
        onAssign={(id, form) => alerts.assignOne(id, form, actor)}
        onResolve={(id, note) => alerts.resolve(id, note, actor)}
        onToggleGuide={(id, step) => alerts.toggleGuide(id, step, actor)}
        onAddNote={(id, text) => alerts.addNote(id, text, actor)}
        onCreateMaintenance={(alert, opts) => setCreateFor({ alert, title: opts?.title })}
        onUpdate={(id, input, check) => alerts.update(id, input, check, actor)}
        onCloseAlert={(id, input, conditions) => alerts.close(id, input, conditions, followOf(id), actor)}
        onMonitor={(id, input) => alerts.monitor(id, input, followOf(id), actor)}
        actor={actor}
        onRequestSupport={(id, input) => alerts.requestSupport(id, input, actor)}
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
              await alerts.noteMaintenance(source.id, rec.code, actor);
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
            const r = await alerts.assign(selected, form, actor);
            setBulkAssignOpen(false);
            setSelected([]);
            setNotice(`${r.message} – người phụ trách: ${form.assignee}.`);
          }}
        />
      )}

      {bulkCloseOpen && (
        <AlertBulkCloseModal
          eligible={closePlan.eligible.length}
          skippedText={closePlan.skipped.length ? (bulkCloseMessage(closePlan.eligible.length, closePlan.skipped).split(' · ')[1] ?? null) : null}
          onClose={() => setBulkCloseOpen(false)}
          onConfirm={async (note) => {
            const r = await alerts.closeMany(selected, note, closeConds, followUpConfig, actor);
            setBulkCloseOpen(false);
            setSelected([]);
            setNotice(r.message);
          }}
        />
      )}
    </Page>
  );
}
