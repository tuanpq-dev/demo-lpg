import { useMemo } from 'react';
import { Card, DataTable, FilterBar, PageHeader, TableActionButton, Tabs, type Severity } from '@/components';
import { useAuth, useCan } from '@/app/auth';
import { DateRangeSelect, ExportButton, LiveDataButton, RefreshButton } from '@/app/HeaderActions';
import { KpiFromData } from '@/app/kpi';
import { Page } from '@/app/Page';
import { pageFallback } from '@/app/Placeholder';
import { useFilterParams } from '@/app/useTableFilters';
import { useRecordSelection } from '@/app/useRecordSelection';
import { fetchAlertList, useAlertPage, useAlertSummary, type AlertListQuery } from '@/data/alertApi';
import { ALERT_PARAMS, RANGE_OPTIONS, alertKpis, priorityCard, type AlertRecord, type AlertShift, type AlertTab } from '@/data/alerts';
import { runAction } from '@/lib/actionError';
import { cn } from '@/lib/cn';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useNow } from '@/hooks/useNow';
import { combineQueries } from '@/lib/queryState';
import { AlertDrawerHost, usePreloadAlertOverlays } from './AlertDrawerHost';
import { AlertBulkActions } from './list/AlertBulkActions';
import { alertColumns, alertFilterDefs, alertTabs } from './list/alertTable';
import { PriorityAlerts } from './list/AlertsSections';

const getAlertId = (a: AlertRecord) => a.id;
const NO_ROWS: AlertRecord[] = [];

const PAGE_SIZE = 5;
/** Ô tìm kiếm: chỉ gửi truy vấn khi ngừng gõ (URL vẫn cập nhật ngay). */
const SEARCH_DEBOUNCE_MS = 300;

/** Giá trị FilterBar → tham số lọc của bảng (rỗng = bỏ lọc). */
const alertFilterValues = (v: Record<string, string | null | undefined>) => ({
  severity: (v.severity as Severity | null) ?? null,
  area: v.area ?? null,
  device: v.device ?? null,
  shift: (v.shift as AlertShift | null) ?? null,
});

/** Xuất CSV MỌI cảnh báo khớp bộ lọc (không chỉ trang đang xem). TODO(backend): GET /alerts/export?… trả CSV. */
const exportMatching = (query: AlertListQuery, total: number) =>
  runAction(async () => {
    const [{ exportAlertsCsv }, all] = await Promise.all([
      import('./list/exportAlertsCsv'),
      fetchAlertList({ ...query, page: 1, pageSize: Math.max(1, total) }),
    ]);
    exportAlertsCsv(all.rows);
  });

/**
 * Trung tâm cảnh báo (Figma 70:2809) – AppLayout full-width. Phân trang / lọc / đếm ở MÁY CHỦ (`data/alertApi.ts`): trang
 * chỉ giữ một trang dòng + số đếm, đổi bộ lọc / trang giữ dữ liệu cũ (mờ) tới khi kết quả mới về.
 */
export default function AlertsPage() {
  const { user } = useAuth();
  const actor = user?.name || 'Admin';
  const now = useNow(60_000);
  // Ẩn thao tác theo vai trò (UX) – backend kiểm tra lại quyền khi có API.
  const canAck = useCan('alert:acknowledge');
  const canCreateMaintenance = useCan('maintenance:write');

  const params = useFilterParams(ALERT_PARAMS, 'alert');
  const { values: filters, setValues: setFilters, openId, setOpenId } = params;
  const q = useDebouncedValue(filters.q, SEARCH_DEBOUNCE_MS);
  const query: AlertListQuery = { ...filters, q, page: params.page, pageSize: PAGE_SIZE };
  const list = useAlertPage(query);
  const summary = useAlertSummary(filters.range);
  const state = combineQueries(list, summary);
  usePreloadAlertOverlays(state.status === 'success');

  const result = list.data;
  const rows = result?.rows ?? NO_ROWS;
  // Đổi bộ lọc (không tính trang) → bỏ chọn.
  const { page: _page, ...filterKey } = query;
  const selection = useRecordSelection(rows, getAlertId, JSON.stringify(filterKey));
  const kpis = useMemo(() => (summary.data ? alertKpis(summary.data.counts, filters.range) : []), [summary.data, filters.range]);
  const priority = useMemo(() => summary.data?.priority.map(priorityCard) ?? [], [summary.data]);

  const header = (
    <PageHeader
      breadcrumb={[{ label: 'Cảnh báo', to: '/alerts' }, { label: 'Trung tâm cảnh báo' }]}
      title="Trung tâm cảnh báo"
      description="Theo dõi, xác nhận và xử lý cảnh báo trên toàn hệ thống LPG"
      actions={
        <>
          <DateRangeSelect value={filters.range} options={RANGE_OPTIONS} onChange={(range) => setFilters({ range })} />
          <ExportButton onClick={() => void exportMatching(query, result?.total ?? 0)} />
          <RefreshButton accent onClick={state.refetch} />
          <LiveDataButton />
        </>
      }
    />
  );

  if (state.status !== 'success' || !result)
    return pageFallback(
      { status: state.status === 'error' ? 'error' : 'loading', error: state.error, refetch: state.refetch },
      { header, errorTitle: 'Không tải được danh sách cảnh báo', skeleton: [135, 92, 528] },
    );

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
          items={alertTabs(result.tabCounts)}
          value={filters.tab}
          onChange={(tab) => setFilters({ tab: tab as AlertTab })}
          panelId="alerts-table"
        />
        <FilterBar
          search={filters.q}
          onSearchChange={(value) => setFilters({ q: value })}
          filters={alertFilterDefs(result.facets)}
          values={{ severity: filters.severity, area: filters.area, device: filters.device, shift: filters.shift }}
          onValuesChange={(v) => setFilters(alertFilterValues(v))}
          advancedLabel="Xoá bộ lọc"
          advancedActive={params.isFiltered(['range'])}
          onAdvancedFilter={() => params.reset(['range'])}
        />

        <AlertBulkActions records={selection.records} onClear={selection.clear} actor={actor} canAct={canAck} />

        {/* Đang tải trang / bộ lọc mới: giữ kết quả cũ, làm mờ (aria-busy) tới khi có kết quả. */}
        <div id="alerts-table" aria-busy={list.pending} className={cn('transition-opacity', list.pending && 'opacity-60')}>
          <DataTable
            label="Danh sách cảnh báo"
            // Khung hẹp hơn → cuộn ngang trong khung; cột "Xem" cố định mép phải.
            minWidth={1180}
            stickyActions
            columns={alertColumns(now)}
            rows={rows}
            getRowId={getAlertId}
            selectable={canAck}
            selectedIds={selection.selected}
            onSelectionChange={selection.setSelected}
            rowActions={(a) => <TableActionButton label={`Xem chi tiết ${a.code}`} onClick={() => setOpenId(a.id)} />}
            emptyState="Không có cảnh báo phù hợp với bộ lọc."
            pagination={{
              page: result.page,
              pageSize: PAGE_SIZE,
              total: result.total,
              onPageChange: params.setPage,
              summary: (f, t, n) => `Hiển thị ${f}-${t} của ${n} cảnh báo`,
            }}
          />
        </div>
      </Card>

      <AlertDrawerHost
        openId={openId}
        onClose={() => setOpenId(null)}
        now={now}
        actor={actor}
        canAct={canAck}
        canCreateMaintenance={canCreateMaintenance}
      />
    </Page>
  );
}
