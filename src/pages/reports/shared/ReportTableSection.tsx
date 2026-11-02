import { forwardRef, useId } from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  DataTable,
  DatePicker,
  FilterBar,
  Icon,
  InfoIcon,
  MoreVerticalIcon,
  SignaturePenIcon,
  Tabs,
  type DataTableColumn,
  type FilterDef,
  type TabItem,
} from '@/components';
import {
  COMPLETION_LABEL,
  COMPLETION_STATUSES,
  PAGE_SIZES,
  PERIOD_CONFIG,
  REPORT_PERIODS,
  SIGNATURE_LABEL,
  SIGNATURE_STATUSES,
  completionOf,
  distinctOptions,
  formatUpdatedAt,
  missingText,
  periodLabel,
  progressText,
  signatureOf,
  type CompletionStatus,
  type ReportPeriod,
  type ReportRecord,
  type ReportTab,
  type SignatureFilter,
} from '@/features/reports';
import { reportDetailPath } from '@/data/dailyReport';
import { CompletionBadge, SignatureBadge } from './ReportBadges';
import type { ReportTableState } from './useReportTable';

const TAB_LABEL: Record<ReportTab, string> = {
  all: 'Tất cả',
  daily: PERIOD_CONFIG.daily.label,
  monthly: PERIOD_CONFIG.monthly.label,
  quarterly: PERIOD_CONFIG.quarterly.label,
  yearly: PERIOD_CONFIG.yearly.label,
  signed: 'Biểu mẫu đã ký',
};

export type ReportTableSectionProps = {
  table: ReportTableState;
  /** Toàn bộ báo cáo (lấy lựa chọn cho bộ lọc người/ca). */
  rows: readonly ReportRecord[];
  now: Date;
  /** Thứ tự + tập tab của màn (mặc định đủ 6 tab như ảnh). */
  tabs?: readonly ReportTab[];
  /** Dòng ⓘ dưới tab theo tab đang chọn. */
  tabNotes: Partial<Record<ReportTab, string>>;
  /** Tên bảng (caption ẩn). */
  label: string;
  /**
   * Nút "Ký xác nhận" (bút ký) ở cột thao tác – chỉ dòng `canSign(r)` (báo cáo ngày chờ Người kiểm tra). Không truyền → không có nút.
   */
  onSign?: (r: ReportRecord) => void;
  canSign?: (r: ReportRecord) => boolean;
};

const SIGNATURE_FILTER_OPTIONS: { value: SignatureFilter; label: string }[] = [
  ...SIGNATURE_STATUSES.map((s) => ({ value: s, label: SIGNATURE_LABEL[s] })),
  { value: 'awaiting', label: 'Chờ xác nhận (chờ duyệt + bị trả lại)' },
];

/** Thông báo cho nút thao tác chưa có thiết kế (đọc kèm qua aria-describedby). Báo cáo ngày đã có màn chi tiết. */
const ACTIONS_PENDING = 'Chưa có màn chi tiết cho loại báo cáo này – chờ thiết kế.';
const MORE_PENDING = 'Chưa có thao tác khác – chờ thiết kế.';

/**
 * Khối tab loại báo cáo + bảng có lọc (ảnh màn Báo cáo). Cột theo tab: tab một kỳ → tiêu đề cột kỳ theo kỳ đó,
 * cột "Ca vận hành" chỉ ở báo cáo ngày; tab gộp ("Tất cả", "Biểu mẫu đã ký") → "Kỳ báo cáo".
 */
export const ReportTableSection = forwardRef<HTMLDivElement, ReportTableSectionProps>(function ReportTableSection(
  { table, rows, now, tabs = ['all', ...REPORT_PERIODS, 'signed'], tabNotes, label, onSign, canSign },
  ref,
) {
  const uid = useId();
  const panelId = `${uid}-panel`;
  const pendingId = `${uid}-pending`;
  const morePendingId = `${uid}-more-pending`;
  const { values: f, setValues } = table;
  const counts = table.tabCounts as Record<ReportTab, number>;
  const period: ReportPeriod | undefined = (REPORT_PERIODS as readonly string[]).includes(f.tab) ? (f.tab as ReportPeriod) : undefined;

  const tabItems: TabItem[] = tabs.map((t) => ({ id: t, label: TAB_LABEL[t], count: counts[t], countMax: 9999, countTone: t === f.tab ? 'info' : 'neutral' }));

  const filterDefs: FilterDef[] = [
    ...(period === undefined || period === 'daily'
      ? [{ id: 'shift', label: 'Ca vận hành', allLabel: 'Tất cả', options: distinctOptions(rows.map((r) => r.shift)) }]
      : []),
    { id: 'completion', label: 'Trạng thái hoàn thành', allLabel: 'Tất cả', options: COMPLETION_STATUSES.map((s) => ({ value: s, label: COMPLETION_LABEL[s] })) },
    { id: 'signature', label: 'Trạng thái chữ ký', allLabel: 'Tất cả', options: SIGNATURE_FILTER_OPTIONS },
    { id: 'inspector', label: 'Người kiểm tra', allLabel: 'Tất cả', options: distinctOptions(rows.map((r) => r.inspector)) },
    { id: 'approver', label: 'Người duyệt', allLabel: 'Tất cả', options: distinctOptions(rows.map((r) => r.approver)) },
  ];

  const columns: DataTableColumn<ReportRecord>[] = [
    {
      id: 'code',
      header: 'Mã báo cáo',
      align: 'start',
      width: 120,
      // Báo cáo ngày → link tới màn chi tiết; loại khác chưa có màn → chữ thường màu info (không phải link).
      cell: (r) => {
        const to = reportDetailPath(r);
        return to ? (
          <Link to={to} className="rounded-sm text-sm font-semibold text-info hover:underline">
            {r.code}
          </Link>
        ) : (
          <span className="text-sm font-semibold text-info">{r.code}</span>
        );
      },
    },
    {
      id: 'period',
      header: period ? PERIOD_CONFIG[period].periodHeader : 'Kỳ báo cáo',
      align: 'start',
      width: 120,
      className: 'whitespace-nowrap text-sm text-fg',
      cell: (r) => periodLabel(r.period, r.periodKey),
    },
    ...(period === 'daily'
      ? [{ id: 'shift', header: 'Ca vận hành', align: 'start' as const, width: 100, className: 'text-sm text-fg', cell: (r: ReportRecord) => r.shift ?? '—' }]
      : []),
    { id: 'progress', header: 'Tiến độ kiểm tra', align: 'start', width: 130, className: 'whitespace-nowrap text-sm tabular-nums text-fg', cell: (r) => progressText(r) },
    { id: 'missing', header: 'Mốc còn thiếu', align: 'start', width: 120, className: 'text-sm text-fg', cell: (r) => missingText(r, now) },
    { id: 'inspector', header: 'Người kiểm tra', align: 'start', width: 120, className: 'whitespace-nowrap text-sm text-fg', cell: (r) => r.inspector },
    {
      id: 'approver',
      header: 'Người duyệt',
      align: 'start',
      width: 110,
      className: 'whitespace-nowrap text-sm',
      cell: (r) => (r.approver ? <span className="text-fg">{r.approver}</span> : <span className="text-fg-secondary">Chưa chỉ định</span>),
    },
    { id: 'completion', header: 'Trạng thái hoàn thành', align: 'start', width: 150, cell: (r) => <CompletionBadge status={completionOf(r, now)} /> },
    { id: 'signature', header: 'Trạng thái chữ ký', align: 'start', width: 130, cell: (r) => <SignatureBadge status={signatureOf(r, now)} /> },
    { id: 'updatedAt', header: 'Cập nhật cuối', align: 'start', width: 110, className: 'whitespace-nowrap text-sm tabular-nums text-fg', cell: (r) => formatUpdatedAt(r.updatedAt) },
  ];

  const note = tabNotes[f.tab];
  const clearKeep = ['tab', 'size'] as const;

  return (
    <div ref={ref} className="flex scroll-mt-20 flex-col gap-4">
      <Card padding="none" radius="lg">
        <Tabs label="Loại báo cáo" items={tabItems} value={f.tab} onChange={(t) => setValues({ tab: t as ReportTab })} panelId={panelId} className="overflow-x-auto" />
        {note && (
          <p className="flex items-start gap-2 px-4 py-3 text-sm text-info">
            <InfoIcon size={16} className="mt-0.5 shrink-0" />
            {note}
          </p>
        )}
      </Card>

      <Card padding="none" radius="lg" id={panelId}>
        <FilterBar
          layout="inline"
          search={f.q}
          onSearchChange={(q) => setValues({ q })}
          searchPlaceholder="Mã báo cáo, ngày, người kiểm tra..."
          leading={<DatePicker hideLabel label="Ngày báo cáo" value={f.date ?? ''} onChange={(date) => setValues({ date: date || null })} className="w-[150px]" />}
          filters={filterDefs}
          values={{ shift: f.shift, completion: f.completion, signature: f.signature, inspector: f.inspector, approver: f.approver }}
          onValuesChange={(v) =>
            setValues({
              shift: v.shift ?? null,
              completion: (v.completion as CompletionStatus | null) ?? null,
              signature: (v.signature as SignatureFilter | null) ?? null,
              inspector: v.inspector ?? null,
              approver: v.approver ?? null,
            })
          }
          onClear={() => table.reset([...clearKeep])}
          clearDisabled={!table.isFiltered([...clearKeep])}
        />
        <span id={pendingId} hidden>
          {ACTIONS_PENDING}
        </span>
        <span id={morePendingId} hidden>
          {MORE_PENDING}
        </span>
        <DataTable
          label={label}
          density="compact"
          minWidth={period === 'daily' ? 1320 : 1220}
          stickyFirst
          stickyActions
          columns={columns}
          rows={table.pageRows}
          getRowId={(r) => r.id}
          rowActions={(r) => (
            <span className="inline-flex items-center gap-1">
              {onSign && canSign?.(r) && (
                <button
                  type="button"
                  aria-label={`Ký xác nhận ${r.code}`}
                  title="Hoàn thành nhận xét & ký xác nhận"
                  onClick={() => onSign(r)}
                  className="inline-flex rounded-sm p-1 text-primary hover:bg-primary/10"
                >
                  <SignaturePenIcon size={18} />
                </button>
              )}
              {reportDetailPath(r) ? (
                <Link to={reportDetailPath(r)!} aria-label={`Xem báo cáo ${r.code}`} className="inline-flex rounded-sm p-1 opacity-90 hover:opacity-100">
                  <Icon name="eye" box={18} />
                </Link>
              ) : (
                <button
                  type="button"
                  aria-disabled="true"
                  aria-label={`Xem báo cáo ${r.code}`}
                  aria-describedby={pendingId}
                  title={ACTIONS_PENDING}
                  className="inline-flex cursor-not-allowed rounded-sm p-1 opacity-60"
                >
                  <Icon name="eye" box={18} />
                </button>
              )}
              <button
                type="button"
                aria-disabled="true"
                aria-label={`Thao tác khác ${r.code}`}
                aria-describedby={morePendingId}
                title={MORE_PENDING}
                className="inline-flex cursor-not-allowed rounded-sm p-1 text-fg-secondary opacity-60"
              >
                <MoreVerticalIcon />
              </button>
            </span>
          )}
          emptyState="Không có báo cáo phù hợp."
          pagination={{
            page: table.page,
            pageSize: table.pageSize,
            total: table.filtered.length,
            onPageChange: table.setPage,
            summary: (a, b, n) => `Hiển thị ${a}-${b} của ${n}`,
            pageSizeOptions: PAGE_SIZES.map(Number),
            onPageSizeChange: (size) => setValues({ size: String(size) as (typeof PAGE_SIZES)[number] }),
          }}
        />
      </Card>
    </div>
  );
});
