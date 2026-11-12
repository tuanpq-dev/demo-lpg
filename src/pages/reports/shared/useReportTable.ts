import { useMemo } from 'react';
import { useFilterParams } from '@/app/useTableFilters';
import { useReportPage, type ReportListQuery } from '@/data/reportApi';
import { reportParams, type ReportTab } from '@/features/reports';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

/** Ô tìm kiếm: chỉ gửi truy vấn khi ngừng gõ (URL vẫn cập nhật ngay). */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Bảng báo cáo phân trang Ở MÁY CHỦ, bộ lọc đồng bộ URL
 * (`?tab=&q=&date=&shift=&completion=&signature=&inspector=&approver=&size=&page=`). Trang chỉ giữ một trang dòng + số đếm.
 * `defaultTab` = tab mở sẵn của từng màn (màn báo cáo vận hành: "daily"); `now` = mốc phút để tải lại ngầm.
 */
export function useReportTable(defaultTab: ReportTab, now: Date) {
  const spec = useMemo(() => reportParams(defaultTab), [defaultTab]);
  const params = useFilterParams(spec);
  const { size, ...filters } = params.values;
  const q = useDebouncedValue(filters.q, SEARCH_DEBOUNCE_MS);
  const pageSize = Number(size);
  const query: ReportListQuery = { ...filters, q, page: params.page, pageSize };
  const list = useReportPage(query, now);
  return { ...params, pageSize, list };
}

export type ReportTableState = ReturnType<typeof useReportTable>;
