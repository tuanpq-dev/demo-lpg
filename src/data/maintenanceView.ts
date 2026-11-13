/** Hiển thị + lọc danh sách bảo trì: hạn, nhãn trạng thái/loại, tham số lọc URL, KPI, việc ưu tiên, lịch. Tách từ maintenance.ts. */
import type { IconName } from '@/assets/digital-twin';
import type { PriorityTaskData, SelectOption, Severity, TimelineEvent, WorkStatus } from '@/components';
import { isPastDue, isRequestOverdue } from '@/features/maintenance/deadline';
import type { MaintenanceCounts, MaintenanceRange, MaintenanceTab } from '@/features/maintenance/query';
import { daysFromToday, formatDayVi } from '@/lib/plantTime';
import { pad2 } from '@/lib/number';
import type { MaintenanceRecord, MaintenanceStatus, MaintenanceType } from '@/features/maintenance/types';
import type { KpiMock } from '@/mocks/types';

/** Số ngày từ hôm nay (giờ nhà máy) tới hạn (âm = đã qua). */
const daysUntilDue = (r: MaintenanceRecord, now: Date) => daysFromToday(r.dueAt, now);

/** Hạn có giờ thật (false = chỉ có ngày → "Cuối ngày", quá hạn sau 23:59:59). */
export const dueHasTime = (r: Pick<MaintenanceRecord, 'dueHasTime'>) => r.dueHasTime !== false;

/** "16:00" hoặc "Cuối ngày" (hạn chỉ có ngày). */
export const dueTimeLabel = (r: Pick<MaintenanceRecord, 'dueAt' | 'dueHasTime'>) => (dueHasTime(r) ? r.dueAt.slice(11, 16) : 'Cuối ngày');

/** Quá hạn (một quy tắc chung – `isRequestOverdue` ở `features/maintenance/deadline.ts`). */
export const isOverdue = (r: MaintenanceRecord, now: Date) => isRequestOverdue(r, now);

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

/** "Hôm nay, 14:00" / "Ngày mai, 08:30" / "20/10/2026, Cuối ngày" (Lịch sắp tới 70:4902). */
function scheduleLabel(r: MaintenanceRecord, now: Date) {
  const d = daysUntilDue(r, now);
  const time = dueTimeLabel(r);
  const day = d === 0 ? 'Hôm nay' : d === 1 ? 'Ngày mai' : formatDayVi(r.dueAt);
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

export type { MaintenanceRange, MaintenanceTab };
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
// Tham số lọc trên URL (lọc / sắp xếp / đếm ở máy chủ – features/maintenance/query.ts)
// ============================================================================

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

// ============================================================================
// Suy dẫn
// ============================================================================

/** Thẻ việc ưu tiên (70:4969) từ bản ghi máy chủ trả về (GET /maintenance/summary → `priority`). */
export function priorityTask(r: MaintenanceRecord, now: Date): PriorityTaskData {
  return {
    id: r.id,
    code: r.code,
    title: r.title,
    severity: r.priority,
    device: r.device,
    deviceIcon: deviceIcon(r.device),
    dueLabel: dueLabel(r, now),
    overdue: isOverdue(r, now),
  };
}

/** Lịch sắp tới (70:4889) từ bản ghi máy chủ trả về (`schedule`) – mục đầu sáng. */
export const scheduleEvents = (rows: readonly MaintenanceRecord[], now: Date): TimelineEvent[] =>
  rows.map((r, i) => ({ id: r.id, time: scheduleLabel(r, now), title: r.title, location: r.area, active: i === 0 }));

/**
 * 6 KPI (70:5207) từ số đếm máy chủ (`maintenanceCounts` ở features/maintenance/query.ts):
 * - Tổng yêu cầu = tạo trong tháng; dòng phụ = % so với số tạo tháng trước.
 * - Đang thực hiện: thanh = đang thực hiện / (đang thực hiện + chờ nghiệm thu + hoàn thành trong tháng).
 * - Đã hoàn thành = hoàn thành trong tháng.
 * - Yêu cầu đã hủy không tính vào KPI nào.
 */
export function maintenanceKpis(c: MaintenanceCounts): KpiMock[] {
  const thisMonth = c.createdThisMonth;
  const lastMonth = c.createdLastMonth;
  const trend = lastMonth ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : 0;
  const { inProgress, review, overdue } = c;
  const doneMonth = c.doneThisMonth;
  const ratio = inProgress + review + doneMonth ? (inProgress / (inProgress + review + doneMonth)) * 100 : 0;
  const base = { variant: 'compact', strongBorder: true, iconBox: 24 } as const;
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
      value: pad2(c.pending),
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
