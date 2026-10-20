import { useCallback, useEffect, useState } from 'react';
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
import * as mock from '@/mocks/overview';
import type { KpiMock } from '@/mocks/types';

/** Toàn bộ dữ liệu màn Tổng quan – hợp đồng giữa UI và nguồn dữ liệu (mock hôm nay, API sau này). */
export type OverviewData = {
  systemStatus: { tone: 'success' | 'warning' | 'danger'; label: string };
  kpis: KpiMock[];
  /** Bản đồ ảnh 2.5D (Figma). Bản 3D: cảnh nạp riêng qua useSceneConfig, số liệu qua useLiveData. */
  map: { markers: MapMarkerData[]; views: MapView[] };
  charts: {
    inventory: { points: TrendPoint[]; domain?: [number, number] };
    pressure: { points: TrendPoint[] };
    consumption: { items: CategoryBarItem[]; max?: number };
    deviceStatus: DonutSegment[];
  };
  systemHealth: { value: number; caption: string; stats: HealthStat[] };
  priorityAlarms: AlertItemData[];
  watchlist: AssetRowData[];
  recentEvents: TimelineEvent[];
};

/**
 * Nguồn dữ liệu. Thay thân hàm bằng `fetch('/api/overview')` khi có API – UI không cần sửa.
 */
export async function fetchOverview(): Promise<OverviewData> {
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

export type QueryState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'error'; data?: undefined; error: Error }
  | { status: 'success'; data: T; error?: undefined };

/** Hook dữ liệu màn Tổng quan: `{ status, data, error, refetch }`. */
export function useOverviewData() {
  const [state, setState] = useState<QueryState<OverviewData>>({ status: 'loading' });

  const load = useCallback(() => {
    let cancelled = false;
    fetchOverview()
      .then((data) => !cancelled && setState({ status: 'success', data }))
      .catch((error: unknown) =>
        !cancelled && setState({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) }),
      );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  return { ...state, refetch: load };
}
