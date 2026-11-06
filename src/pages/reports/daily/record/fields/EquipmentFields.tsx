import { Badge } from '@/components';
import { SENSOR_HEALTH_LABEL, effectiveValue, formatRecordValue, valueState, valueStateLabel, type FlowLine, type RecordReading, type SensorHealth, type VaporizerUnit } from '@/features/reports';
import { cn } from '@/lib/cn';
import { ManualInput, ReadingRow, Row, STATE_TEXT, boxClass, sensorText, type ManualProps } from './recordParts';

/** Máy hóa hơi: thẻ theo máy (đang hoạt động / dự phòng), số đo + cảm biến kém nhất. */
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

/** Điều áp: thẻ theo số đo (ô nhập khi IoT mất) + trạng thái cảm biến. */
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

/** Lưu lượng – đường cấp: thẻ theo đường, số đo + cảm biến. */
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
