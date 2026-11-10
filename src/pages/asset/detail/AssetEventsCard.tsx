import { Button, Card, DataTable, type DataTableColumn } from '@/components';
import {
  type EVENT_PARAMS,
  EVENT_STATUS_LABEL,
  EVENT_TYPES,
  EVENT_TYPE_META,
  parseHiddenTypes,
  toggleHiddenType,
  type AssetEvent,
} from '@/data/assetDetail';
import type { useTableFilters } from '@/app/useTableFilters';
import { cn } from '@/lib/cn';
import { EVENT_TONE } from './assetView';

export const getEventId = (e: AssetEvent) => e.id;
export type AssetEventsTable = ReturnType<typeof useTableFilters<AssetEvent, typeof EVENT_PARAMS>>;

const COLUMNS: DataTableColumn<AssetEvent>[] = [
  {
    id: 'time',
    header: 'Thời gian',
    align: 'start',
    width: '22%',
    className: 'text-sm tabular-nums text-fg',
    cell: (e) => (e.daysAgo ? `${e.time} (−${e.daysAgo} ngày)` : e.time),
  },
  { id: 'title', header: 'Sự kiện / Hành động', align: 'start', width: '30%', className: 'text-sm text-fg' },
  {
    id: 'type',
    header: 'Loại',
    align: 'start',
    width: '24%',
    cell: (e) => <span className={cn('text-sm', EVENT_TONE[e.type].text)}>{EVENT_TYPE_META[e.type].label}</span>,
  },
  {
    id: 'status',
    header: 'Trạng thái',
    align: 'start',
    cell: (e) => <span className={cn('text-xs', e.status === 'done' ? 'text-success' : 'text-fg-secondary')}>{EVENT_STATUS_LABEL[e.status]}</span>,
  },
];

/** Hàng dưới: "Sự kiện gần đây" – chú thích loại = nút lọc (ẩn / hiện qua ?hide=), bảng phân trang, nhật ký đầy đủ (chưa có). */
export function AssetEventsCard({ assetId, events }: { assetId: string; events: AssetEventsTable }) {
  const hidden = parseHiddenTypes(events.values.hide);
  return (
    <Card
      title={`Sự kiện gần đây ${assetId}`}
      headerVariant="plain"
      headerEnd={
        <div role="group" aria-label="Lọc theo loại sự kiện" className="flex flex-wrap items-center gap-1">
          {EVENT_TYPES.map((t) => {
            const on = !hidden.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => events.setValues({ hide: toggleHiddenType(events.values.hide, t) })}
                className={cn(
                  'flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-2xs transition-opacity hover:bg-surface-muted/20',
                  on ? 'text-fg-muted' : 'text-fg-secondary line-through opacity-60',
                )}
              >
                <span aria-hidden="true" className={cn('size-2 rounded-full', EVENT_TONE[t].dot, !on && 'opacity-40')} />
                {EVENT_TYPE_META[t].legend}
              </button>
            );
          })}
        </div>
      }
    >
      <DataTable
        label={`Sự kiện gần đây của ${assetId}`}
        columns={COLUMNS}
        rows={events.pageRows}
        getRowId={getEventId}
        minWidth={640}
        density="compact"
        emptyState={<p className="py-6 text-center text-sm text-fg-secondary">Không có sự kiện thuộc loại đang chọn.</p>}
      />
      <div className="flex justify-end pt-3">
        {/* Chưa có trang nhật ký đầy đủ (chờ thiết kế/API) → nút tắt, có tooltip. */}
        <Button variant="link" disabled title="Chưa có trang nhật ký đầy đủ">
          Xem toàn bộ nhật ký của {assetId}
        </Button>
      </div>
    </Card>
  );
}
