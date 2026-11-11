/*
 * Store danh sách cảnh báo (mock hôm nay, API sau này) – module NHẸ, chỉ đọc/ghi danh sách.
 * Tách khỏi `data/alerts.ts` vì `LiveAnnouncer` (bundle chính, mọi trang) chỉ cần đếm cảnh báo chưa xác nhận: import
 * từ đây thì logic quy trình/bộ lọc/KPI ở `data/alerts.ts` chỉ nằm trong chunk các trang dùng nó.
 */
import { createCollectionStore } from '@/lib/createCollectionStore';
import type { AlertRecord } from '@/features/alerts/types';

/** Bản ghi mock – nạp lười lần tải đầu (mock ~7 KB không nằm trong bundle chính). */
let db: AlertRecord[] = [];
let seeding: Promise<void> | null = null;

/**
 * Đợi dữ liệu cảnh báo sẵn sàng – thao tác cần ĐỌC đủ danh sách trước khi kiểm điều kiện (vd ký báo cáo kiểm lỗi cảm
 * biến) gọi hàm này trước `currentAlerts()`. Khi có API: thay bằng refetch / kiểm ở máy chủ.
 */
export function alertsReady(): Promise<void> {
  seeding ??= import('@/mocks/alerts').then(({ alertRecords }) => {
    db = alertRecords.map((a) => ({ ...a }));
  });
  return seeding;
}

/** GET /alerts – thay bằng fetch thật khi có API. */
async function fetchAlerts(): Promise<AlertRecord[]> {
  await alertsReady();
  return db.map((a) => ({ ...a }));
}

export const alertStore = createCollectionStore(fetchAlerts);

/** Bản hiện tại (đồng bộ) cho thao tác ghi ở `data/alerts.ts`. */
export const currentAlerts = (): readonly AlertRecord[] => db;

/** Áp `fn` lên các bản ghi `ids` rồi commit (optimistic; khi có API: gọi POST rồi refetch). */
export function mutateAlerts(ids: readonly string[], fn: (a: AlertRecord) => AlertRecord) {
  const set = new Set(ids);
  // Ghi chỉ xảy ra sau khi danh sách đã tải (trang hiện dữ liệu) – `db` đã có mock.
  db = db.map((a) => (set.has(a.id) ? fn(a) : a));
  alertStore.commit(db.map((a) => ({ ...a })));
}

/** Chỉ đọc danh sách (`{ status, data, error, refetch }`) – không kéo logic thao tác. */
export const useAlertList = () => alertStore.useCollection();
