import { useMemo } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { DEFAULT_OPERATION_DEVICE, operationDevicePath } from '@/app/assetRoutes';
import { RefreshButton } from '@/app/HeaderActions';
import { Page } from '@/app/Page';
import { Placeholder } from '@/app/Placeholder';
import {
  AlertItem,
  Badge,
  BoltIcon,
  Button,
  Card,
  CheckCircleIcon,
  CpuIcon,
  DataTable,
  type DataTableColumn,
  DualTrendChart,
  type DualTrendSeries,
  EventTimeline,
  GaugeIcon,
  Icon,
  InfoChip,
  InfoIcon,
  KpiCard,
  type KpiTone,
  MapPinIcon,
  MetricListCard,
  PageHeader,
  StatusDot,
  StatusPill,
  type StatusPillTone,
  type TagTone,
  ThermometerIcon,
  UserIcon,
  VaporizerDiagram,
  type DiagramReading,
} from '@/components';
import { deriveMaintenanceSummary } from '@/data/assetDetail';
import { useLiveStatus } from '@/data/live';
import { useMaintenance } from '@/data/maintenance';
import {
  type DeviceParam,
  type DeviceParamId,
  OPERATION_DEVICE_IDS,
  deriveDeviceAlerts,
  deriveDeviceMaintenance,
  deviceHistory,
  resolveOperationDeviceId,
  trendPoints,
  useOperationDevice,
} from '@/data/operationDevice';
import { SIGNAL_LOST_LABEL } from '@/features/live/signal';
import {
  connectionView,
  limitText,
  logTimeLabel,
  lostSensorCount,
  readParam,
  runState,
  standbyReadiness,
  trendTicks,
  type ParamReading,
  type ViewTone,
} from '@/features/operations/device';
import { cn } from '@/lib/cn';
import { useNow } from '@/lib/useNow';
import NotFoundPage from '../NotFoundPage';

const BREADCRUMB_BASE = [{ label: 'Vận hành' }, { label: 'Giám sát thiết bị' }];

const kpiTone = (t: ViewTone): KpiTone => (t === 'neutral' ? 'neutral' : t);
const pillTone = (t: ViewTone): StatusPillTone => t;
const tagTone = (t: ViewTone): TagTone => t;
const textTone: Record<ViewTone, string> = { success: 'text-success', warning: 'text-warning', danger: 'text-danger-text', neutral: 'text-fg-secondary' };
const diagramTone = (r: ParamReading): DiagramReading['tone'] =>
  r.state === 'lost' ? 'lost' : r.state === 'pending' ? 'pending' : r.status === 'danger' ? 'danger' : r.status === 'normal' ? 'normal' : 'warning';
const valueText = (r: ParamReading, p: Pick<DeviceParam, 'digits'>, suffix = '') =>
  r.state === 'ok' ? `${r.value!.toFixed(p.digits)}${suffix}` : r.state === 'lost' ? SIGNAL_LOST_LABEL : '—';

/**
 * Route `/operations/devices/:deviceId` (menu "Vận hành"): chuẩn hoá mã (`e-101a` → `E-101A`, giữ query) rồi tải trang;
 * mã lạ → "Không tìm thấy thiết bị".
 */
export default function DeviceDetailRoute() {
  const { deviceId: raw = '' } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const id = resolveOperationDeviceId(raw);
  if (!id) {
    return (
      <NotFoundPage
        title="Không tìm thấy thiết bị"
        breadcrumb={[...BREADCRUMB_BASE, { label: raw || '—' }]}
        message={`Chưa có trang giám sát cho "${raw}". Thiết bị đang có: ${OPERATION_DEVICE_IDS.join(', ')}.`}
        actions={<Button onClick={() => navigate(operationDevicePath(DEFAULT_OPERATION_DEVICE))}>Mở {DEFAULT_OPERATION_DEVICE}</Button>}
      />
    );
  }
  if (id !== raw) return <Navigate to={`${operationDevicePath(id)}${search}`} replace />;
  return <DeviceDetailPage deviceId={id} />;
}

/**
 * Chi tiết thiết bị – màn Vận hành (ảnh `scratch/figma-ref/op-device-*.png`, chưa có node Figma): header (tên / khu /
 * trạng thái / làm mới / PLC) · 4 KPI · trái: sơ đồ, xu hướng 60 phút, bảng thông số · phải: trạng thái nhanh, cảnh báo
 * liên quan, bảo trì, tín hiệu PLC/SCADA, nhật ký. Mọi số đo đọc tag trực tiếp (mất tín hiệu → xám, không số cũ);
 * cảnh báo / bảo trì từ store chung.
 */
function DeviceDetailPage({ deviceId }: { deviceId: string }) {
  const navigate = useNavigate();
  // Mỗi giây: cột "Cập nhật", mốc mất tín hiệu 10 s.
  const nowDate = useNow(1000);
  const now = nowDate.getTime();
  const { status, data, error, refetch, liveData, alerts } = useOperationDevice(deviceId);
  const maintenance = useMaintenance();
  const conn = connectionView(useLiveStatus());
  const live = !!liveData;

  const run = runState(data && liveData?.[data.stateTag], live, now);
  const standbyRaw = data && liveData?.[data.standby.stateTag];
  const standbyRun = runState(standbyRaw, live, now);

  // Lịch sử đổi theo phút (không vẽ lại cả chuỗi mỗi giây).
  const minute = Math.floor(now / 60_000);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `minute` đại diện `now`
  const history = useMemo(() => (data ? deviceHistory(data, now) : {}), [data, minute]);

  const header = (
    <PageHeader
      breadcrumb={[...BREADCRUMB_BASE, { label: `Chi tiết thiết bị - ${deviceId}` }]}
      title="Chi tiết thiết bị"
      // TODO: đổi sang `actionItems` (gom Tên/Khu vực/PLC vào "Thêm" < md) khi nhánh fix/header-mobile vào main.
      actions={
        <>
          {data && (
            <>
              <InfoChip icon={<InfoIcon size={16} />} label="Tên" value={data.name} />
              <InfoChip icon={<MapPinIcon />} label="Khu vực" value={data.area} />
              <StatusPill tone={pillTone(run.tone)}>Trạng thái: {run.label}</StatusPill>
            </>
          )}
          <RefreshButton accent onClick={refetch} />
          <InfoChip icon={<CpuIcon />} label="PLC" value={conn.plc} tone={conn.tone === 'neutral' ? 'muted' : conn.tone} />
        </>
      }
    />
  );

  if (status === 'error') {
    return (
      <Page pageHeader={header}>
        <Card title="Không tải được thiết bị" headerVariant="plain" tone="danger">
          <p className="mb-4 text-base text-fg-secondary">{error.message}</p>
          <div className="flex gap-2">
            <Button onClick={refetch}>Thử lại</Button>
            <Button onClick={() => navigate('/overview')}>Về Tổng quan</Button>
          </div>
        </Card>
      </Page>
    );
  }

  if (status === 'loading') {
    return (
      <Page pageHeader={header}>
        <div className="reveal-delayed flex flex-col gap-6">
          <Placeholder label="Đang tải…" height={120} />
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Placeholder label="Đang tải…" height={720} />
            <Placeholder label="Đang tải…" height={720} />
          </div>
        </div>
      </Page>
    );
  }

  const param = (id: DeviceParamId) => data.params.find((p) => p.id === id)!;
  const reading = (p: DeviceParam) => readParam(p, liveData?.[p.tag], live, now);
  const rows = data.params.map((p) => ({ param: p, reading: reading(p) }));
  const byId = (id: DeviceParamId) => rows.find((r) => r.param.id === id)!;

  const temp = byId(data.kpi.temperature);
  const pressure = byId(data.kpi.pressure);
  const efficiency = byId(data.kpi.efficiency);

  const deviceAlerts = deriveDeviceAlerts(alerts.data ?? [], data.relatedDevices, nowDate);
  const mt = deriveDeviceMaintenance(deriveMaintenanceSummary(maintenance.data ?? [], data.id, nowDate));
  const lostCount = lostSensorCount(data.params.map((p) => p.tag), liveData, now);
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
      cell: (r) => <span className={cn('text-base tabular-nums', r.reading.state === 'ok' ? 'text-accent' : 'text-fg-secondary')}>{valueText(r.reading, r.param)}</span>,
    },
    { id: 'unit', header: 'Đơn vị', align: 'start', width: '12%', className: 'text-base text-fg', cell: (r) => r.param.unit },
    { id: 'limit', header: 'Ngưỡng cảnh báo', align: 'start', width: '20%', className: 'text-base tabular-nums text-fg', cell: (r) => limitText(r.param.limits, r.param.limitDigits) },
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
  const signalOf = (tag: string) => {
    const p = data.params.find((x) => x.tag === tag);
    return p ? reading(p).state : 'pending';
  };

  return (
    <Page pageHeader={header}>
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
            <DataTable label="Thông số vận hành chi tiết" columns={columns} rows={rows} getRowId={(r) => r.param.id} minWidth={720} density="compact" />
          </Card>
        </div>

        {/* Cột phải */}
        <aside aria-label="Trạng thái, cảnh báo, bảo trì và nhật ký" className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:flex xl:flex-col">
          <MetricListCard
            title="Trạng thái nhanh"
            headerVariant="divided"
            rows={[
              { id: 'scada', label: 'Kết nối SCADA', value: <StatusPill size="sm" tone={pillTone(conn.tone)}>{conn.scada}</StatusPill> },
              {
                id: 'critical',
                label: 'Cảnh báo nghiêm trọng',
                value: alerts.status !== 'success' ? '—' : deviceAlerts.criticalOpen === 0 ? 'Không có' : String(deviceAlerts.criticalOpen),
                tone: alerts.status !== 'success' ? 'default' : deviceAlerts.criticalOpen === 0 ? 'success' : 'danger',
              },
              { id: 'standby', label: `Thiết bị dự phòng (${data.standby.id})`, value: <span className={textTone[standby.tone] === 'text-fg-secondary' ? 'text-fg' : textTone[standby.tone]}>{standby.label}</span> },
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
                value: maintenance.status !== 'success' ? '—' : <span className={mt.next.tone === 'neutral' ? 'text-accent' : textTone[mt.next.tone]}>{mt.next.text}</span>,
              },
            ]}
          />

          <Card
            title="Cảnh báo liên quan"
            headerVariant="divided"
            headerEnd={
              alerts.status === 'success' ? (
                <Badge variant="tag" tone="neutral">
                  {deviceAlerts.total} mục
                </Badge>
              ) : undefined
            }
            bodyClassName="gap-2"
          >
            {alerts.status !== 'success' ? (
              <p className="py-4 text-sm text-fg-secondary">{alerts.status === 'error' ? 'Không tải được cảnh báo.' : 'Đang tải…'}</p>
            ) : deviceAlerts.items.length ? (
              <ul className="flex flex-col gap-2">
                {deviceAlerts.items.map((a) => (
                  <li key={a.id}>
                    <AlertItem layout="bar" {...a} onClick={() => navigate(`/alerts?alert=${encodeURIComponent(a.id)}&range=30d`)} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-4 text-sm text-fg-secondary">Không có cảnh báo liên quan.</p>
            )}
            <Button variant="subtle" className="mt-2 w-full" onClick={() => navigate(`/alerts?q=${encodeURIComponent(data.id)}&range=30d`)}>
              Xem tất cả cảnh báo
            </Button>
          </Card>

          <Card
            title="Bảo trì"
            headerVariant="divided"
            headerEnd={maintenance.status === 'success' ? <StatusPill size="sm" tone={pillTone(mt.badge.tone)}>{mt.badge.label}</StatusPill> : undefined}
            bodyClassName="gap-3"
          >
            <dl className="flex flex-col gap-2 text-base">
              <div className="flex items-center gap-2">
                <UserIcon size={18} className="shrink-0 text-fg-secondary" />
                <dt className="text-fg-secondary">Kỹ thuật viên:</dt>
                <dd className="font-semibold text-fg">{maintenance.status === 'success' ? mt.technician : '—'}</dd>
              </div>
              <div className="flex items-center gap-2">
                <Icon name="calendar" box={18} />
                <dt className="text-fg-secondary">Lần bảo trì cuối:</dt>
                <dd className="font-semibold tabular-nums text-fg">{maintenance.status === 'success' ? mt.lastDate : '—'}</dd>
              </div>
            </dl>
            <div className="rounded-md border border-line/30 p-3">
              <p className="mb-1.5 text-sm text-fg-secondary">Hạng mục chi tiết:</p>
              <ul className="flex flex-col gap-1.5 pl-2 text-base text-fg" title="Phạm vi bảo dưỡng định kỳ – số tạm, chờ kế hoạch bảo trì từ hệ thống">
                {data.maintenanceScope.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <Button variant="subtle" className="w-full" onClick={() => navigate(`/maintenance?q=${encodeURIComponent(data.id)}`)}>
              Xem lịch sử bảo trì
            </Button>
          </Card>

          <Card title="Dữ liệu PLC/SCADA" headerVariant="divided" bodyClassName="gap-3">
            <ul aria-label="Tín hiệu PLC/SCADA" className="flex flex-col gap-2">
              {data.plcSignals.map((s) => {
                const st = signalOf(s.tag);
                const ok = st === 'ok';
                return (
                  <li key={s.id} className="flex items-center gap-3 rounded-md border border-line/30 bg-surface-muted/10 px-3 py-2">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-base text-fg">{s.label}</span>
                      <span className="truncate font-mono text-2xs text-fg-secondary">{s.address}</span>
                    </span>
                    <span className={cn('shrink-0 text-xs font-semibold', ok ? 'text-success' : 'text-fg-secondary')}>
                      {ok ? 'Trực tuyến' : st === 'lost' ? SIGNAL_LOST_LABEL : '—'}
                    </span>
                    <StatusDot status={ok ? 'live' : 'offline'} />
                  </li>
                );
              })}
            </ul>
            <p className="text-sm italic text-fg-secondary">* Dữ liệu chỉ dùng để giám sát, không điều khiển thiết bị từ màn hình này.</p>
          </Card>

          <Card title="Nhật ký vận hành" headerVariant="divided">
            <EventTimeline variant="schedule" events={data.log.map((l) => ({ id: l.id, title: l.text, time: logTimeLabel(l, nowDate) }))} />
          </Card>
        </aside>
      </div>
    </Page>
  );
}
