import { DataTable, Icon, StatusDot, type DataTableColumn } from '@/components';
import {
  DAILY_GROUPS,
  ROW_RESULT_LABEL,
  cellState,
  formatReading,
  rowResult,
  standardText,
  type CellState,
  type CheckpointView,
  type DailyReadingRow,
  type RowResult,
} from '@/features/reports';
import { cn } from '@/lib/cn';

const VALUE_CLASS: Record<Exclude<CellState, 'missing' | 'upcoming'>, string> = {
  normal: 'text-fg',
  warning: 'text-warning',
  abnormal: 'font-semibold text-danger-text',
};

const RESULT_CLASS: Record<RowResult, string> = {
  normal: 'text-success',
  warning: 'text-warning',
  abnormal: 'text-danger-text',
  'no-data': 'text-fg-secondary',
};

const GROUP_LABEL: Record<string, string> = Object.fromEntries(DAILY_GROUPS.map((g) => [g.id, g.label]));

/** Ghi chú dưới số đọc tại chỗ (dòng cao hơn – yêu cầu thiết kế). */
export const FIELD_NOTE = 'XM hiện trường';

/**
 * Ô giờ (Figma 117:4616): icon nguồn 9px + số 13px; số đọc tại chỗ có thêm dòng "XM hiện trường"; trống → "—" giữa ô.
 * Khung `relative` giữ chữ `sr-only` (absolute) trong vùng cuộn của bảng – thiếu nó trang tràn ngang ở 390 px.
 */
function ReadingCell({ row, cp }: { row: DailyReadingRow; cp: CheckpointView }) {
  const v = row.values[cp.key];
  const state = cellState(v, row.limits, cp.state);
  if (v === null || v === undefined || state === 'missing' || state === 'upcoming') {
    return (
      <span className="relative block text-center text-sm text-fg-secondary">
        <span aria-hidden="true">—</span>
        <span className="sr-only">{state === 'upcoming' ? 'Chưa tới hạn' : 'Chưa có dữ liệu'}</span>
      </span>
    );
  }
  return (
    <span className="relative flex flex-col items-start gap-0.5">
      <span className="inline-flex items-center gap-1">
        {row.source === 'auto' ? <Icon name="reportReadingAuto" box={9} /> : <StatusDot status="verify" size="sm" />}
        <span className={cn('text-base font-medium leading-[19.5px] tabular-nums', VALUE_CLASS[state])}>{formatReading(v, row.digits)}</span>
        {state !== 'normal' && <span className="sr-only"> – {state === 'abnormal' ? 'Bất thường' : 'Cảnh báo'}</span>}
      </span>
      {row.source === 'field' && <span className="text-xs leading-4 text-verify">{FIELD_NOTE}</span>}
    </span>
  );
}

export type DailyReadingsTableProps = {
  rows: readonly DailyReadingRow[];
  checkpoints: readonly CheckpointView[];
  label: string;
};

/**
 * Bảng số liệu báo cáo ngày – 11 cột (Hạng mục · Thiết bị · Đơn vị · 6 mốc · Ngưỡng/chuẩn · Kết quả), gom theo nhóm
 * thiết bị (dòng nhóm 117:4603, dòng số liệu 117:4609). Ô thiếu dữ liệu nền tối như ảnh; kết quả = mức xấu nhất của dòng.
 */
export function DailyReadingsTable({ rows, checkpoints, label }: DailyReadingsTableProps) {
  const columns: DataTableColumn<DailyReadingRow>[] = [
    { id: 'label', header: 'Hạng mục', align: 'start', width: 200, className: 'text-base font-semibold text-fg', cell: (r) => r.label },
    { id: 'device', header: 'Thiết bị', align: 'start', width: 150, className: 'whitespace-nowrap text-sm text-fg-secondary', cell: (r) => r.device },
    { id: 'unit', header: 'Đơn vị', width: 80, className: 'whitespace-nowrap text-base font-medium text-fg', cell: (r) => r.unit },
    ...checkpoints.map(
      (cp): DataTableColumn<DailyReadingRow> => ({
        id: `cp-${cp.key}`,
        header: cp.label,
        align: 'start',
        width: 112,
        className: (r) => (r.values[cp.key] === null && cp.state === 'missing' ? 'bg-bg-app' : undefined),
        cell: (r) => <ReadingCell row={r} cp={cp} />,
      }),
    ),
    {
      id: 'standard',
      header: 'Ngưỡng/chuẩn',
      width: 140,
      className: 'whitespace-nowrap text-sm text-fg-secondary',
      cell: (r) => standardText(r.limits, r.unit),
    },
    {
      id: 'result',
      header: 'Kết quả',
      width: 130,
      cell: (r) => {
        const res = rowResult(r);
        return <span className={cn('whitespace-nowrap text-sm font-semibold', RESULT_CLASS[res])}>{ROW_RESULT_LABEL[res]}</span>;
      },
    },
  ];

  return (
    <DataTable
      label={label}
      density="dense"
      gridLines
      minWidth={1380}
      stickyFirst
      columns={columns}
      rows={rows}
      getRowId={(r) => r.id}
      groupBy={(r) => ({ id: r.groupId, label: GROUP_LABEL[r.groupId] ?? r.groupId })}
      emptyState="Không có hạng mục phù hợp."
    />
  );
}
