import type { ReactNode } from 'react';
import { unitSuffix, withUnit } from '@/lib/number';
import {
  Badge,
  BoltIcon,
  Card,
  CheckCircleIcon,
  DataTable,
  type DataTableColumn,
  type DualTrendSeries,
  GaugeIcon,
  KpiCard,
  type KpiTone,
  MetricListCard,
  type MetricRow,
  StatusPill,
  type StatusPillTone,
  type TagTone,
  ThermometerIcon,
  VaporizerDiagram,
  type DiagramReading,
} from '@/components';
import { type DeviceParam, type DeviceParamId, type OperationDeviceMock, deviceHistory, trendPoints } from '@/data/operationDevice';
import { SIGNAL_LOST_LABEL } from '@/features/live/signal';
import type { TagValue } from '@/features/live/types';
import {
  connectionView,
  limitText,
  lostSensorCount,
  readParam,
  runState,
  standbyReadiness,
  type ParamReading,
  type ViewTone,
} from '@/features/operations/device';
import { cn } from '@/lib/cn';
import { useMinuteMemo } from '@/hooks/useMinuteMemo';
import { DeviceLayout, DiagramCard, TrendCard, commonSide, criticalAlertsRow } from './DeviceLayout';
import { textTone } from './DeviceSideCards';
import type { DeviceViewProps } from './deviceView';

const kpiTone = (t: ViewTone): KpiTone => (t === 'neutral' ? 'neutral' : t);
const pillTone = (t: ViewTone): StatusPillTone => t;
const tagTone = (t: ViewTone): TagTone => t;
const diagramTone = (r: ParamReading): DiagramReading['tone'] =>
  r.state === 'lost' ? 'lost' : r.state === 'pending' ? 'pending' : r.status === 'danger' ? 'danger' : r.status === 'normal' ? 'normal' : 'warning';
const valueText = (r: ParamReading, p: Pick<DeviceParam, 'digits'>, suffix = '') =>
  r.state === 'ok' ? `${r.value!.toFixed(p.digits)}${suffix}` : r.state === 'lost' ? SIGNAL_LOST_LABEL : '—';

/** Trạng thái chạy của máy (pill "Trạng thái" ở header). */
export function vaporizerRun(data: OperationDeviceMock, liveData: Readonly<Record<string, TagValue>> | undefined, now: number) {
  return runState(liveData?.[data.stateTag], !!liveData, now);
}

type ParamRow = { param: DeviceParam; reading: ParamReading };

const COLUMNS: DataTableColumn<ParamRow>[] = [
  { id: 'label', header: 'Tham số', align: 'start', width: '22%', className: 'text-base text-fg', cell: (r) => r.param.label },
  {
    id: 'value',
    header: 'Giá trị hiện tại',
    align: 'start',
    width: '18%',
    cell: (r) => (
      <span className={cn('text-base tabular-nums', r.reading.state === 'ok' ? 'text-accent' : 'text-fg-secondary')}>
        {valueText(r.reading, r.param)}
      </span>
    ),
  },
  { id: 'unit', header: 'Đơn vị', align: 'start', width: '12%', className: 'text-base text-fg', cell: (r) => r.param.unit },
  {
    id: 'limit',
    header: 'Ngưỡng cảnh báo',
    align: 'start',
    width: '20%',
    className: 'text-base tabular-nums text-fg',
    cell: (r) => limitText(r.param.limits, r.param.limitDigits),
  },
  {
    id: 'status',
    header: 'Trạng thái',
    align: 'start',
    cell: (r) => (
      <Badge variant="tag" tone={tagTone(r.reading.tone)}>
        {r.reading.label}
      </Badge>
    ),
  },
  { id: 'updated', header: 'Cập nhật', align: 'end', className: 'text-sm tabular-nums text-fg-secondary', cell: (r) => r.reading.updated ?? '—' },
];

/** KPI số đo (nhiệt độ / áp suất / hiệu suất): số + đơn vị, "Mất tín hiệu" khi lost, nhãn trạng thái khi có số. */
function ParamKpi({ label, icon, row }: { label: string; icon: ReactNode; row: ParamRow }) {
  const { reading: r, param: p } = row;
  const ok = r.state === 'ok';
  return (
    <KpiCard
      label={label}
      icon={icon}
      iconPosition="start"
      value={ok ? r.value!.toFixed(p.digits) : '—'}
      unit={p.unit}
      signalLost={r.state === 'lost'}
      sub={ok ? r.label : undefined}
      subTone={kpiTone(r.tone)}
      reserveSub
    />
  );
}

/** Màu chữ theo tone; trung tính hiện màu chữ thường (không xám). */
const strongText = (t: ViewTone) => (textTone[t] === 'text-fg-secondary' ? 'text-fg' : textTone[t]);

/** Chuỗi xu hướng nhiệt độ + áp suất: điểm lịch sử (theo phút) + giá trị hiện tại, 2 trục và ngưỡng cao. */
function vaporizerTrend(data: OperationDeviceMock, history: Readonly<Record<string, readonly number[]>>, byId: (id: DeviceParamId) => ParamRow) {
  const t = byId(data.trend.temperature.param);
  const p = byId(data.trend.pressure.param);
  const points = trendPoints(data.trend.minutes, [
    { key: 'temperature', history: history[t.param.tag] ?? [], current: t.reading.value },
    { key: 'pressure', history: history[p.param.tag] ?? [], current: p.reading.value },
  ]);
  const series: readonly [DualTrendSeries, DualTrendSeries] = [
    {
      id: 'temperature',
      name: `Nhiệt độ (${t.param.unit})`,
      suffix: unitSuffix(t.param.unit),
      color: 'accent',
      area: true,
      domain: data.trend.temperature.domain,
      threshold: t.param.limits.warn !== undefined ? { value: t.param.limits.warn, label: 'Ngưỡng nhiệt độ cao', color: 'danger-text' } : undefined,
    },
    {
      id: 'pressure',
      name: `Áp suất (${p.param.unit})`,
      suffix: unitSuffix(p.param.unit),
      color: 'text-secondary',
      dashed: true,
      domain: data.trend.pressure.domain,
      threshold: p.param.limits.warn !== undefined ? { value: p.param.limits.warn, label: 'Ngưỡng áp suất cao', color: 'warning' } : undefined,
    },
  ];
  const now = (r: ParamRow) =>
    `${valueText(r.reading, r.param, unitSuffix(r.param.unit))} (ngưỡng cao ${r.param.limits.warn !== undefined ? withUnit(String(r.param.limits.warn), r.param.unit) : '—'})`;
  const label = `Xu hướng ${data.trend.minutes} phút: nhiệt độ đầu ra hiện ${now(t)}, áp suất đầu ra hiện ${now(p)}.`;
  return { points, series, label };
}

/**
 * Máy hóa hơi (E-101A – ảnh `scratch/figma-ref/op-device-*.png`): 4 KPI · sơ đồ máy hóa hơi, xu hướng nhiệt độ/áp suất, bảng
 * 6 tham số · trạng thái nhanh (SCADA, cảnh báo nghiêm trọng, máy dự phòng, cảm biến lỗi, chế độ, bảo trì tiếp theo).
 */
export function VaporizerView(props: DeviceViewProps<OperationDeviceMock>) {
  const { data, liveData, nowDate, liveStatus, alerts, alertsState, mt, maintenanceState } = props;
  const now = nowDate.getTime();
  const live = !!liveData;
  const run = vaporizerRun(data, liveData, now);
  const standbyRaw = liveData?.[data.standby.stateTag];
  const standbyRun = runState(standbyRaw, live, now);

  // Lịch sử đổi theo phút (không vẽ lại cả chuỗi mỗi giây).
  const history = useMinuteMemo((t) => deviceHistory(data, t), now, [data]);

  const rows: ParamRow[] = data.params.map((p) => ({ param: p, reading: readParam(p, liveData?.[p.tag], live, now) }));
  const byId = (id: DeviceParamId) => rows.find((r) => r.param.id === id)!;
  const temp = byId(data.kpi.temperature);
  const pressure = byId(data.kpi.pressure);
  const trend = vaporizerTrend(data, history, byId);
  const tempText = valueText(temp.reading, temp.param, unitSuffix(temp.param.unit));
  const pressureText = valueText(pressure.reading, pressure.param, unitSuffix(pressure.param.unit));

  const conn = connectionView(liveStatus);
  const standby = standbyReadiness(standbyRun, standbyRaw);
  const lostCount = lostSensorCount(
    data.params.map((p) => p.tag),
    liveData,
    now,
  );
  const quickRows: MetricRow[] = [
    {
      id: 'scada',
      label: 'Kết nối SCADA',
      value: (
        <StatusPill size="sm" tone={pillTone(conn.tone)}>
          {conn.scada}
        </StatusPill>
      ),
    },
    criticalAlertsRow(alerts, alertsState, 'success'),
    { id: 'standby', label: `Thiết bị dự phòng (${data.standby.id})`, value: <span className={strongText(standby.tone)}>{standby.label}</span> },
    { id: 'lost', label: 'Cảm biến lỗi', value: lostCount ?? '—', tone: lostCount ? 'warning' : 'default' },
    {
      id: 'mode',
      label: 'Chế độ vận hành',
      value: (
        <span title={data.controlMode.note}>
          <Badge variant="tag" tone="primary" size="md">
            {data.controlMode.value}
          </Badge>
          <span className="sr-only"> ({data.controlMode.note})</span>
        </span>
      ),
    },
    {
      id: 'next-mt',
      label: 'Bảo trì tiếp theo',
      separated: true,
      value:
        maintenanceState.status !== 'success' ? (
          '—'
        ) : (
          <span className={mt.next.tone === 'neutral' ? 'text-accent' : textTone[mt.next.tone]}>{mt.next.text}</span>
        ),
    },
  ];

  return (
    <DeviceLayout
      kpis={
        <>
          <ParamKpi label="Nhiệt độ đầu ra" icon={<ThermometerIcon size={20} />} row={temp} />
          <ParamKpi label="Áp suất đầu ra" icon={<GaugeIcon size={20} />} row={pressure} />
          <ParamKpi label="Hiệu suất hóa hơi" icon={<BoltIcon size={20} />} row={byId(data.kpi.efficiency)} />
          <KpiCard
            label="Trạng thái thiết bị"
            icon={<CheckCircleIcon size={20} />}
            iconPosition="start"
            value={<span className={cn('text-xl', strongText(run.tone))}>{run.label}</span>}
            sub={`${data.standby.id} ${standbyRun.short}`}
            subTone="muted"
          />
        </>
      }
      side={{
        ...commonSide(props),
        quick: <MetricListCard title="Trạng thái nhanh" headerVariant="divided" rows={quickRows} />,
        alertsQuery: data.id,
        signalsNote: '* Dữ liệu chỉ dùng để giám sát, không điều khiển thiết bị từ màn hình này.',
      }}
    >
      <DiagramCard title="Sơ đồ thiết bị">
        <VaporizerDiagram
          title={data.diagramTitle}
          temperature={{ text: tempText, tone: diagramTone(temp.reading) }}
          pressure={{ text: pressureText, tone: diagramTone(pressure.reading) }}
          label={`Sơ đồ ${data.name} ${data.id}: LPG lỏng vào bộ gia nhiệt và buồng hóa hơi, LPG khí ra. Nhiệt độ đầu ra ${tempText}, áp suất đầu ra ${pressureText}.`}
          className="min-w-[640px]"
        />
      </DiagramCard>
      <TrendCard
        title={`Xu hướng vận hành (${data.trend.minutes} phút)`}
        legend={[
          { label: trend.series[0].name, swatch: 'accent' },
          { label: trend.series[1].name, swatch: 'secondary' },
        ]}
        label={trend.label}
        heightClass="h-[340px]"
        points={trend.points}
        series={trend.series}
        minutes={data.trend.minutes}
      />
      <Card title="Thông số vận hành chi tiết" padding="none">
        <DataTable label="Thông số vận hành chi tiết" columns={COLUMNS} rows={rows} getRowId={(r) => r.param.id} minWidth={720} density="compact" />
      </Card>
    </DeviceLayout>
  );
}
