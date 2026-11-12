import { useNavigate } from 'react-router-dom';
import { AssetModelPanel } from '@/app/AssetModelPanel';
import { useCan } from '@/app/auth';
import { ClockButton, LiveDataButton } from '@/app/HeaderActions';
import { Page } from '@/app/Page';
import { pageFallback, Placeholder } from '@/app/Placeholder';
import { useTableFilters } from '@/app/useTableFilters';
import { assetV101Image, plantMapImage } from '@/assets/digital-twin';
import { Button, HistoryIcon, Icon, MapIcon, PageHeader, StatusPill, type StatusPillTone } from '@/components';
import { useAlertsByDevices } from '@/data/alertApi';
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
import { useMaintenanceByDevice } from '@/data/maintenanceApi';
import { SIGNAL_LOST_LABEL } from '@/features/live/signal';
import { levelPercentToVolumePercent } from '@/features/tank/volume';
import type { ImageAsset } from '@/lib/imageAsset';
import { useNow } from '@/lib/useNow';
import { CreateMaintenanceModal } from '../../shared/maintenance/CreateMaintenanceModal';
import { AssetAside } from './AssetAside';
import { AssetEventsCard, getEventId } from './AssetEventsCard';
import { AssetKpiSection } from './AssetKpiSection';
import { fixed, lost, readingText } from './assetView';
import { StorageCard } from './StorageCard';
import { CreatedNotice, useAssetCreateRequest } from './useAssetCreateRequest';

/** Ảnh tĩnh dự phòng theo tài sản (chụp từ cảnh 3D riêng). */
const FALLBACK_IMAGE: Record<string, ImageAsset> = { 'V-101': assetV101Image };
const matchEvent = (e: AssetEvent, v: { hide: string | null }) => !parseHiddenTypes(v.hide).includes(e.type);
const sortEvents = (a: AssetEvent, b: AssetEvent) => newestEventFirst(a, b);
const EVENT_ROWS = 5;

type AssetData = NonNullable<ReturnType<typeof useAssetDetail>['data']>;
type AssetLive = NonNullable<ReturnType<typeof useAssetDetail>['live']>;

/** % thể tích lỏng, nhãn nổi trên mô hình 3D (nhiệt độ vòm bồn) và mô tả cho trình đọc màn hình. */
function modelText(data: AssetData, live: AssetLive) {
  const { level, pressure, temperature, storageStatus } = live;
  const liquidPct = level.state === 'ok' ? levelPercentToVolumePercent(level.value!) : undefined;
  const tempLine = temperature.state === 'ok' ? `Temp: ${fixed(temperature.value!)}°C` : temperature.state === 'lost' ? SIGNAL_LOST_LABEL : 'Temp: —';
  const levelText = liquidPct !== undefined ? `${fixed(liquidPct)}%` : 'không có số liệu';
  return {
    liquidPct,
    tag: { title: `${data.id} DOME`, line: tempLine, signalLost: lost(temperature) },
    description: `${data.name}: mức bồn ${levelText}, áp suất ${readingText(pressure, 1, ' bar')}, nhiệt độ ${readingText(temperature, 1, ' °C')}, trạng thái tồn chứa ${STATUS_LABEL[storageStatus]}.`,
  };
}

/** Nút header: trạng thái hệ thống · đồng hồ · dữ liệu trực tiếp · xem trên bản đồ · lịch sử cảnh báo · tạo yêu cầu (nếu có quyền). */
function AssetHeaderActions({
  status,
  onMap,
  onAlerts,
  onCreate,
  createDisabled,
}: {
  status?: { tone: StatusPillTone; label: string };
  onMap: () => void;
  onAlerts: () => void;
  onCreate?: () => void;
  createDisabled: boolean;
}) {
  return (
    <>
      {status && <StatusPill tone={status.tone}>{status.label}</StatusPill>}
      <ClockButton />
      <LiveDataButton />
      <Button icon={<MapIcon size={16} />} onClick={onMap}>
        Xem trên bản đồ
      </Button>
      {/* q (không phải device): khớp cả cảnh báo của tag/van an toàn thuộc bồn, giống thẻ "Cảnh báo liên quan". */}
      <Button icon={<HistoryIcon size={16} />} onClick={onAlerts}>
        Lịch sử cảnh báo
      </Button>
      {onCreate && (
        <Button variant="primary" icon={<Icon name="add" />} onClick={onCreate} disabled={createDisabled}>
          Tạo yêu cầu bảo trì
        </Button>
      )}
    </>
  );
}

/**
 * Chi tiết tài sản – `/map/:assetId`, theo ảnh "Bồn LPG V-101" (chưa có node Figma).
 * 3 cột (≈ 1,5 : 2,85 : 272px theo ảnh) + hàng sự kiện. Số đo qua useLiveData (Mất tín hiệu khi stale); ba lớp
 * trong bồn tính từ 2 mức chiều cao + kích thước bồn (features/tank/layers).
 * Khối: mô hình 3D · AssetKpiSection · StorageCard · AssetAside · AssetEventsCard; tạo yêu cầu = `useAssetCreateRequest`.
 */
const NO_DEVICES: string[] = [];

export function AssetDetail({ assetId }: { assetId: string }) {
  const navigate = useNavigate();
  const now = useNow(60_000);
  const { status, data, error, refetch, live, liveData } = useAssetDetail(assetId);
  // Chỉ cảnh báo / bảo trì của thiết bị này (máy chủ lọc) – không tải toàn bộ danh sách.
  const alerts = useAlertsByDevices(data?.relatedDevices ?? NO_DEVICES);
  const maintenance = useMaintenanceByDevice(assetId);
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
        <AssetHeaderActions
          status={data?.systemStatus}
          onMap={() => void navigate(`/overview?map=3d&focus=${encodeURIComponent(assetId)}`)}
          onAlerts={() => void navigate(alertsUrl)}
          onCreate={canWrite ? create.openCreate : undefined}
          createDisabled={!data}
        />
      }
    />
  );

  if (status !== 'success' || !live) {
    // Đã có dữ liệu nhưng chưa có số trực tiếp → vẫn là "đang tải".
    return pageFallback(
      { status: status === 'error' ? 'error' : 'loading', error, refetch },
      {
        header,
        errorTitle: 'Không tải được tài sản',
        errorActions: <Button onClick={() => void navigate('/overview')}>Về Tổng quan</Button>,
        skeleton: (
          <div className="reveal-delayed grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,2.85fr)_272px]">
            <Placeholder label="Đang tải…" height={688} />
            <Placeholder label="Đang tải…" height={688} />
            <Placeholder label="Đang tải…" height={688} />
          </div>
        ),
      },
    );
  }

  const { liquidPct, tag, description } = modelText(data, live);

  return (
    <Page pageHeader={header}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.9fr)] xl:grid-cols-[minmax(0,1.5fr)_minmax(0,2.85fr)_272px]">
        {/* Cột trái – mô hình 3D */}
        <AssetModelPanel
          sceneId={data.sceneId}
          assetName={data.name}
          liveData={liveData}
          tag={tag}
          description={description}
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
          onOpenAlert={(id) => void navigate(`/alerts?alert=${id}&range=30d`)}
          onAllAlerts={() => void navigate(`/alerts?q=${encodeURIComponent(data.id)}&range=30d`)}
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
