import type { KpiTone, StatusPillTone, TankLayerItem } from '@/components';
import { STATUS_LABEL, WATER_STATUS_LABEL, type AssetEventType, type Reading, type useAssetDetail } from '@/data/assetDetail';
import { SIGNAL_LOST_LABEL } from '@/features/live/signal';

/** Số liệu trực tiếp của trang tài sản (khi đã có). */
export type AssetLive = NonNullable<ReturnType<typeof useAssetDetail>['live']>;

/** Định nghĩa hiển thị ở tooltip KPI "Mức bồn" (khác dòng "LPG lỏng"). */
export const LEVEL_HINT =
  'Mức bồn = % thể tích toàn bộ chất lỏng (LPG lỏng + nước đáy), quy đổi từ mức chiều cao theo hình học bồn trụ nằm; chờ bảng dung tích thật.';

/** Màu chữ theo loại sự kiện (chú thích + cột "Loại"). */
export const EVENT_TONE: Record<AssetEventType, { text: string; dot: string }> = {
  sensor: { text: 'text-info', dot: 'bg-info' },
  operation: { text: 'text-warning', dot: 'bg-warning' },
  system: { text: 'text-fg-secondary', dot: 'bg-fg-secondary' },
  alert: { text: 'text-danger-text', dot: 'bg-danger' },
};

export const statusTone = (s: string): StatusPillTone =>
  s === 'danger' ? 'danger' : s === 'warning' ? 'warning' : s === 'normal' ? 'success' : 'neutral';
export const kpiTone = (r: Reading): KpiTone => (r.status === 'danger' ? 'danger' : r.status === 'warning' ? 'warning' : 'neutral');
export const fixed = (v: number, d = 1) => v.toFixed(d);
export const lost = (r: Reading) => r.state === 'lost';
/** "9.2 bar" · "Mất tín hiệu" · "—". */
export const readingText = (r: Reading, digits: number, unit: string) =>
  r.state === 'ok' ? `${fixed(r.value!, digits)}${unit}` : r.state === 'lost' ? SIGNAL_LOST_LABEL : '—';

type Tone = TankLayerItem['tone'];
const statusItemTone = (s: string | undefined): Tone =>
  s === 'normal' ? 'success' : s === 'warning' ? 'warning' : s === 'danger' ? 'danger' : 'muted';

/**
 * 5 dòng "Trạng thái tồn chứa": LPG lỏng / pha hơi / nước đáy ("12.3% | 4.5 m³"; mất tín hiệu → "Mất tín hiệu"; chưa có → "—"),
 * trạng thái tồn chứa, cảnh báo nước đáy.
 */
export function tankLayerItems({
  layers,
  layersState,
  storageStatus,
  waterStatus,
}: Pick<AssetLive, 'layers' | 'layersState' | 'storageStatus' | 'waterStatus'>): TankLayerItem[] {
  const value = (pct?: number, vol?: number) =>
    layers && pct !== undefined && vol !== undefined
      ? `${fixed(pct)}% | ${vol.toFixed(vol < 1 ? 2 : 1)} m³`
      : layersState === 'lost'
        ? SIGNAL_LOST_LABEL
        : '—';
  return [
    { id: 'lpg', label: 'LPG lỏng', value: value(layers?.lpg.percent, layers?.lpg.volume), tone: layers ? 'info' : 'muted' },
    { id: 'vapor', label: 'Pha hơi / khí gas', value: value(layers?.vapor.percent, layers?.vapor.volume), tone: layers ? 'neutral' : 'muted' },
    { id: 'water', label: 'Nước đáy bồn', value: value(layers?.water.percent, layers?.water.volume), tone: layers ? 'warning' : 'muted' },
    { id: 'status', label: 'Trạng thái', value: STATUS_LABEL[storageStatus], tone: statusItemTone(storageStatus) },
    {
      id: 'water-alarm',
      label: 'Cảnh báo nước đáy',
      value: waterStatus ? WATER_STATUS_LABEL[waterStatus] : layersState === 'lost' ? SIGNAL_LOST_LABEL : '—',
      tone: statusItemTone(waterStatus),
    },
  ];
}
