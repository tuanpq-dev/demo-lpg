/*
 * MOCK SERVER cảnh báo – thay cho backend tới khi có API (tải lười: chỉ nạp khi trang gọi `fetch*` ở `data/alertApi.ts`).
 * Mỗi hàm = một endpoint; kết quả là bản sao (như JSON từ mạng – trang sửa object không đụng "cơ sở dữ liệu" mock).
 * Logic lọc / đếm thuần ở `features/alerts/query.ts` – backend làm tương đương.
 */
import { computeAlertLoads, type AlertLoad } from '@/features/alerts/assignStaff';
import { relatedOpenAlerts, type RelatedAlert } from '@/features/alerts/close';
import {
  alertCounts,
  priorityAlerts,
  queryAlerts,
  unacknowledgedCount,
  type AlertListQuery,
  type AlertListResult,
  type AlertRange,
  type AlertSummary,
} from '@/features/alerts/query';
import type { AlertRecord } from '@/features/alerts/types';
import { alertsReady, currentAlerts } from '../alertStore';

const copy = (a: AlertRecord): AlertRecord => ({ ...a });

async function db(): Promise<readonly AlertRecord[]> {
  await alertsReady();
  return currentAlerts();
}

/** GET /alerts?tab&q&severity&area&device&shift&range&page&size */
export async function list(q: AlertListQuery): Promise<AlertListResult> {
  const r = queryAlerts(await db(), q);
  return { ...r, rows: r.rows.map(copy) };
}

/** GET /alerts/summary?range */
export async function summary(range: AlertRange): Promise<AlertSummary> {
  const all = await db();
  return { counts: alertCounts(all, range), priority: priorityAlerts(all).map(copy) };
}

/** GET /alerts/:id (không có → null, tương đương 404). */
export async function byId(id: string): Promise<AlertRecord | null> {
  const a = (await db()).find((x) => x.id === id);
  return a ? copy(a) : null;
}

/** GET /alerts?ids=… – các cảnh báo theo mã (lựa chọn nhiều trang, cảnh báo nguồn của yêu cầu bảo trì…). */
export async function byIds(ids: readonly string[]): Promise<AlertRecord[]> {
  const set = new Set(ids);
  return (await db()).filter((a) => set.has(a.id)).map(copy);
}

/** GET /alerts?devices=…&kinds=… – cảnh báo của các thiết bị HOẶC thuộc các loại (trang tài sản / thiết bị, lỗi cảm biến). */
export async function byDevices(devices: readonly string[], kinds: readonly string[] = []): Promise<AlertRecord[]> {
  const d = new Set(devices);
  const k = new Set(kinds);
  return (await db()).filter((a) => d.has(a.device) || (a.kind !== undefined && k.has(a.kind))).map(copy);
}

/** GET /alerts/related-open?ids=… – cảnh báo đang mở cùng thiết bị / khu của từng cảnh báo (điều kiện đóng). */
export async function relatedOpen(ids: readonly string[]): Promise<Record<string, RelatedAlert[]>> {
  const all = await db();
  const out: Record<string, RelatedAlert[]> = {};
  for (const id of ids) {
    const a = all.find((x) => x.id === id);
    if (a) out[id] = relatedOpenAlerts(a, all);
  }
  return out;
}

/** GET /staff/alert-loads – số cảnh báo đang xử lý theo người phụ trách (hộp phân công). */
export async function loads(): Promise<Record<string, AlertLoad>> {
  return Object.fromEntries(computeAlertLoads(await db()));
}

/** GET /alerts/counts – số chưa xác nhận (chuông + tab header). */
export async function counts(): Promise<{ unacknowledged: number }> {
  return { unacknowledged: unacknowledgedCount(await db()) };
}

/** GET /alerts?from&to – cảnh báo trong khoảng ngày (nhật ký vận hành). `daysAgo` ≤ `maxDaysAgo`. */
export async function recent(maxDaysAgo: number): Promise<AlertRecord[]> {
  return (await db()).filter((a) => a.daysAgo <= maxDaysAgo).map(copy);
}
