import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTableFilters } from '@/app/useTableFilters';
import { PAGE_SIZES, matchReport, reportParams, sortReports, type ReportFilterValues, type ReportRecord, type ReportTab } from '@/features/reports';

const getId = (r: ReportRecord) => r.id;

/**
 * Trạng thái bảng báo cáo đồng bộ URL (`?tab=&q=&date=&shift=&completion=&signature=&inspector=&approver=&size=&page=`).
 * `defaultTab` = tab mở sẵn của từng màn (màn báo cáo vận hành: "daily").
 */
export function useReportTable(rows: readonly ReportRecord[], now: Date, defaultTab: ReportTab) {
  const params = useMemo(() => reportParams(defaultTab), [defaultTab]);
  const match = useCallback((r: ReportRecord, v: ReportFilterValues) => matchReport(r, v, now), [now]);
  // Số dòng mỗi trang nằm trong URL (`size`, cùng khai báo ở `params`) – useTableFilters cần nó trước khi đọc params.
  const [search] = useSearchParams();
  const raw = search.get('size');
  const pageSize = Number((PAGE_SIZES as readonly string[]).includes(raw ?? '') ? raw : params.size.default);
  return useTableFilters({ rows, getId, params, match, sort: sortReports, pageSize, tabKey: 'tab' });
}

export type ReportTableState = ReturnType<typeof useReportTable>;
