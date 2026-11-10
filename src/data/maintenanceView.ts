/** Hiển thị + lọc danh sách bảo trì: hạn, nhãn trạng thái/loại, tham số lọc URL, KPI, việc ưu tiên, lịch. Tách từ maintenance.ts. */
import type { IconName } from '@/assets/digital-twin';
import type { PriorityTaskData, SelectOption, Severity, TimelineEvent, WorkStatus } from '@/components';
import { isPastDue } from '@/features/maintenance/deadline';
import { daysFromToday, plantMonthKey } from '@/lib/plantTime';
import type { MaintenanceRecord, MaintenanceStatus, MaintenanceType } from '@/features/maintenance/types';
import type { KpiMock } from '@/mocks/types';

/** Số ngày từ hôm nay (giờ nhà máy) tới hạn (âm = đã qua). */
const daysUntilDue = (r: MaintenanceRecord, now: Date) => daysFromToday(r.dueAt, now);

/** Hạn có giờ thật (false = chỉ có ngày → "Cuối ngày", quá hạn sau 23:59:59). */
export const dueHasTime = (r: Pick<MaintenanceRecord, 'dueHasTime'>) => r.dueHasTime !== false;

/** "16:00" hoặc "Cuối ngày" (hạn chỉ có ngày). */
export const dueTimeLabel = (r: Pick<MaintenanceRecord, 'dueAt' | 'dueHasTime'>) => (dueHasTime(r) ? r.dueAt.slice(11, 16) : 'Cuối ngày');

/** Còn mở = chưa hoàn thành và chưa hủy. */
const isOpen = (r: Pick<MaintenanceRecord, 'status'>) => r.status !== 'done' && r.status !== 'cancelled';

/**
 * Quá hạn = còn mở và now ≥ giờ hạn (giờ nhà máy; hạn chỉ có ngày = 23:59) – MỘT quy tắc cho danh sách, KPI,
 * thẻ ưu tiên, lịch và trang chi tiết (`features/maintenance/deadline.ts`). Đã xong / đã hủy → không.
 */
export const isOverdue = (r: MaintenanceRecord, now: Date) => isOpen(r) && isPastDue(r.dueAt, now, dueHasTime(r));

/**
 * "Quá hạn 2 ngày" · "Quá hạn từ 16:00" (hạn hôm nay đã qua giờ) · "Hết hạn hôm nay" (hôm nay, chưa tới giờ) ·
 * "Hết hạn ngày mai" · "Còn N ngày".
 */
export function dueLabel(r: MaintenanceRecord, now: Date) {
  const d = daysUntilDue(r, now);
  if (d < 0) return `Quá hạn ${-d} ngày`;
  if (d === 0)
    return isPastDue(r.dueAt, now, dueHasTime(r)) ? (dueHasTime(r) ? `Quá hạn từ ${dueTimeLabel(r)}` : 'Quá hạn hôm nay') : 'Hết hạn hôm nay';
  if (d === 1) return 'Hết hạn ngày mai';
  return `Còn ${d} ngày`;
}

/** "10/10/2023" */
export const formatDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

/** "Hôm nay, 14:00" / "Ngày mai, 08:30" / "20/10/2026, Cuối ngày" (Lịch sắp tới 70:4902). */
function scheduleLabel(r: MaintenanceRecord, now: Date) {
  const d = daysUntilDue(r, now);
  const time = dueTimeLabel(r);
  const day = d === 0 ? 'Hôm nay' : d === 1 ? 'Ngày mai' : formatDate(r.dueAt);
  return `${day}, ${time}`;
}

// ============================================================================
// Nhãn & tuỳ chọn
// ============================================================================

export const STATUS_LABEL: Record<MaintenanceStatus, string> = {
  pending: 'Chờ tiếp nhận',
  assigned: 'Đã phân công',
  'in-progress': 'Đang thực hiện',
  review: 'Chờ nghiệm thu',
  done: 'Hoàn thành',
  cancelled: 'Đã hủy',
};

/** Trạng thái bảo trì → giá trị Badge status. */
export const STATUS_BADGE: Record<MaintenanceStatus, WorkStatus> = {
  pending: 'pending',
  assigned: 'assigned',
  'in-progress': 'in-progress',
  review: 'review',
  done: 'done',
  cancelled: 'cancelled',
};

export const TYPE_OPTIONS: SelectOption<MaintenanceType>[] = [
  { value: 'periodic', label: 'Định kỳ' },
  { value: 'incident', label: 'Sự cố' },
  { value: 'inspection', label: 'Kiểm tra' },
];
export const TYPE_LABEL = Object.fromEntries(TYPE_OPTIONS.map((o) => [o.value, o.label])) as Record<MaintenanceType, string>;

export const PRIORITY_OPTIONS: SelectOption<Severity>[] = [
  { value: 'critical', label: 'Nghiêm trọng' },
  { value: 'high', label: 'Cao' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'low', label: 'Thấp' },
];

export type MaintenanceRange = 'all' | 'today' | '7d' | '30d';
export const RANGE_OPTIONS: SelectOption<MaintenanceRange>[] = [
  { value: 'all', label: 'Tất cả thời gian' },
  { value: 'today', label: 'Hôm nay' },
  { value: '7d', label: '7 ngày qua' },
  { value: '30d', label: '30 ngày qua' },
];

/** Icon thiết bị theo tiền tố mã (70:4592, 70:4612, 70:4632). */
function deviceIcon(device: string): IconName {
  if (/^GS-/i.test(device)) return 'mtDeviceGas';
  if (/^E-/i.test(device)) return 'mtDeviceVaporizer';
  return 'mtDeviceValve';
}

// ============================================================================
// Lọc (dùng với useTableFilters)
// ============================================================================

export type MaintenanceTab = 'all' | Exclude<MaintenanceStatus, 'cancelled'> | 'overdue';

/** ?tab=&q=&area=&priority=&type=&range=&sort=&page= (`?open=<id>` cũ → chuyển hướng /maintenance/:id). Đã hủy chỉ hiện ở tab "Tất cả". */
export const MAINTENANCE_PARAMS = {
  tab: { values: ['all', 'pending', 'assigned', 'in-progress', 'review', 'done', 'overdue'], default: 'all' },
  q: { default: '' },
  area: {},
  priority: { values: ['critical', 'high', 'medium', 'low'] },
  type: { values: ['periodic', 'incident', 'inspection'] },
  range: { values: ['all', 'today', '7d', '30d'], default: 'all' },
  sort: { values: ['created', 'due'], default: 'created' },
} as const;

type Filters = {
  tab: MaintenanceTab;
  q: string;
  area: string | null;
  priority: Severity | null;
  type: MaintenanceType | null;
  range: MaintenanceRange;
  sort: 'created' | 'due';
};

const RANGE_DAYS: Record<Exclude<MaintenanceRange, 'all'>, number> = { today: 0, '7d': 6, '30d': 29 };

export function matchMaintenance(r: MaintenanceRecord, f: Filters, now: Date) {
  const q = f.q.trim().toLowerCase();
  const age = -daysFromToday(r.createdAt, now);
  return (
    (f.range === 'all' || age <= RANGE_DAYS[f.range]) &&
    (f.tab === 'all' || (f.tab === 'overdue' ? isOverdue(r, now) : r.status === f.tab)) &&
    (!q || [r.code, r.title, r.device, r.area, r.assignee ?? ''].some((s) => s.toLowerCase().includes(q))) &&
    (!f.area || r.area === f.area) &&
    (!f.priority || r.priority === f.priority) &&
    (!f.type || r.type === f.type)
  );
}

/** created: mới tạo trước (rồi mã giảm dần) · due: hạn gần nhất trước. */
export function sortMaintenance(a: MaintenanceRecord, b: MaintenanceRecord, f: Pick<Filters, 'sort'>) {
  return f.sort === 'due' ? a.dueAt.localeCompare(b.dueAt) : b.createdAt.localeCompare(a.createdAt) || b.code.localeCompare(a.code);
}

// ============================================================================
// Suy dẫn
// ============================================================================

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/** 3 việc ưu tiên: chưa xong, mức Nghiêm trọng/Cao; quá hạn trước, rồi hạn gần nhất, rồi mức độ (70:4969). */
export function derivePriorityTasks(rows: readonly MaintenanceRecord[], now: Date, limit = 3): PriorityTaskData[] {
  return rows
    .filter((r) => isOpen(r) && (r.priority === 'critical' || r.priority === 'high'))
    .sort((a, b) => daysUntilDue(a, now) - daysUntilDue(b, now) || SEVERITY_RANK[a.priority] - SEVERITY_RANK[b.priority])
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      severity: r.priority,
      device: r.device,
      deviceIcon: deviceIcon(r.device),
      dueLabel: dueLabel(r, now),
      overdue: isOverdue(r, now),
    }));
}

/** Lịch sắp tới: việc ĐỊNH KỲ còn mở, chưa tới giờ hạn (đã quá giờ → sang "Quá hạn"), gần nhất trước (70:4889). */
export function deriveSchedule(rows: readonly MaintenanceRecord[], now: Date, limit = 3): TimelineEvent[] {
  return rows
    .filter((r) => r.type === 'periodic' && isOpen(r) && !isPastDue(r.dueAt, now, dueHasTime(r)))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, limit)
    .map((r, i) => ({ id: r.id, time: scheduleLabel(r, now), title: r.title, location: r.area, active: i === 0 }));
}

/** Ngày `iso` thuộc tháng hiện tại (giờ nhà máy) dời `monthOffset` tháng. */
const inMonth = (iso: string | null, monthOffset: number, now: Date) => !!iso && iso.slice(0, 7) === plantMonthKey(now, monthOffset);

/**
 * 6 KPI (70:5207):
 * - Tổng yêu cầu = tạo trong tháng; dòng phụ = % so với số tạo tháng trước.
 * - Đang thực hiện: thanh = đang thực hiện / (đang thực hiện + chờ nghiệm thu + hoàn thành trong tháng).
 * - Đã hoàn thành = hoàn thành trong tháng.
 * - Yêu cầu đã hủy không tính vào KPI nào.
 */
export function deriveMaintenanceKpis(all: readonly MaintenanceRecord[], now: Date): KpiMock[] {
  const rows = all.filter((r) => r.status !== 'cancelled');
  const thisMonth = rows.filter((r) => inMonth(r.createdAt, 0, now)).length;
  const lastMonth = rows.filter((r) => inMonth(r.createdAt, -1, now)).length;
  const trend = lastMonth ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : 0;
  const count = (s: MaintenanceStatus) => rows.filter((r) => r.status === s).length;
  const inProgress = count('in-progress');
  const review = count('review');
  const doneMonth = rows.filter((r) => r.status === 'done' && inMonth(r.completedAt, 0, now)).length;
  const overdue = rows.filter((r) => isOverdue(r, now)).length;
  const ratio = inProgress + review + doneMonth ? (inProgress / (inProgress + review + doneMonth)) * 100 : 0;
  const base = { variant: 'compact', strongBorder: true, iconBox: 24 } as const;
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return [
    {
      ...base,
      id: 'total',
      label: 'Tổng yêu cầu',
      icon: 'kpiMtTotal',
      value: String(thisMonth),
      sub: `${trend >= 0 ? '+' : ''}${trend}% vs tháng trước`,
      subTone: trend >= 0 ? 'success' : 'danger',
      subIcon: trend >= 0 ? 'kpiTrendUp' : undefined,
    },
    {
      ...base,
      id: 'pending',
      label: 'Chờ tiếp nhận',
      icon: 'kpiMtPending',
      value: pad2(count('pending')),
      sub: 'Cần phân công',
      subTone: 'muted',
      tone: 'warning',
    },
    {
      ...base,
      id: 'in-progress',
      label: 'Đang thực hiện',
      icon: 'kpiMtTimer',
      value: pad2(inProgress),
      progress: Math.round(ratio),
      progressTone: 'info',
    },
    { ...base, id: 'review', label: 'Chờ nghiệm thu', icon: 'kpiMtReview', value: pad2(review), sub: 'Đã hoàn tất thi công', subTone: 'muted' },
    {
      ...base,
      id: 'overdue',
      label: 'Quá hạn',
      icon: 'kpiMtOverdue',
      value: pad2(overdue),
      sub: 'Cần xử lý ngay',
      subTone: 'danger',
      subIcon: 'kpiMtOverdueSm',
      tone: 'danger',
      outlined: true,
      strongBorder: false,
    },
    {
      ...base,
      id: 'done',
      label: 'Đã hoàn thành',
      icon: 'kpiMtDone',
      value: pad2(doneMonth),
      sub: 'Trong tháng',
      subTone: 'success',
      subIcon: 'kpiMtDoneSm',
      tone: 'success',
    },
  ];
}

// ============================================================================
// Nguồn dữ liệu + mutation
// ============================================================================
