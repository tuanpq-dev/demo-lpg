/*
 * "Cơ sở dữ liệu" yêu cầu bảo trì của mock server – module NHẸ (không kéo mock / quy trình). Bản ghi mẫu nạp LƯỜI lần đầu
 * cần (`maintenanceReady`). Thao tác ghi (`data/maintenance.ts`) sửa qua `mutateMaintenance` / `insertMaintenance` → store
 * tăng phiên bản → mọi truy vấn bảo trì đang hiện tải lại ngầm. Khi có API: bỏ module này, ghi = POST/PATCH rồi refetch.
 */
import { createCollectionStore } from '@/lib/createCollectionStore';
import type { MaintenanceRecord } from '@/features/maintenance/types';

let db: MaintenanceRecord[] = [];
let seeding: Promise<void> | null = null;

/** Đợi dữ liệu mẫu sẵn sàng (nạp một lần). Mọi đọc / ghi của mock server gọi trước. */
export function maintenanceReady(): Promise<void> {
  seeding ??= import('@/mocks/maintenanceRecords').then(({ maintenanceRecords }) => {
    db = maintenanceRecords.map((r) => ({ ...r }));
  });
  return seeding;
}

/** GET /maintenance (toàn bộ) – chỉ cho trang còn lọc ở client; trang lớn đọc qua `data/maintenanceApi.ts`. */
async function fetchAll(): Promise<MaintenanceRecord[]> {
  await maintenanceReady();
  return db.map((r) => ({ ...r }));
}

export const maintenanceStore = createCollectionStore(fetchAll);

/** Bản hiện tại (đồng bộ) – chỉ dùng SAU `maintenanceReady()`. */
export const currentMaintenance = (): readonly MaintenanceRecord[] => db;

const commit = () => maintenanceStore.commit(db.map((r) => ({ ...r })));

/** Áp `fn` lên các bản ghi `ids` rồi commit. */
export async function mutateMaintenance(ids: readonly string[], fn: (r: MaintenanceRecord) => MaintenanceRecord) {
  await maintenanceReady();
  const set = new Set(ids);
  db = db.map((r) => (set.has(r.id) ? fn(r) : r));
  commit();
}

/** Thêm bản ghi mới lên đầu danh sách rồi commit. */
export async function insertMaintenance(record: MaintenanceRecord) {
  await maintenanceReady();
  db = [record, ...db];
  commit();
}
