/*
 * Truy vấn danh sách bảo trì – THUẦN, là phần BACKEND làm khi có API (GET /maintenance, GET /maintenance/summary,
 * GET /staff/maintenance-loads): lọc, sắp xếp, phân trang, đếm tab, facet, số đếm KPI, việc ưu tiên, lịch định kỳ, tải việc.
 * Hôm nay chạy trong mock server (`data/mockServer/maintenance.ts`, tải lười) – trang chỉ nhận một trang + số đếm.
 * `now` truyền vào (máy chủ dùng giờ của nó; quá hạn / "tháng này" theo giờ nhà máy).
 */
import { daysFromToday, plantMonthKey } from '@/lib/plantTime';
import { isOpenRequest, isPastDue, isRequestOverdue } from './deadline';
import type { MaintenanceRecord, MaintenanceStatus, MaintenanceType } from './types';

type Severity = MaintenanceRecord['priority'];

export type MaintenanceTab = 'all' | Exclude<MaintenanceStatus, 'cancelled'> | 'overdue';
export type MaintenanceRange = 'all' | 'today' | '7d' | '30d';
export type MaintenanceSort = 'created' | 'due';

export type MaintenanceFilters = {
  tab: MaintenanceTab;
  q: string;
  area: string | null;
  priority: Severity | null;
  type: MaintenanceType | null;
  range: MaintenanceRange;
  sort: MaintenanceSort;
};

/** Tham số GET /maintenance: bộ lọc + trang (1-based). */
export type MaintenanceListQuery = MaintenanceFilters & { page: number; pageSize: number };

export type MaintenanceTabCounts = Record<MaintenanceTab, number>;

/** Kết quả GET /maintenance. `page` đã kẹp vào [1, số trang]. */
export type MaintenanceListResult = {
  rows: MaintenanceRecord[];
  total: number;
  page: number;
  /** Số yêu cầu từng tab theo các bộ lọc CÒN LẠI (không tính `tab`). */
  tabCounts: MaintenanceTabCounts;
  /** Khu vực có trong dữ liệu (bộ lọc Khu vực). */
  facets: { areas: string[] };
};

/** Số đếm KPI (70:5207). Yêu cầu đã hủy không tính vào KPI nào. */
export type MaintenanceCounts = {
  createdThisMonth: number;
  createdLastMonth: number;
  pending: number;
  inProgress: number;
  review: number;
  doneThisMonth: number;
  overdue: number;
};

/** GET /maintenance/summary: KPI + việc ưu tiên + lịch định kỳ sắp tới. */
export type MaintenanceSummary = {
  counts: MaintenanceCounts;
  priority: MaintenanceRecord[];
  schedule: MaintenanceRecord[];
};

const RANGE_DAYS: Record<Exclude<MaintenanceRange, 'all'>, number> = { today: 0, '7d': 6, '30d': 29 };

/** Một yêu cầu có khớp bộ lọc không. Đã hủy chỉ hiện ở tab "Tất cả". */
export function matchMaintenance(r: MaintenanceRecord, f: MaintenanceFilters, now: Date) {
  const q = f.q.trim().toLowerCase();
  const age = -daysFromToday(r.createdAt, now);
  return (
    (f.range === 'all' || age <= RANGE_DAYS[f.range]) &&
    (f.tab === 'all' || (f.tab === 'overdue' ? isRequestOverdue(r, now) : r.status === f.tab)) &&
    (!q || [r.code, r.title, r.device, r.area, r.assignee ?? ''].some((s) => s.toLowerCase().includes(q))) &&
    (!f.area || r.area === f.area) &&
    (!f.priority || r.priority === f.priority) &&
    (!f.type || r.type === f.type)
  );
}

/** created: mới tạo trước (rồi mã giảm dần) · due: hạn gần nhất trước. */
export function sortMaintenance(a: MaintenanceRecord, b: MaintenanceRecord, sort: MaintenanceSort) {
  return sort === 'due' ? a.dueAt.localeCompare(b.dueAt) : b.createdAt.localeCompare(a.createdAt) || b.code.localeCompare(a.code);
}

const TABS: readonly MaintenanceTab[] = ['all', 'pending', 'assigned', 'in-progress', 'review', 'done', 'overdue'];

/** GET /maintenance – một trang kết quả + số đếm tab + facet. */
export function queryMaintenance(all: readonly MaintenanceRecord[], q: MaintenanceListQuery, now: Date): MaintenanceListResult {
  const tabCounts = Object.fromEntries(TABS.map((t) => [t, 0])) as MaintenanceTabCounts;
  const rest = { ...q, tab: 'all' as const };
  const matched: MaintenanceRecord[] = [];
  for (const r of all) {
    if (!matchMaintenance(r, rest, now)) continue;
    tabCounts.all += 1;
    if (r.status !== 'cancelled') tabCounts[r.status] += 1;
    const overdue = isRequestOverdue(r, now);
    if (overdue) tabCounts.overdue += 1;
    if (q.tab === 'all' || (q.tab === 'overdue' ? overdue : r.status === q.tab)) matched.push(r);
  }
  matched.sort((a, b) => sortMaintenance(a, b, q.sort));
  const size = Math.max(1, q.pageSize);
  const pages = Math.max(1, Math.ceil(matched.length / size));
  const page = Math.min(Math.max(1, Math.floor(q.page) || 1), pages);
  return {
    rows: matched.slice((page - 1) * size, page * size),
    total: matched.length,
    page,
    tabCounts,
    facets: { areas: [...new Set(all.map((r) => r.area))].sort() },
  };
}

/** Ngày `iso` thuộc tháng hiện tại (giờ nhà máy) dời `monthOffset` tháng. */
const inMonth = (iso: string | null, monthOffset: number, now: Date) => !!iso && iso.slice(0, 7) === plantMonthKey(now, monthOffset);

/** Số đếm KPI: tạo trong tháng / tháng trước, theo trạng thái, hoàn thành trong tháng, quá hạn. */
export function maintenanceCounts(all: readonly MaintenanceRecord[], now: Date): MaintenanceCounts {
  const c: MaintenanceCounts = { createdThisMonth: 0, createdLastMonth: 0, pending: 0, inProgress: 0, review: 0, doneThisMonth: 0, overdue: 0 };
  for (const r of all) {
    if (r.status === 'cancelled') continue;
    if (inMonth(r.createdAt, 0, now)) c.createdThisMonth += 1;
    if (inMonth(r.createdAt, -1, now)) c.createdLastMonth += 1;
    if (r.status === 'pending') c.pending += 1;
    else if (r.status === 'in-progress') c.inProgress += 1;
    else if (r.status === 'review') c.review += 1;
    else if (r.status === 'done' && inMonth(r.completedAt, 0, now)) c.doneThisMonth += 1;
    if (isRequestOverdue(r, now)) c.overdue += 1;
  }
  return c;
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/** Việc ưu tiên: chưa xong, mức Nghiêm trọng/Cao; quá hạn trước, rồi hạn gần nhất, rồi mức độ (70:4969). */
export function priorityMaintenance(all: readonly MaintenanceRecord[], now: Date, limit = 3): MaintenanceRecord[] {
  return all
    .filter((r) => isOpenRequest(r) && (r.priority === 'critical' || r.priority === 'high'))
    .sort((a, b) => daysFromToday(a.dueAt, now) - daysFromToday(b.dueAt, now) || SEVERITY_RANK[a.priority] - SEVERITY_RANK[b.priority])
    .slice(0, limit);
}

/** Lịch sắp tới: việc ĐỊNH KỲ còn mở, chưa tới giờ hạn (đã quá giờ → sang "Quá hạn"), gần nhất trước (70:4889). */
export function upcomingPeriodic(all: readonly MaintenanceRecord[], now: Date, limit = 3): MaintenanceRecord[] {
  return all
    .filter((r) => r.type === 'periodic' && isOpenRequest(r) && !isPastDue(r.dueAt, now, r.dueHasTime !== false))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, limit);
}
