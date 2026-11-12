/*
 * "Cơ sở dữ liệu" báo cáo của mock server – module NHẸ. Trang KHÔNG đọc danh sách từ đây: đọc qua `data/reportApi.ts`
 * (máy chủ lọc / phân trang / đếm). Thao tác ghi (ký, ghi nhận mốc) sửa qua `replaceReport` → store tăng phiên bản → các
 * truy vấn đang hiện tải lại ngầm. Khi có API: bỏ module này, ghi = POST/PUT rồi refetch.
 */
import type { ReportRecord } from '@/features/reports';
import { createCollectionStore } from '@/lib/createCollectionStore';
import { appNow } from '@/lib/demoNow';

/** Bản ghi mock – sinh lười lần tải đầu theo ngày hiện tại (mock không nằm trong bundle chính). */
let db: ReportRecord[] = [];
let seeding: Promise<void> | null = null;

/** Đợi dữ liệu sẵn sàng – thao tác ghi gọi trước `currentReports()`. Khi có API: thay bằng request tới máy chủ. */
export function reportsReady(): Promise<void> {
  seeding ??= import('@/mocks/reports').then(({ buildReports }) => {
    db = buildReports(appNow());
  });
  return seeding;
}

/** GET /reports (toàn bộ) – chỉ mock server dùng. */
async function fetchAll(): Promise<ReportRecord[]> {
  await reportsReady();
  return [...db];
}

export const reportStore = createCollectionStore(fetchAll);

/** Bản hiện tại (đồng bộ) cho mock server + thao tác ghi; gọi sau `reportsReady()`. */
export const currentReports = (): readonly ReportRecord[] => db;

/** Thay một bản ghi (optimistic). TODO(backend): POST rồi refetch – hợp đồng ở docs/decisions.md. */
export function replaceReport(next: ReportRecord) {
  db = db.map((r) => (r.id === next.id ? next : r));
  reportStore.commit([...db]);
}
