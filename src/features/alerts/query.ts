/*
 * Truy vấn danh sách cảnh báo – THUẦN, là phần BACKEND làm khi có API (GET /alerts, GET /alerts/summary): lọc, sắp xếp,
 * phân trang, đếm theo tab, danh sách giá trị cho bộ lọc, số đếm KPI, cảnh báo ưu tiên. Hôm nay chạy trong mock server
 * (`data/mockServer/alerts.ts`, tải lười) – trang chỉ nhận MỘT trang kết quả + số đếm, không giữ / duyệt toàn bộ dữ liệu.
 */
import type { AlertRecord, AlertStatus } from './types';

export type AlertTab = 'all' | AlertStatus;
export type AlertRange = 'today' | '7d' | '30d';
/** Ca làm việc – dùng cho Select "Thời gian". */
export type AlertShift = 'night' | 'morning' | 'afternoon';

export type AlertFilters = {
  tab: AlertTab;
  q: string;
  severity: AlertRecord['severity'] | null;
  area: string | null;
  device: string | null;
  shift: AlertShift | null;
  range: AlertRange;
};

/** Tham số GET /alerts: bộ lọc + trang (1-based). */
export type AlertListQuery = AlertFilters & { page: number; pageSize: number };

export type AlertTabCounts = Record<AlertTab, number>;

/** Kết quả GET /alerts. `page` đã kẹp vào [1, số trang] (URL cũ trỏ trang không còn → trang cuối). */
export type AlertListResult = {
  rows: AlertRecord[];
  total: number;
  page: number;
  /** Số cảnh báo từng tab theo các bộ lọc CÒN LẠI (không tính `tab`). */
  tabCounts: AlertTabCounts;
  /** Giá trị có trong dữ liệu cho bộ lọc Khu vực / Thiết bị (sắp xếp theo tiếng Việt). */
  facets: { areas: string[]; devices: string[] };
};

/** Số đếm KPI trong khoảng thời gian (GET /alerts/summary). */
export type AlertCounts = { total: number; critical: number; unacknowledged: number; inProgress: number; done: number };

export type AlertSummary = {
  counts: AlertCounts;
  /** Cảnh báo ưu tiên (mới nhất, còn phải xử lý, Nghiêm trọng / Cao). */
  priority: AlertRecord[];
};

const RANGE_DAYS: Record<AlertRange, number> = { today: 0, '7d': 6, '30d': 29 };

const inRange = (a: AlertRecord, range: AlertRange) => a.daysAgo <= RANGE_DAYS[range];

export function shiftOf(time: string): AlertShift {
  const h = Number(time.slice(0, 2));
  if (h >= 6 && h < 14) return 'morning';
  if (h >= 14 && h < 22) return 'afternoon';
  return 'night';
}

/** Một cảnh báo có khớp bộ lọc không. */
export function matchAlert(a: AlertRecord, f: AlertFilters) {
  const q = f.q.trim().toLowerCase();
  return (
    inRange(a, f.range) &&
    (f.tab === 'all' || a.status === f.tab) &&
    (!q || [a.code, a.message, a.device, a.area, a.assignee ?? ''].some((s) => s.toLowerCase().includes(q))) &&
    (!f.severity || a.severity === f.severity) &&
    (!f.area || a.area === f.area) &&
    (!f.device || a.device === f.device) &&
    (!f.shift || shiftOf(a.time) === f.shift)
  );
}

/** Mới nhất trước: theo ngày rồi theo giờ. */
export const byNewest = (a: AlertRecord, b: AlertRecord) => a.daysAgo - b.daysAgo || b.time.localeCompare(a.time);

const unique = (values: readonly string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, 'vi'));

/** GET /alerts – một trang kết quả + số đếm tab + facet. Một lượt duyệt dữ liệu cho cả lọc lẫn đếm tab. */
export function queryAlerts(all: readonly AlertRecord[], q: AlertListQuery): AlertListResult {
  const tabCounts: AlertTabCounts = { all: 0, unacknowledged: 0, 'in-progress': 0, resolved: 0, done: 0 };
  const rest = { ...q, tab: 'all' as const };
  const matched: AlertRecord[] = [];
  for (const a of all) {
    if (!matchAlert(a, rest)) continue;
    tabCounts.all += 1;
    tabCounts[a.status] += 1;
    if (q.tab === 'all' || a.status === q.tab) matched.push(a);
  }
  matched.sort(byNewest);
  const size = Math.max(1, q.pageSize);
  const pages = Math.max(1, Math.ceil(matched.length / size));
  const page = Math.min(Math.max(1, Math.floor(q.page) || 1), pages);
  return {
    rows: matched.slice((page - 1) * size, page * size),
    total: matched.length,
    page,
    tabCounts,
    facets: { areas: unique(all.map((a) => a.area)), devices: unique(all.map((a) => a.device)) },
  };
}

/** Số đếm KPI trong khoảng thời gian; Đã xử lý (chờ đóng) chỉ đếm vào tổng (KPI riêng chỉ có ở tab "Chờ đóng"). */
export function alertCounts(all: readonly AlertRecord[], range: AlertRange): AlertCounts {
  const c: AlertCounts = { total: 0, critical: 0, unacknowledged: 0, inProgress: 0, done: 0 };
  for (const a of all) {
    if (!inRange(a, range)) continue;
    c.total += 1;
    if (a.severity === 'critical') c.critical += 1;
    if (a.status === 'unacknowledged') c.unacknowledged += 1;
    else if (a.status === 'in-progress') c.inProgress += 1;
    else if (a.status === 'done') c.done += 1;
  }
  return c;
}

/**
 * Cảnh báo ưu tiên = mới nhất, CÒN PHẢI XỬ LÝ (Chưa xác nhận / Đang xử lý – Đã xử lý chờ đóng không còn ưu tiên), mức
 * Nghiêm trọng/Cao (khớp Figma 70:2910).
 */
export function priorityAlerts(all: readonly AlertRecord[], limit = 3): AlertRecord[] {
  return all
    .filter((a) => (a.status === 'unacknowledged' || a.status === 'in-progress') && (a.severity === 'critical' || a.severity === 'high'))
    .sort(byNewest)
    .slice(0, limit);
}

/** Số cảnh báo chưa xác nhận (mọi thời điểm) – chuông + tab Cảnh báo ở header. */
export const unacknowledgedCount = (all: readonly AlertRecord[]) => all.filter((a) => a.status === 'unacknowledged').length;
