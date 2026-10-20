import type { IconName } from '@/assets/digital-twin';
import type { PriorityTaskData, SelectOption, Severity, TimelineEvent, WorkStatus } from '@/components';
import { createCollectionStore } from '@/lib/createCollectionStore';
import type { AlertRecord } from '@/mocks/alerts';
import {
  CHECKLIST_TEMPLATES,
  DEPARTMENTS,
  MAINTENANCE_ASSIGNEES,
  PEOPLE,
  SHIFTS,
  SOURCE_OPTIONS,
  isoDay,
  maintenanceRecords,
  type MaintenanceRecord,
  type MaintenanceSource,
  type MaintenanceStatus,
  type MaintenanceType,
  type ShiftId,
} from '@/mocks/maintenance';
import type { KpiMock } from '@/mocks/types';

export type { MaintenanceRecord, MaintenanceSource, MaintenanceStatus, MaintenanceType, ShiftId };
export { CHECKLIST_TEMPLATES, DEPARTMENTS, MAINTENANCE_ASSIGNEES, PEOPLE, SHIFTS, SOURCE_OPTIONS };

// ============================================================================
// Ngày & hạn
// ============================================================================

const DAY = 86_400_000;
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const parseDay = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
};

/** Số ngày từ hôm nay tới hạn (âm = đã qua). */
export const daysUntilDue = (r: MaintenanceRecord, now = new Date()) => Math.round((parseDay(r.dueAt) - dayStart(now)) / DAY);

/** Quá hạn = hạn (theo ngày) trước hôm nay và chưa hoàn thành. Tự tính, không lưu. */
export const isOverdue = (r: MaintenanceRecord, now = new Date()) => r.status !== 'done' && daysUntilDue(r, now) < 0;

export function dueLabel(r: MaintenanceRecord, now = new Date()) {
  const d = daysUntilDue(r, now);
  if (d < 0) return `Quá hạn ${-d} ngày`;
  if (d === 0) return 'Hết hạn hôm nay';
  if (d === 1) return 'Hết hạn ngày mai';
  return `Còn ${d} ngày`;
}

/** "10/10/2023" */
export const formatDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

/** "Hôm nay, 14:00" / "Ngày mai, 08:30" / "20/10/2026, 17:00" (Lịch sắp tới 70:4902). */
export function scheduleLabel(r: MaintenanceRecord, now = new Date()) {
  const d = daysUntilDue(r, now);
  const time = r.dueAt.slice(11, 16);
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
};

/** Trạng thái bảo trì → giá trị Badge status. */
export const STATUS_BADGE: Record<MaintenanceStatus, WorkStatus> = {
  pending: 'pending',
  assigned: 'assigned',
  'in-progress': 'in-progress',
  review: 'review',
  done: 'done',
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
export function deviceIcon(device: string): IconName {
  if (/^GS-/i.test(device)) return 'mtDeviceGas';
  if (/^E-/i.test(device)) return 'mtDeviceVaporizer';
  return 'mtDeviceValve';
}

// ============================================================================
// Lọc (dùng với useTableFilters)
// ============================================================================

export type MaintenanceTab = 'all' | MaintenanceStatus | 'overdue';

/** ?tab=&q=&area=&priority=&type=&range=&sort=&page=&open= */
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

export function matchMaintenance(r: MaintenanceRecord, f: Filters) {
  const q = f.q.trim().toLowerCase();
  const age = Math.round((dayStart(new Date()) - parseDay(r.createdAt)) / DAY);
  return (
    (f.range === 'all' || age <= RANGE_DAYS[f.range]) &&
    (f.tab === 'all' || (f.tab === 'overdue' ? isOverdue(r) : r.status === f.tab)) &&
    (!q || [r.code, r.title, r.device, r.area, r.assignee ?? ''].some((s) => s.toLowerCase().includes(q))) &&
    (!f.area || r.area === f.area) &&
    (!f.priority || r.priority === f.priority) &&
    (!f.type || r.type === f.type)
  );
}

/** created: mới tạo trước (rồi mã giảm dần) · due: hạn gần nhất trước. */
export function sortMaintenance(a: MaintenanceRecord, b: MaintenanceRecord, f: Pick<Filters, 'sort'>) {
  return f.sort === 'due'
    ? a.dueAt.localeCompare(b.dueAt)
    : b.createdAt.localeCompare(a.createdAt) || b.code.localeCompare(a.code);
}

// ============================================================================
// Suy dẫn
// ============================================================================

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/** 3 việc ưu tiên: chưa xong, mức Nghiêm trọng/Cao; quá hạn trước, rồi hạn gần nhất, rồi mức độ (70:4969). */
export function derivePriorityTasks(rows: readonly MaintenanceRecord[], limit = 3): PriorityTaskData[] {
  return rows
    .filter((r) => r.status !== 'done' && (r.priority === 'critical' || r.priority === 'high'))
    .sort((a, b) => daysUntilDue(a) - daysUntilDue(b) || SEVERITY_RANK[a.priority] - SEVERITY_RANK[b.priority])
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      severity: r.priority,
      device: r.device,
      deviceIcon: deviceIcon(r.device),
      dueLabel: dueLabel(r),
      overdue: isOverdue(r),
    }));
}

/** Lịch sắp tới: việc ĐỊNH KỲ chưa xong, hạn từ hôm nay trở đi, gần nhất trước (70:4889). */
export function deriveSchedule(rows: readonly MaintenanceRecord[], limit = 3): TimelineEvent[] {
  return rows
    .filter((r) => r.type === 'periodic' && r.status !== 'done' && daysUntilDue(r) >= 0)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, limit)
    .map((r, i) => ({ id: r.id, time: scheduleLabel(r), title: r.title, location: r.area, active: i === 0 }));
}

const inMonth = (iso: string | null, monthOffset: number, now = new Date()) => {
  if (!iso) return false;
  const start = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1).getTime();
  const end = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 1).getTime();
  const t = parseDay(iso);
  return t >= start && t < end;
};

/**
 * 6 KPI (70:5207):
 * - Tổng yêu cầu = tạo trong tháng; dòng phụ = % so với số tạo tháng trước.
 * - Đang thực hiện: thanh = đang thực hiện / (đang thực hiện + chờ nghiệm thu + hoàn thành trong tháng).
 * - Đã hoàn thành = hoàn thành trong tháng.
 */
export function deriveMaintenanceKpis(rows: readonly MaintenanceRecord[], now = new Date()): KpiMock[] {
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
    { ...base, id: 'total', label: 'Tổng yêu cầu', icon: 'kpiMtTotal', value: String(thisMonth), sub: `${trend >= 0 ? '+' : ''}${trend}% vs tháng trước`, subTone: trend >= 0 ? 'success' : 'danger', subIcon: trend >= 0 ? 'kpiTrendUp' : undefined },
    { ...base, id: 'pending', label: 'Chờ tiếp nhận', icon: 'kpiMtPending', value: pad2(count('pending')), sub: 'Cần phân công', subTone: 'muted', tone: 'warning' },
    { ...base, id: 'in-progress', label: 'Đang thực hiện', icon: 'kpiMtTimer', value: pad2(inProgress), progress: Math.round(ratio), progressTone: 'info' },
    { ...base, id: 'review', label: 'Chờ nghiệm thu', icon: 'kpiMtReview', value: pad2(review), sub: 'Đã hoàn tất thi công', subTone: 'muted' },
    { ...base, id: 'overdue', label: 'Quá hạn', icon: 'kpiMtOverdue', value: pad2(overdue), sub: 'Cần xử lý ngay', subTone: 'danger', subIcon: 'kpiMtOverdueSm', tone: 'danger', outlined: true, strongBorder: false },
    { ...base, id: 'done', label: 'Đã hoàn thành', icon: 'kpiMtDone', value: pad2(doneMonth), sub: 'Trong tháng', subTone: 'success', subIcon: 'kpiMtDoneSm', tone: 'success' },
  ];
}

// ============================================================================
// Nguồn dữ liệu + mutation
// ============================================================================

let db: MaintenanceRecord[] = maintenanceRecords.map((r) => ({ ...r }));

/** GET /maintenance – thay bằng fetch thật khi có API. */
export async function fetchMaintenance(): Promise<MaintenanceRecord[]> {
  return db.map((r) => ({ ...r }));
}

const store = createCollectionStore(fetchMaintenance);
const commit = () => store.commit(db.map((r) => ({ ...r })));

function patch(ids: readonly string[], fn: (r: MaintenanceRecord) => MaintenanceRecord) {
  const set = new Set(ids);
  db = db.map((r) => (set.has(r.id) ? fn(r) : r));
  commit();
}

export type NewMaintenanceInput = {
  title: string;
  description?: string;
  device: string;
  area?: string;
  type: MaintenanceType;
  priority: Severity;
  source?: MaintenanceSource;
  referenceCode?: string;
  /** "yyyy-mm-ddTHH:mm" */
  startAt?: string;
  /** "yyyy-mm-ddTHH:mm" (hoặc "yyyy-mm-dd" → 17:00) */
  dueAt: string;
  assignee: string | null;
  collaborators?: string[];
  department?: string;
  shift?: ShiftId;
  checklist?: { id: string; text: string; done: boolean }[];
  attachments?: { id: string; name: string; size: number }[];
  notes?: string;
  requiresPermit?: boolean;
  sourceAlertId?: string;
};

/** POST /maintenance – tạo yêu cầu mới; có người phụ trách → "Đã phân công", không → "Chờ tiếp nhận". */
export async function createMaintenance(input: NewMaintenanceInput): Promise<MaintenanceRecord> {
  const maxNo = Math.max(0, ...db.map((r) => Number(r.code.replace(/\D/g, '')) || 0));
  const code = `MT-${String(maxNo + 1).padStart(5, '0')}`;
  const checklist = (input.checklist ?? []).filter((c) => c.text.trim());
  const record: MaintenanceRecord = {
    id: code,
    code,
    title: input.title.trim().slice(0, 160),
    description: input.description?.trim() || undefined,
    device: input.device,
    area: input.area ?? deviceArea(input.device) ?? 'Khác',
    type: input.type,
    priority: input.priority,
    status: input.assignee ? 'assigned' : 'pending',
    assignee: input.assignee,
    createdAt: isoDay(0),
    dueAt: input.dueAt.length === 10 ? `${input.dueAt}T17:00` : input.dueAt,
    completedAt: null,
    progress: checklist.length ? Math.round((checklist.filter((c) => c.done).length / checklist.length) * 100) : 0,
    sourceAlertId: input.sourceAlertId,
    source: input.source,
    referenceCode: input.referenceCode?.trim() || undefined,
    startAt: input.startAt || undefined,
    department: input.department,
    shift: input.shift,
    collaborators: input.collaborators?.length ? input.collaborators : undefined,
    checklist: checklist.length ? checklist : undefined,
    attachments: input.attachments?.length ? input.attachments.map(({ id, name, size }) => ({ id, name, size })) : undefined,
    notes: input.notes?.trim() || undefined,
    requiresPermit: input.requiresPermit || undefined,
  };
  db = [record, ...db];
  commit();
  return record;
}

/** Phân công: gán người; "Chờ tiếp nhận" → "Đã phân công". */
export const assignMaintenance = async (ids: readonly string[], assignee: string) =>
  patch(ids, (r) => (r.status === 'done' ? r : { ...r, assignee, status: r.status === 'pending' ? 'assigned' : r.status }));

/** Chuyển bước kế tiếp: Đã phân công → Đang thực hiện → Chờ nghiệm thu → Hoàn thành. */
export const advanceMaintenance = async (id: string) =>
  patch([id], (r) => {
    switch (r.status) {
      case 'pending':
      case 'assigned':
        return { ...r, status: 'in-progress', progress: Math.max(r.progress, 10), assignee: r.assignee ?? 'Admin' };
      case 'in-progress':
        return { ...r, status: 'review', progress: 100 };
      case 'review':
        return { ...r, status: 'done', progress: 100, completedAt: isoDay(0) };
      default:
        return r;
    }
  });

export const completeMaintenance = async (ids: readonly string[]) =>
  patch(ids, (r) => (r.status === 'done' ? r : { ...r, status: 'done', progress: 100, completedAt: isoDay(0) }));

/** Nhãn nút "bước kế tiếp" trong drawer. */
export const NEXT_STEP_LABEL: Partial<Record<MaintenanceStatus, string>> = {
  pending: 'Tiếp nhận & bắt đầu',
  assigned: 'Bắt đầu thực hiện',
  'in-progress': 'Chuyển nghiệm thu',
  review: 'Nghiệm thu xong',
};

/** Hook: `{ status, data, error, refetch, create, assign, advance, complete }`. */
export function useMaintenance() {
  return {
    ...store.useCollection(),
    create: createMaintenance,
    assign: assignMaintenance,
    advance: advanceMaintenance,
    complete: completeMaintenance,
  };
}

// ============================================================================
// Hỗ trợ form "Tạo yêu cầu bảo trì" (ảnh thiết kế)
// ============================================================================

/** Loại bảo trì trong form – nhãn đầy đủ (bảng dùng nhãn ngắn TYPE_OPTIONS). */
export const FORM_TYPE_OPTIONS: SelectOption<MaintenanceType>[] = [
  { value: 'incident', label: 'Bảo trì khắc phục' },
  { value: 'periodic', label: 'Bảo trì định kỳ' },
  { value: 'inspection', label: 'Kiểm tra / Hiệu chuẩn' },
];

/** Mức độ ưu tiên trong form: 3 nút. "Thường" = medium; "Thấp" chỉ có trong dữ liệu cũ. */
export const FORM_PRIORITY_OPTIONS = [
  { id: 'critical', label: 'Nghiêm trọng', tone: 'danger' as const },
  { id: 'high', label: 'Cao', tone: 'warning' as const },
  { id: 'medium', label: 'Thường', tone: 'neutral' as const },
];

/** Danh bạ thiết bị (thiết bị → khu vực) gộp từ bảo trì + cảnh báo. */
let directory = new Map<string, string>();
export function setDeviceDirectory(maint: readonly MaintenanceRecord[], alerts: readonly AlertRecord[] = []) {
  directory = new Map();
  [...alerts.map((a) => [a.device, a.area] as const), ...maint.map((r) => [r.device, r.area] as const)].forEach(([d, a]) =>
    directory.set(d, a),
  );
  return [...directory.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([device, area]) => ({ device, area }));
}
export const deviceArea = (device: string) => directory.get(device);

/** Phòng ban gợi ý theo tiền tố mã thiết bị. */
export function departmentFor(device: string): (typeof DEPARTMENTS)[number] {
  if (/^(GS|PT|TT|FT|LT|PI|PCV)-/i.test(device)) return 'Đo lường – Tự động hóa';
  if (/^(G|C)-/i.test(device)) return 'Bảo trì Điện';
  if (/^FS-/i.test(device)) return 'An toàn – HSE';
  return 'Bảo trì Cơ khí';
}

/** Ca vận hành chứa thời điểm "yyyy-mm-ddTHH:mm". */
export function shiftFor(dateTime: string): ShiftId {
  const h = Number(dateTime.slice(11, 13));
  return SHIFTS.find((s) => (s.from < s.to ? h >= s.from && h < s.to : h >= s.from || h < s.to))?.value ?? 'shift-1';
}

const pad = (n: number) => String(n).padStart(2, '0');
/** "yyyy-mm-ddTHH:mm" cách bây giờ `hours` giờ, làm tròn lên giờ chẵn. */
export function localDateTime(hoursFromNow = 0, base = new Date()) {
  const d = new Date(base);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1 + hoursFromNow);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}

/** Số giờ giữa hai mốc "yyyy-mm-ddTHH:mm" (làm tròn 0.5). */
export function durationHours(start?: string, end?: string) {
  if (!start || !end) return null;
  const h = (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000;
  return Number.isFinite(h) ? Math.round(h * 2) / 2 : null;
}

export type AiSuggestion = { assessment: string; checks: string[] };

/**
 * "GÓP Ý TỪ AI" – ⚠ MOCK theo quy tắc (chưa nối AI thật).
 * Khi có API: thay thân hàm bằng gọi dịch vụ AI với ngữ cảnh {device, alert, lịch sử vận hành}.
 */
export function suggestForRequest({ device, alert }: { device: string | null; alert?: AlertRecord }): AiSuggestion | null {
  if (!device && !alert) return null;
  const d = device ?? alert?.device ?? '';
  if (alert && /áp suất/i.test(alert.message)) {
    return {
      assessment: `Áp suất ${alert.device.startsWith('V-') ? 'bồn ' : ''}${alert.device} tăng bất thường trong 2 giờ gần nhất và có khả năng liên quan đến van an toàn PSV-${alert.device.replace(/\D/g, '') || '101'} hoặc hệ thống làm mát.`,
      checks: [`Kiểm tra trạng thái van PSV-${alert.device.replace(/\D/g, '') || '101'}`, 'Đối chiếu áp suất tại hiện trường', 'Kiểm tra hệ thống làm mát và tín hiệu cảm biến liên quan'],
    };
  }
  if (/^GS-/i.test(d) || (alert && /gas|LEL/i.test(alert.message + alert.unit))) {
    return {
      assessment: `Nồng độ gas tại ${d} vượt ngưỡng cảnh báo; cần loại trừ rò rỉ thật trước khi hiệu chuẩn cảm biến.`,
      checks: ['Đo nồng độ bằng máy cầm tay', 'Kiểm tra mặt bích & khớp nối lân cận', 'Hiệu chuẩn cảm biến bằng khí chuẩn'],
    };
  }
  if (/^E-/i.test(d) || (alert && /hóa hơi/i.test(alert.message))) {
    return {
      assessment: `Nhiệt độ đầu ra máy hóa hơi ${d} thấp hơn định mức; có thể do bám cặn bộ trao đổi nhiệt hoặc van điều nhiệt.`,
      checks: ['Kiểm tra van điều nhiệt', 'Đo nhiệt độ nước nóng đầu vào', 'Kiểm tra bám cặn bộ trao đổi nhiệt'],
    };
  }
  return {
    assessment: `Chưa ghi nhận bất thường lớn ở ${d} trong 24 giờ qua; đề xuất kiểm tra tổng quát theo checklist định kỳ.`,
    checks: ['Kiểm tra ngoại quan & rò rỉ', 'Đối chiếu thông số vận hành', 'Kiểm tra tín hiệu cảm biến liên quan'],
  };
}

/** Checklist mẫu phù hợp nhất với thiết bị/cảnh báo. */
export function templateFor(device: string | null, alert?: AlertRecord) {
  if (alert && /áp suất/i.test(alert.message)) return CHECKLIST_TEMPLATES.find((t) => t.id === 'pressure');
  if (device && /^GS-/i.test(device)) return CHECKLIST_TEMPLATES.find((t) => t.id === 'gas');
  if (device && /^E-/i.test(device)) return CHECKLIST_TEMPLATES.find((t) => t.id === 'vaporizer');
  return undefined;
}

// ---- Lưu nháp (localStorage, theo trình duyệt) ----
const DRAFT_KEY = 'demo-lpg:maintenance-draft';
export function saveMaintenanceDraft(draft: unknown) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: new Date().toISOString(), draft }));
  } catch {
    /* bộ nhớ không khả dụng – bỏ qua */
  }
}
export function loadMaintenanceDraft<T>(): { savedAt: string; draft: T } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function clearMaintenanceDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
