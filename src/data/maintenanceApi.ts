/*
 * Đọc / ghi bảo trì theo HÌNH DẠNG API cho trang KHÔNG cần cả danh sách (Cảnh báo, Tài sản…): yêu cầu liên kết cảnh báo,
 * danh bạ thiết bị, tạo yêu cầu. Module nhẹ – mock server + logic tạo (data/maintenance.ts) nạp LƯỜI khi gọi.
 */
import { useMemo } from 'react';
import type { StaffWorkload } from '@/features/maintenance/assign';
import type { MaintenanceListQuery, MaintenanceListResult, MaintenanceSummary } from '@/features/maintenance/query';
import type { MaintenanceRecord } from '@/features/maintenance/types';
import { useQuery } from '@/hooks/useQuery';
import { fromMock } from './contract';
import { maintenanceStore } from './maintenanceStore';
import type { DeviceDirectoryEntry } from './mockServer/maintenance';
import type { NewMaintenanceInput } from './maintenance';

export type { DeviceDirectoryEntry, MaintenanceListQuery, MaintenanceListResult, MaintenanceSummary, NewMaintenanceInput };

/** Đã có yêu cầu (chưa hủy) tạo từ cảnh báo này → tạo lại bị từ chối (drawer hiện "Xem MT-…" thay nút tạo). */
export class DuplicateFromAlertError extends Error {
  constructor(readonly existing: MaintenanceRecord) {
    super(`Cảnh báo ${existing.sourceAlertId} đã có yêu cầu bảo trì ${existing.code}.`);
  }
}

const server = () => import('./mockServer/maintenance');

/** TODO(backend): GET /maintenance?sourceAlertId=… */
export const fetchLinkedMaintenance = (alertId: string, _signal?: AbortSignal) =>
  fromMock(
    'GET /maintenance?sourceAlertId',
    (s) => s.LinkedMaintenanceSchema,
    server().then((s) => s.linkedTo(alertId)),
  );
/** TODO(backend): GET /devices */
export const fetchDeviceDirectory = (_signal?: AbortSignal) =>
  fromMock(
    'GET /devices',
    (s) => s.DeviceDirectorySchema,
    server().then((s) => s.deviceDirectory()),
  );
/** TODO(backend): POST /maintenance (409 khi cảnh báo đã có yêu cầu → DuplicateFromAlertError). */
export const createMaintenanceRequest = (input: NewMaintenanceInput) => import('./maintenance').then((m) => m.createMaintenance(input));

/** Phiên bản dữ liệu bảo trì – `revision` cho truy vấn bảo trì. */
export const useMaintenanceRevision = () => maintenanceStore.useVersion();

/** Yêu cầu đang hiệu lực tạo từ cảnh báo: `undefined` = đang tải, `null` = chưa có (hoặc không truyền cảnh báo). */
export function useLinkedMaintenance(alertId: string | null | undefined) {
  const revision = useMaintenanceRevision();
  const q = useQuery(alertId ?? '', (signal) => (alertId ? fetchLinkedMaintenance(alertId, signal) : Promise.resolve(null)), { revision });
  return q.status === 'success' ? q.data : undefined;
}

/** Danh bạ thiết bị (form tạo yêu cầu); [] khi đang tải. */
export function useDeviceDirectory(enabled = true): DeviceDirectoryEntry[] {
  const revision = useMaintenanceRevision();
  const q = useQuery(enabled ? 'devices' : '', (signal) => (enabled ? fetchDeviceDirectory(signal) : Promise.resolve([])), {
    revision,
    keepPrevious: true,
  });
  return q.data ?? [];
}

/** TODO(backend): GET /maintenance?device=… */
export const fetchMaintenanceByDevice = (device: string, _signal?: AbortSignal) =>
  fromMock(
    'GET /maintenance?device',
    (s) => s.MaintenanceArraySchema,
    server().then((s) => s.byDevice(device)),
  );

/** Yêu cầu bảo trì của một thiết bị. */
export function useMaintenanceByDevice(device: string) {
  const revision = useMaintenanceRevision();
  return useQuery(device, (signal) => fetchMaintenanceByDevice(device, signal), { revision, remember: 'maintenance-by-device' });
}

/** TODO(backend): GET /maintenance?tab&q&area&priority&type&range&sort&page&size → MaintenanceListResult. */
export const fetchMaintenanceList = (q: MaintenanceListQuery, _signal?: AbortSignal) =>
  fromMock(
    'GET /maintenance',
    (s) => s.MaintenanceListResultSchema,
    server().then((s) => s.list(q)),
  );
/** TODO(backend): GET /maintenance/summary → { counts, priority, schedule }. */
export const fetchMaintenanceSummary = (_signal?: AbortSignal) =>
  fromMock(
    'GET /maintenance/summary',
    (s) => s.MaintenanceSummarySchema,
    server().then((s) => s.summary()),
  );
/** TODO(backend): GET /maintenance/:id (mã không phân biệt hoa thường; 404 → null). */
export const fetchMaintenanceById = (id: string, _signal?: AbortSignal) =>
  fromMock(
    'GET /maintenance/:id',
    (s) => s.MaintenanceOrNullSchema,
    server().then((s) => s.byId(id)),
  );
/** TODO(backend): GET /staff/maintenance-loads */
export const fetchMaintenanceLoads = (_signal?: AbortSignal) =>
  fromMock(
    'GET /staff/maintenance-loads',
    (s) => s.MaintenanceLoadsSchema,
    server().then((s) => s.loads()),
  );

/**
 * `tick` = mốc phút của "bây giờ" ở trang (useNow 60 s): quá hạn / "tháng này" đổi theo thời gian → tải lại NGẦM mỗi phút
 * (giữ dữ liệu đang hiện).
 */
const minuteKey = (tick: Date) => String(Math.floor(tick.getTime() / 60_000));

/** Một trang bảng bảo trì. Đổi bộ lọc / trang → giữ trang cũ (`pending`) tới khi có kết quả mới. */
export function useMaintenancePage(q: MaintenanceListQuery, tick: Date) {
  const revision = `${useMaintenanceRevision()}:${minuteKey(tick)}`;
  return useQuery(JSON.stringify(q), (signal) => fetchMaintenanceList(q, signal), { revision, keepPrevious: true });
}

/** KPI + việc ưu tiên + lịch sắp tới. */
export function useMaintenanceSummary(tick: Date) {
  const revision = `${useMaintenanceRevision()}:${minuteKey(tick)}`;
  return useQuery('summary', fetchMaintenanceSummary, { revision, keepPrevious: true });
}

/** Một yêu cầu theo mã (null = không mở / không có). */
export function useMaintenanceById(id: string | null | undefined) {
  const revision = useMaintenanceRevision();
  return useQuery(id ?? '', (signal) => (id ? fetchMaintenanceById(id, signal) : Promise.resolve(null)), { revision });
}

/** Tải việc theo người xử lý chính (hộp phân công); Map rỗng khi đang tải. */
export function useMaintenanceLoads(): ReadonlyMap<string, StaffWorkload> {
  const revision = useMaintenanceRevision();
  const { data } = useQuery('loads', fetchMaintenanceLoads, { revision, keepPrevious: true });
  return useMemo(() => new Map(Object.entries(data ?? {})), [data]);
}
