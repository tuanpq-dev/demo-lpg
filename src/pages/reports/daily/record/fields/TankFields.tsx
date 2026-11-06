import { Badge, DataTable, Icon, type DataTableColumn } from '@/components';
import { SENSOR_HEALTH_LABEL, effectiveValue, formatRecordValue, inventoryNm3, valueSource, valueState, valueStateLabel, type CheckpointSnapshot, type RecordReading } from '@/features/reports';
import { cn } from '@/lib/cn';
import { STATE_TEXT, SourceBadge, ValueCell, boxClass, sensorText, type ManualProps } from './recordParts';

/** Bồn chứa LPG: bảng thông số (node 126:8062) + "Dữ liệu tính toán" (tồn kho quy đổi). */
export function TankTable({ snapshot, editing, manual, onManual }: { snapshot: CheckpointSnapshot; editing: boolean } & ManualProps) {
  const columns: DataTableColumn<RecordReading>[] = [
    { id: 'label', header: 'Thông số', align: 'start', width: 170, className: 'text-sm font-bold text-fg', cell: (r) => r.label },
    { id: 'tag', header: 'Tag/Thiết bị', align: 'start', width: 210, className: 'text-sm font-bold text-fg-secondary', cell: (r) => r.tag },
    {
      id: 'value',
      header: 'Giá trị hiện tại',
      align: 'start',
      width: 132,
      className: 'text-sm font-bold text-primary',
      cell: (r) => <ValueCell reading={r} editing={editing} manual={manual} onManual={onManual} />,
    },
    { id: 'unit', header: 'Đơn vị', align: 'start', width: 78, className: 'text-sm font-bold text-fg', cell: (r) => r.unit },
    { id: 'source', header: 'Nguồn', align: 'start', width: 90, cell: (r) => <SourceBadge source={valueSource(r, manual)} /> },
    {
      id: 'state',
      header: 'Trạng thái giá trị',
      align: 'start',
      width: 150,
      cell: (r) => <span className={cn('text-sm font-bold', STATE_TEXT[valueState(r, manual)])}>{valueStateLabel(r, manual)}</span>,
    },
    {
      id: 'sensor',
      header: 'Trạng thái cảm biến',
      align: 'start',
      width: 160,
      cell: (r) => <span className={cn('text-sm font-bold', sensorText(r.sensor))}>{SENSOR_HEALTH_LABEL[r.sensor]}</span>,
    },
  ];
  const volume = snapshot.tank.find((r) => r.id === 'tank-volume');
  const v = volume ? effectiveValue(volume, manual) : null;
  return (
    <>
      <DataTable label="Thông số bồn chứa LPG V-101" density="compact" minWidth={980} columns={columns} rows={snapshot.tank} getRowId={(r) => r.id} />
      <div className={cn(boxClass, 'flex flex-wrap items-center justify-between gap-2 px-3 py-3')}>
        <p className="text-sm">
          <span className="font-semibold tracking-wide text-fg-secondary">Dữ liệu tính toán: </span>
          <span className="font-bold text-primary">Tồn kho quy đổi: {v === null ? '—' : `${formatRecordValue(inventoryNm3(v), 1)} Nm³`}</span>
        </p>
        <Badge variant="tag" tone="primary" className="font-bold">
          Dữ liệu tính toán
        </Badge>
      </div>
    </>
  );
}

/** Nút "Nhập giá trị đồng hồ cơ" (icon bút chì asset 126:8067). */
export function GaugeInputToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className="inline-flex items-center gap-1 rounded-sm px-1 text-sm font-bold text-primary hover:underline"
    >
      <Icon name="reportRecordEdit" box={12} />
      {active ? 'Xong nhập đồng hồ cơ' : 'Nhập giá trị đồng hồ cơ'}
    </button>
  );
}
