import {
  effectiveValue,
  findReading,
  formatRecordValue,
  valueState,
  valueStateLabel,
  type CheckpointSnapshot,
  type ManualValues,
  type SensorHealth,
} from '@/features/reports';
import { cn } from '@/lib/cn';
import { Row, STATE_TEXT, boxClass } from './recordParts';

/** Cảm biến rò rỉ LPG: % LEL theo đầu dò + ngưỡng PLC. */
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

/** Hệ thống báo cháy: trạng thái từng tín hiệu. */
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

/** PLC và SCADA: heartbeat, kết nối, chế độ, E-Stop, thời gian cập nhật. */
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

/** Trạng thái cảm biến: tổng / bình thường / lỗi / mất kết nối / dữ liệu cũ. */
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
