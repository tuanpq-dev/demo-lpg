import { useMemo, type ReactNode } from 'react';
import {
  AlertTriangleIcon,
  Badge,
  BroadcastIcon,
  Card,
  DataTable,
  type DataTableColumn,
  DualTrendChart,
  type DualTrendSeries,
  FlameIcon,
  KpiCard,
  type KpiTone,
  MetricListCard,
  NetworkIcon,
  PipeLineIcon,
  PlcScadaDiagram,
  type DiagramLinkState,
  SlidersIcon,
  StatusPill,
  type TagTone,
} from '@/components';
import { plcLatencyHistory, trendPoints, type PlcScadaDeviceMock, type PlcSourceIcon } from '@/data/operationDevice';
import { SIGNAL_LOST_LABEL } from '@/features/live/signal';
import type { TagValue } from '@/features/live/types';
import { readParam, trendTicks, type ViewTone } from '@/features/operations/device';
import {
  HEARTBEAT_VIEW,
  HISTORIAN_VIEW,
  MODE_VIEW,
  plcScadaRows,
  plcStatus,
  readStateTag,
  scadaStatus,
  sourceState,
  stateView,
  tagAvailability,
  uptimeText,
  type PlcRow,
  type RowTone,
} from '@/features/operations/plcScada';
import { cn } from '@/lib/cn';
import { DeviceMaintenanceCard, OperationLogCard, PlcSignalsCard, RelatedAlertsCard, textTone } from './DeviceSideCards';
import type { DeviceViewProps } from './deviceView';

const SOURCE_ICON: Record<PlcSourceIcon, ReactNode> = {
  tank: <BroadcastIcon size={16} />,
  vaporizer: <NetworkIcon size={16} />,
  regulator: <SlidersIcon size={16} />,
  line: <PipeLineIcon size={16} />,
  gas: <AlertTriangleIcon size={16} />,
  fire: <FlameIcon size={16} />,
};

const kpiTone = (t: ViewTone): KpiTone => (t === 'neutral' ? 'neutral' : t);
const tagTone = (t: RowTone): TagTone => t;
const linkState = (t: ViewTone, pending: boolean): DiagramLinkState => (pending ? 'pending' : t === 'success' ? 'ok' : t === 'danger' ? 'danger' : 'lost');

/** Trạng thái PLC (pill "Trạng thái" ở header: "Đang hoạt động"). */
export function plcHeaderStatus(data: PlcScadaDeviceMock, liveData: Readonly<Record<string, TagValue>> | undefined, now: number) {
  const live = !!liveData;
  return plcStatus(readStateTag(liveData?.[data.tags.heartbeat], live, now), readStateTag(liveData?.[data.tags.plcLink], live, now));
}

/**
 * Hệ thống PLC/SCADA (Figma bản sao A88YJ2BRhICDDdeu2rtRg1 – 168:4689, dựng theo ảnh chụp): 4 KPI (PLC, SCADA, tag khả dụng,
 * độ trễ) · sơ đồ kết nối, xu hướng 60 phút (độ trễ + % tag khả dụng), bảng 9 thông số · trạng thái nhanh, cảnh báo liên quan,
 * bảo trì, dữ liệu PLC/SCADA, nhật ký. Mọi giá trị từ tag trực tiếp (mất tín hiệu → xám, không số cũ).
 */
export function PlcScadaView({ data, liveData, nowDate, alerts, alertsState, mt, maintenanceState }: DeviceViewProps<PlcScadaDeviceMock>) {
  const now = nowDate.getTime();
  const live = !!liveData;
  const t = data.tags;

  const plc = plcHeaderStatus(data, liveData, now);
  const scadaRead = readStateTag(liveData?.[t.scadaLink], live, now);
  const scada = scadaStatus(scadaRead);
  const avail = tagAvailability(data.monitoredTags, liveData, now);
  const latency = readParam({ limits: { warn: data.limits.latency.warn }, okLabel: 'Tốt', okTone: 'success' }, liveData?.[t.latency], live, now);
  const historian = stateView(readStateTag(liveData?.[t.historian], live, now), HISTORIAN_VIEW);
  const mode = stateView(readStateTag(liveData?.[t.mode], live, now), MODE_VIEW);
  const heartbeat = stateView(readStateTag(liveData?.[t.heartbeat], live, now), HEARTBEAT_VIEW);
  const rows = plcScadaRows({ tags: t, limits: data.limits, availability: avail }, liveData, now);

  // Lịch sử đổi theo phút.
  const minute = Math.floor(now / 60_000);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `minute` đại diện `now`
  const latencyHistory = useMemo(() => plcLatencyHistory(data, now), [data, minute]);
  const points = trendPoints(data.trend.minutes, [
    { key: 'latency', history: latencyHistory, current: latency.state === 'ok' ? latency.value : undefined },
    // Tag khả dụng: lịch sử giả lập 100 % (chưa có API lịch sử); điểm cuối = tính trực tiếp.
    { key: 'availability', history: Array.from({ length: data.trend.minutes + 1 }, () => 100), current: avail?.percent },
  ]);
  const series: readonly [DualTrendSeries, DualTrendSeries] = [
    {
      id: 'latency',
      name: 'Độ trễ (s)',
      suffix: ' s',
      color: 'accent',
      domain: data.trend.latency.domain,
      threshold: { value: data.limits.latency.warn, label: 'Ngưỡng', color: 'warning' },
    },
    { id: 'availability', name: 'Tag khả dụng (%)', suffix: '%', color: 'text-secondary', domain: [0, 104] },
  ];

  const latencyText = latency.state === 'ok' ? `${latency.value!.toFixed(1)} giây` : latency.state === 'lost' ? SIGNAL_LOST_LABEL : '—';
  const availText = avail ? `${avail.ok}/${avail.total}` : '—';

  const columns: DataTableColumn<PlcRow>[] = [
    { id: 'label', header: 'Thông số', align: 'start', width: '20%', className: 'text-base text-fg', cell: (r) => r.label },
    {
      id: 'value',
      header: 'Giá trị hiện tại',
      align: 'start',
      width: '18%',
      cell: (r) => <span className={cn('text-base tabular-nums', r.valueOk ? 'text-accent' : 'text-fg-secondary')}>{r.value}</span>,
    },
    { id: 'unit', header: 'Đơn vị', align: 'start', width: '12%', className: 'text-base text-fg', cell: (r) => r.unit },
    { id: 'alarm', header: 'Ngưỡng cảnh báo', align: 'start', width: '20%', className: 'text-base text-fg-secondary', cell: (r) => r.alarm },
    {
      id: 'status',
      header: 'Trạng thái',
      align: 'start',
      cell: (r) => (
        <Badge variant="tag" tone={tagTone(r.tone)}>
          {r.status}
        </Badge>
      ),
    },
    { id: 'updated', header: 'Cập nhật', align: 'end', className: 'text-sm tabular-nums text-fg-secondary', cell: (r) => r.updated ?? '—' },
  ];

  const sources = data.sources.map((s) => ({ id: s.id, label: s.label, icon: SOURCE_ICON[s.icon], state: sourceState(s.tags, liveData, now) }));
  const lostSources = sources.filter((s) => s.state === 'lost').map((s) => s.label);

  return (
    <>
      {/* KPI (ảnh: không icon) */}
      <section aria-label="Chỉ số chính" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Trạng thái PLC"
          value={<span className="text-2xl font-bold">{plc.label}</span>}
          sub={plc.tone === 'success' ? `${data.controller} ổn định` : plc.tone === 'danger' ? `${data.controller} mất kết nối` : undefined}
          subTone={plc.tone === 'success' ? 'success' : kpiTone(plc.tone)}
        />
        <KpiCard
          label="Trạng thái SCADA"
          value={<span className="text-2xl font-bold">{scada.label}</span>}
          sub={scada.tone === 'success' ? 'Dữ liệu hiển thị bình thường' : scada.tone === 'danger' ? 'Mất kết nối SCADA' : undefined}
          subTone={scada.tone === 'success' ? 'muted' : kpiTone(scada.tone)}
        />
        <KpiCard
          label="Tag khả dụng"
          value={availText}
          sub={!avail ? undefined : avail.lost === 0 ? 'Không có tag lỗi' : `${avail.lost} tag lỗi`}
          subTone={!avail ? 'muted' : avail.lost === 0 ? 'success' : 'warning'}
        />
        <KpiCard
          label="Độ trễ dữ liệu"
          value={latency.state === 'ok' ? latency.value!.toFixed(1) : '—'}
          unit="giây"
          signalLost={latency.state === 'lost'}
          sub={latency.state !== 'ok' ? undefined : latency.status === 'normal' ? 'Trong ngưỡng chấp nhận' : `Vượt ngưỡng ${data.limits.latency.warn} giây`}
          subTone={latency.status === 'normal' ? 'muted' : 'warning'}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Cột trái */}
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Sơ đồ kết nối PLC/SCADA" padding="none">
            <div role="region" aria-label="Sơ đồ kết nối PLC/SCADA (cuộn ngang)" tabIndex={0} className="overflow-x-auto p-4">
              <PlcScadaDiagram
                sources={sources}
                controller={{ title: 'PLC Siemens', model: data.controller.replace(/^Siemens\s*/, ''), subtitle: 'Bộ điều khiển trung tâm', state: linkState(plc.tone, !live) }}
                heartbeat={{ text: `Heartbeat: ${heartbeat.value}`, state: linkState(heartbeat.tone === 'primary' ? 'neutral' : heartbeat.tone, !live) }}
                scada={{ title: 'SCADA / HMI', subtitle: 'Giao diện giám sát', state: linkState(scada.tone, !live) }}
                link={{ text: `Kết nối: ${scada.tone === 'success' ? 'Active' : scada.label}`, state: linkState(scada.tone, !live) }}
                syncText={`Tag đồng bộ: ${availText}`}
                label={`Sơ đồ kết nối: ${sources.length} nhóm thiết bị gửi dữ liệu về PLC ${data.controller} (${plc.label}), PLC truyền dữ liệu sang SCADA/HMI (${scada.label}). Tag đồng bộ ${availText}.${lostSources.length ? ` Nhóm mất tín hiệu: ${lostSources.join(', ')}.` : ''}`}
              />
            </div>
          </Card>

          <Card
            title={`Xu hướng trạng thái kết nối (${data.trend.minutes} phút)`}
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
                <li className="flex items-center gap-2">
                  <span className="h-0.5 w-4 rounded-full bg-warning" />
                  Ngưỡng
                </li>
              </ul>
            }
          >
            <div
              role="img"
              aria-label={`Xu hướng ${data.trend.minutes} phút: độ trễ dữ liệu hiện ${latencyText} (ngưỡng ${data.limits.latency.warn} giây), tag khả dụng ${avail ? `${avail.percent}%` : '—'}.`}
              className="h-[220px]"
            >
              <DualTrendChart data={points} series={series} xTicks={trendTicks(data.trend.minutes)} />
            </div>
          </Card>

          <Card title="Thông số vận hành chi tiết" padding="none">
            <DataTable label="Thông số vận hành chi tiết" columns={columns} rows={rows} getRowId={(r) => r.id} minWidth={760} density="compact" />
          </Card>
        </div>

        {/* Cột phải */}
        <aside aria-label="Trạng thái, cảnh báo, bảo trì và nhật ký" className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:flex xl:flex-col">
          <MetricListCard
            title="Trạng thái nhanh"
            headerVariant="divided"
            rows={[
              { id: 'plc', label: 'PLC', value: <StatusPill size="sm" tone={plc.tone}>{plc.label}</StatusPill> },
              { id: 'scada', label: 'SCADA', value: <span className={cn('font-semibold', scada.tone === 'neutral' ? 'text-fg' : textTone[scada.tone])}>{scada.label}</span> },
              {
                id: 'critical',
                label: 'Cảnh báo nghiêm trọng',
                value: alertsState.status !== 'success' ? '—' : alerts.criticalOpen === 0 ? 'Không có' : String(alerts.criticalOpen),
                tone: alertsState.status !== 'success' ? 'default' : alerts.criticalOpen === 0 ? 'default' : 'danger',
              },
              { id: 'faults', label: 'Tag lỗi', value: avail ? avail.lost : '—', tone: avail?.lost ? 'warning' : 'default' },
              {
                id: 'sync',
                label: 'Đồng bộ dữ liệu',
                value: (
                  <span className={cn('font-semibold', historian.tone === 'success' ? 'text-success' : historian.tone === 'warning' ? 'text-warning' : 'text-fg-secondary')}>
                    {historian.tone === 'success' ? 'Ổn định' : historian.value}
                  </span>
                ),
              },
              {
                id: 'mode',
                label: 'Chế độ vận hành',
                value: mode.tone === 'primary' ? (
                  <Badge variant="tag" tone="primary" size="md">
                    {mode.value}
                  </Badge>
                ) : (
                  <span className="text-fg-secondary">{mode.value}</span>
                ),
              },
              {
                id: 'uptime',
                label: 'Thời gian hoạt động liên tục',
                separated: true,
                value: (
                  <span className="font-semibold text-accent" title="Số tạm – chờ tag thời gian chạy (uptime) của PLC">
                    {uptimeText(data.runningSinceMinutes)}
                  </span>
                ),
              },
            ]}
          />
          <RelatedAlertsCard alerts={alerts} state={alertsState} query="Mất tín hiệu" />
          <DeviceMaintenanceCard mt={mt} state={maintenanceState} scope={data.maintenanceScope} deviceId={data.id} showNext />
          <PlcSignalsCard signals={data.plcSignals} liveData={liveData} now={now} note="Dữ liệu PLC/SCADA dùng để giám sát trạng thái kết nối và tính sẵn sàng của hệ thống." />
          <OperationLogCard log={data.log} now={nowDate} />
        </aside>
      </div>
    </>
  );
}
