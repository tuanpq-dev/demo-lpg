import { useMemo } from 'react';
import {
  Badge,
  BoltIcon,
  Card,
  CheckCircleIcon,
  DataTable,
  type DataTableColumn,
  DualTrendChart,
  type DualTrendSeries,
  GaugeIcon,
  KpiCard,
  type KpiTone,
  MetricListCard,
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
  trendTicks,
  type ParamReading,
  type ViewTone,
} from '@/features/operations/device';
import { cn } from '@/lib/cn';
import { DeviceMaintenanceCard, OperationLogCard, PlcSignalsCard, RelatedAlertsCard, textTone } from './DeviceSideCards';
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

/**
 * Máy hóa hơi (E-101A – ảnh `scratch/figma-ref/op-device-*.png`): 4 KPI · sơ đồ máy hóa hơi, xu hướng nhiệt độ/áp suất, bảng
 * 6 tham số · trạng thái nhanh (SCADA, cảnh báo nghiêm trọng, máy dự phòng, cảm biến lỗi, chế độ, bảo trì tiếp theo).
 */
export function VaporizerView({
  data,
  liveData,
  nowDate,
  liveStatus,
  alerts,
  alertsState,
  mt,
  maintenanceState,
}: DeviceViewProps<OperationDeviceMock>) {
  const now = nowDate.getTime();
  const live = !!liveData;
  const conn = connectionView(liveStatus);
  const run = vaporizerRun(data, liveData, now);
  const standbyRaw = liveData?.[data.standby.stateTag];
  const standbyRun = runState(standbyRaw, live, now);

  // Lịch sử đổi theo phút (không vẽ lại cả chuỗi mỗi giây).
  const minute = Math.floor(now / 60_000);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `minute` đại diện `now`
  const history = useMemo(() => deviceHistory(data, now), [data, minute]);

  const param = (id: DeviceParamId) => data.params.find((p) => p.id === id)!;
  const reading = (p: DeviceParam) => readParam(p, liveData?.[p.tag], live, now);
  const rows = data.params.map((p) => ({ param: p, reading: reading(p) }));
  const byId = (id: DeviceParamId) => rows.find((r) => r.param.id === id)!;

  const temp = byId(data.kpi.temperature);
  const pressure = byId(data.kpi.pressure);
  const efficiency = byId(data.kpi.efficiency);
  const lostCount = lostSensorCount(
    data.params.map((p) => p.tag),
    liveData,
    now,
  );
  const standby = standbyReadiness(standbyRun, standbyRaw);

  const tTrend = data.trend.temperature;
  const pTrend = data.trend.pressure;
  const tParam = param(tTrend.param);
  const pParam = param(pTrend.param);
  const tNow = byId(tTrend.param).reading;
  const pNow = byId(pTrend.param).reading;
  const points = trendPoints(data.trend.minutes, [
    { key: 'temperature', history: history[tParam.tag] ?? [], current: tNow.value },
    { key: 'pressure', history: history[pParam.tag] ?? [], current: pNow.value },
  ]);
  const series: readonly [DualTrendSeries, DualTrendSeries] = [
    {
      id: 'temperature',
      name: `Nhiệt độ (${tParam.unit})`,
      suffix: tParam.unit,
      color: 'accent',
      area: true,
      domain: tTrend.domain,
      threshold: tParam.limits.warn !== undefined ? { value: tParam.limits.warn, label: 'Ngưỡng nhiệt độ cao', color: 'danger-text' } : undefined,
    },
    {
      id: 'pressure',
      name: `Áp suất (${pParam.unit})`,
      suffix: ` ${pParam.unit}`,
      color: 'text-secondary',
      dashed: true,
      domain: pTrend.domain,
      threshold: pParam.limits.warn !== undefined ? { value: pParam.limits.warn, label: 'Ngưỡng áp suất cao', color: 'warning' } : undefined,
    },
  ];

  const columns: DataTableColumn<(typeof rows)[number]>[] = [
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

  const tempText = valueText(temp.reading, temp.param, temp.param.unit);
  const pressureText = valueText(pressure.reading, pressure.param, ` ${pressure.param.unit}`);

  return (
    <>
      {/* KPI */}
      <section aria-label="Chỉ số chính" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Nhiệt độ đầu ra"
          icon={<ThermometerIcon size={20} />}
          iconPosition="start"
          value={temp.reading.state === 'ok' ? temp.reading.value!.toFixed(temp.param.digits) : '—'}
          unit={temp.param.unit}
          signalLost={temp.reading.state === 'lost'}
          sub={temp.reading.state === 'ok' ? temp.reading.label : undefined}
          subTone={kpiTone(temp.reading.tone)}
        />
        <KpiCard
          label="Áp suất đầu ra"
          icon={<GaugeIcon size={20} />}
          iconPosition="start"
          value={pressure.reading.state === 'ok' ? pressure.reading.value!.toFixed(pressure.param.digits) : '—'}
          unit={pressure.param.unit}
          signalLost={pressure.reading.state === 'lost'}
          sub={pressure.reading.state === 'ok' ? pressure.reading.label : undefined}
          subTone={kpiTone(pressure.reading.tone)}
        />
        <KpiCard
          label="Hiệu suất hóa hơi"
          icon={<BoltIcon size={20} />}
          iconPosition="start"
          value={efficiency.reading.state === 'ok' ? efficiency.reading.value!.toFixed(efficiency.param.digits) : '—'}
          unit={efficiency.param.unit}
          signalLost={efficiency.reading.state === 'lost'}
          sub={efficiency.reading.state === 'ok' ? efficiency.reading.label : undefined}
          subTone={kpiTone(efficiency.reading.tone)}
        />
        <KpiCard
          label="Trạng thái thiết bị"
          icon={<CheckCircleIcon size={20} />}
          iconPosition="start"
          value={<span className={cn('text-xl', textTone[run.tone] === 'text-fg-secondary' ? 'text-fg' : textTone[run.tone])}>{run.label}</span>}
          sub={`${data.standby.id} ${standbyRun.short}`}
          subTone="muted"
        />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Cột trái */}
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Sơ đồ thiết bị" padding="none">
            <div role="region" aria-label="Sơ đồ thiết bị (cuộn ngang)" tabIndex={0} className="overflow-x-auto p-4">
              <VaporizerDiagram
                title={data.diagramTitle}
                temperature={{ text: tempText, tone: diagramTone(temp.reading) }}
                pressure={{ text: pressureText, tone: diagramTone(pressure.reading) }}
                label={`Sơ đồ ${data.name} ${data.id}: LPG lỏng vào bộ gia nhiệt và buồng hóa hơi, LPG khí ra. Nhiệt độ đầu ra ${tempText}, áp suất đầu ra ${pressureText}.`}
                className="min-w-[640px]"
              />
            </div>
          </Card>

          <Card
            title={`Xu hướng vận hành (${data.trend.minutes} phút)`}
            headerEnd={
              <ul aria-hidden="true" className="flex items-center gap-5 text-sm text-fg-secondary">
                <li className="flex items-center gap-2">
                  <span className="h-0.5 w-4 rounded-full bg-accent" />
                  {series[0].name}
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-0.5 w-4 rounded-full bg-fg-secondary" />
                  {series[1].name}
                </li>
              </ul>
            }
          >
            <div
              role="img"
              aria-label={`Xu hướng ${data.trend.minutes} phút: nhiệt độ đầu ra hiện ${valueText(tNow, tParam, ` ${tParam.unit}`)} (ngưỡng cao ${tParam.limits.warn ?? '—'} ${tParam.unit}), áp suất đầu ra hiện ${valueText(pNow, pParam, ` ${pParam.unit}`)} (ngưỡng cao ${pParam.limits.warn ?? '—'} ${pParam.unit}).`}
              className="h-[340px]"
            >
              <DualTrendChart data={points} series={series} xTicks={trendTicks(data.trend.minutes)} />
            </div>
          </Card>

          <Card title="Thông số vận hành chi tiết" padding="none">
            <DataTable
              label="Thông số vận hành chi tiết"
              columns={columns}
              rows={rows}
              getRowId={(r) => r.param.id}
              minWidth={720}
              density="compact"
            />
          </Card>
        </div>

        {/* Cột phải */}
        <aside aria-label="Trạng thái, cảnh báo, bảo trì và nhật ký" className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:flex xl:flex-col">
          <MetricListCard
            title="Trạng thái nhanh"
            headerVariant="divided"
            rows={[
              {
                id: 'scada',
                label: 'Kết nối SCADA',
                value: (
                  <StatusPill size="sm" tone={pillTone(conn.tone)}>
                    {conn.scada}
                  </StatusPill>
                ),
              },
              {
                id: 'critical',
                label: 'Cảnh báo nghiêm trọng',
                value: alertsState.status !== 'success' ? '—' : alerts.criticalOpen === 0 ? 'Không có' : String(alerts.criticalOpen),
                tone: alertsState.status !== 'success' ? 'default' : alerts.criticalOpen === 0 ? 'success' : 'danger',
              },
              {
                id: 'standby',
                label: `Thiết bị dự phòng (${data.standby.id})`,
                value: <span className={textTone[standby.tone] === 'text-fg-secondary' ? 'text-fg' : textTone[standby.tone]}>{standby.label}</span>,
              },
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
            ]}
          />
          <RelatedAlertsCard alerts={alerts} state={alertsState} query={data.id} />
          <DeviceMaintenanceCard mt={mt} state={maintenanceState} scope={data.maintenanceScope} deviceId={data.id} />
          <PlcSignalsCard
            signals={data.plcSignals}
            liveData={liveData}
            now={now}
            note="* Dữ liệu chỉ dùng để giám sát, không điều khiển thiết bị từ màn hình này."
          />
          <OperationLogCard log={data.log} now={nowDate} />
        </aside>
      </div>
    </>
  );
}
