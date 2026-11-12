import {
  Button,
  Card,
  DataTable,
  FilterBar,
  Select,
  TableActionButton,
  Tabs,
  type DataTableColumn,
  type FilterDef,
  type Severity,
  type TabItem,
  type TimelineEvent,
} from '@/components';
import type { useFilterParams } from '@/app/useTableFilters';
import type { useRecordSelection } from '@/app/useRecordSelection';
import {
  MAINTENANCE_ASSIGNEES,
  PRIORITY_OPTIONS,
  TYPE_OPTIONS,
  type MAINTENANCE_PARAMS,
  type MaintenanceRecord,
  type MaintenanceTab,
  type MaintenanceType,
} from '@/data/maintenance';
import type { MaintenanceListResult } from '@/data/maintenanceApi';
import { cn } from '@/lib/cn';
import { ScheduleCard, SectionHeading } from './MaintenanceSections';

export const PAGE_SIZE = 8;
const getId = (r: MaintenanceRecord) => r.id;

/** Bộ lọc + trang ↔ URL (`useFilterParams(MAINTENANCE_PARAMS)`). */
export type MaintenanceParams = ReturnType<typeof useFilterParams<typeof MAINTENANCE_PARAMS>>;

/** Thanh thao tác hàng loạt: phân công (chỉ dòng Chờ tiếp nhận) + bỏ chọn. */
function BulkAssignBar({ count, onAssign, onClear }: { count: number; onAssign: (name: string) => void; onClear: () => void }) {
  return (
    <div role="toolbar" aria-label="Thao tác hàng loạt" className="flex flex-wrap items-center gap-3 border-b border-info/20 bg-info/10 px-4 py-2.5">
      <span className="text-base font-semibold text-info">Đã chọn {count} yêu cầu</span>
      <Select
        variant="button"
        label="Phân công (chỉ Chờ tiếp nhận)"
        options={MAINTENANCE_ASSIGNEES.map((n) => ({ value: n, label: n }))}
        value={null}
        onChange={(n) => n && onAssign(n)}
      />
      <Button variant="link" onClick={onClear} className="ml-auto">
        Bỏ chọn
      </Button>
    </div>
  );
}

export type MaintenanceListSectionProps = {
  params: MaintenanceParams;
  /** Một trang kết quả + số đếm tab + facet (GET /maintenance). */
  result: MaintenanceListResult;
  /** Đang tải bộ lọc / trang mới – giữ kết quả cũ, làm mờ. */
  pending: boolean;
  selection: ReturnType<typeof useRecordSelection<MaintenanceRecord>>;
  columns: DataTableColumn<MaintenanceRecord>[];
  /** Thông báo sau thao tác (vùng `role="status"`). */
  notice: string;
  schedule: TimelineEvent[];
  onShowSchedule: () => void;
  openDetail: (id: string) => void;
  onBulkAssign: (name: string) => void;
};

/**
 * 3. Danh sách yêu cầu + Lịch sắp tới – Figma 70:5642: tab trạng thái, tìm kiếm + bộ lọc (đồng bộ URL), thao tác hàng loạt,
 * thông báo, bảng phân trang (mã + cột "Xem" cố định khi cuộn ngang); cột phải = lịch bảo trì định kỳ. Lọc / trang / đếm ở
 * MÁY CHỦ – bảng chỉ có dòng của trang đang xem; lựa chọn giữ qua nhiều trang (`useRecordSelection`).
 */
export function MaintenanceListSection({
  params,
  result,
  pending,
  selection,
  columns,
  notice,
  schedule,
  onShowSchedule,
  openDetail,
  onBulkAssign,
}: MaintenanceListSectionProps) {
  const { values: f, setValues } = params;
  const tc = result.tabCounts;
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
    {
      id: 'area',
      label: 'Khu vực',
      allLabel: 'Tất cả khu vực',
      options: result.facets.areas.map((a) => ({ value: a, label: a })),
    },
    { id: 'priority', label: 'Mức độ', options: PRIORITY_OPTIONS },
    { id: 'type', label: 'Loại bảo trì', options: TYPE_OPTIONS },
  ];

  return (
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
            advancedActive={params.isFiltered(['range'])}
            onAdvancedFilter={() => params.reset(['range'])}
          />

          {selection.selected.length > 0 && <BulkAssignBar count={selection.selected.length} onAssign={onBulkAssign} onClear={selection.clear} />}
          <p role="status" className={notice ? 'px-4 pt-2 text-sm text-success' : 'sr-only'}>
            {notice}
          </p>

          {/* Đang tải trang / bộ lọc mới: giữ kết quả cũ, làm mờ (aria-busy) tới khi có kết quả. */}
          <div id="maintenance-table" aria-busy={pending} className={cn('transition-opacity', pending && 'opacity-60')}>
            <DataTable
              label="Danh sách yêu cầu bảo trì"
              // Khung hẹp hơn → cuộn ngang trong khung; mã yêu cầu + cột "Xem" cố định khi cuộn.
              minWidth={1100}
              stickyFirst
              stickyActions
              columns={columns}
              rows={result.rows}
              getRowId={getId}
              selectable
              selectedIds={selection.selected}
              onSelectionChange={selection.setSelected}
              rowActions={(r) => <TableActionButton label={`Xem chi tiết ${r.code}`} onClick={() => openDetail(r.id)} />}
              onRowClick={(r) => openDetail(r.id)}
              emptyState="Không có yêu cầu bảo trì phù hợp."
              pagination={{
                page: result.page,
                pageSize: PAGE_SIZE,
                total: result.total,
                onPageChange: params.setPage,
                summary: (a, b, n) => `Hiển thị ${a}-${b} của ${n} yêu cầu`,
              }}
            />
          </div>
        </Card>

        <ScheduleCard events={schedule} onShowSchedule={onShowSchedule} onEventClick={openDetail} />
      </div>
    </section>
  );
}
