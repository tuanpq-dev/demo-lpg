/*
 * MOCK SERVER bảo trì – thay backend tới khi có API (tải lười qua `data/maintenanceApi.ts`). Mỗi hàm = một endpoint.
 */
import { linkedMaintenance } from '@/features/alerts/workflow';
import { computeWorkloads, type StaffWorkload } from '@/features/maintenance/assign';
import {
  maintenanceCounts,
  priorityMaintenance,
  queryMaintenance,
  upcomingPeriodic,
  type MaintenanceListQuery,
  type MaintenanceListResult,
  type MaintenanceSummary,
} from '@/features/maintenance/query';
import type { MaintenanceRecord } from '@/features/maintenance/types';
import { appNow } from '@/lib/demoNow';
import { alertsReady, currentAlerts } from '../alertStore';
import { currentMaintenance, maintenanceReady } from '../maintenanceStore';

export type DeviceDirectoryEntry = { device: string; area: string };

const copy = (r: MaintenanceRecord): MaintenanceRecord => ({ ...r });

async function db(): Promise<readonly MaintenanceRecord[]> {
  await maintenanceReady();
  return currentMaintenance();
}

/** GET /maintenance?sourceAlertId=… – yêu cầu đang hiệu lực tạo từ cảnh báo (null = chưa có). */
export async function linkedTo(alertId: string): Promise<Pick<MaintenanceRecord, 'id' | 'code' | 'status'> | null> {
  const r = linkedMaintenance(alertId, await db());
  return r ? { id: r.id, code: r.code, status: r.status } : null;
}

/** GET /devices – danh bạ thiết bị → khu vực (form tạo yêu cầu). Bảo trì ghi đè cảnh báo khi trùng thiết bị. */
export async function deviceDirectory(): Promise<DeviceDirectoryEntry[]> {
  await alertsReady();
  const directory = new Map<string, string>();
  for (const a of currentAlerts()) directory.set(a.device, a.area);
  for (const r of await db()) directory.set(r.device, r.area);
  return [...directory.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([device, area]) => ({ device, area }));
}

/** GET /maintenance?device=… – yêu cầu của một thiết bị (tóm tắt ở trang tài sản / thiết bị). */
export async function byDevice(device: string): Promise<MaintenanceRecord[]> {
  return (await db()).filter((r) => r.device === device).map(copy);
}

/** GET /maintenance/:id – mã không phân biệt hoa thường (`mt-00128` → MT-00128); không có → null (404). */
export async function byId(id: string): Promise<MaintenanceRecord | null> {
  const key = id.trim().toUpperCase();
  const r = key ? (await db()).find((x) => x.id.toUpperCase() === key) : undefined;
  return r ? copy(r) : null;
}

/** GET /maintenance?tab&q&area&priority&type&range&sort&page&size – "bây giờ" = giờ máy chủ. */
export async function list(q: MaintenanceListQuery): Promise<MaintenanceListResult> {
  const r = queryMaintenance(await db(), q, appNow());
  return { ...r, rows: r.rows.map(copy) };
}

/** GET /maintenance/summary – số đếm KPI + việc ưu tiên + lịch định kỳ sắp tới. */
export async function summary(): Promise<MaintenanceSummary> {
  const all = await db();
  const now = appNow();
  return { counts: maintenanceCounts(all, now), priority: priorityMaintenance(all, now).map(copy), schedule: upcomingPeriodic(all, now).map(copy) };
}

/** GET /staff/maintenance-loads – việc đang làm / quá hạn theo người xử lý chính (hộp phân công). */
export async function loads(): Promise<Record<string, StaffWorkload>> {
  return Object.fromEntries(computeWorkloads(await db(), appNow()));
}
