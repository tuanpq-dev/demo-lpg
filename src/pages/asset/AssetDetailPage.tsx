import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AssetModelPanel } from '@/app/AssetModelPanel';
import { DEFAULT_ASSET_ID, assetPath } from '@/app/assetRoutes';
import { useCan } from '@/app/auth';
import { ClockButton, LiveDataButton } from '@/app/HeaderActions';
import { Page } from '@/app/Page';
import { Placeholder } from '@/app/Placeholder';
import { useTableFilters } from '@/app/useTableFilters';
import { assetV101Image, plantMapImage } from '@/assets/digital-twin';
import {
  AlertItem,
  Button,
  Card,
  CloseIcon,
  DataTable,
  type DataTableColumn,
  DonutGauge,
  HistoryIcon,
  Icon,
  KpiCard,
  type KpiTone,
  MaintenanceSummaryCard,
  MapIcon,
  PageHeader,
  StatusPill,
  type StatusPillTone,
  TankCutawayDiagram,
  TankLayerList,
  type TankLayerItem,
} from '@/components';
import { useAlerts } from '@/data/alerts';
import {
  type AssetEvent,
  type AssetEventType,
  EVENT_PARAMS,
  EVENT_STATUS_LABEL,
  EVENT_TYPE_META,
  EVENT_TYPES,
  type Reading,
  STATUS_LABEL,
  WATER_STATUS_LABEL,
  ASSET_IDS,
  deriveMaintenanceSummary,
  deriveRelatedAlerts,
  newestEventFirst,
  parseHiddenTypes,
  resolveAssetId,
  toggleHiddenType,
  useAssetDetail,
} from '@/data/assetDetail';
import { setDeviceDirectory, useMaintenance } from '@/data/maintenance';
import { SIGNAL_LOST_LABEL } from '@/features/live/signal';
import { levelPercentToVolumePercent } from '@/features/tank/volume';
import { announce } from '@/lib/announce';
import { cn } from '@/lib/cn';
import { useNow } from '@/lib/useNow';
import { CreateMaintenanceModal } from '../maintenance/CreateMaintenanceModal';
import NotFoundPage from '../NotFoundPage';

/** Ảnh tĩnh dự phòng theo tài sản (chụp từ cảnh 3D riêng). */
const FALLBACK_IMAGE: Record<string, string> = { 'V-101': assetV101Image };

/** Định nghĩa hiển thị ở tooltip KPI "Mức bồn" (khác dòng "LPG lỏng"). */
const LEVEL_HINT = 'Mức bồn = % thể tích toàn bộ chất lỏng (LPG lỏng + nước đáy), quy đổi từ mức chiều cao theo hình học bồn trụ nằm; chờ bảng dung tích thật.';

/** Màu chữ theo loại sự kiện (chú thích + cột "Loại"). */
const EVENT_TONE: Record<AssetEventType, { text: string; dot: string }> = {
  sensor: { text: 'text-info', dot: 'bg-info' },
  operation: { text: 'text-warning', dot: 'bg-warning' },
  system: { text: 'text-fg-secondary', dot: 'bg-fg-secondary' },
  alert: { text: 'text-danger', dot: 'bg-danger' },
};

const statusTone = (s: string): StatusPillTone => (s === 'danger' ? 'danger' : s === 'warning' ? 'warning' : s === 'normal' ? 'success' : 'neutral');
const kpiTone = (r: Reading): KpiTone => (r.status === 'danger' ? 'danger' : r.status === 'warning' ? 'warning' : 'neutral');
const fixed = (v: number, d = 1) => v.toFixed(d);
const readingText = (r: Reading, digits: number, unit: string) =>
  r.state === 'ok' ? `${fixed(r.value!, digits)}${unit}` : r.state === 'lost' ? SIGNAL_LOST_LABEL : '—';

const getEventId = (e: AssetEvent) => e.id;
const matchEvent = (e: AssetEvent, v: { hide: string | null }) => !parseHiddenTypes(v.hide).includes(e.type);
const sortEvents = (a: AssetEvent, b: AssetEvent) => newestEventFirst(a, b);
const EVENT_ROWS = 5;

/**
 * Route `/map/:assetId` (tab "Bản đồ nội khu"; `/map` mở V-101): chuẩn hoá mã trước khi tải trang.
 * - khác kiểu chữ (`/map/v-101`) → chuyển sang mã chuẩn `/map/V-101` (giữ query);
 * - không có trang → "Không tìm thấy tài sản".
 */
export default function AssetDetailRoute() {
  const { assetId: raw = '' } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const id = resolveAssetId(raw);
  if (!id) {
    return (
      <NotFoundPage
        title="Không tìm thấy tài sản"
        breadcrumb={[{ label: 'Bản đồ nội khu' }, { label: raw || '—' }]}
        message={
          <>
            Không có tài sản <code className="font-mono text-fg">{raw}</code>. Tài sản có trang chi tiết: {ASSET_IDS.join(', ')}.
          </>
        }
        actions={<Button onClick={() => navigate(assetPath(DEFAULT_ASSET_ID))}>Mở {DEFAULT_ASSET_ID}</Button>}
      />
    );
  }
  if (id !== raw) return <Navigate to={`${assetPath(id)}${search}`} replace />;
  return <AssetDetailPage assetId={id} />;
}

/**
 * Chi tiết tài sản (GĐ 5D) – `/map/:assetId`, theo ảnh "Bồn LPG V-101" (chưa có node Figma).
 * 3 cột (≈ 1,5 : 2,85 : 272px theo ảnh) + hàng sự kiện. Số đo qua useLiveData (Mất tín hiệu khi stale); ba lớp
 * trong bồn tính từ 2 mức chiều cao + kích thước bồn (features/tank/layers).
 */
function AssetDetailPage({ assetId }: { assetId: string }) {
  const navigate = useNavigate();
  const now = useNow(60_000);
  const { status, data, error, refetch, live, liveData } = useAssetDetail(assetId);
  const alerts = useAlerts();
  const maintenance = useMaintenance();
  const canWrite = useCan('maintenance:write');
  const [created, setCreated] = useState<{ id: string; code: string } | null>(null);

  const events = useTableFilters({
    rows: data?.events ?? [],
    getId: getEventId,
    params: EVENT_PARAMS,
    match: matchEvent,
    sort: sortEvents,
    pageSize: EVENT_ROWS,
  });
  const hidden = parseHiddenTypes(events.values.hide);

  // Modal tạo yêu cầu mở qua URL (?create=1) như /maintenance; thiết bị điền sẵn = tài sản.
  const createOpen = canWrite && events.search.get('create') === '1';
  const devices = useMemo(() => setDeviceDirectory(maintenance.data ?? [], alerts.data ?? []), [maintenance.data, alerts.data]);

  useEffect(() => {
    if (!created) return;
    const t = window.setTimeout(() => setCreated(null), 8000);
    return () => window.clearTimeout(t);
  }, [created]);

  const header = (
    <PageHeader
      breadcrumb={[{ label: 'Bản đồ nội khu' }, { label: data?.area ?? '…' }]}
      title={data?.name ?? assetId}
      actions={
        <>
          {data && <StatusPill tone={data.systemStatus.tone}>{data.systemStatus.label}</StatusPill>}
          <ClockButton />
          <LiveDataButton />
          <Button icon={<MapIcon size={16} />} onClick={() => navigate(`/overview?map=3d&focus=${encodeURIComponent(assetId)}`)}>
            Xem trên bản đồ
          </Button>
          {/* q (không phải device): khớp cả cảnh báo của tag/van an toàn thuộc bồn, giống thẻ "Cảnh báo liên quan". */}
          <Button icon={<HistoryIcon size={16} />} onClick={() => navigate(`/alerts?q=${encodeURIComponent(assetId)}&range=30d`)}>
            Lịch sử cảnh báo
          </Button>
          {canWrite && (
            <Button variant="primary" icon={<Icon name="add" />} onClick={() => events.setExtra({ create: '1' })} disabled={!data}>
              Tạo yêu cầu bảo trì
            </Button>
          )}
        </>
      }
    />
  );

  if (status === 'error') {
    return (
      <Page pageHeader={header}>
        <Card title="Không tải được tài sản" headerVariant="plain" tone="danger">
          <p className="mb-4 text-base text-fg-secondary">{error.message}</p>
          <div className="flex gap-2">
            <Button onClick={refetch}>Thử lại</Button>
            <Button onClick={() => navigate('/overview')}>Về Tổng quan</Button>
          </div>
        </Card>
      </Page>
    );
  }

  if (status === 'loading' || !live) {
    return (
      <Page pageHeader={header}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,2.85fr)_272px]">
          <Placeholder label="Đang tải…" height={688} />
          <Placeholder label="Đang tải…" height={688} />
          <Placeholder label="Đang tải…" height={688} />
        </div>
      </Page>
    );
  }

  const { level, pressure, temperature, layers, layersState, waterStatus, storageStatus } = live;
  const ph = data.placeholders;
  const liquidPct = level.state === 'ok' ? levelPercentToVolumePercent(level.value!) : undefined;
  const lost = (r: Reading) => r.state === 'lost';
  const layerValue = (pct?: number, vol?: number) =>
    layers && pct !== undefined && vol !== undefined ? `${fixed(pct)}% | ${vol.toFixed(vol < 1 ? 2 : 1)} m³` : layersState === 'lost' ? SIGNAL_LOST_LABEL : '—';

  const layerItems: TankLayerItem[] = [
    { id: 'lpg', label: 'LPG lỏng', value: layerValue(layers?.lpg.percent, layers?.lpg.volume), tone: layers ? 'info' : 'muted' },
    { id: 'vapor', label: 'Pha hơi / khí gas', value: layerValue(layers?.vapor.percent, layers?.vapor.volume), tone: layers ? 'neutral' : 'muted' },
    { id: 'water', label: 'Nước đáy bồn', value: layerValue(layers?.water.percent, layers?.water.volume), tone: layers ? 'warning' : 'muted' },
    {
      id: 'status',
      label: 'Trạng thái',
      value: STATUS_LABEL[storageStatus],
      tone: storageStatus === 'normal' ? 'success' : storageStatus === 'warning' ? 'warning' : storageStatus === 'danger' ? 'danger' : 'muted',
    },
    {
      id: 'water-alarm',
      label: 'Cảnh báo nước đáy',
      value: waterStatus ? WATER_STATUS_LABEL[waterStatus] : layersState === 'lost' ? SIGNAL_LOST_LABEL : '—',
      tone: waterStatus === 'normal' ? 'success' : waterStatus === 'warning' ? 'warning' : waterStatus === 'danger' ? 'danger' : 'muted',
    },
  ];

  const related = deriveRelatedAlerts(alerts.data ?? [], data.relatedDevices, now);
  const summary = deriveMaintenanceSummary(maintenance.data ?? [], data.id, now);
  const tempLine = temperature.state === 'ok' ? `Temp: ${fixed(temperature.value!)}°C` : temperature.state === 'lost' ? SIGNAL_LOST_LABEL : 'Temp: —';

  const eventColumns: DataTableColumn<AssetEvent>[] = [
    { id: 'time', header: 'Thời gian', align: 'start', width: '22%', className: 'text-sm tabular-nums text-fg', cell: (e) => (e.daysAgo ? `${e.time} (−${e.daysAgo} ngày)` : e.time) },
    { id: 'title', header: 'Sự kiện / Hành động', align: 'start', width: '30%', className: 'text-sm text-fg' },
    { id: 'type', header: 'Loại', align: 'start', width: '24%', cell: (e) => <span className={cn('text-sm', EVENT_TONE[e.type].text)}>{EVENT_TYPE_META[e.type].label}</span> },
    {
      id: 'status',
      header: 'Trạng thái',
      align: 'start',
      cell: (e) => <span className={cn('text-xs', e.status === 'done' ? 'text-success' : 'text-fg-secondary')}>{EVENT_STATUS_LABEL[e.status]}</span>,
    },
  ];

  return (
    <Page pageHeader={header}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.9fr)] xl:grid-cols-[minmax(0,1.5fr)_minmax(0,2.85fr)_272px]">
        {/* Cột trái – mô hình 3D */}
        <AssetModelPanel
          sceneId={data.sceneId}
          assetName={data.name}
          liveData={liveData}
          tag={{ title: `${data.id} DOME`, line: tempLine, signalLost: lost(temperature) }}
          description={`${data.name}: mức bồn ${liquidPct !== undefined ? `${fixed(liquidPct)}%` : 'không có số liệu'}, áp suất ${readingText(pressure, 1, ' bar')}, nhiệt độ ${readingText(temperature, 1, ' °C')}, trạng thái tồn chứa ${STATUS_LABEL[storageStatus]}.`}
          fallbackImage={FALLBACK_IMAGE[data.id] ?? plantMapImage}
          className="min-h-[420px] lg:min-h-0"
        />

        {/* Cột giữa – KPI + tồn chứa */}
        <div className="flex min-w-0 flex-col gap-4">
          <section aria-label="Chỉ số bồn" className="grid auto-rows-[102px] grid-cols-2 gap-4 sm:grid-cols-3">
            <KpiCard
              dense
              label="Mức bồn"
              hint={LEVEL_HINT}
              hintIcon
              value={liquidPct !== undefined ? fixed(liquidPct) : '—'}
              unit="%"
              signalLost={lost(level)}
              tone={kpiTone(level)}
              progress={liquidPct !== undefined ? { value: liquidPct, tone: 'info' } : undefined}
            />
            <KpiCard
              dense
              label="Thể tích"
              hint={`Thể tích LPG lỏng (m³). Xu hướng 1 giờ là số tạm: ${ph.volumeTrend1h.note}`}
              value={layers ? fixed(layers.lpg.volume) : '—'}
              unit="m³"
              signalLost={layersState === 'lost'}
              sub={`+${fixed(ph.volumeTrend1h.value)}% (1h)`}
              subIcon={<Icon name="kpiTrendUp" box={12} />}
              subTone="success"
            />
            <KpiCard
              dense
              label="Áp suất"
              hint={`Ngưỡng cảnh báo ${data.alarms.pressure.warn} bar, nguy hiểm ${data.alarms.pressure.danger} bar. Định mức thiết kế ${fixed(data.designPressure)} bar là thông số chế tạo, không phải ngưỡng cảnh báo.`}
              value={pressure.state === 'ok' ? fixed(pressure.value!) : '—'}
              unit="bar"
              signalLost={lost(pressure)}
              tone={kpiTone(pressure)}
              sub={`Định mức: ${fixed(data.designPressure)} bar`}
              subTone="muted"
            />
            <KpiCard
              dense
              label="Nhiệt độ"
              value={temperature.state === 'ok' ? fixed(temperature.value!) : '—'}
              unit="°C"
              signalLost={lost(temperature)}
              tone={kpiTone(temperature)}
              progress={temperature.state === 'ok' ? { value: temperature.value!, max: data.alarms.temperature.danger, tone: 'warning' } : undefined}
            />
            <KpiCard
              dense
              label="Tồn kho"
              hint={`Số tạm: ${ph.inventory.note} ${ph.daysOfSupply.note}`}
              value={fixed(ph.inventory.value)}
              unit="Nm³"
              sub={`Dự kiến: ${ph.daysOfSupply.value} ngày`}
              subTone="muted"
            />
            <KpiCard
              dense
              label="Sức khỏe thiết bị"
              hint={`Số tạm: ${ph.health.note}`}
              value={String(ph.health.value)}
              unit="%"
              tone="success"
              sub="Hoạt động ổn định"
              subTone="success"
            />
          </section>

          <Card
            title="Trạng thái tồn chứa trong bồn"
            headerVariant="plain"
            className="flex-1"
            headerEnd={
              <StatusPill size="sm" tone={statusTone(storageStatus)}>
                {STATUS_LABEL[storageStatus]}
              </StatusPill>
            }
          >
            <div className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <div className="flex min-h-[260px] flex-col justify-center rounded-lg border border-line/30 bg-surface-sunken/40 p-3">
                <TankCutawayDiagram
                  label={`Mặt cắt ${data.name}`}
                  length={data.tank.length}
                  diameter={data.tank.diameter}
                  state={layersState === 'lost' ? 'lost' : 'pending'}
                  layers={
                    layers && {
                      levelPct: layers.levelPct,
                      waterPct: layers.waterPct,
                      lpgPercent: layers.lpg.percent,
                      vaporPercent: layers.vapor.percent,
                      waterPercent: layers.water.percent,
                    }
                  }
                />
              </div>
              <TankLayerList items={layerItems} />
            </div>
            <dl className="mt-5 grid max-w-[360px] grid-cols-3 gap-4">
              {[
                { id: 'p', label: 'Áp suất bồn', value: readingText(pressure, 1, ' bar'), tone: 'text-fg' },
                { id: 't', label: 'Nhiệt độ LPG', value: readingText(temperature, 1, '°C'), tone: 'text-fg' },
                { id: 'l', label: 'Mức bồn', value: liquidPct !== undefined ? `${fixed(liquidPct)}%` : lost(level) ? SIGNAL_LOST_LABEL : '—', tone: 'text-info' },
              ].map((x) => (
                <div key={x.id} className="flex flex-col gap-1">
                  <dt className="text-2xs uppercase tracking-caps text-fg-secondary">{x.label}</dt>
                  <dd className={cn('text-base tabular-nums', x.value === SIGNAL_LOST_LABEL ? 'text-fg-secondary' : x.tone)}>{x.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>

        {/* Cột phải */}
        <aside aria-label="Tình trạng, cảnh báo và bảo trì" className="grid gap-6 lg:col-span-2 lg:grid-cols-3 xl:col-span-1 xl:flex xl:flex-col">
          <Card title="Tình trạng tài sản" headerVariant="plain">
            <div className="flex flex-col items-center gap-4">
              <DonutGauge
                size={132}
                ringWidth={10}
                hideLegend
                label={`Tình trạng tài sản ${ph.health.value}%, tối ưu (số tạm)`}
                segments={[
                  { id: 'ok', label: 'Tốt', value: ph.health.value, tone: 'success' },
                  { id: 'rest', label: 'Còn lại', value: 100 - ph.health.value, tone: 'offline' },
                ]}
                center={{ value: `${ph.health.value}%`, caption: 'Tối ưu', tone: 'success' }}
              />
              <p className="self-stretch text-sm text-fg-muted">Hệ thống đang vận hành trong thông số kỹ thuật cho phép.</p>
            </div>
          </Card>

          <Card
            title="Cảnh báo liên quan"
            padding="none"
            className="min-h-[196px]"
          >
            {related.length ? (
              related.map((a, i) => (
                <AlertItem key={a.id} layout="inline" {...a} last={i === related.length - 1} onClick={() => navigate(`/alerts?alert=${a.id}&range=30d`)} />
              ))
            ) : (
              <p className="px-4 py-6 text-sm text-fg-secondary">Không có cảnh báo liên quan.</p>
            )}
            <div className="mt-auto border-t border-line/30 bg-surface-muted/10 py-2 text-center">
              <Button variant="link" onClick={() => navigate(`/alerts?q=${encodeURIComponent(data.id)}&range=30d`)}>
                Xem tất cả
              </Button>
            </div>
          </Card>

          <MaintenanceSummaryCard
            next={summary.next && { date: summary.next.date, note: summary.next.overdue || summary.next.daysLeft <= 7 ? summary.next.dueText : undefined, overdue: summary.next.overdue }}
            last={summary.last && { date: summary.last.date }}
            records={{ value: ph.recordCompleteness.value, status: ph.recordCompleteness.value >= 100 ? 'Đầy đủ' : `${ph.recordCompleteness.value}%`, hint: `Số tạm: ${ph.recordCompleteness.note}` }}
          />
        </aside>
      </div>

      {/* Hàng dưới – sự kiện */}
      <Card
        title={`Sự kiện gần đây ${data.id}`}
        headerVariant="plain"
        headerEnd={
          <div role="group" aria-label="Lọc theo loại sự kiện" className="flex flex-wrap items-center gap-1">
            {EVENT_TYPES.map((t) => {
              const on = !hidden.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  onClick={() => events.setValues({ hide: toggleHiddenType(events.values.hide, t) })}
                  className={cn('flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-2xs transition-opacity hover:bg-surface-muted/20', on ? 'text-fg-muted' : 'text-fg-secondary line-through opacity-60')}
                >
                  <span aria-hidden="true" className={cn('size-2 rounded-full', EVENT_TONE[t].dot, !on && 'opacity-40')} />
                  {EVENT_TYPE_META[t].legend}
                </button>
              );
            })}
          </div>
        }
      >
        <DataTable
          label={`Sự kiện gần đây của ${data.id}`}
          columns={eventColumns}
          rows={events.pageRows}
          getRowId={getEventId}
          minWidth={640}
          density="compact"
          emptyState={<p className="py-6 text-center text-sm text-fg-secondary">Không có sự kiện thuộc loại đang chọn.</p>}
        />
        <div className="flex justify-end pt-3">
          {/* Chưa có trang nhật ký đầy đủ (chờ thiết kế/API) → nút tắt, có tooltip. */}
          <Button variant="link" disabled title="Chưa có trang nhật ký đầy đủ">
            Xem toàn bộ nhật ký của {data.id}
          </Button>
        </div>
      </Card>

      {createOpen && (
        <CreateMaintenanceModal
          open
          onClose={() => events.setExtra({ create: null })}
          devices={devices}
          defaultDevice={data.id}
          onDraftSaved={() => {
            events.setExtra({ create: null });
            announce('Đã lưu nháp yêu cầu bảo trì.');
          }}
          onSubmit={async (input) => {
            const rec = await maintenance.create(input);
            events.setExtra({ create: null });
            setCreated({ id: rec.id, code: rec.code });
            announce(`Đã tạo yêu cầu ${rec.code}.`);
          }}
        />
      )}
      {created && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-lg border border-success/30 bg-surface-raised px-4 py-3 text-sm shadow-card">
          <span className="text-success">Đã tạo yêu cầu {created.code}.</span>
          <Link to={`/maintenance?open=${encodeURIComponent(created.id)}`} className="text-accent underline hover:text-info">
            Xem trong Bảo trì
          </Link>
          <Button variant="icon" size="sm" aria-label="Đóng thông báo" onClick={() => setCreated(null)} icon={<CloseIcon size={12} />} />
        </div>
      )}
    </Page>
  );
}
