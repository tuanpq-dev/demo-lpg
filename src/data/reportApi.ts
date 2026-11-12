/*
 * Đọc báo cáo theo HÌNH DẠNG API (máy chủ lọc / phân trang / đếm) – trang không tải toàn bộ danh sách.
 * Mỗi `fetch*` = một endpoint; hôm nay gọi mock server tải lười (`mockServer/reports.ts`) qua `fromMock` (dev / test kiểm
 * response theo schema `src/api/reportSchemas.ts`); khi có backend thay bằng `api.request(…, { schema, signal })` giữ
 * nguyên schema. Hợp đồng: docs/decisions.md "Báo cáo – hợp đồng API cần bổ sung".
 */
import type { ReportListQuery, ReportListResult, ReportRecord, ReportSummary } from '@/features/reports';
import { useQuery } from '@/lib/useQuery';
import { fromMock } from './contract';
import { reportStore } from './reports';

export type { ReportListQuery, ReportListResult, ReportSummary };

const server = () => import('./mockServer/reports');

/** TODO(backend): GET /reports?tab&q&date&shift&completion&signature&inspector&approver&page&size → ReportListResult. */
export const fetchReportList = (q: ReportListQuery, _signal?: AbortSignal): Promise<ReportListResult> =>
  fromMock(
    'GET /reports',
    (s) => s.ReportListResultSchema,
    server().then((s) => s.list(q)),
  );
/** TODO(backend): GET /reports/summary → KPI, chờ xác nhận theo bước, tiến độ tháng, việc cần xử lý hôm nay. */
export const fetchReportSummary = (_signal?: AbortSignal): Promise<ReportSummary> =>
  fromMock(
    'GET /reports/summary',
    (s) => s.ReportSummarySchema,
    server().then((s) => s.summary()),
  );
/** TODO(backend): GET /reports/daily/:code (mã không phân biệt hoa thường; 404 → null). */
export const fetchDailyReport = (code: string, _signal?: AbortSignal): Promise<ReportRecord | null> =>
  fromMock(
    'GET /reports/daily/:code',
    (s) => s.DailyReportOrNullSchema,
    server().then((s) => s.dailyByCode(code)),
  );

/**
 * `revision` cho truy vấn báo cáo: phiên bản store (ký, ghi nhận mốc) + mốc phút của "bây giờ" ở trang – trạng thái hoàn thành /
 * mốc thiếu đổi theo thời gian → tải lại NGẦM mỗi phút (giữ dữ liệu đang hiện).
 */
function useReportRevision(tick?: Date) {
  const version = reportStore.useVersion();
  return tick ? `${version}@${Math.floor(tick.getTime() / 60_000)}` : version;
}

/** Một trang bảng báo cáo. Đổi bộ lọc / trang → giữ trang cũ (`pending`) tới khi có kết quả mới. */
export function useReportPage(q: ReportListQuery, tick: Date) {
  const revision = useReportRevision(tick);
  return useQuery(JSON.stringify(q), (signal) => fetchReportList(q, signal), { revision, keepPrevious: true });
}

/** KPI + thẻ tóm tắt màn báo cáo. */
export function useReportSummary(tick: Date) {
  const revision = useReportRevision(tick);
  return useQuery('summary', fetchReportSummary, { revision, keepPrevious: true });
}

/** Báo cáo ngày theo mã trên URL (null = không có). Ký / ghi nhận mốc → tải lại ngầm. */
export function useDailyReportByCode(code: string | null | undefined) {
  const revision = useReportRevision();
  return useQuery(code ?? '', (signal) => (code ? fetchDailyReport(code, signal) : Promise.resolve(null)), { revision });
}
