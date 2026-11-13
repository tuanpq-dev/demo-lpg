import type { ReactNode } from 'react';
import {
  AlertTriangleIcon,
  Badge,
  BroadcastIcon,
  Card,
  DataTable,
  type DataTableColumn,
  type DualTrendSeries,
  FlameIcon,
  KpiCard,
  type KpiTone,
  MetricListCard,
  type MetricRow,
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
import { readParam, type ViewTone } from '@/features/operations/device';
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
import { useMinuteMemo } from '@/hooks/useMinuteMemo';
import { DeviceLayout, DiagramCard, TrendCard, commonSide, criticalAlertsRow } from './DeviceLayout';
import { textTone } from './DeviceSideCards';
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
const linkState = (t: ViewTone, pending: boolean): DiagramLinkState =>
  pending ? 'pending' : t === 'success' ? 'ok' : t === 'danger' ? 'danger' : 'lost';

/** Trạng thái PLC (pill "Trạng thái" ở header: "Đang hoạt động"). */
export function plcHeaderStatus(data: PlcScadaDeviceMock, liveData: Readonly<Record<string, TagValue>> | undefined, now: number) {
  const live = !!liveData;
  return plcStatus(readStateTag(liveData?.[data.tags.heartbeat], live, now), readStateTag(liveData?.[data.tags.plcLink], live, now));
}

const COLUMNS: DataTableColumn<PlcRow>[] = [
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

type Live = Readonly<Record<string, TagValue>> | undefined;

/** Mọi trạng thái suy từ tag trực tiếp tại `now` (mất tín hiệu → xám, không số cũ). */
function plcModel(data: PlcScadaDeviceMock, liveData: Live, now: number) {
  const live = !!liveData;
  const t = data.tags;
  const state = (tag: string) => readStateTag(liveData?.[tag], live, now);
  const avail = tagAvailability(data.monitoredTags, liveData, now);
  const latency = readParam({ limits: { warn: data.limits.latency.warn }, okLabel: 'Tốt', okTone: 'success' }, liveData?.[t.latency], live, now);
  const sources = data.sources.map((s) => ({ id: s.id, label: s.label, icon: SOURCE_ICON[s.icon], state: sourceState(s.tags, liveData, now) }));
  return {
    live,
    plc: plcHeaderStatus(data, liveData, now),
    scada: scadaStatus(state(t.scadaLink)),
    avail,
    latency,
    historian: stateView(state(t.historian), HISTORIAN_VIEW),
    mode: stateView(state(t.mode), MODE_VIEW),
    heartbeat: stateView(state(t.heartbeat), HEARTBEAT_VIEW),
    rows: plcScadaRows({ tags: t, limits: data.limits, availability: avail }, liveData, now),
    sources,
    latencyText: latency.state === 'ok' ? `${latency.value!.toFixed(1)} giây` : latency.state === 'lost' ? SIGNAL_LOST_LABEL : '—',
    availText: avail ? `${avail.ok}/${avail.total}` : '—',
  };
}
type PlcModel = ReturnType<typeof plcModel>;

function PlcKpis({ data, m }: { data: PlcScadaDeviceMock; m: PlcModel }) {
  const { plc, scada, avail, latency } = m;
  const latencySub =
    latency.state !== 'ok' ? undefined : latency.status === 'normal' ? 'Trong ngưỡng chấp nhận' : `Vượt ngưỡng ${data.limits.latency.warn} giây`;
  return (
    <>
      <KpiCard
        label="Trạng thái PLC"
        value={<span className="text-2xl font-bold">{plc.label}</span>}
        sub={plc.tone === 'success' ? `${data.controller} ổn định` : plc.tone === 'danger' ? `${data.controller} mất kết nối` : undefined}
        subTone={plc.tone === 'success' ? 'success' : kpiTone(plc.tone)}
        reserveSub
      />
      <KpiCard
        label="Trạng thái SCADA"
        value={<span className="text-2xl font-bold">{scada.label}</span>}
        sub={scada.tone === 'success' ? 'Dữ liệu hiển thị bình thường' : scada.tone === 'danger' ? 'Mất kết nối SCADA' : undefined}
        subTone={scada.tone === 'success' ? 'muted' : kpiTone(scada.tone)}
        reserveSub
      />
      <KpiCard
        label="Tag khả dụng"
        value={m.availText}
        sub={!avail ? undefined : avail.lost === 0 ? 'Không có tag lỗi' : `${avail.lost} tag lỗi`}
        subTone={!avail ? 'muted' : avail.lost === 0 ? 'success' : 'warning'}
        reserveSub
      />
      <KpiCard
        label="Độ trễ dữ liệu"
        value={latency.state === 'ok' ? latency.value!.toFixed(1) : '—'}
        unit="giây"
        signalLost={latency.state === 'lost'}
        sub={latencySub}
        subTone={latency.status === 'normal' ? 'muted' : 'warning'}
        reserveSub
      />
    </>
  );
}

const historianClass = (t: RowTone) => (t === 'success' ? 'text-success' : t === 'warning' ? 'text-warning' : 'text-fg-secondary');

function plcQuickRows(
  data: PlcScadaDeviceMock,
  m: PlcModel,
  alerts: DeviceViewProps<PlcScadaDeviceMock>['alerts'],
  alertsState: DeviceViewProps<PlcScadaDeviceMock>['alertsState'],
): MetricRow[] {
  const { plc, scada, avail, historian, mode } = m;
  return [
    {
      id: 'plc',
      label: 'PLC',
      value: (
        <StatusPill size="sm" tone={plc.tone}>
          {plc.label}
        </StatusPill>
      ),
    },
    {
      id: 'scada',
      label: 'SCADA',
      value: <span className={cn('font-semibold', scada.tone === 'neutral' ? 'text-fg' : textTone[scada.tone])}>{scada.label}</span>,
    },
    criticalAlertsRow(alerts, alertsState, 'default'),
    { id: 'faults', label: 'Tag lỗi', value: avail ? avail.lost : '—', tone: avail?.lost ? 'warning' : 'default' },
    {
      id: 'sync',
      label: 'Đồng bộ dữ liệu',
      value: (
        <span className={cn('font-semibold', historianClass(historian.tone))}>{historian.tone === 'success' ? 'Ổn định' : historian.value}</span>
      ),
    },
    {
      id: 'mode',
      label: 'Chế độ vận hành',
      value:
        mode.tone === 'primary' ? (
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
  ];
}

/** Sơ đồ kết nối: nhóm thiết bị → PLC → SCADA/HMI; chưa có dữ liệu trực tiếp → đường "pending". */
function PlcDiagram({ data, m }: { data: PlcScadaDeviceMock; m: PlcModel }) {
  const { plc, scada, heartbeat, sources, availText, live } = m;
  const lost = sources.filter((s) => s.state === 'lost').map((s) => s.label);
  return (
    <PlcScadaDiagram
      sources={sources}
      controller={{
        title: 'PLC Siemens',
        model: data.controller.replace(/^Siemens\s*/, ''),
        subtitle: 'Bộ điều khiển trung tâm',
        state: linkState(plc.tone, !live),
      }}
      heartbeat={{ text: `Heartbeat: ${heartbeat.value}`, state: linkState(heartbeat.tone === 'primary' ? 'neutral' : heartbeat.tone, !live) }}
      scada={{ title: 'SCADA / HMI', subtitle: 'Giao diện giám sát', state: linkState(scada.tone, !live) }}
      link={{ text: `Kết nối: ${scada.tone === 'success' ? 'Active' : scada.label}`, state: linkState(scada.tone, !live) }}
      syncText={`Tag đồng bộ: ${availText}`}
      label={`Sơ đồ kết nối: ${sources.length} nhóm thiết bị gửi dữ liệu về PLC ${data.controller} (${plc.label}), PLC truyền dữ liệu sang SCADA/HMI (${scada.label}). Tag đồng bộ ${availText}.${lost.length ? ` Nhóm mất tín hiệu: ${lost.join(', ')}.` : ''}`}
    />
  );
}

/**
 * Hệ thống PLC/SCADA (Figma bản sao A88YJ2BRhICDDdeu2rtRg1 – 168:4689, dựng theo ảnh chụp): 4 KPI (PLC, SCADA, tag khả dụng,
 * độ trễ) · sơ đồ kết nối, xu hướng 60 phút (độ trễ + % tag khả dụng), bảng 9 thông số · trạng thái nhanh, cảnh báo liên quan,
 * bảo trì, dữ liệu PLC/SCADA, nhật ký. Mọi giá trị từ tag trực tiếp (mất tín hiệu → xám, không số cũ).
 */
export function PlcScadaView(props: DeviceViewProps<PlcScadaDeviceMock>) {
  const { data, liveData, nowDate, alerts, alertsState } = props;
  const now = nowDate.getTime();
  const m = plcModel(data, liveData, now);

  // Lịch sử đổi theo phút.
  const latencyHistory = useMinuteMemo((t) => plcLatencyHistory(data, t), now, [data]);
  const points = trendPoints(data.trend.minutes, [
    { key: 'latency', history: latencyHistory, current: m.latency.state === 'ok' ? m.latency.value : undefined },
    // Tag khả dụng: lịch sử giả lập 100 % (chưa có API lịch sử); điểm cuối = tính trực tiếp.
    { key: 'availability', history: Array.from({ length: data.trend.minutes + 1 }, () => 100), current: m.avail?.percent },
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

  return (
    <DeviceLayout
      kpis={<PlcKpis data={data} m={m} />}
      side={{
        ...commonSide(props),
        quick: <MetricListCard title="Trạng thái nhanh" headerVariant="divided" rows={plcQuickRows(data, m, alerts, alertsState)} />,
        alertsQuery: 'Mất tín hiệu',
        showNextMaintenance: true,
        signalsNote: 'Dữ liệu PLC/SCADA dùng để giám sát trạng thái kết nối và tính sẵn sàng của hệ thống.',
      }}
    >
      <DiagramCard title="Sơ đồ kết nối PLC/SCADA">
        <PlcDiagram data={data} m={m} />
      </DiagramCard>
      <TrendCard
        title={`Xu hướng trạng thái kết nối (${data.trend.minutes} phút)`}
        legend={[
          { label: series[0].name, swatch: 'accent' },
          { label: series[1].name, swatch: 'secondary' },
          { label: 'Ngưỡng', swatch: 'warning' },
        ]}
        label={`Xu hướng ${data.trend.minutes} phút: độ trễ dữ liệu hiện ${m.latencyText} (ngưỡng ${data.limits.latency.warn} giây), tag khả dụng ${m.avail ? `${m.avail.percent}%` : '—'}.`}
        heightClass="h-[220px]"
        points={points}
        series={series}
        minutes={data.trend.minutes}
      />
      <Card title="Thông số vận hành chi tiết" padding="none">
        <DataTable label="Thông số vận hành chi tiết" columns={COLUMNS} rows={m.rows} getRowId={(r) => r.id} minWidth={760} density="compact" />
      </Card>
    </DeviceLayout>
  );
}
