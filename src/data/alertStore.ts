/*
 * Store danh sách cảnh báo (mock hôm nay, API sau này) – module NHẸ, chỉ đọc/ghi danh sách.
 * Tách khỏi `data/alerts.ts` vì `LiveAnnouncer` (bundle chính, mọi trang) chỉ cần đếm cảnh báo chưa xác nhận: import
 * từ đây thì logic quy trình/bộ lọc/KPI ở `data/alerts.ts` chỉ nằm trong chunk các trang dùng nó.
 */
import { createCollectionStore } from '@/lib/createCollectionStore';
import { alertRecords, type AlertRecord } from '@/mocks/alerts';

let db: AlertRecord[] = alertRecords.map((a) => ({ ...a }));

/** GET /alerts – thay bằng fetch thật khi có API. */
export async function fetchAlerts(): Promise<AlertRecord[]> {
  return db.map((a) => ({ ...a }));
}

export const alertStore = createCollectionStore(fetchAlerts);

/** Bản hiện tại (đồng bộ) cho thao tác ghi ở `data/alerts.ts`. */
export const currentAlerts = (): readonly AlertRecord[] => db;

/** Áp `fn` lên các bản ghi `ids` rồi commit (optimistic; khi có API: gọi POST rồi refetch). */
export function mutateAlerts(ids: readonly string[], fn: (a: AlertRecord) => AlertRecord) {
  const set = new Set(ids);
  db = db.map((a) => (set.has(a.id) ? fn(a) : a));
  alertStore.commit(db.map((a) => ({ ...a })));
}

/** Chỉ đọc danh sách (`{ status, data, error, refetch }`) – không kéo logic thao tác. */
export const useAlertList = () => alertStore.useCollection();
