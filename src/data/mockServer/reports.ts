/*
 * MOCK SERVER báo cáo – thay cho backend tới khi có API (tải lười: chỉ nạp khi trang gọi `fetch*` ở `data/reportApi.ts`).
 * Logic lọc / đếm ở `features/reports/query.ts` (thuần) – backend làm đúng phần đó. "Bây giờ" = giờ của máy chủ (`appNow`).
 */
import { findDailyReport, queryReports, reportSummary, type ReportListQuery, type ReportListResult, type ReportSummary } from '@/features/reports';
import type { ReportRecord } from '@/features/reports';
import { appNow } from '@/lib/demoNow';
import { currentReports, reportsReady } from '../reports';

export async function list(q: ReportListQuery): Promise<ReportListResult> {
  await reportsReady();
  return queryReports(currentReports(), q, appNow());
}

export async function summary(): Promise<ReportSummary> {
  await reportsReady();
  return reportSummary(currentReports(), appNow());
}

export async function dailyByCode(code: string): Promise<ReportRecord | null> {
  await reportsReady();
  return findDailyReport(currentReports(), code);
}
