import { useCallback, useEffect, useState } from 'react';
import { tagSignal } from '@/features/live/signal';
import type { LiveData } from '@/features/live/types';
import { fieldStatus } from '@/features/scene/fields';
import type { Thresholds } from '@/features/scene/types';
import { tankLayers, upperLimitStatus, type LimitStatus, type TankLayers } from '@/features/tank/layers';
import { daysFromToday } from '@/lib/plantTime';
import type { AlertRecord } from '@/mocks/alerts';
import { assetEvents, assetMocks, type AssetEvent, type AssetEventStatus, type AssetEventType, type AssetMock } from '@/mocks/assets';
import { isoDay } from '@/mocks/maintenance';
import { systemStatus } from '@/mocks/overview';
import { useLiveData } from './live';
import { dueLabel, isOverdue, type MaintenanceRecord } from './maintenance';
import type { QueryState } from './overview';

export type { AssetEvent, AssetEventStatus, AssetEventType, AssetMock };
export type { PlaceholderValue } from '@/mocks/assets';

/** Dữ liệu tĩnh của trang chi tiết tài sản – hợp đồng UI ↔ nguồn (mock hôm nay, `GET /api/assets/:id` sau này). */
export type AssetDetail = AssetMock & {
  systemStatus: { tone: 'success' | 'warning' | 'danger'; label: string };
  events: AssetEvent[];
};

/** Mã tài sản có trang chi tiết. */
export const ASSET_IDS = Object.keys(assetMocks);

/**
 * Mã chuẩn của tài sản từ URL / id khác kiểu chữ ("v-101", " V-101 " → "V-101"); không có trang → null.
 * Trang dùng để chuyển `/map/v-101` sang `/map/V-101` và báo "Không tìm thấy tài sản".
 */
export function resolveAssetId(raw: string | null | undefined): string | null {
  const key = (raw ?? '').trim().toUpperCase();
  if (!key) return null;
  return ASSET_IDS.find((id) => id.toUpperCase() === key) ?? null;
}

export async function fetchAssetDetail(assetId: string): Promise<AssetDetail> {
  const mock = assetMocks[assetId];
  if (!mock) throw new Error(`Không có tài sản "${assetId}" (có: ${ASSET_IDS.join(', ')})`);
  return { ...mock, systemStatus, events: assetEvents.filter((e) => e.asset === assetId) };
}

// ============================================================================
// Ghép số liệu trực tiếp (thuần – `now` truyền vào)
// ============================================================================

/** pending = chưa nhận ảnh chụp đầu ("—") · lost = mất tín hiệu (không hiện số cũ) · ok. */
export type ReadingState = 'pending' | 'lost' | 'ok';
export type Reading = { state: ReadingState; value?: number; status: LimitStatus | 'offline' };

export type AssetLiveView = {
  level: Reading;
  waterLevel: Reading;
  pressure: Reading;
  temperature: Reading;
  /** Ba lớp trong bồn; null khi thiếu/mất mức tổng hoặc mức nước. */
  layers: TankLayers | null;
  layersState: ReadingState;
  /** Nước đáy so ngưỡng (% thể tích); undefined khi chưa có lớp. */
  waterStatus?: LimitStatus;
  /** Trạng thái tồn chứa = xấu nhất của mức bồn và nước đáy; offline khi mất tín hiệu. */
  storageStatus: LimitStatus | 'offline' | 'pending';
};

const RANK = { normal: 0, warning: 1, danger: 2 } as const;
const worst = (a: LimitStatus, b: LimitStatus): LimitStatus => (RANK[b] > RANK[a] ? b : a);

function reading(live: LiveData | undefined, tag: string, field: string, t: Thresholds, now: number): Reading {
  if (!live) return { state: 'pending', status: 'normal' };
  const tv = live[tag];
  if (tagSignal(tv, now) === 'lost' || typeof tv?.value !== 'number') return { state: 'lost', status: 'offline' };
  const status = fieldStatus(field, tv, t, now);
  return { state: 'ok', value: tv.value, status: status === 'offline' ? 'offline' : status };
}

/**
 * Số liệu trực tiếp của tài sản: 4 tag (mức tổng, mức nước, áp suất, nhiệt độ) + ba lớp tính từ hai mức chiều cao
 * và kích thước bồn (`tankLayers`) – không nhập cứng ba con số nên tổng luôn 100 %. Mất tín hiệu một trong hai
 * mức → không tính lớp (UI hiện "Mất tín hiệu").
 */
export function deriveAssetLive(detail: Pick<AssetMock, 'tags' | 'alarms' | 'tank'>, live: LiveData | undefined, now: number): AssetLiveView {
  const { tags, alarms, tank } = detail;
  const level = reading(live, tags.level, 'level', alarms.level, now);
  const waterLevel = reading(live, tags.waterLevel, 'level', {}, now);
  const pressure = reading(live, tags.pressure, 'pressure', alarms.pressure, now);
  const temperature = reading(live, tags.temperature, 'temperature', alarms.temperature, now);

  const layersState: ReadingState =
    level.state === 'pending' || waterLevel.state === 'pending' ? 'pending' : level.state === 'lost' || waterLevel.state === 'lost' ? 'lost' : 'ok';
  const layers = layersState === 'ok' ? tankLayers(level.value!, waterLevel.value!, tank) : null;
  const waterStatus = layers ? upperLimitStatus(layers.water.percent, alarms.water) : undefined;
  const storageStatus =
    layersState === 'pending' ? 'pending' : !layers || level.status === 'offline' ? 'offline' : worst(level.status, waterStatus ?? 'normal');

  return { level, waterLevel, pressure, temperature, layers, layersState, waterStatus, storageStatus };
}

export const STATUS_LABEL: Record<LimitStatus | 'offline' | 'pending', string> = {
  normal: 'Bình thường',
  warning: 'Cảnh báo',
  danger: 'Nguy hiểm',
  offline: 'Mất tín hiệu',
  pending: '—',
};

export const WATER_STATUS_LABEL: Record<LimitStatus, string> = {
  normal: 'Trong ngưỡng cho phép',
  warning: 'Vượt ngưỡng cảnh báo',
  danger: 'Vượt ngưỡng nguy hiểm',
};

// ============================================================================
// Sự kiện
// ============================================================================

/** Nhãn loại sự kiện (bảng) + nhãn chú thích. Đổi loại/nhãn ở đây – màu ở trang (`EVENT_TONE`). */
export const EVENT_TYPE_META: Record<AssetEventType, { label: string; legend: string }> = {
  sensor: { label: 'Cảm biến', legend: 'Cảm biến' },
  operation: { label: 'Vận hành', legend: 'Thao tác vận hành' },
  system: { label: 'Hệ thống', legend: 'Hệ thống' },
  alert: { label: 'Cảnh báo', legend: 'Cảnh báo' },
};
export const EVENT_TYPES = Object.keys(EVENT_TYPE_META) as AssetEventType[];

export const EVENT_STATUS_LABEL: Record<AssetEventStatus, string> = {
  success: 'Thành công',
  done: 'Hoàn thành',
  normal: 'Bình thường',
  acknowledged: 'Đã xác nhận',
};

/** Tham số URL của bảng sự kiện (useTableFilters): `hide` = loại đang ẩn, cách nhau dấu phẩy. */
export const EVENT_PARAMS = { hide: {} } as const;

/** Đọc `hide` trên URL → các loại đang ẩn (bỏ giá trị lạ, trùng; giữ thứ tự EVENT_TYPES). */
export function parseHiddenTypes(raw: string | null | undefined): AssetEventType[] {
  const set = new Set((raw ?? '').split(',').map((s) => s.trim()));
  return EVENT_TYPES.filter((t) => set.has(t));
}

/** Bật/tắt một loại → giá trị `hide` mới (null = không ẩn gì → xoá khỏi URL). */
export function toggleHiddenType(raw: string | null | undefined, type: AssetEventType): string | null {
  const hidden = new Set(parseHiddenTypes(raw));
  if (hidden.has(type)) hidden.delete(type);
  else hidden.add(type);
  const next = EVENT_TYPES.filter((t) => hidden.has(t));
  return next.length ? next.join(',') : null;
}

/** Mới nhất trước: ngày gần hơn, rồi giờ muộn hơn. */
export const newestEventFirst = (a: AssetEvent, b: AssetEvent) => a.daysAgo - b.daysAgo || b.time.localeCompare(a.time);

/** Sự kiện của `asset`, bỏ các loại trong `hidden`, mới nhất trước (không đổi mảng gốc). */
export function filterAssetEvents(events: readonly AssetEvent[], asset: string, hidden: readonly AssetEventType[] = []): AssetEvent[] {
  return events.filter((e) => e.asset === asset && !hidden.includes(e.type)).sort(newestEventFirst);
}

// ============================================================================
// Cảnh báo liên quan
// ============================================================================

export type RelatedAlert = { id: string; code: string; message: string; time: string; severity: AlertRecord['severity']; tone: 'danger' | 'warning' | 'success' };


/** "10:42" (hôm nay) · "Hôm qua" · "20/10" (ngày theo giờ nhà máy). */
export function dayTimeLabel(daysAgo: number, time: string, now: Date): string {
  if (daysAgo <= 0) return time.slice(0, 5);
  if (daysAgo === 1) return 'Hôm qua';
  const [, m, d] = isoDay(-daysAgo, now).split('-');
  return `${d}/${m}`;
}

/** Cảnh báo có thiết bị thuộc `devices`, mới nhất trước, tối đa `limit`. Đã xử lý → tone success. */
export function deriveRelatedAlerts(alerts: readonly AlertRecord[], devices: readonly string[], now: Date, limit = 3): RelatedAlert[] {
  return alerts
    .filter((a) => devices.includes(a.device))
    .sort((a, b) => a.daysAgo - b.daysAgo || b.time.localeCompare(a.time))
    .slice(0, limit)
    .map((a) => ({
      id: a.id,
      code: a.code,
      message: a.message,
      severity: a.severity,
      time: dayTimeLabel(a.daysAgo, a.time, now),
      tone: a.status === 'done' ? 'success' : a.severity === 'critical' ? 'danger' : 'warning',
    }));
}

// ============================================================================
// Bảo trì
// ============================================================================

/** "15 Tháng 9, 2026" (ảnh thiết kế). */
export function formatLongDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} Tháng ${m}, ${y}`;
}

export type MaintenanceSummary = {
  /** Việc chưa xong có hạn sớm nhất (có thể đã quá hạn). */
  next?: { record: MaintenanceRecord; date: string; dueText: string; overdue: boolean; daysLeft: number };
  /** Việc hoàn thành gần nhất. */
  last?: { record: MaintenanceRecord; date: string };
};

/** Tóm tắt bảo trì của một thiết bị. Ngày/quá hạn theo giờ nhà máy (`now` truyền vào). */
export function deriveMaintenanceSummary(rows: readonly MaintenanceRecord[], device: string, now: Date): MaintenanceSummary {
  const mine = rows.filter((r) => r.device === device);
  const next = mine.filter((r) => r.status !== 'done' && r.status !== 'cancelled').sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
  const last = mine
    .filter((r) => r.status === 'done' && r.completedAt)
    .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!))[0];
  return {
    next: next && {
      record: next,
      date: formatLongDate(next.dueAt),
      dueText: dueLabel(next, now),
      overdue: isOverdue(next, now),
      daysLeft: daysFromToday(next.dueAt, now),
    },
    last: last && { record: last, date: formatLongDate(last.completedAt!) },
  };
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Trang chi tiết tài sản: `{ status, data, error, refetch, live }`. `data` = thông số tĩnh (mock); `live` = số liệu
 * trực tiếp đã ghép (`deriveAssetLive`, tính lại mỗi lần render để "Mất tín hiệu" đúng mốc 10 s).
 */
export function useAssetDetail(assetId: string) {
  const [state, setState] = useState<QueryState<AssetDetail>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    fetchAssetDetail(assetId)
      .then((data) => !cancelled && setState({ status: 'success', data }))
      .catch((error: unknown) =>
        !cancelled && setState({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) }),
      );
    return () => {
      cancelled = true;
    };
  }, [assetId, attempt]);

  const tags = state.data ? Object.values(state.data.tags) : [];
  const liveData = useLiveData(tags, { enabled: !!state.data });
  const live = state.data ? deriveAssetLive(state.data, liveData, Date.now()) : undefined;
  const refetch = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, refetch, live, liveData };
}
