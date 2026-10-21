import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCard,
  AlertDetailDrawer,
  Badge,
  Button,
  Card,
  DataTable,
  FilterBar,
  Icon,
  PageHeader,
  Select,
  TableActionButton,
  Tabs,
  type AlertDetailData,
  type DataTableColumn,
  type FilterDef,
  type Severity,
  type TabItem,
} from '@/components';
import { DateRangeSelect, ExportButton, LiveDataButton, RefreshButton } from '@/app/HeaderActions';
import { KpiFromData } from '@/app/kpi';
import { Page } from '@/app/Page';
import { Placeholder } from '@/app/Placeholder';
import { useTableFilters } from '@/app/useTableFilters';
import { plantDayKey } from '@/lib/plantTime';
import {
  ALERT_ASSIGNEES,
  ALERT_PARAMS,
  RANGE_OPTIONS,
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

const getAlertId = (a: AlertRecord) => a.id;
const sortNewest = (a: AlertRecord, b: AlertRecord) => byNewest(a, b);

const PAGE_SIZE = 5;

const readingTone: Record<Severity, string> = {
  critical: 'text-danger',
  high: 'text-warning',
  medium: 'text-fg',
  low: 'text-fg',
};

const dayLabel = (d: number) => (d === 0 ? 'Hôm nay' : d === 1 ? 'Hôm qua' : `${d} ngày trước`);

function toDetail(a: AlertRecord): AlertDetailData {
  return {
    id: a.id,
    code: a.code,
    severity: a.severity,
    status: a.status,
    message: a.message,
    device: a.device,
    area: a.area,
    time: `${dayLabel(a.daysAgo)}, ${a.time}`,
    reading: tableValue(a),
    assignee: a.assignee,
  };
}

/** Xuất CSV các cảnh báo đang lọc (UTF-8 BOM để Excel đọc đúng tiếng Việt). */
function exportCsv(rows: readonly AlertRecord[]) {
  const head = ['Ngày', 'Thời gian', 'Mức độ', 'Mã CB', 'Nội dung', 'Thiết bị', 'Khu vực', 'Giá trị/Ngưỡng', 'Trạng thái', 'Người xử lý'];
  const sev = Object.fromEntries(SEVERITY_OPTIONS.map((o) => [o.value, o.label]));
  const st = { unacknowledged: 'Chưa xác nhận', 'in-progress': 'Đang xử lý', done: 'Đã hoàn thành' };
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
  const { status, data, error, refetch, acknowledge, complete, assign } = useAlerts();
  const navigate = useNavigate();
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

  const runBulk = async (kind: 'ack' | 'assign', assignee?: string) => {
    const ids = [...selected];
    if (kind === 'ack') {
      await acknowledge(ids);
      setNotice(`Đã xác nhận ${unackSelected} cảnh báo.`);
    } else if (assignee) {
      await assign(ids, assignee);
      setNotice(`Đã phân công ${ids.length} cảnh báo cho ${assignee}.`);
    }
    setSelected([]);
  };

  const tabs: TabItem[] = [
    { id: 'all', label: 'Tất cả', count: tabCounts.all },
    { id: 'unacknowledged', label: 'Chưa xác nhận', count: tabCounts.unacknowledged, countTone: 'danger' },
    { id: 'in-progress', label: 'Đang xử lý', count: tabCounts['in-progress'], countTone: 'info' },
    { id: 'done', label: 'Đã hoàn thành', count: tabCounts.done },
  ];

  const filterDefs: FilterDef[] = [
    { id: 'severity', label: 'Mức độ', options: SEVERITY_OPTIONS },
    { id: 'area', label: 'Khu vực', allLabel: 'Tất cả khu vực', options: uniqueOptions(all.map((a) => a.area)) },
    { id: 'device', label: 'Thiết bị', options: uniqueOptions(all.map((a) => a.device)) },
    { id: 'shift', label: 'Thời gian', options: SHIFT_OPTIONS },
  ];

  const columns: DataTableColumn<AlertRecord>[] = [
    { id: 'time', header: 'Thời gian', width: 81, cell: (a) => (a.daysAgo === 0 ? a.time : <span title={dayLabel(a.daysAgo)}>{a.time}<span className="block text-2xs text-fg-muted/60">{dayLabel(a.daysAgo)}</span></span>) },
    { id: 'severity', header: 'Mức độ', width: 110, cell: (a) => <Badge variant="severity" value={a.severity} /> },
    { id: 'code', header: 'Mã CB', width: 90 },
    { id: 'message', header: 'Nội dung', align: 'start', width: 260, className: 'max-w-[260px] truncate text-fg', cell: (a) => <span title={a.message}>{a.message}</span> },
    { id: 'device', header: 'Thiết bị', width: 72, className: 'text-info' },
    { id: 'area', header: 'Khu vực', width: 100 },
    { id: 'reading', header: 'Giá trị/Ngưỡng', width: 116, cell: (a) => <span className={readingTone[a.severity]}>{tableValue(a)}</span> },
    { id: 'status', header: 'Trạng thái', width: 120, cell: (a) => <Badge variant="status" value={a.status} /> },
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
      <section aria-label="Thống kê cảnh báo" className="grid grid-cols-2 gap-3 md:grid-cols-5">
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

        {selected.length > 0 && (
          <div
            role="toolbar"
            aria-label="Thao tác hàng loạt"
            className="flex flex-wrap items-center gap-3 border-b border-info/20 bg-info/10 px-4 py-2.5"
          >
            <span className="text-base font-semibold text-info">Đã chọn {selected.length} cảnh báo</span>
            <Button variant="primary" disabled={unackSelected === 0} onClick={() => runBulk('ack')}>
              Xác nhận{unackSelected > 0 ? ` (${unackSelected})` : ''}
            </Button>
            <Select
              variant="button"
              label="Phân công"
              options={ALERT_ASSIGNEES.map((n) => ({ value: n, label: n }))}
              value={null}
              onChange={(name) => name && runBulk('assign', name)}
            />
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
            columns={columns}
            rows={table.pageRows}
            getRowId={(a) => a.id}
            selectable
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
        alert={openAlert ? toDetail(openAlert) : null}
        readingClassName={openAlert ? readingTone[openAlert.severity] : undefined}
        onClose={() => setOpenId(null)}
        onCreateMaintenance={(a) =>
          navigate(`/maintenance?create=1&device=${encodeURIComponent(a.device)}&from=${encodeURIComponent(a.id)}`)
        }
        onAcknowledge={(id) => {
          void acknowledge([id]);
          setNotice('Đã xác nhận cảnh báo.');
        }}
        onComplete={(id) => {
          void complete([id]);
          setNotice('Đã đánh dấu hoàn thành.');
        }}
      />
    </Page>
  );
}
