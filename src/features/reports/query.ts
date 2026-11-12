/*
 * Truy vấn báo cáo – THUẦN, là phần BACKEND làm khi có API (GET /reports, GET /reports/summary, GET /reports/:code):
 * lọc, sắp xếp, phân trang, đếm tab, facet, số liệu màn báo cáo. Hôm nay chạy trong mock server (`data/mockServer/reports.ts`,
 * tải lười) – trang chỉ nhận một trang + số đếm. Trạng thái hoàn thành / chữ ký suy theo `now` (giờ nhà máy).
 */
import {
  deriveAwaitingByStep,
  deriveMonthProgress,
  deriveReportKpis,
  deriveTodayActions,
  type MonthProgress,
  type ReportActionItem,
  type ReportKpis,
} from './derive';
import { matchReport, sortReports, type ReportFilterValues, type ReportTab } from './filter';
import { REPORT_PERIODS } from './period';
import { reportState, type ReportRecord, type SignatureStep } from './status';

/** Tham số GET /reports: bộ lọc + trang (1-based). */
export type ReportListQuery = ReportFilterValues & { page: number; pageSize: number };

export type ReportTabCounts = Record<ReportTab, number>;

/** Kết quả GET /reports. `page` đã kẹp vào [1, số trang]. */
export type ReportListResult = {
  rows: ReportRecord[];
  total: number;
  page: number;
  /** Số báo cáo từng tab theo các bộ lọc CÒN LẠI (không tính `tab`). */
  tabCounts: ReportTabCounts;
  /** Giá trị cho bộ lọc Ca / Người kiểm tra / Người duyệt (từ toàn bộ dữ liệu, sắp theo tiếng Việt). */
  facets: { shifts: string[]; inspectors: string[]; approvers: string[] };
};

/** GET /reports/summary – KPI, chờ xác nhận theo bước ký, tiến độ tháng, việc cần xử lý hôm nay. */
export type ReportSummary = {
  kpis: ReportKpis;
  awaitingByStep: Record<SignatureStep, number>;
  monthProgress: MonthProgress;
  actions: ReportActionItem[];
};

const TABS: readonly ReportTab[] = ['all', ...REPORT_PERIODS, 'signed'];

const distinct = (values: readonly (string | undefined)[]) =>
  [...new Set(values.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, 'vi'));

/** GET /reports – một trang kết quả + số đếm tab + facet. */
export function queryReports(all: readonly ReportRecord[], q: ReportListQuery, now: Date): ReportListResult {
  const tabCounts = Object.fromEntries(TABS.map((t) => [t, 0])) as ReportTabCounts;
  const rest: ReportFilterValues = { ...q, tab: 'all' };
  const matched: ReportRecord[] = [];
  for (const r of all) {
    if (!matchReport(r, rest, now)) continue;
    tabCounts.all += 1;
    tabCounts[r.period] += 1;
    if (reportState(r, now) === 'signed') tabCounts.signed += 1;
    if (matchReport(r, q, now)) matched.push(r);
  }
  matched.sort(sortReports);
  const size = Math.max(1, q.pageSize);
  const pages = Math.max(1, Math.ceil(matched.length / size));
  const page = Math.min(Math.max(1, Math.floor(q.page) || 1), pages);
  return {
    rows: matched.slice((page - 1) * size, page * size),
    total: matched.length,
    page,
    tabCounts,
    facets: {
      shifts: distinct(all.map((r) => r.shift)),
      inspectors: distinct(all.map((r) => r.inspector)),
      approvers: distinct(all.map((r) => r.approver)),
    },
  };
}

/** GET /reports/summary */
export function reportSummary(all: readonly ReportRecord[], now: Date): ReportSummary {
  return {
    kpis: deriveReportKpis(all, now),
    awaitingByStep: deriveAwaitingByStep(all, now),
    monthProgress: deriveMonthProgress(all, now),
    actions: deriveTodayActions(all, now),
  };
}

/** GET /reports/daily/:code – mã không phân biệt hoa thường; không có → null. */
export function findDailyReport(all: readonly ReportRecord[], code: string): ReportRecord | null {
  const key = code.trim().toUpperCase();
  return all.find((r) => r.period === 'daily' && r.code.toUpperCase() === key) ?? null;
}
