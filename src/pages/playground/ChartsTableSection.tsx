import { useMemo, useState } from 'react';
import {
  AreaTrendChart,
  Badge,
  Button,
  CategoryBarList,
  ChartCard,
  DataTable,
  DonutGauge,
  LineTrendChart,
  TableActionButton,
  type DataTableColumn,
  type Severity,
} from '@/components';
import { tableValue, type AlertRecord } from '@/data/alerts';
import { alertRecords as alertRows } from '@/mocks/alerts';
import { consumptionByArea, deviceStatus, inventoryDomain, inventoryTrend, pressureTrend } from '@/mocks/overview';
import { cn } from '@/lib/cn';
import { FigmaRef } from './FigmaRef';
import { Demo } from './Demo';

const OVERVIEW = '/figma-ref/53-11-overview.png';
const ALERTS = '/figma-ref/70-2809-alerts.png';
const MAINT = '/figma-ref/70-3964-maintenance.png';

const valueTone: Record<Severity, string> = {
  critical: 'text-danger',
  high: 'text-warning',
  medium: 'text-fg',
  low: 'text-fg',
};

const nf = (v: number) => v.toLocaleString('en-US');

export function ChartsTableSection() {
  const [width, setWidth] = useState(1148);

  // DataTable state
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [empty, setEmpty] = useState(false);
  const [viewed, setViewed] = useState('—');
  const pageSize = 5;
  const rows = useMemo(() => (empty ? [] : alertRows), [empty]);
  const pageRows = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [rows, page]);

  const columns: DataTableColumn<AlertRecord>[] = [
    { id: 'time', header: 'Thời gian', width: 81 },
    { id: 'severity', header: 'Mức độ', width: 110, cell: (r) => <Badge variant="severity" value={r.severity} /> },
    { id: 'code', header: 'Mã CB', width: 90 },
    { id: 'message', header: 'Nội dung', align: 'start', width: 260, className: 'max-w-[260px] truncate text-fg', cell: (r) => r.message },
    { id: 'device', header: 'Thiết bị', width: 70, className: 'text-info' },
    { id: 'area', header: 'Khu vực', width: 100 },
    {
      id: 'value',
      header: 'Giá trị/Ngưỡng',
      width: 110,
      cell: (r) => (
        <span className={valueTone[r.severity]}>
          {tableValue(r)}
        </span>
      ),
    },
    { id: 'status', header: 'Trạng thái', width: 120, cell: (r) => <Badge variant="status" value={r.status} /> },
    { id: 'assignee', header: 'Người xử lý', width: 110, className: 'text-fg opacity-75', cell: (r) => r.assignee ?? '-' },
  ];

  return (
    <div className="flex flex-col gap-10">
      <Demo title="ChartCard × 4 (responsive theo khung)" node="53:319">
        <div className="flex items-center gap-3 text-sm text-fg-secondary">
          <label htmlFor="chart-w">Độ rộng hàng chart: {width}px</label>
          <input
            id="chart-w"
            type="range"
            min={720}
            max={1480}
            step={4}
            value={width}
            onChange={(e) => setWidth(+e.target.value)}
            className="accent-accent"
          />
        </div>
        <div className="grid grid-cols-4 gap-4" style={{ width }}>
          <ChartCard title="Xu hướng tồn kho (24h)" description="Tồn kho 24 giờ, khoảng 150 nghìn Nm³">
            <AreaTrendChart data={inventoryTrend} domain={inventoryDomain} unit="Nm³" format={nf} />
          </ChartCard>
          <ChartCard title="Tiêu thụ theo khu vực" height={240}>
            <CategoryBarList items={consumptionByArea.items} max={consumptionByArea.max} unit="Nm³/h" />
          </ChartCard>
          <ChartCard title="Áp suất hệ thống (24h)" description="Áp suất 24 giờ, quanh 1.8 bar">
            <LineTrendChart data={pressureTrend} unit="bar" format={(v) => v.toFixed(2)} />
          </ChartCard>
          <ChartCard title="Trạng thái thiết bị" height={240}>
            <div className="flex h-full justify-center overflow-hidden">
              <DonutGauge segments={deviceStatus} size={180} className="-mt-2" />
            </div>
          </ChartCard>
        </div>
        <FigmaRef src={OVERVIEW} x={30} y={911} w={1148} h={315} />
      </Demo>

      <Demo title="DataTable" node="70:3032 · phân trang 70:5530 (màu đọc từ ảnh chụp)">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={() => { setEmpty((v) => !v); setPage(1); }}>
            {empty ? 'Hiện dữ liệu' : 'Thử trạng thái rỗng'}
          </Button>
          <span className="font-mono text-xs text-fg-muted/65">
            đã chọn: {selected.length} [{selected.join(', ')}] · xem: {viewed}
          </span>
        </div>
        <div className="w-[1496px] overflow-hidden rounded-lg border border-line/30 bg-surface shadow-card">
          <DataTable
            label="Danh sách cảnh báo"
            columns={columns}
            rows={pageRows}
            getRowId={(r) => r.id}
            selectable
            selectedIds={selected}
            onSelectionChange={setSelected}
            rowActions={(r) => <TableActionButton label={`Xem ${r.code}`} onClick={() => setViewed(r.code)} />}
            emptyState="Không có cảnh báo nào."
            maxHeight={420}
            pagination={{
              page,
              pageSize,
              total: rows.length,
              onPageChange: setPage,
              summary: (f, t, n) => `Hiển thị ${f}-${t} của ${n} cảnh báo`,
            }}
          />
        </div>
        <FigmaRef src={ALERTS} x={34.5} y={582} w={1496} h={419} caption="Figma – bảng 70:3032" />
        <FigmaRef src={MAINT} x={32} y={1079.5} w={1131} h={57} caption="Figma – phân trang 70:5530" />
      </Demo>

      <Demo title="DataTable – density compact, không chọn, không phân trang" node="—">
        <div className={cn('w-[900px] overflow-hidden rounded-lg border border-line/30 bg-surface')}>
          <DataTable
            label="Bảng gọn"
            density="compact"
            columns={columns.slice(0, 5)}
            rows={alertRows.slice(0, 4)}
            getRowId={(r) => r.id}
          />
        </div>
      </Demo>
    </div>
  );
}
