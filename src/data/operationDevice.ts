import { useCallback, useMemo } from 'react';
import { WORK_STATUS_LABEL } from '@/components/Badge';
import { mockHistory, tagSeed, trendLabel, type ViewTone } from '@/features/operations/device';
import { formatDayVi } from '@/lib/plantTime';
import type { AlertRecord } from '@/features/alerts/types';
import { operationDevices, plcScadaDevices } from '@/mocks/operations';
import type { OperationDeviceMock, PlcScadaDeviceMock } from '@/features/operations/types';
import { liveBase } from '@/mocks/scenes/live';
import { alertBadgeStatus } from './alerts';
import { useAlertsByDevices } from './alertApi';
import { dayTimeLabel, type MaintenanceSummary } from './assetDetail';
import { useLiveData } from './live';
import { useQuery } from '@/hooks/useQuery';

export type {
  DeviceParam,
  DeviceParamId,
  OperationDeviceMock,
  PlcScadaDeviceMock,
  PlcSignal,
  PlcSource,
  PlcSourceIcon,
} from '@/features/operations/types';

/** Mọi loại thiết bị có trang chi tiết (`kind` quyết định KPI / cột trái của trang). */
export type AnyOperationDevice = OperationDeviceMock | PlcScadaDeviceMock;

const allDevices: Record<string, AnyOperationDevice> = { ...operationDevices, ...plcScadaDevices };

/** Mã thiết bị có trang chi tiết ở màn Vận hành. */
export const OPERATION_DEVICE_IDS = Object.keys(allDevices);

/** Lựa chọn ô "Thiết bị" ở header trang chi tiết – chỉ mã (tên đã có ở chip "Tên" ngay cạnh; nhãn dài đẩy header xuống 3 hàng). */
export const OPERATION_DEVICE_OPTIONS: readonly { value: string; label: string }[] = OPERATION_DEVICE_IDS.map((id) => ({ value: id, label: id }));

/** Mã chuẩn từ URL ("e-101a" → "E-101A"); không có trang → null. */
export function resolveOperationDeviceId(raw: string | null | undefined): string | null {
  const key = (raw ?? '').trim().toUpperCase();
  if (!key) return null;
  return OPERATION_DEVICE_IDS.find((id) => id.toUpperCase() === key) ?? null;
}

/** GET /api/devices/:id – mock hôm nay. */
async function fetchOperationDevice(id: string): Promise<AnyOperationDevice> {
  const d = allDevices[id];
  if (!d) throw new Error(`Không có thiết bị "${id}" (có: ${OPERATION_DEVICE_IDS.join(', ')})`);
  return d;
}

// ============================================================================
// Cảnh báo liên quan (thuần)
// ============================================================================

export type DeviceAlertItem = {
  id: string;
  code: string;
  message: string;
  severity: AlertRecord['severity'];
  /** "14:22" · "Hôm qua" · "20/10". */
  time: string;
  statusLabel: string;
  /** Màu vạch: đã xử lý / hoàn thành → success · nghiêm trọng → danger · còn lại warning. */
  tone: 'success' | 'warning' | 'danger';
};

export type DeviceAlerts = {
  items: DeviceAlertItem[];
  /** Tổng số cảnh báo liên quan (chip "N mục"), không chỉ số đang hiện. */
  total: number;
  /** Cảnh báo NGHIÊM TRỌNG chưa xử lý xong (chưa xác nhận / đang xử lý) – "Cảnh báo nghiêm trọng". */
  criticalOpen: number;
};

const isClosed = (a: AlertRecord) => a.status === 'done' || a.status === 'resolved';

/** Cảnh báo có thiết bị thuộc `devices` (hoặc LOẠI thuộc `kinds`), mới nhất trước; `limit` mục đầu để hiển thị. */
export function deriveDeviceAlerts(
  alerts: readonly AlertRecord[],
  devices: readonly string[],
  now: Date,
  limit = 3,
  kinds: readonly string[] = [],
): DeviceAlerts {
  const mine = alerts
    .filter((a) => devices.includes(a.device) || (a.kind !== undefined && kinds.includes(a.kind)))
    .sort((a, b) => a.daysAgo - b.daysAgo || b.time.localeCompare(a.time));
  return {
    total: mine.length,
    criticalOpen: mine.filter((a) => a.severity === 'critical' && !isClosed(a)).length,
    items: mine.slice(0, limit).map((a) => ({
      id: a.id,
      code: a.code,
      message: a.message,
      severity: a.severity,
      time: dayTimeLabel(a.daysAgo, a.time, now),
      statusLabel: WORK_STATUS_LABEL[alertBadgeStatus(a.status)],
      tone: isClosed(a) ? 'success' : a.severity === 'critical' ? 'danger' : 'warning',
    })),
  };
}

// ============================================================================
// Bảo trì (thuần – từ `deriveMaintenanceSummary` của trang tài sản)
// ============================================================================

export type DeviceMaintenanceView = {
  /** Chip header: "Đúng hạn" · "Quá hạn" · "Chưa lên lịch". */
  badge: { label: string; tone: ViewTone };
  technician: string;
  /** "12/09/2026" · "Chưa có". */
  lastDate: string;
  /** "Bảo trì tiếp theo": "12 ngày" · "Hôm nay" · "Quá hạn 2 ngày" · "Chưa lên lịch". */
  next: { text: string; tone: ViewTone };
};

export function deriveDeviceMaintenance(s: MaintenanceSummary): DeviceMaintenanceView {
  const n = s.next;
  return {
    badge: !n
      ? { label: 'Chưa lên lịch', tone: 'neutral' }
      : n.overdue
        ? { label: 'Quá hạn', tone: 'danger' }
        : { label: 'Đúng hạn', tone: 'success' },
    technician: n?.record.assignee ?? s.last?.record.assignee ?? 'Chưa phân công',
    lastDate: s.last?.record.completedAt ? formatDayVi(s.last.record.completedAt) : 'Chưa có',
    next: !n
      ? { text: 'Chưa lên lịch', tone: 'neutral' }
      : n.overdue
        ? { text: n.dueText, tone: 'danger' }
        : n.daysLeft <= 0
          ? { text: 'Hôm nay', tone: 'warning' }
          : { text: `${n.daysLeft} ngày`, tone: 'neutral' },
  };
}

// ============================================================================
// Xu hướng
// ============================================================================

/**
 * Lịch sử mock theo phút cho các tag của biểu đồ (giá trị nền = số nền của nguồn trực tiếp giả lập).
 * TODO(backend): `GET /api/tags/history?tags=…&minutes=60`.
 */
export function deviceHistory(device: OperationDeviceMock, now: number): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const s of [device.trend.temperature, device.trend.pressure]) {
    const p = device.params.find((x) => x.id === s.param)!;
    const base = liveBase[p.tag];
    out[p.tag] = typeof base === 'number' ? mockHistory(base, s.amplitude, tagSeed(p.tag), device.trend.minutes, now) : [];
  }
  return out;
}

/**
 * Lịch sử mock độ trễ dữ liệu (s) của hệ PLC/SCADA – cùng cách giả lập với `deviceHistory`.
 * TODO(backend): `GET /api/tags/history?tags=PLC-01.LATENCY&minutes=60`.
 */
export function plcLatencyHistory(device: PlcScadaDeviceMock, now: number): number[] {
  const base = liveBase[device.tags.latency];
  return typeof base === 'number' ? mockHistory(base, device.trend.latency.amplitude, tagSeed(device.tags.latency), device.trend.minutes, now) : [];
}

/** Tag cần theo dõi trực tiếp của thiết bị (tham số / tín hiệu PLC / trạng thái chạy / tag giám sát). */
function deviceLiveTags(d: AnyOperationDevice): string[] {
  const common = d.plcSignals.map((s) => s.tag);
  const own =
    d.kind === 'vaporizer' ? [...d.params.map((p) => p.tag), d.stateTag, d.standby.stateTag] : [...Object.values(d.tags), ...d.monitoredTags];
  return [...new Set([...own, ...common])];
}

/** Điểm biểu đồ: lịch sử + điểm "Bây giờ" = số trực tiếp (null khi mất tín hiệu → không vẽ, không hiện số cũ). */
export function trendPoints(
  minutes: number,
  series: readonly { key: string; history: readonly number[]; current: number | undefined }[],
): ({ label: string } & Record<string, number | string | null>)[] {
  return Array.from({ length: minutes + 1 }, (_, i) => {
    const k = minutes - i;
    const point: { label: string } & Record<string, number | string | null> = { label: trendLabel(k) };
    for (const s of series) point[s.key] = k === 0 ? (s.current ?? null) : (s.history[i] ?? null);
    return point;
  });
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Trang chi tiết thiết bị: `{ status, data, error, refetch, liveData, alerts }`. Số đo từ `useLiveData` (mọi tag của tham số
 * + tín hiệu PLC + trạng thái chạy); trang tự tính trạng thái bằng hàm thuần trong `features/operations/device.ts`.
 */
const NO_LIST: string[] = [];

export function useOperationDevice(id: string) {
  const { refetch: refetchDevice, ...state } = useQuery(id, () => fetchOperationDevice(id));

  const d = state.data;
  const tags = useMemo(() => (d ? deviceLiveTags(d) : []), [d]);
  const liveData = useLiveData(tags, { enabled: !!d });
  // Chỉ cảnh báo của thiết bị liên quan / loại liên quan (máy chủ lọc).
  const alerts = useAlertsByDevices(d?.relatedDevices ?? NO_LIST, d?.relatedKinds ?? NO_LIST);
  const refetchAlerts = alerts.refetch;
  const refetch = useCallback(() => {
    refetchDevice();
    refetchAlerts();
  }, [refetchDevice, refetchAlerts]);
  return { ...state, refetch, liveData, tags, alerts };
}
