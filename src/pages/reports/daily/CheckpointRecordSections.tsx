/*
 * Khối nội dung của modal "Ghi nhận mốc kiểm tra" (Figma bản sao 126:7966; style bảng lấy từ node 126:8062, phần còn lại
 * theo ảnh chụp node – scratch/figma-ref/report-record/). Màu Figma map về token: #8AEBFF → primary, #31E6A1 → success,
 * #90A5BD → fg-secondary, #EAF3FF → fg, nền #0B1626 → surface-raised, viền #1A344E → line-card.
 */
import { forwardRef, type ReactNode } from 'react';
import { Badge, DataTable, Icon, NumberField, type DataTableColumn } from '@/components';
import {
  SENSOR_HEALTH_LABEL,
  effectiveValue,
  findReading,
  formatRecordValue,
  inventoryNm3,
  valueSource,
  valueState,
  valueStateLabel,
  type CheckpointSnapshot,
  type FlowLine,
  type ManualValues,
  type RecordReading,
  type SensorHealth,
  type ValueSource,
  type ValueState,
  type VaporizerUnit,
} from '@/features/reports';
import { cn } from '@/lib/cn';

export type ManualProps = {
  manual: ManualValues;
  /** null = bỏ giá trị nhập tay (quay về số IoT). */
  onManual: (id: string, value: number | null) => void;
};

const STATE_TEXT: Record<ValueState, string> = {
  normal: 'text-success',
  warning: 'text-warning',
  abnormal: 'text-danger-text',
  missing: 'text-fg-secondary',
};

const sensorText = (h: SensorHealth) => (h === 'normal' ? 'text-success' : h === 'stale' ? 'text-warning' : 'text-danger-text');

/** Khung thẻ chung của modal (nền #0B1626, viền #1A344E, bo 6). */
export const boxClass = 'rounded-md border border-line-card bg-surface-raised';

/** Tiêu đề mục + nội dung; `id` để tab điều hướng cuộn tới. */
export const RecordSection = forwardRef<HTMLElement, { id: string; title: string; end?: ReactNode; children: ReactNode; className?: string }>(
  function RecordSection({ id, title, end, children, className }, ref) {
    return (
      <section ref={ref} id={id} aria-labelledby={`${id}-title`} className={cn('flex scroll-mt-2 flex-col gap-3', className)}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={`${id}-title`} className="text-lg font-semibold text-fg">
            {title}
          </h3>
          {end}
        </div>
        {children}
      </section>
    );
  },
);

const SOURCE_BADGE: Record<Exclude<ValueSource, 'missing'>, { label: string; tone: 'primary' | 'success' | 'warning' }> = {
  iot: { label: 'PLC', tone: 'primary' },
  field: { label: 'Đồng hồ', tone: 'success' },
  manual: { label: 'Thủ công', tone: 'warning' },
};

/** Ô "Nguồn": PLC (IoT) · Đồng hồ (xác minh hiện trường) · Thủ công (ghi nhận thủ công) · "—". */
export function SourceBadge({ source }: { source: ValueSource }) {
  if (source === 'missing') return <span className="text-sm text-fg-secondary">—</span>;
  const b = SOURCE_BADGE[source];
  return (
    <Badge variant="tag" tone={b.tone} className="font-bold">
      {b.label}
    </Badge>
  );
}

/** Ô nhập giá trị đồng hồ cơ (nhập tay) – trống + rời ô → bỏ nhập tay. */
function ManualInput({ reading: r, manual, onManual }: { reading: RecordReading } & ManualProps) {
  return (
    <NumberField
      size="sm"
      hideLabel
      label={`Giá trị đồng hồ cơ – ${r.label} (${r.unit})`}
      value={r.id in manual ? manual[r.id] : null}
      placeholder={r.value === null ? 'Nhập' : formatRecordValue(r.value, r.digits)}
      precision={r.digits}
      min={0}
      onChange={(v) => onManual(r.id, v)}
      onClear={() => onManual(r.id, null)}
    />
  );
}

/** Giá trị hiển thị; ô nhập khi đang nhập đồng hồ cơ hoặc IoT không có số. */
function ValueCell({ reading: r, editing, manual, onManual, className }: { reading: RecordReading; editing: boolean; className?: string } & ManualProps) {
  if (editing || r.value === null) {
    return (
      <span className="block w-28">
        <ManualInput reading={r} manual={manual} onManual={onManual} />
      </span>
    );
  }
  return <span className={cn('tabular-nums', className)}>{formatRecordValue(effectiveValue(r, manual), r.digits)}</span>;
}

// ============================================================================
// Bồn chứa LPG (bảng – node 126:8062)
// ============================================================================

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

// ============================================================================
// Dòng nhãn – giá trị dùng chung (máy hóa hơi, đường cấp, PLC)
// ============================================================================

function Row({ label, children, dim }: { label: string; children: ReactNode; dim?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <dt className={cn('font-semibold', dim ? 'text-fg-secondary/80' : 'text-fg-secondary')}>{label}</dt>
      <dd className={cn('text-right font-bold', dim ? 'text-fg-secondary' : 'text-fg')}>{children}</dd>
    </div>
  );
}

function ReadingRow({ reading: r, dim, ...m }: { reading: RecordReading; dim?: boolean } & ManualProps) {
  const st = valueState(r, m.manual);
  const v = effectiveValue(r, m.manual);
  return (
    <Row label={`${r.label}:`} dim={dim}>
      {v === null ? (
        <span className="ml-auto block w-28">
          <ManualInput reading={r} {...m} />
        </span>
      ) : (
        <span className={cn('tabular-nums', st === 'warning' || st === 'abnormal' ? STATE_TEXT[st] : undefined)}>
          {formatRecordValue(v, r.digits)}
          {r.unit.startsWith('°') ? r.unit : ` ${r.unit}`}
          {st === 'warning' || st === 'abnormal' ? <span className="sr-only"> – {valueStateLabel(r, m.manual)}</span> : null}
        </span>
      )}
    </Row>
  );
}

// ============================================================================
// Máy hóa hơi
// ============================================================================

export function VaporizerCards({ units, ...m }: { units: readonly VaporizerUnit[] } & ManualProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {units.map((u) => {
        const standby = u.state === 'standby';
        const sensors = u.readings.map((r) => r.sensor);
        const worst: SensorHealth = sensors.find((s) => s === 'lost') ?? sensors.find((s) => s === 'fault') ?? sensors.find((s) => s === 'stale') ?? 'normal';
        return (
          <div key={u.id} className={cn(boxClass, 'flex flex-col gap-3 p-4')}>
            <div className="flex items-center justify-between gap-2">
              <h4 className={cn('text-md font-bold', standby ? 'text-fg-secondary' : 'text-primary')}>{u.id}</h4>
              <Badge variant="tag" tone={standby ? 'neutral' : 'success'}>
                {standby ? 'Dự phòng' : 'Đang hoạt động'}
              </Badge>
            </div>
            <dl className="flex flex-col gap-2">
              {u.readings.map((r) => (
                <ReadingRow key={r.id} reading={r} dim={standby} {...m} />
              ))}
              <Row label="Cảm biến:" dim={standby}>
                <span className={sensorText(worst)}>{SENSOR_HEALTH_LABEL[worst]}</span>
              </Row>
            </dl>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Điều áp
// ============================================================================

export function RegulatorCards({ readings, ...m }: { readings: readonly RecordReading[] } & ManualProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {readings.map((r) => {
        const v = effectiveValue(r, m.manual);
        const st = valueState(r, m.manual);
        return (
          <div key={r.id} className={cn(boxClass, 'flex flex-col gap-1.5 p-4')}>
            <p className="text-sm tracking-wide text-fg-secondary">{r.label}</p>
            {v === null ? (
              <span className="w-28">
                <ManualInput reading={r} {...m} />
              </span>
            ) : (
              <p className={cn('text-lg tabular-nums', st === 'normal' ? 'text-fg' : STATE_TEXT[st])}>
                {formatRecordValue(v, r.digits)} {r.unit}
                {st !== 'normal' && <span className="sr-only"> – {valueStateLabel(r, m.manual)}</span>}
              </p>
            )}
            <p className="text-xs font-semibold text-fg-secondary">
              Trạng thái cảm biến: <span className={sensorText(r.sensor)}>{SENSOR_HEALTH_LABEL[r.sensor]}</span>
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Lưu lượng – đường cấp
// ============================================================================

export function FlowLineCards({ lines, ...m }: { lines: readonly FlowLine[] } & ManualProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {lines.map((l) => (
        <div key={l.id} className={cn(boxClass, 'flex flex-col gap-3 p-4')}>
          <h4 className="border-b border-line-card pb-1.5 text-md font-bold text-primary">{l.label}</h4>
          <dl className="flex flex-col gap-2">
            {l.readings.map((r) => (
              <ReadingRow key={r.id} reading={r} {...m} />
            ))}
          </dl>
          <p className={cn('mt-auto text-xs font-semibold', sensorText(l.sensor))}>Cảm biến: {SENSOR_HEALTH_LABEL[l.sensor]}</p>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Gas + báo cháy
// ============================================================================

export function GasTable({ snapshot, manual }: { snapshot: CheckpointSnapshot; manual: ManualValues }) {
  const rows = snapshot.gas.flatMap((g) => {
    const r = findReading(snapshot, g.readingId);
    return r ? [{ g, r }] : [];
  });
  const warn = rows[0]?.r.limits;
  return (
    <div className={cn(boxClass, 'overflow-hidden')}>
      <dl>
        {rows.map(({ g, r }) => {
          const v = effectiveValue(r, manual);
          const st = valueState(r, manual);
          return (
            <div key={g.readingId} className="flex items-center justify-between gap-3 border-b border-line-card px-4 py-2.5 text-sm last:border-b-0">
              <dt className="font-bold text-fg">{g.label}</dt>
              <dd className={cn('font-bold tabular-nums', st === 'missing' ? 'text-fg-secondary' : STATE_TEXT[st])}>
                {v === null ? '—' : `${formatRecordValue(v, r.digits)}% LEL`}
                {st !== 'normal' && <span className="sr-only"> – {valueStateLabel(r, manual)}</span>}
              </dd>
            </div>
          );
        })}
      </dl>
      {warn && (
        <p className="bg-surface-muted/40 px-4 py-2 text-xs font-semibold italic text-fg-secondary">
          * Ngưỡng PLC: cảnh báo {warn.warn ?? '—'}% LEL · nguy hiểm {warn.danger ?? '—'}% LEL
        </p>
      )}
    </div>
  );
}

export function FireTable({ snapshot }: { snapshot: CheckpointSnapshot }) {
  return (
    <dl className={cn(boxClass, 'self-stretch')}>
      {snapshot.fire.map((f) => (
        <div key={f.id} className="flex items-center justify-between gap-3 border-b border-line-card px-4 py-2.5 text-sm last:border-b-0">
          <dt className="font-bold text-fg">{f.label}</dt>
          <dd className={cn('font-bold', f.ok ? 'text-success' : 'text-danger-text')}>{f.text}</dd>
        </div>
      ))}
    </dl>
  );
}

// ============================================================================
// PLC/SCADA + trạng thái cảm biến
// ============================================================================

export function PlcStatusCard({ snapshot }: { snapshot: CheckpointSnapshot }) {
  const p = snapshot.plc;
  const ok = (good: boolean, yes: string, no: string) => <span className={good ? 'text-success' : 'text-danger-text'}>{good ? yes : no}</span>;
  return (
    <dl className={cn(boxClass, 'flex flex-col gap-2.5 p-4')}>
      <Row label="PLC Heartbeat:">{ok(p.heartbeat, 'Bình thường', 'Mất tín hiệu')}</Row>
      <Row label="Communication:">{ok(p.connected, 'Đã kết nối', 'Mất kết nối')}</Row>
      <Row label="SCADA Connection:">{ok(p.scada, 'Bình thường', 'Mất kết nối')}</Row>
      <Row label="System Mode:">
        <span className="text-primary">{p.mode}</span>
      </Row>
      <Row label="E-Stop/Shutdown:">{ok(!p.estop, 'Không kích hoạt', 'Đang kích hoạt')}</Row>
      <div className="flex items-center justify-between gap-3 pt-1 text-xs font-semibold text-fg-secondary">
        <dt>Update Time:</dt>
        <dd className="tabular-nums">
          {p.updatedAt} ({p.delaySec}s delay)
        </dd>
      </div>
    </dl>
  );
}

export function SensorSummaryCard({ summary }: { summary: Record<SensorHealth, number> & { total: number } }) {
  const item = (label: string, value: number, tone?: string) => (
    <div className="flex items-center justify-between gap-3 text-sm">
      <dt className="font-semibold text-fg-secondary">{label}</dt>
      <dd className={cn('font-bold tabular-nums', tone ?? 'text-fg')}>{value}</dd>
    </div>
  );
  return (
    <dl className={cn(boxClass, 'grid content-start gap-x-6 gap-y-2.5 p-4 sm:grid-cols-2')}>
      {item('Tổng cảm biến:', summary.total)}
      {item('Bình thường:', summary.normal, 'text-success')}
      {item('Lỗi:', summary.fault, summary.fault ? 'text-danger-text' : undefined)}
      {item('Mất kết nối:', summary.lost, summary.lost ? 'text-danger-text' : undefined)}
      {item('Dữ liệu cũ:', summary.stale, summary.stale ? 'text-warning' : undefined)}
    </dl>
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
