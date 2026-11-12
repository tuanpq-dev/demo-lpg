import type {
  AlertItemData,
  AssetRowData,
  CategoryBarItem,
  DonutSegment,
  HealthStat,
  MapMarkerData,
  MapView,
  TimelineEvent,
  TrendPoint,
} from '@/components';
import { SIGNAL_LOST_LABEL, tagSignal } from '@/features/live/signal';
import type { LiveData } from '@/features/live/types';
import { fieldStatus, FIELD_META, formatField } from '@/features/scene/fields';
import { levelPercentToVolumePercent } from '@/features/tank/volume';
import { useQuery } from '@/lib/useQuery';
import * as mock from '@/mocks/overview';
import type { KpiMock } from '@/mocks/types';
import { formatNumber } from '@/lib/number';

/** Toàn bộ dữ liệu màn Tổng quan – hợp đồng giữa UI và nguồn dữ liệu (mock hôm nay, API sau này). */
/** Gắn ô hiển thị với tag trực tiếp + trường (định dạng/ý nghĩa theo FIELD_META). */
export type FieldBinding = { tag: string; field: string };

export type KpiData = KpiMock & { signalLost?: boolean };
export type WatchRow = AssetRowData & { live?: FieldBinding };
export type MapMarkerLive = MapMarkerData & { live?: FieldBinding };

export type OverviewData = {
  systemStatus: { tone: 'success' | 'warning' | 'danger'; label: string };
  /** KPI có `live` lấy số từ tag (xem applyLive). */
  kpis: KpiData[];
  /** Bản đồ ảnh 2.5D (Figma); marker có `live` lấy giá trị từ tag. Bản 3D: cảnh qua useSceneConfig, số liệu qua useLiveData. */
  map: { markers: MapMarkerLive[]; views: MapView[] };
  charts: {
    inventory: { points: TrendPoint[]; domain?: [number, number] };
    pressure: { points: TrendPoint[] };
    consumption: { items: CategoryBarItem[]; max?: number };
    deviceStatus: DonutSegment[];
  };
  systemHealth: { value: number; caption: string; stats: HealthStat[] };
  priorityAlarms: AlertItemData[];
  watchlist: WatchRow[];
  recentEvents: TimelineEvent[];
};

/**
 * Nguồn dữ liệu. Thay thân hàm bằng `fetch('/api/overview')` khi có API – UI không cần sửa.
 */
async function fetchOverview(): Promise<OverviewData> {
  return {
    systemStatus: mock.systemStatus,
    kpis: mock.overviewKpis,
    map: { markers: mock.mapMarkers, views: mock.mapViews },
    charts: {
      inventory: { points: mock.inventoryTrend, domain: mock.inventoryDomain },
      pressure: { points: mock.pressureTrend },
      consumption: mock.consumptionByArea,
      deviceStatus: mock.deviceStatus,
    },
    systemHealth: mock.systemHealth,
    priorityAlarms: mock.priorityAlarms,
    watchlist: mock.watchlist,
    recentEvents: mock.recentEvents,
  };
}

const kpiNumber = (v: number, digits = 0) => formatNumber(v, digits);

/**
 * Ghép số liệu trực tiếp vào dữ liệu màn Tổng quan (thuần – page gọi lúc render, `now` = Date.now()):
 * - chưa có ảnh chụp đầu (`live` undefined) → ô gắn tag hiện "—" (không dùng số tĩnh của mock như số thật);
 * - mất tín hiệu (bad / quá 10 s / không có tag) → KPI `signalLost`, dòng theo dõi "Mất tín hiệu" (tone offline),
 *   marker 2.5D xám + "Mất tín hiệu"; KHÔNG giữ số cũ;
 * - còn lại: số mới (KPI `tank-volume` quy đổi % chiều cao → % thể tích bồn trụ nằm).
 */
export function applyLive(data: OverviewData, live: LiveData | undefined, now: number = Date.now()): OverviewData {
  const kpis = data.kpis.map((k): KpiData => {
    if (!k.live) return k;
    const tv = live?.[k.live.tag];
    if (!live) return { ...k, value: '—' };
    if (tagSignal(tv, now) === 'lost' || typeof tv!.value !== 'number') return { ...k, signalLost: true };
    const v = k.live.transform === 'tank-volume' ? levelPercentToVolumePercent(tv!.value) : tv!.value;
    return { ...k, value: kpiNumber(v, k.live.digits), unit: k.unit ?? tv!.unit };
  });
  const watchlist = data.watchlist.map((r): WatchRow => {
    if (!r.live || !live) return r;
    const tv = live[r.live.tag];
    if (tagSignal(tv, now) === 'lost') return { ...r, statusLabel: SIGNAL_LOST_LABEL, tone: 'offline', signalLost: true };
    const st = fieldStatus(r.live.field, tv, {}, now);
    if (st === 'danger' || st === 'warning')
      return {
        ...r,
        statusLabel: typeof tv!.value === 'string' ? (FIELD_META[r.live.field]?.states?.[tv!.value]?.label ?? tv!.value) : r.statusLabel,
        tone: st,
      };
    return r;
  });
  const markers = data.map.markers.map((m): MapMarkerLive => {
    if (!m.live) return m;
    if (!live) return { ...m, value: '—' };
    const tv = live[m.live.tag];
    if (tagSignal(tv, now) === 'lost')
      return { ...m, tone: 'neutral', value: SIGNAL_LOST_LABEL, showDot: false, showWarningIcon: false, showSignalLostIcon: true };
    return { ...m, value: formatField(m.live.field, tv, now) };
  });
  return { ...data, kpis, watchlist, map: { ...data.map, markers } };
}

export type { QueryState } from '@/lib/useQuery';

/** Hook dữ liệu màn Tổng quan: `{ status, data, error, refetch }` (refetch → về loading). */
export function useOverviewData() {
  return useQuery('overview', fetchOverview, { remember: 'overview' });
}
