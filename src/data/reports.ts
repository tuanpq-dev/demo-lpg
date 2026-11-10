/*
 * Lớp dữ liệu màn Báo cáo. Trang chỉ đọc qua `useReports()`; số liệu suy dẫn dùng `derive*` ở `features/reports`.
 */
import type { ReportRecord } from '@/features/reports';
import { createCollectionStore } from '@/lib/createCollectionStore';
import { appNow } from '@/lib/demoNow';
import { buildReports } from '@/mocks/reports';

/**
 * Nguồn dữ liệu. TODO(backend): `api.request('/reports?year=…', { schema })` – hợp đồng ở docs/decisions.md
 * (mục "Báo cáo – hợp đồng API cần bổ sung").
 */
async function fetchReports(): Promise<ReportRecord[]> {
  return buildReports(appNow());
}

const store = createCollectionStore(fetchReports);

export function useReports() {
  return store.useCollection();
}

/** Bản hiện tại (đồng bộ) cho thao tác ghi; chưa tải xong → rỗng. */
export const currentReports = (): readonly ReportRecord[] => store.getState().data ?? [];

/** Thay một bản ghi (optimistic). TODO(backend): POST rồi refetch – hợp đồng ở docs/decisions.md. */
export function replaceReport(next: ReportRecord) {
  const s = store.getState();
  if (s.status !== 'success') return;
  store.commit(s.data.map((r) => (r.id === next.id ? next : r)));
}
