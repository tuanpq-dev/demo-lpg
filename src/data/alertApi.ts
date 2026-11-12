/*
 * Đọc cảnh báo theo HÌNH DẠNG API (máy chủ lọc / phân trang / đếm) – trang không tải toàn bộ danh sách.
 * Mỗi `fetch*` = một endpoint; hôm nay gọi mock server tải lười (`mockServer/alerts.ts`), khi có backend thay thân hàm bằng
 * `api.request(…, { schema, signal })` (hợp đồng: docs/decisions.md "Truy vấn phía máy chủ"). Hook đọc qua `useQuery` với
 * `revision` = phiên bản store: thao tác ghi (xác nhận, phân công…) xong → mọi truy vấn đang hiện tải lại NGẦM.
 */
import { useMemo } from 'react';
import type { AlertLoad } from '@/features/alerts/assignStaff';
import type { RelatedAlert } from '@/features/alerts/close';
import type { AlertListQuery, AlertListResult, AlertRange, AlertSummary } from '@/features/alerts/query';
import type { AlertRecord } from '@/features/alerts/types';
import { useQuery } from '@/lib/useQuery';
import { alertStore } from './alertStore';

export type { AlertListQuery, AlertListResult, AlertSummary };

const server = () => import('./mockServer/alerts');

/** TODO(backend): GET /alerts?tab&q&severity&area&device&shift&range&page&size → AlertListResult. */
export const fetchAlertList = (q: AlertListQuery, _signal?: AbortSignal) => server().then((s) => s.list(q));
/** TODO(backend): GET /alerts/summary?range → { counts, priority }. */
export const fetchAlertSummary = (range: AlertRange, _signal?: AbortSignal) => server().then((s) => s.summary(range));
/** TODO(backend): GET /alerts/:id (404 → null). */
export const fetchAlert = (id: string, _signal?: AbortSignal) => server().then((s) => s.byId(id));
/** TODO(backend): GET /alerts?ids=… */
export const fetchAlertsByIds = (ids: readonly string[], _signal?: AbortSignal) => server().then((s) => s.byIds(ids));
/** TODO(backend): GET /alerts?devices=…&kinds=… */
export const fetchAlertsByDevices = (devices: readonly string[], kinds: readonly string[] = [], _signal?: AbortSignal) =>
  server().then((s) => s.byDevices(devices, kinds));
/** TODO(backend): GET /alerts/related-open?ids=… */
export const fetchRelatedOpen = (ids: readonly string[], _signal?: AbortSignal) => server().then((s) => s.relatedOpen(ids));
/** TODO(backend): GET /staff/alert-loads */
export const fetchAlertLoads = (_signal?: AbortSignal) => server().then((s) => s.loads());
/** TODO(backend): GET /alerts/counts (+ đẩy qua WebSocket khi có cảnh báo mới). */
export const fetchAlertCounts = (_signal?: AbortSignal) => server().then((s) => s.counts());
/** TODO(backend): GET /alerts?from&to */
export const fetchRecentAlerts = (maxDaysAgo: number, _signal?: AbortSignal) => server().then((s) => s.recent(maxDaysAgo));

/** Phiên bản dữ liệu cảnh báo (đổi khi có thao tác ghi) – `revision` cho mọi truy vấn cảnh báo. */
export const useAlertRevision = () => alertStore.useVersion();

/** Một trang bảng cảnh báo. Đổi bộ lọc / trang → giữ trang cũ (`pending`) tới khi có kết quả mới. */
export function useAlertPage(q: AlertListQuery) {
  const revision = useAlertRevision();
  return useQuery(JSON.stringify(q), (signal) => fetchAlertList(q, signal), { revision, keepPrevious: true });
}

/** KPI + cảnh báo ưu tiên trong khoảng thời gian. */
export function useAlertSummary(range: AlertRange) {
  const revision = useAlertRevision();
  return useQuery(range, (signal) => fetchAlertSummary(range, signal), { revision, keepPrevious: true });
}

/** Một cảnh báo theo id (null = không mở / không có). */
export function useAlertById(id: string | null | undefined) {
  const revision = useAlertRevision();
  return useQuery(id ?? '', (signal) => (id ? fetchAlert(id, signal) : Promise.resolve(null)), { revision });
}

/** Cảnh báo của các thiết bị hoặc thuộc các loại (trang tài sản, chi tiết thiết bị, lỗi cảm biến khi ký báo cáo). */
export function useAlertsByDevices(devices: readonly string[], kinds: readonly string[] = []) {
  const revision = useAlertRevision();
  const key = `${[...devices].sort().join('|')}#${[...kinds].sort().join('|')}`;
  return useQuery(key, (signal) => fetchAlertsByDevices(devices, kinds, signal), { revision });
}

/** Cảnh báo theo id (cảnh báo nguồn của yêu cầu bảo trì…). */
export function useAlertsByIds(ids: readonly string[]) {
  const revision = useAlertRevision();
  const key = [...ids].sort().join('|');
  return useQuery(key, (signal) => (ids.length ? fetchAlertsByIds(ids, signal) : Promise.resolve([])), { revision });
}

/** Cảnh báo đang mở liên quan theo id (điều kiện đóng); `undefined` khi đang tải. */
export function useRelatedOpen(ids: readonly string[]): Record<string, RelatedAlert[]> | undefined {
  const revision = useAlertRevision();
  const key = [...ids].sort().join('|');
  const q = useQuery(key, (signal) => (ids.length ? fetchRelatedOpen(ids, signal) : Promise.resolve({})), { revision, keepPrevious: true });
  return q.pending ? undefined : q.data;
}

/** Tải việc theo người phụ trách (hộp phân công); Map rỗng khi đang tải. */
export function useAlertLoads(): ReadonlyMap<string, AlertLoad> {
  const revision = useAlertRevision();
  const { data } = useQuery('loads', fetchAlertLoads, { revision, keepPrevious: true });
  return useMemo(() => new Map(Object.entries(data ?? {})), [data]);
}

/** Số cảnh báo chưa xác nhận (chuông, tab header); undefined khi chưa tải. */
export function useUnacknowledgedCount(): number | undefined {
  const revision = useAlertRevision();
  return useQuery('counts', fetchAlertCounts, { revision, keepPrevious: true }).data?.unacknowledged;
}

/** Cảnh báo `daysAgo` ≤ `maxDaysAgo` (nhật ký vận hành). */
export function useRecentAlerts(maxDaysAgo: number) {
  const revision = useAlertRevision();
  return useQuery(String(maxDaysAgo), (signal) => fetchRecentAlerts(maxDaysAgo, signal), { revision, keepPrevious: true });
}

export type { AlertRecord };
