/*
 * Lớp dữ liệu màn Nhật ký vận hành (`/operations/logs`). Trang chỉ đọc qua `useOperationLogs(now)`:
 * sự kiện hệ thống/người dùng (mock theo ngày) + cảnh báo của store chung (một nguồn với Trung tâm cảnh báo).
 */
import { useCallback, useMemo } from 'react';
import { alertToLogEvent, type OperationLogEvent } from '@/features/operations/logs';
import { createCollectionStore } from '@/lib/createCollectionStore';
import { appNow } from '@/lib/demoNow';
import { plantDayKey } from '@/lib/plantTime';
import { buildOperationLogs } from '@/mocks/operationLogs';
import { useRecentAlerts } from './alertApi';

/** GET /operation-logs – TODO(backend): `api.request('/operation-logs?from=&to=', { schema })` (docs/decisions.md). */
async function fetchOperationLogs(): Promise<OperationLogEvent[]> {
  return buildOperationLogs(appNow());
}

const store = createCollectionStore(fetchOperationLogs);

type LogsState =
  | { status: 'loading'; data?: undefined; error?: undefined; refetch: () => void }
  | { status: 'error'; data?: undefined; error: Error; refetch: () => void }
  | { status: 'success'; data: OperationLogEvent[]; error?: undefined; refetch: () => void };

/** Sự kiện nhật ký (chưa lọc, chưa sắp xếp). Lỗi/tải ở một trong hai nguồn → cả trang lỗi/tải. */
/** Khoảng lớn nhất của bộ lọc nhật ký (`30d` = hôm nay + 29 ngày trước). */
const LOG_WINDOW_DAYS = 29;

export function useOperationLogs(now: Date): LogsState {
  const logs = store.useCollection();
  // Cảnh báo trong khoảng lớn nhất của bộ lọc nhật ký (30 ngày – GET /alerts?from&to), không tải toàn bộ lịch sử.
  const alerts = useRecentAlerts(LOG_WINDOW_DAYS);
  const refetchLogs = logs.refetch;
  const refetchAlerts = alerts.refetch;
  const refetch = useCallback(() => {
    refetchLogs();
    refetchAlerts();
  }, [refetchLogs, refetchAlerts]);
  // `daysAgo` của cảnh báo tính theo ngày → chỉ tính lại khi sang ngày mới (không mỗi phút).
  const day = plantDayKey(now);
  const data = useMemo(() => {
    if (logs.status !== 'success' || alerts.status !== 'success') return undefined;
    const ref = new Date(`${day}T12:00:00+07:00`);
    return [...logs.data, ...alerts.data.map((a) => alertToLogEvent(a, ref))];
  }, [logs.status, logs.data, alerts.status, alerts.data, day]);

  if (logs.status === 'error') return { status: 'error', error: logs.error, refetch };
  if (alerts.status === 'error') return { status: 'error', error: alerts.error, refetch };
  if (!data) return { status: 'loading', refetch };
  return { status: 'success', data, refetch };
}
