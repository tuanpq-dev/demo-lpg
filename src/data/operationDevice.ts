import { useCallback, useEffect, useMemo, useState } from 'react';
import { WORK_STATUS_LABEL } from '@/components/Badge';
import { mockHistory, tagSeed, trendLabel, type ViewTone } from '@/features/operations/device';
import { formatDayVi } from '@/lib/plantTime';
import type { AlertRecord } from '@/mocks/alerts';
import { operationDevices, type OperationDeviceMock } from '@/mocks/operations';
import { liveBase } from '@/mocks/scenes/live';
import { alertBadgeStatus } from './alerts';
import { useAlertList } from './alertStore';
import { dayTimeLabel, type MaintenanceSummary } from './assetDetail';
import { useLiveData } from './live';
import type { QueryState } from './overview';

export type { DeviceParam, DeviceParamId, OperationDeviceMock, PlcSignal } from '@/mocks/operations';

/** Mã thiết bị có trang chi tiết ở màn Vận hành. */
export const OPERATION_DEVICE_IDS = Object.keys(operationDevices);

/** Mã chuẩn từ URL ("e-101a" → "E-101A"); không có trang → null. */
export function resolveOperationDeviceId(raw: string | null | undefined): string | null {
  const key = (raw ?? '').trim().toUpperCase();
  if (!key) return null;
  return OPERATION_DEVICE_IDS.find((id) => id.toUpperCase() === key) ?? null;
}

/** GET /api/devices/:id – mock hôm nay. */
export async function fetchOperationDevice(id: string): Promise<OperationDeviceMock> {
  const d = operationDevices[id];
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

/** Cảnh báo có thiết bị thuộc `devices`, mới nhất trước; `limit` mục đầu để hiển thị. */
export function deriveDeviceAlerts(alerts: readonly AlertRecord[], devices: readonly string[], now: Date, limit = 3): DeviceAlerts {
  const mine = alerts.filter((a) => devices.includes(a.device)).sort((a, b) => a.daysAgo - b.daysAgo || b.time.localeCompare(a.time));
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
    badge: !n ? { label: 'Chưa lên lịch', tone: 'neutral' } : n.overdue ? { label: 'Quá hạn', tone: 'danger' } : { label: 'Đúng hạn', tone: 'success' },
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
export function useOperationDevice(id: string) {
  const [state, setState] = useState<QueryState<OperationDeviceMock>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    fetchOperationDevice(id)
      .then((data) => !cancelled && setState({ status: 'success', data }))
      .catch((error: unknown) => !cancelled && setState({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) }));
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  const d = state.data;
  const tags = useMemo(
    () => (d ? [...new Set([...d.params.map((p) => p.tag), ...d.plcSignals.map((s) => s.tag), d.stateTag, d.standby.stateTag])] : []),
    [d],
  );
  const liveData = useLiveData(tags, { enabled: !!d });
  const alerts = useAlertList();
  const refetchAlerts = alerts.refetch;
  const refetch = useCallback(() => {
    setAttempt((n) => n + 1);
    refetchAlerts();
  }, [refetchAlerts]);
  return { ...state, refetch, liveData, tags, alerts };
}
