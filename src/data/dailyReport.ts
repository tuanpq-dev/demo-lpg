/*
 * Lớp dữ liệu màn "Chi tiết báo cáo ngày" (`/reports/daily/:code`). Bản ghi báo cáo lấy từ CÙNG store với danh sách
 * (`useReports`) → trạng thái/chữ ký ở hai màn luôn khớp; số đo theo mốc là mock riêng.
 */
import { useMemo } from 'react';
import { useIdentityRevision, useQuery } from '@/lib/useQuery';
import type { DailyReadingRow, ReportRecord } from '@/features/reports';
import { appNow } from '@/lib/demoNow';
import { buildDailyReadings } from '@/mocks/dailyReport';
import { useReports } from './reports';

/** Đường dẫn chi tiết của báo cáo; chỉ báo cáo NGÀY có màn chi tiết (tháng/quý/năm chờ thiết kế). */
export function reportDetailPath(r: Pick<ReportRecord, 'period' | 'code'>): string | null {
  return r.period === 'daily' ? `/reports/daily/${r.code}` : null;
}

/** Mã trên URL không phân biệt hoa thường ("bcvh-n-24062026"). */
export function findDailyReport(rows: readonly ReportRecord[], code: string): ReportRecord | undefined {
  const key = code.trim().toUpperCase();
  return rows.find((r) => r.period === 'daily' && r.code.toUpperCase() === key);
}

/**
 * Số đo theo mốc. TODO(backend): `api.request('/reports/:code/readings', { schema })` – hợp đồng ở docs/decisions.md
 * ("Báo cáo – hợp đồng API cần bổ sung").
 */
export async function fetchDailyReadings(report: ReportRecord, _signal?: AbortSignal): Promise<DailyReadingRow[]> {
  return buildDailyReadings(report, appNow());
}

/**
 * Số đo theo mốc của `report` (`{ status, data, error, refetch }`); `report` chưa có → loading. Bản ghi đổi (ghi mốc, ký) →
 * tải lại ngầm, giữ số đang hiện.
 */
export function useDailyReadings(report: ReportRecord | undefined) {
  const revision = useIdentityRevision(report);
  return useQuery(report?.id ?? '', (signal) => (report ? fetchDailyReadings(report, signal) : new Promise<DailyReadingRow[]>(() => {})), {
    revision,
  });
}

export type DailyReportState =
  | { status: 'loading'; error?: undefined; report?: undefined; readings?: undefined; refetch: () => void }
  | { status: 'error'; error: Error; report?: undefined; readings?: undefined; refetch: () => void }
  | { status: 'not-found'; error?: undefined; report?: undefined; readings?: undefined; refetch: () => void }
  | { status: 'success'; error?: undefined; report: ReportRecord; readings: DailyReadingRow[]; refetch: () => void };

export function useDailyReport(code: string): DailyReportState & { reports: readonly ReportRecord[] } {
  const { status, data, error, refetch } = useReports();
  const report = useMemo(() => (data ? findDailyReport(data, code) : undefined), [data, code]);
  const readings = useDailyReadings(report);
  const reports = data ?? [];
  if (status === 'loading') return { status, refetch, reports };
  if (status === 'error') return { status, error, refetch, reports };
  if (!report) return { status: 'not-found', refetch, reports };
  if (readings.status === 'loading') return { status: 'loading', refetch, reports };
  if (readings.status === 'error') return { status: 'error', error: readings.error, refetch: readings.refetch, reports };
  return { status: 'success', report, readings: readings.data, refetch, reports };
}
