import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { plantMapImage } from '@/assets/digital-twin';
import {
  AlertItem,
  AreaTrendChart,
  AssetWatchlist,
  Button,
  Card,
  CategoryBarList,
  ChartCard,
  DonutGauge,
  Icon,
  LineTrendChart,
  PageHeader,
  PlantMap,
  type PlantMapRenderer,
  RecentEventsCard,
  StatusPill,
  SystemHealthCard,
} from '@/components';
import { ConnectedPlantMap } from '@/app/ConnectedPlantMap';
import { ClockButton, LiveDataButton } from '@/app/HeaderActions';
import { KpiFromData } from '@/app/kpi';
import { Page } from '@/app/Page';
import { Placeholder } from '@/app/Placeholder';
import { useLiveData } from '@/data/live';
import { applyLive, useOverviewData } from '@/data/overview';
import { useAnnounceChange } from '@/lib/announce';
import { parseQuality } from '@/features/scene';

const nf = (v: number) => v.toLocaleString('en-US');

/** Cảnh 3D mặc định của bản đồ Tổng quan (src/mocks/scenes/khu-bon-lpg.json; views + nhãn nằm trong cảnh). */
const DEFAULT_SCENE_ID = 'khu-bon-lpg';

/**
 * Tổng quan (Figma 53:11) – AppLayout 2 cột.
 * Main: 6 KPI · bản đồ 2.5D · 4 chart. Sidebar 326px: độ tin cậy · cảnh báo ưu tiên · theo dõi thiết bị · sự kiện.
 */
export default function OverviewPage() {
  const navigate = useNavigate();
  const { status, data, error, refetch } = useOverviewData();
  const [mapView, setMapView] = useState('all');
  // Bản đồ 3D bật bằng ?map=3d hoặc nút 2.5D/3D ở góc bản đồ; mặc định ảnh 2.5D theo Figma.
  const [params, setParams] = useSearchParams();
  // ?scene=<id>: cảnh khác (mẫu hoặc lưu từ /editor) – luôn 3D vì ảnh 2.5D chỉ có cho khu bồn LPG.
  const sceneParam = params.get('scene');
  const sceneId = sceneParam ?? DEFAULT_SCENE_ID;
  const map3d = params.get('map') === '3d' || !!sceneParam;
  // Dev: ?edit=1 → kéo/xoay object + Copy JSON (chưa lưu).
  const editMode = params.get('edit') === '1';
  // ?quality=low|medium|high ghi đè preset 3D (mặc định tự chọn theo FPS).
  const quality = parseQuality(params.get('quality')) ?? 'auto';
  // WebGL lỗi → về ảnh 2.5D kèm thông báo nhỏ; bật lại 3D thì xoá thông báo.
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const setRenderer = (r: PlantMapRenderer) => {
    if (r === 'three') setFallbackNotice(null);
    setParams(
      (p) => {
        if (r === 'three') p.set('map', '3d');
        else {
          p.delete('map');
          p.delete('scene');
        }
        return p;
      },
      { replace: true },
    );
  };
  // Mọi tag: KPI, danh sách theo dõi, nhãn bản đồ 2.5D và cảnh 3D dùng chung một đăng ký.
  const liveData = useLiveData();

  const view = data ? applyLive(data, liveData) : undefined;
  const lostCount = view
    ? view.kpis.filter((k) => k.signalLost).length + view.watchlist.filter((r) => r.signalLost).length + view.map.markers.filter((m) => m.showSignalLostIcon).length
    : 0;
  useAnnounceChange(lostCount, (n, prev) =>
    n > 0 ? `Mất tín hiệu ở ${n} điểm đo trên Tổng quan.` : prev > 0 ? 'Các điểm đo trên Tổng quan đã có tín hiệu trở lại.' : '',
  );

  const header = (
    <PageHeader
      actions={
        <>
          {data && <StatusPill tone={data.systemStatus.tone}>{data.systemStatus.label}</StatusPill>}
          <ClockButton />
          <LiveDataButton />
        </>
      }
    />
  );

  if (status === 'error') {
    return (
      <Page pageHeader={header}>
        <Card title="Không tải được dữ liệu" headerVariant="plain" tone="danger">
          <p className="mb-4 text-base text-fg-secondary">{error.message}</p>
          <Button onClick={refetch} className="self-start">
            Thử lại
          </Button>
        </Card>
      </Page>
    );
  }

  if (status === 'loading') {
    return (
      <Page
        variant="sidebar"
        pageHeader={header}
        sidebar={[235, 239, 234, 197].map((h) => <Placeholder key={h} label="Đang tải…" height={h} />)}
      >
        <Placeholder label="Đang tải…" height={128} />
        <Placeholder label="Đang tải…" height={591} />
        <Placeholder label="Đang tải…" height={315} />
      </Page>
    );
  }

  // Ghép số liệu trực tiếp lúc render (Date.now() → "Mất tín hiệu" khi tag quá 10 s; useLiveData tự hẹn giờ vẽ lại).
  const { kpis, map, charts, systemHealth, priorityAlarms, watchlist, recentEvents } = view!;

  return (
    <Page
      variant="sidebar"
      pageHeader={header}
      sidebar={
        <>
          <SystemHealthCard {...systemHealth} />
          <Card
            title="Cảnh báo ưu tiên"
            icon={<Icon name="danger" />}
            action={{ label: 'Xem tất cả', onClick: () => navigate('/alerts') }}
            padding="none"
          >
            {priorityAlarms.map((a, i) => (
              <AlertItem
                key={a.id}
                {...a}
                highlighted={i === 0}
                last={i === priorityAlarms.length - 1}
                onClick={() => navigate('/alerts')}
              />
            ))}
          </Card>
          <AssetWatchlist assets={watchlist} />
          <RecentEventsCard events={recentEvents} />
        </>
      }
    >
      {/* 1. KPI – 53:166 (6 cột gap 16, cao 128) */}
      <section aria-label="Chỉ số chính" className="grid auto-rows-[128px] grid-cols-3 gap-4 min-[1520px]:grid-cols-6">
        {kpis.map((k) => (
          <KpiFromData key={k.id} data={k} onAction={() => navigate('/alerts')} />
        ))}
      </section>

      {/* 2. Bản đồ 2.5D – 53:242 (hoặc 3D với ?map=3d) */}
      {map3d ? (
        <ConnectedPlantMap
          sceneId={sceneId}
          editable={editMode}
          liveData={liveData}
          quality={quality}
          alt="Bản đồ 3D nhà máy LPG"
          onRendererChange={setRenderer}
          onFallback={(reason) => {
            setRenderer('image');
            setFallbackNotice(`Không chạy được bản đồ 3D (${reason}) – đang hiển thị 2.5D.`);
          }}
        />
      ) : (
        <PlantMap
          image={plantMapImage}
          alt="Bản đồ 2.5D nhà máy LPG"
          markers={map.markers}
          views={map.views}
          view={mapView}
          onViewChange={setMapView}
          onRendererChange={setRenderer}
          notice={fallbackNotice}
        />
      )}

      {/* 3. Chart – 53:319. Figma đặt cả hàng opacity 70% (xem mục "Sai khác với Figma") */}
      <section aria-label="Biểu đồ" className="grid grid-cols-2 gap-4 opacity-70 min-[1520px]:grid-cols-4">
        <ChartCard title="Xu hướng tồn kho (24h)" description="Tồn kho 24 giờ qua">
          <AreaTrendChart data={charts.inventory.points} domain={charts.inventory.domain} unit="Nm³" format={nf} />
        </ChartCard>
        <ChartCard title="Tiêu thụ theo khu vực">
          <CategoryBarList items={charts.consumption.items} max={charts.consumption.max} unit="Nm³/h" />
        </ChartCard>
        <ChartCard title="Áp suất hệ thống (24h)" description="Áp suất hệ thống 24 giờ qua">
          <LineTrendChart data={charts.pressure.points} unit="bar" format={(v) => v.toFixed(2)} />
        </ChartCard>
        <ChartCard title="Trạng thái thiết bị">
          <div className="flex h-full justify-center">
            <DonutGauge segments={charts.deviceStatus} className="-mt-2" />
          </div>
        </ChartCard>
      </section>
    </Page>
  );
}
