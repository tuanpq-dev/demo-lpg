import { useCallback, useId, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Badge,
  Card,
  DataTable,
  FilterBar,
  Icon,
  KpiCard,
  MoreVerticalIcon,
  PageHeader,
  StatusDot,
  type DataTableColumn,
  type DotStatus,
  type FilterDef,
  type WorkStatus,
} from '@/components';
import { DateRangeSelect, ExportButton, LiveDataButton, RefreshButton } from '@/app/HeaderActions';
import { Page } from '@/app/Page';
import { pageFallback } from '@/app/Placeholder';
import { useTableFilters } from '@/app/useTableFilters';
import { useOperationLogs } from '@/data/operationLogs';
import {
  LOG_CATEGORIES,
  LOG_CATEGORY_LABEL,
  LOG_LEVEL_LABEL,
  LOG_PARAMS,
  LOG_RANGE_OPTIONS,
  LOG_STATUS_LABEL,
  byNewestEvent,
  deriveLogKpis,
  distinctLogOptions,
  eventDaysAgo,
  logTimeText,
  logsToCsv,
  matchLogEvent,
  type LogLevel,
  type LogStatus,
  type OperationLogEvent,
} from '@/features/operations/logs';
import { announce } from '@/lib/announce';
import { plantDayKey } from '@/lib/plantTime';
import { useNow } from '@/hooks/useNow';
import { downloadCsv } from '@/lib/download';

const PAGE_SIZE = 10;
const getId = (e: OperationLogEvent) => e.id;

/** Mức → chấm + chữ cùng màu (Figma 64:977: Thông tin xanh · Trung vàng · Cao đỏ). */
const LEVEL_VIEW: Record<LogLevel, { dot: DotStatus; text: string }> = {
  info: { dot: 'success', text: 'text-success' },
  medium: { dot: 'warning', text: 'text-warning' },
  high: { dot: 'danger', text: 'text-danger-text' },
};

/** Trạng thái → kiểu pill có sẵn của Badge status (nhãn riêng của nhật ký). */
const STATUS_BADGE: Record<LogStatus, WorkStatus> = {
  open: 'unacknowledged',
  'in-progress': 'in-progress',
  monitoring: 'monitoring',
  done: 'done',
  recorded: 'done',
};

/** Link mở cảnh báo gốc trên Trung tâm cảnh báo (khoảng thời gian đủ rộng để thấy dòng đó). */
function alertHref(e: OperationLogEvent, now: Date) {
  const d = eventDaysAgo(e, now);
  const range = d === 0 ? '' : d <= 6 ? '&range=7d' : '&range=30d';
  return `/alerts?alert=${encodeURIComponent(e.alertId ?? '')}${range}`;
}

const MORE_PENDING = 'Chưa có thao tác khác cho sự kiện – chờ thiết kế.';

/** Cột bảng nhật ký – `now` cho giờ hiển thị (hôm nay / ngày khác) và link mở cảnh báo. */
function logColumns(now: Date): DataTableColumn<OperationLogEvent>[] {
  return [
    {
      id: 'time',
      header: 'Thời gian',
      align: 'start',
      width: 92,
      className: 'whitespace-nowrap tabular-nums text-fg-secondary',
      cell: (e) => {
        const t = logTimeText(e, now);
        return (
          <>
            {t.time}
            {t.day && <span className="block text-2xs text-fg-muted">{t.day}</span>}
          </>
        );
      },
    },
    {
      id: 'level',
      header: 'Mức độ',
      align: 'start',
      width: 112,
      cell: (e) => (
        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${LEVEL_VIEW[e.level].text}`}>
          <StatusDot status={LEVEL_VIEW[e.level].dot} />
          {LOG_LEVEL_LABEL[e.level]}
        </span>
      ),
    },
    {
      id: 'code',
      header: 'Mã SK',
      width: 104,
      className: 'whitespace-nowrap text-fg-secondary',
      cell: (e) =>
        e.alertId ? (
          // Link không chỉ dựa vào màu (cột cùng chữ nhạt): luôn gạch chân.
          <Link
            to={alertHref(e, now)}
            className="rounded-sm font-semibold text-info underline decoration-info/50 underline-offset-2 hover:decoration-info"
            aria-label={`${e.code} – mở cảnh báo`}
          >
            {e.code}
          </Link>
        ) : (
          e.code
        ),
    },
    {
      id: 'title',
      header: 'Sự kiện / Hành động',
      align: 'start',
      width: 300,
      className: 'max-w-[300px] truncate text-fg',
      cell: (e) => <span title={e.title}>{e.title}</span>,
    },
    { id: 'area', header: 'Khu vực', align: 'start', width: 138, className: 'whitespace-nowrap text-fg-secondary' },
    { id: 'device', header: 'Thiết bị', width: 92, className: 'whitespace-nowrap text-info' },
    {
      id: 'status',
      header: 'Trạng thái',
      width: 125,
      cell: (e) => (
        <Badge variant="status" value={STATUS_BADGE[e.status]}>
          {LOG_STATUS_LABEL[e.status]}
        </Badge>
      ),
    },
  ];
}

/**
 * Nhật ký vận hành (Figma bản sao A88YJ2BRhICDDdeu2rtRg1 node 64:418): header (khoảng thời gian · xuất CSV · làm mới · dữ liệu
 * trực tiếp) → 5 KPI → thanh lọc + bảng sự kiện. Cột phải "25%" của Figma chưa lấy được (hết lượt MCP) – docs/questions.md 13.
 */
export default function OperationLogsPage() {
  const now = useNow(60_000);
  const { status, data, error, refetch } = useOperationLogs(now);
  const all = useMemo(() => data ?? [], [data]);
  const match = useCallback((e: OperationLogEvent, v: Parameters<typeof matchLogEvent>[1]) => matchLogEvent(e, v, now), [now]);
  const table = useTableFilters({ rows: all, getId, params: LOG_PARAMS, match, sort: byNewestEvent, pageSize: PAGE_SIZE });
  const { values: f, setValues } = table;
  const kpis = useMemo(() => deriveLogKpis(all, f.range, now), [all, f.range, now]);
  const morePendingId = `${useId()}-more`;

  const exportCsv = () => {
    const rows = table.filtered;
    downloadCsv(logsToCsv(rows), `nhat-ky-van-hanh-${plantDayKey(now)}.csv`);
    announce(`Đã xuất ${rows.length} sự kiện ra tệp CSV.`);
  };

  const header = (
    <PageHeader
      breadcrumb={[{ label: 'Vận hành' }, { label: 'Nhật ký vận hành' }]}
      title="Nhật ký vận hành"
      actions={
        <>
          <DateRangeSelect value={f.range} options={LOG_RANGE_OPTIONS} onChange={(range) => setValues({ range })} />
          <ExportButton onClick={exportCsv} />
          <RefreshButton accent onClick={refetch} />
          <LiveDataButton />
        </>
      }
    />
  );

  if (status !== 'success')
    return pageFallback({ status, error, refetch }, { header, errorTitle: 'Không tải được nhật ký vận hành', skeleton: [92, 600] });

  const rangeLabel = LOG_RANGE_OPTIONS.find((o) => o.value === f.range)?.label.toLowerCase() ?? '';
  const filterDefs: FilterDef[] = [
    { id: 'area', label: 'Khu vực', allLabel: 'Tất cả khu vực', options: distinctLogOptions(all.map((e) => e.area)) },
    { id: 'category', label: 'Loại sự kiện', allLabel: 'Tất cả', options: LOG_CATEGORIES.map((c) => ({ value: c, label: LOG_CATEGORY_LABEL[c] })) },
  ];

  const columns = logColumns(now);

  const delta = kpis.delta;

  return (
    <Page pageHeader={header}>
      {/* KPI – Figma 64:875 (5 thẻ, gap 8) */}
      <section aria-label="Thống kê nhật ký vận hành" className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          variant="compact"
          label={f.range === 'today' ? 'Tổng sự kiện hôm nay' : `Tổng sự kiện ${rangeLabel}`}
          value={kpis.total}
          hint={delta !== null ? 'Số bên cạnh = chênh lệch so với hôm qua cùng giờ' : undefined}
          valueNote={delta !== null && delta !== 0 ? Math.abs(delta) : undefined}
          valueNoteTone="success"
          valueNoteIcon={
            delta !== null && delta !== 0 ? (
              <>
                <Icon name="logArrowUp" box={12} className={delta < 0 ? 'rotate-180' : undefined} />
                <span className="sr-only">{delta > 0 ? 'Tăng' : 'Giảm'}</span>
              </>
            ) : undefined
          }
        />
        <KpiCard variant="compact" label="Sự kiện vận hành" value={kpis.operation} tone="info" valueNote={`(${kpis.operationShare}%)`} />
        <KpiCard
          variant="compact"
          label="Cảnh báo phát sinh"
          icon={<Icon name="logAlert" box={14} />}
          iconPosition="start"
          toneLabel
          tone="danger"
          value={kpis.alerts}
          valueNote={`(${kpis.alertsOpen} chưa xử lý)`}
          valueNoteTone="danger"
        />
        <KpiCard
          variant="compact"
          label="Thao tác người dùng"
          value={kpis.userActions}
          valueNote={`(${kpis.activeUsers} người dùng)`}
          valueNoteTone="success"
        />
        <KpiCard
          variant="compact"
          label="Thiết bị kết nối"
          hint="Số thiết bị đang có sự kiện mất kết nối / mất tín hiệu chưa xử lý"
          icon={<Icon name="logLinkOff" box={14} />}
          iconPosition="start"
          toneLabel
          tone="warning"
          value={kpis.connectionIssues}
          valueNote={kpis.connectionIssues > 0 ? '(Cần kiểm tra)' : '(Ổn định)'}
        />
      </section>

      {/* Danh sách sự kiện – Figma 64:919 (thanh lọc 64:931 + bảng 64:953) */}
      <Card padding="none" radius="lg">
        <FilterBar
          search={f.q}
          onSearchChange={(q) => setValues({ q })}
          filters={filterDefs}
          values={{ area: f.area, category: f.category }}
          onValuesChange={(v) => setValues({ area: v.area ?? null, category: (v.category as (typeof LOG_CATEGORIES)[number] | null) ?? null })}
          advancedLabel="Xoá bộ lọc"
          advancedActive={table.isFiltered(['range'])}
          onAdvancedFilter={() => table.reset(['range'])}
        />
        <span id={morePendingId} hidden>
          {MORE_PENDING}
        </span>
        <DataTable
          label="Nhật ký vận hành"
          // Figma 64:974: dòng ~47px (chữ 12px, đệm dọc 15.5) → compact 48px.
          density="compact"
          minWidth={1060}
          stickyActions
          columns={columns}
          rows={table.pageRows}
          getRowId={getId}
          rowActions={(e) => (
            <button
              type="button"
              aria-disabled="true"
              aria-label={`Thao tác khác ${e.code}`}
              aria-describedby={morePendingId}
              title={MORE_PENDING}
              className="inline-flex cursor-not-allowed rounded-sm p-1 text-fg-secondary opacity-60"
            >
              <MoreVerticalIcon />
            </button>
          )}
          emptyState="Không có sự kiện phù hợp với bộ lọc."
          pagination={{
            page: table.page,
            pageSize: PAGE_SIZE,
            total: table.filtered.length,
            onPageChange: table.setPage,
            summary: (a, b, n) => `Hiển thị ${a}-${b} của ${n} sự kiện`,
          }}
        />
      </Card>
    </Page>
  );
}
