import { useNavigate } from 'react-router-dom';
import { AssetModelPanel } from '@/app/AssetModelPanel';
import { useCan } from '@/app/auth';
import { ClockButton, LiveDataButton } from '@/app/HeaderActions';
import { Page } from '@/app/Page';
import { PageError, Placeholder } from '@/app/Placeholder';
import { useTableFilters } from '@/app/useTableFilters';
import { assetV101Image, plantMapImage } from '@/assets/digital-twin';
import { Button, HistoryIcon, Icon, MapIcon, PageHeader, StatusPill } from '@/components';
import { useAlerts } from '@/data/alerts';
import {
  EVENT_PARAMS,
  STATUS_LABEL,
  deriveMaintenanceSummary,
  deriveRelatedAlerts,
  newestEventFirst,
  parseHiddenTypes,
  useAssetDetail,
  type AssetEvent,
} from '@/data/assetDetail';
import { useMaintenance } from '@/data/maintenance';
import { SIGNAL_LOST_LABEL } from '@/features/live/signal';
import { levelPercentToVolumePercent } from '@/features/tank/volume';
import { useNow } from '@/lib/useNow';
import { CreateMaintenanceModal } from '../../maintenance/CreateMaintenanceModal';
import { AssetAside } from './AssetAside';
import { AssetEventsCard, getEventId } from './AssetEventsCard';
import { AssetKpiSection } from './AssetKpiSection';
import { fixed, lost, readingText } from './assetView';
import { StorageCard } from './StorageCard';
import { CreatedNotice, useAssetCreateRequest } from './useAssetCreateRequest';

/** Ảnh tĩnh dự phòng theo tài sản (chụp từ cảnh 3D riêng). */
const FALLBACK_IMAGE: Record<string, string> = { 'V-101': assetV101Image };
const matchEvent = (e: AssetEvent, v: { hide: string | null }) => !parseHiddenTypes(v.hide).includes(e.type);
const sortEvents = (a: AssetEvent, b: AssetEvent) => newestEventFirst(a, b);
const EVENT_ROWS = 5;

/**
 * Chi tiết tài sản (GĐ 5D) – `/map/:assetId`, theo ảnh "Bồn LPG V-101" (chưa có node Figma).
 * 3 cột (≈ 1,5 : 2,85 : 272px theo ảnh) + hàng sự kiện. Số đo qua useLiveData (Mất tín hiệu khi stale); ba lớp
 * trong bồn tính từ 2 mức chiều cao + kích thước bồn (features/tank/layers).
 * Khối: mô hình 3D · AssetKpiSection · StorageCard · AssetAside · AssetEventsCard; tạo yêu cầu = `useAssetCreateRequest`.
 */
export function AssetDetail({ assetId }: { assetId: string }) {
  const navigate = useNavigate();
  const now = useNow(60_000);
  const { status, data, error, refetch, live, liveData } = useAssetDetail(assetId);
  const alerts = useAlerts();
  const maintenance = useMaintenance();
  const canWrite = useCan('maintenance:write');

  const events = useTableFilters({
    rows: data?.events ?? [],
    getId: getEventId,
    params: EVENT_PARAMS,
    match: matchEvent,
    sort: sortEvents,
    pageSize: EVENT_ROWS,
  });
  const create = useAssetCreateRequest({ open: canWrite && events.search.get('create') === '1', setExtra: events.setExtra });
  const alertsUrl = `/alerts?q=${encodeURIComponent(assetId)}&range=30d`;

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
          <Button icon={<HistoryIcon size={16} />} onClick={() => navigate(alertsUrl)}>
            Lịch sử cảnh báo
          </Button>
          {canWrite && (
            <Button variant="primary" icon={<Icon name="add" />} onClick={create.openCreate} disabled={!data}>
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
        <PageError
          title="Không tải được tài sản"
          error={error}
          onRetry={refetch}
          actions={<Button onClick={() => navigate('/overview')}>Về Tổng quan</Button>}
        />
      </Page>
    );
  }

  if (status === 'loading' || !live) {
    return (
      <Page pageHeader={header}>
        <div className="reveal-delayed grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,2.85fr)_272px]">
          <Placeholder label="Đang tải…" height={688} />
          <Placeholder label="Đang tải…" height={688} />
          <Placeholder label="Đang tải…" height={688} />
        </div>
      </Page>
    );
  }

  const { level, pressure, temperature, storageStatus } = live;
  const liquidPct = level.state === 'ok' ? levelPercentToVolumePercent(level.value!) : undefined;
  const tempLine = temperature.state === 'ok' ? `Temp: ${fixed(temperature.value!)}°C` : temperature.state === 'lost' ? SIGNAL_LOST_LABEL : 'Temp: —';

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
          <AssetKpiSection data={data} live={live} liquidPct={liquidPct} />
          <StorageCard data={data} live={live} liquidPct={liquidPct} />
        </div>

        {/* Cột phải */}
        <AssetAside
          data={data}
          related={deriveRelatedAlerts(alerts.data ?? [], data.relatedDevices, now)}
          summary={deriveMaintenanceSummary(maintenance.data ?? [], data.id, now)}
          onOpenAlert={(id) => navigate(`/alerts?alert=${id}&range=30d`)}
          onAllAlerts={() => navigate(`/alerts?q=${encodeURIComponent(data.id)}&range=30d`)}
        />
      </div>

      {/* Hàng dưới – sự kiện */}
      <AssetEventsCard assetId={data.id} events={events} />

      {create.open && (
        <CreateMaintenanceModal
          open
          onClose={create.close}
          devices={create.devices}
          defaultDevice={data.id}
          onDraftSaved={create.onDraftSaved}
          onSubmit={create.onSubmit}
        />
      )}
      {create.created && <CreatedNotice created={create.created} onDismiss={create.dismissCreated} />}
    </Page>
  );
}
