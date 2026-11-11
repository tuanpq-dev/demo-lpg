/*
 * Nhật ký vận hành (Figma bản sao A88YJ2BRhICDDdeu2rtRg1 node 64:418) – logic THUẦN: kiểu sự kiện, nhãn, gộp cảnh báo vào
 * nhật ký, KPI suy dẫn, lọc/sắp xếp, CSV. Mọi hàm nhận `now` qua tham số; "hôm nay" theo giờ nhà máy.
 */
import type { AlertRecord } from '@/features/alerts/types';
import { foldSearch } from '@/lib/foldSearch';
import { dayNumber, formatDayVi, parsePlantDateTime, plantDayKey, plantTimeOfDay } from '@/lib/plantTime';
import { CSV_BOM, toCsv } from '@/lib/download';

export const LOG_CATEGORIES = ['operation', 'alert', 'user-action', 'connection'] as const;
export type LogCategory = (typeof LOG_CATEGORIES)[number];

export const LOG_CATEGORY_LABEL: Record<LogCategory, string> = {
  operation: 'Sự kiện vận hành',
  alert: 'Cảnh báo',
  'user-action': 'Thao tác người dùng',
  connection: 'Kết nối thiết bị',
};

/** Ba mức của nhật ký (Figma: Thông tin · Trung · Cao). */
export type LogLevel = 'info' | 'medium' | 'high';

export const LOG_LEVEL_LABEL: Record<LogLevel, string> = { info: 'Thông tin', medium: 'Trung bình', high: 'Cao' };

/**
 * Trạng thái sự kiện: open = Chưa xử lý · in-progress = Đang xử lý · monitoring = Đang theo dõi · done = Hoàn thành ·
 * recorded = Ghi nhận (sự kiện chỉ để lưu vết, không cần xử lý).
 */
export type LogStatus = 'open' | 'in-progress' | 'monitoring' | 'done' | 'recorded';

export const LOG_STATUS_LABEL: Record<LogStatus, string> = {
  open: 'Chưa xử lý',
  'in-progress': 'Đang xử lý',
  monitoring: 'Đang theo dõi',
  done: 'Hoàn thành',
  recorded: 'Ghi nhận',
};

export type OperationLogEvent = {
  id: string;
  /** Mã sự kiện: "EV-ddmm-nnn" (sự kiện hệ thống/người dùng) hoặc mã cảnh báo "ALT-…" (sự kiện lấy từ store cảnh báo). */
  code: string;
  /** ISO – thời điểm tuyệt đối. */
  at: string;
  category: LogCategory;
  level: LogLevel;
  title: string;
  area: string;
  device: string;
  status: LogStatus;
  /** Người thực hiện (thao tác người dùng) / người phụ trách (cảnh báo). */
  actor?: string;
  /** Cảnh báo gốc – link sang Trung tâm cảnh báo. */
  alertId?: string;
};

// ---------------------------------------------------------------------------
// Khoảng thời gian (cùng lựa chọn với nút "Hôm nay" của màn Cảnh báo)

const LOG_RANGES = ['today', '7d', '30d'] as const;
export type LogRange = (typeof LOG_RANGES)[number];

export const LOG_RANGE_OPTIONS: { value: LogRange; label: string }[] = [
  { value: 'today', label: 'Hôm nay' },
  { value: '7d', label: '7 ngày qua' },
  { value: '30d', label: '30 ngày qua' },
];

/** Số ngày lùi tối đa (0 = chỉ hôm nay). */
const LOG_RANGE_DAYS: Record<LogRange, number> = { today: 0, '7d': 6, '30d': 29 };

/** Số ngày từ ngày của sự kiện tới hôm nay (giờ nhà máy): 0 = hôm nay, 1 = hôm qua. */
export const eventDaysAgo = (e: Pick<OperationLogEvent, 'at'>, now: Date) => dayNumber(plantDayKey(now)) - dayNumber(plantDayKey(new Date(e.at)));

/** Sự kiện nằm trong khoảng và KHÔNG ở tương lai (giờ trong mock cảnh báo cố định – có thể sau `now`). */
function inLogRange(e: Pick<OperationLogEvent, 'at'>, range: LogRange, now: Date) {
  const d = eventDaysAgo(e, now);
  return d >= 0 && d <= LOG_RANGE_DAYS[range] && Date.parse(e.at) <= now.getTime();
}

/** "yyyy-mm-dd" lùi `days` ngày (lịch, không múi giờ). */
export function shiftDayKey(isoDay: string, days: number): string {
  return new Date((dayNumber(isoDay) + days) * 86_400_000).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Cảnh báo → sự kiện nhật ký (một nguồn với Trung tâm cảnh báo)

type AlertLike = Pick<AlertRecord, 'id' | 'code' | 'daysAgo' | 'time' | 'severity' | 'message' | 'device' | 'area' | 'status' | 'assignee'>;

/** Nghiêm trọng/Cao → Cao; Trung bình/Thấp → Trung bình (cảnh báo không bao giờ là "Thông tin"). */
const alertLogLevel = (s: AlertLike['severity']): LogLevel => (s === 'critical' || s === 'high' ? 'high' : 'medium');

/** Chưa xác nhận → Chưa xử lý · Đang xử lý · Đã xử lý (chờ đóng/theo dõi) → Đang theo dõi · Hoàn thành. */
function alertLogStatus(s: AlertLike['status']): LogStatus {
  switch (s) {
    case 'unacknowledged':
      return 'open';
    case 'in-progress':
      return 'in-progress';
    case 'resolved':
      return 'monitoring';
    default:
      return 'done';
  }
}

/** Một cảnh báo của store chung → một dòng nhật ký (lúc phát sinh). `daysAgo` tính từ hôm nay của `now`. */
export function alertToLogEvent(a: AlertLike, now: Date): OperationLogEvent {
  const day = shiftDayKey(plantDayKey(now), -a.daysAgo);
  const at = parsePlantDateTime(`${day}T${a.time}`) ?? now;
  return {
    id: `alert-${a.id}`,
    code: a.code,
    at: at.toISOString(),
    category: 'alert',
    level: alertLogLevel(a.severity),
    title: a.message,
    area: a.area,
    device: a.device,
    status: alertLogStatus(a.status),
    actor: a.assignee ?? undefined,
    alertId: a.id,
  };
}

// ---------------------------------------------------------------------------
// KPI (Figma 64:875) – mọi số tính từ CÙNG danh sách của bảng

export type LogKpis = {
  total: number;
  /** Chênh lệch so với hôm qua cùng giờ – chỉ khi khoảng = hôm nay; khác → null. */
  delta: number | null;
  operation: number;
  /** % sự kiện vận hành trên tổng (làm tròn), tổng 0 → 0. */
  operationShare: number;
  alerts: number;
  alertsOpen: number;
  userActions: number;
  /** Số người khác nhau có thao tác trong khoảng. */
  activeUsers: number;
  /** Số thiết bị đang có sự kiện kết nối chưa xử lý (cần kiểm tra). */
  connectionIssues: number;
};

export function deriveLogKpis(events: readonly OperationLogEvent[], range: LogRange, now: Date): LogKpis {
  const scoped = events.filter((e) => inLogRange(e, range, now));
  const of = (c: LogCategory) => scoped.filter((e) => e.category === c);
  const operation = of('operation').length;
  const alerts = of('alert');
  const users = of('user-action');
  let delta: number | null = null;
  if (range === 'today') {
    // Hôm qua tới cùng giờ trong ngày (so sánh công bằng khi ngày chưa hết).
    const clock = plantTimeOfDay(now);
    const yesterday = events.filter((e) => eventDaysAgo(e, now) === 1 && plantTimeOfDay(new Date(e.at)) <= clock).length;
    delta = scoped.length - yesterday;
  }
  return {
    total: scoped.length,
    delta,
    operation,
    operationShare: scoped.length ? Math.round((operation / scoped.length) * 100) : 0,
    alerts: alerts.length,
    alertsOpen: alerts.filter((e) => e.status === 'open').length,
    userActions: users.length,
    activeUsers: new Set(users.map((e) => e.actor).filter(Boolean)).size,
    connectionIssues: new Set(
      of('connection')
        .filter((e) => e.status === 'open')
        .map((e) => e.device),
    ).size,
  };
}

// ---------------------------------------------------------------------------
// Lọc + sắp xếp (URL: ?q=&range=&area=&category=&page=)

export const LOG_PARAMS = {
  q: { default: '' },
  range: { values: LOG_RANGES, default: 'today' },
  area: {},
  category: { values: LOG_CATEGORIES },
} as const;

export type LogFilterValues = { q: string; range: LogRange; area: string | null; category: LogCategory | null };

/** Tìm (không dấu) trong mã, nội dung, thiết bị, khu vực, người thực hiện. */
export function matchLogEvent(e: OperationLogEvent, f: LogFilterValues, now: Date) {
  if (!inLogRange(e, f.range, now)) return false;
  if (f.area && e.area !== f.area) return false;
  if (f.category && e.category !== f.category) return false;
  const q = foldSearch(f.q.trim());
  if (!q) return true;
  return [e.code, e.title, e.device, e.area, e.actor ?? ''].some((v) => foldSearch(v).includes(q));
}

/** Mới nhất trước; cùng giây → mã giảm dần (thứ tự ổn định). */
export const byNewestEvent = (a: OperationLogEvent, b: OperationLogEvent) => b.at.localeCompare(a.at) || b.code.localeCompare(a.code);

/** Lựa chọn duy nhất, sắp theo tiếng Việt. */
export const distinctLogOptions = (values: readonly string[]) =>
  [...new Set(values)].sort((a, b) => a.localeCompare(b, 'vi')).map((v) => ({ value: v, label: v }));

// ---------------------------------------------------------------------------
// Hiển thị

/** Giờ "HH:mm:ss" + nhãn ngày khi không phải hôm nay ("Hôm qua" / "dd/mm/yyyy"). */
export function logTimeText(e: Pick<OperationLogEvent, 'at'>, now: Date): { time: string; day: string | null } {
  const at = new Date(e.at);
  const d = eventDaysAgo(e, now);
  return { time: plantTimeOfDay(at), day: d === 0 ? null : d === 1 ? 'Hôm qua' : formatDayVi(plantDayKey(at)) };
}

/** CSV các sự kiện (UTF-8 BOM để Excel đọc đúng tiếng Việt; CRLF). */
export function logsToCsv(rows: readonly OperationLogEvent[]): string {
  const head = ['Ngày', 'Thời gian', 'Mức độ', 'Mã SK', 'Loại', 'Sự kiện / Hành động', 'Khu vực', 'Thiết bị', 'Trạng thái', 'Người thực hiện'];
  const lines = rows.map((e) => {
    const at = new Date(e.at);
    return [
      formatDayVi(plantDayKey(at)),
      plantTimeOfDay(at),
      LOG_LEVEL_LABEL[e.level],
      e.code,
      LOG_CATEGORY_LABEL[e.category],
      e.title,
      e.area,
      e.device,
      LOG_STATUS_LABEL[e.status],
      e.actor ?? '',
    ];
  });
  return CSV_BOM + toCsv([head, ...lines]);
}
