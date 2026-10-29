/**
 * Mock data màn Cảnh báo – 5 dòng đầu nguyên văn Figma 70:3032, 15 dòng bổ sung để thử lọc/phân trang.
 * Đây là NGUỒN DUY NHẤT: thẻ ưu tiên, KPI, số đếm Tabs đều tính ra từ danh sách này (src/data/alerts.ts).
 */
import type { Alert, AlertStatus as ApiAlertStatus } from '@demo-lpg/shared/alerts';
import { V101_TAGS, VAPORIZER_AREA_TAGS, VAPORIZER_TAGS } from '@/features/live/tags';
import { GAS_TAGS } from '@/features/live/tags';
import { appNow } from '@/lib/demoNow';
import { plantDateTimeKey, plantDayKey, plantTimeOfDay } from '@/lib/plantTime';
import type { AlertKind } from './alertKinds';

/**
 * Trạng thái xử lý của cảnh báo ở FE = hợp đồng (`unacknowledged` · `in-progress` · `done`) + `resolved` CHỈ FE (28/10/2026):
 * Đã xử lý, chờ người có thẩm quyền xác nhận đóng (tab "Chờ đóng"). `done` = Hoàn thành (đã đóng).
 * TODO(backend): thêm `resolved` vào `ALERT_STATUSES` (packages/shared – repo backend) – docs/decisions.md.
 */
export type AlertStatus = ApiAlertStatus | 'resolved';

/** Chiều vượt ngưỡng: above = cao hơn ngưỡng là xấu (mặc định) · below = thấp hơn ngưỡng là xấu (nhiệt độ thấp, lưu lượng thấp…). */
export type AlertDirection = 'above' | 'below';

export type AlertNote = { id: string; author: string; /** ISO */ at: string; text: string };

export type AlertHistoryKind = 'acknowledge' | 'assign' | 'guide' | 'note' | 'resolve' | 'maintenance' | 'support' | 'update' | 'hold' | 'close' | 'monitor';
export type AlertHistoryEntry = { id: string; /** ISO */ at: string; kind: AlertHistoryKind; text: string; actor?: string };

/** Trạng thái một hạng mục kiểm tra (= bước hướng dẫn của drawer – MỘT danh sách theo loại). */
export type InspectionStatus = 'pending' | 'pass' | 'issue' | 'na';
/**
 * Một hạng mục đã ghi: DẠNG CŨ `{ at, by }` (tick ở drawer trước 28/10/2026) = Đạt; dạng mới có `status` (+ ghi chú).
 * Chỉ đọc qua `inspectionEntry` / `inspectionItems` (features/alerts/inspection.ts) – không tự kiểm tra dạng ở nơi khác.
 */
export type AlertGuideEntry = { at: string; by: string; status?: InspectionStatus; note?: string };
/** Hạng mục kiểm tra / bước hướng dẫn: id bước (cấu hình loại) → bản ghi. Thiếu id = Chưa kiểm tra. */
export type AlertGuideProgress = Readonly<Record<string, AlertGuideEntry>>;

/** Giai đoạn khi Đang xử lý (modal cập nhật xử lý áp suất): đang kiểm tra / đang xử lý. Sau xác nhận = inspecting. */
export type AlertPhase = 'inspecting' | 'resolving';
/** Tạm dừng (lý do) / cần hỗ trợ (lý do + người phối hợp) – chỉ khi Đang xử lý. */
export type AlertHold = { kind: 'paused' | 'needs-support'; reason: string; at: string };
export type AlertAttachment = { name: string; size: number; kind: 'image' | 'document' | 'manual'; /** Chưa upload (chỉ tên/kích thước/loại – không lưu object URL). */ isTemp?: boolean };
/** Nguồn xác minh số liệu sau xử lý. */
export type VerificationSource = 'sensor' | 'gauge' | 'both';
/** Thông số trước/sau xử lý đã lưu (modal áp suất). `before` = số lúc cảnh báo, `after` = số sau xử lý (live hoặc đo tay). */
export type AlertReadings = { source: VerificationSource; at: string; rows: readonly { id: string; before?: number; after?: number; manual?: boolean }[] };
/** Theo dõi sau xử lý: đến `until`, mục tiêu `< target unit`, người chịu trách nhiệm. TODO(backend): tự tạo lại cảnh báo khi vượt mục tiêu. */
export type AlertFollowUp = { minutes: number; until: string; /** Thiếu = theo dõi không có giá trị mục tiêu số (báo cháy). */ target?: number; unit: string; owner: string };

/**
 * Cảnh báo trong mock = hợp đồng API `Alert` (packages/shared/src/alerts.ts) nhưng thời điểm ghi TƯƠNG ĐỐI
 * (`daysAgo` + `time`) thay cho `occurredAt` để demo luôn "hôm nay".
 * Các trường sau `time` CHỈ CÓ Ở FE (drawer chi tiết cảnh báo, 27/10/2026) – chờ đưa vào hợp đồng API (docs/decisions.md);
 * liệt kê ở `ALERT_FE_ONLY_FIELDS` để test hợp đồng bỏ qua.
 */
export type AlertRecord = Omit<Alert, 'occurredAt' | 'status'> & {
  status: AlertStatus;
  /** Số ngày trước hôm nay (0 = hôm nay). Thời điểm thật = hôm nay − daysAgo, lúc `time`. */
  daysAgo: number;
  /** "HH:mm:ss" */
  time: string;
  /** Loại cảnh báo → cấu hình drawer (`ALERT_KINDS` ở mocks/alertKinds.ts: panel, nguyên nhân, hướng dẫn…); thiếu = generic. */
  kind?: AlertKind;
  /** Thiếu → lấy từ cấu hình tag, rồi mặc định 'above'. */
  direction?: AlertDirection;
  /** Tag cảm biến của số liệu cảnh báo → "Hiện tại" trực tiếp + ngưỡng từ cấu hình tài sản (nếu có). */
  tag?: string;
  /** Giờ hệ thống gửi thông báo "HH:mm:ss" (bước "Gửi thông báo" của tiến trình). */
  notifiedTime?: string;
  /** ISO – lúc xác nhận / lúc đánh dấu đã xử lý (thao tác trong phiên; mock cũ không có). */
  acknowledgedAt?: string;
  resolvedAt?: string;
  guide?: AlertGuideProgress;
  notes?: readonly AlertNote[];
  history?: readonly AlertHistoryEntry[];
  /** Giá trị đo NGAY TRƯỚC khi phát sinh cảnh báo (ảnh chụp lưu cùng cảnh báo) – "Giá trị trước đó", Mức tăng = live − giá trị này. */
  previousValue?: string;
  /** Người phối hợp (Yêu cầu hỗ trợ). */
  collaborators?: readonly string[];
  /** Nồng độ lúc đóng (gas): live hoặc số đo lại tại chỗ. */
  closingReading?: { value: number; source: 'live' | 'measured' };
  /**
   * Kết quả đóng cảnh báo cháy (thống kê báo động giả): handled = đã xử lý sự cố · false-alarm = báo động giả.
   * `closedBy` = căn cứ đóng: đầu báo đã phục hồi (live) hoặc kiểm tra tại chỗ khi mất tín hiệu.
   */
  resolution?: { kind: 'handled' | 'false-alarm'; closedBy: 'live' | 'field' };
  // ---- Modal "Cập nhật xử lý cảnh báo áp suất" (28/10/2026) ----
  phase?: AlertPhase;
  hold?: AlertHold;
  /** Số đo các dòng thông số LÚC cảnh báo (ảnh chụp lưu cùng cảnh báo; dòng chính = `value`) – cột "Trước". */
  readingsAtAlert?: Readonly<Record<string, number>>;
  readings?: AlertReadings;
  /** Id mục "Kết quả xác minh" đã chọn (cấu hình loại). */
  verification?: readonly string[];
  /** Vấn đề phát sinh (một lựa chọn; `other` có mô tả). */
  issue?: { kind: string; note?: string };
  cause?: string;
  actionTaken?: string;
  attachments?: readonly AlertAttachment[];
  followUp?: AlertFollowUp;
  // ---- Đóng cảnh báo (modal "Xác nhận đóng cảnh báo", 28/10/2026) ----
  /** Người đánh dấu Đã xử lý (status resolved) – mức Nghiêm trọng thì người đóng phải khác người này. Thiếu → người phụ trách. */
  resolvedBy?: string;
  /** ISO – lúc xác nhận đóng (Hoàn thành) + người đóng + ghi chú kết luận. */
  closedAt?: string;
  closedBy?: string;
  closingNote?: string;
  /** Mục xác nhận tick tay khi đóng (id `CLOSE_MANUAL_ITEMS`). */
  closeChecks?: readonly string[];
};

export const ALERT_FE_ONLY_FIELDS = [
  'kind',
  'direction',
  'tag',
  'notifiedTime',
  'acknowledgedAt',
  'resolvedAt',
  'guide',
  'notes',
  'history',
  'previousValue',
  'collaborators',
  'closingReading',
  'resolution',
  'phase',
  'hold',
  'readingsAtAlert',
  'readings',
  'verification',
  'issue',
  'cause',
  'actionTaken',
  'attachments',
  'followUp',
  'resolvedBy',
  'closedAt',
  'closedBy',
  'closingNote',
  'closeChecks',
] as const;

/** Hệ thống gửi thông báo sau khi phát hiện (mock: +3 s, như ảnh 10:45:22 → 10:45:25). */
const NOTIFY_DELAY_S = 3;
function addSeconds(time: string, s: number) {
  const [h, m, sec] = time.split(':').map(Number);
  const t = (h! * 3600 + m! * 60 + sec! + s) % 86_400;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(t / 3600))}:${p(Math.floor(t / 60) % 60)}:${p(t % 60)}`;
}

type Extra = Partial<Pick<AlertRecord, 'kind' | 'direction' | 'tag' | 'previousValue' | 'readingsAtAlert' | 'attachments' | 'status' | 'resolvedBy' | 'cause' | 'actionTaken'>> & {
  /** Phát sinh TƯƠNG ĐỐI "N phút trước" (thay daysAgo + time của bảng) – ALT-00127: 6 phút như ảnh "T/G vượt ngưỡng". */
  minutesAgo?: number;
  /** Đã xử lý N phút trước (mock Chờ đóng) → `resolvedAt`; `followUpMin` = theo dõi N phút tính từ lúc đó (có thể đã hết giờ). */
  resolvedAgoMin?: number;
  followUpMin?: number;
};
/** Loại / chiều / tag theo mã – tách khỏi bảng cho bảng giữ nguyên văn Figma. */
const EXTRA: Record<string, Extra> = {
  // Báo cháy (ảnh FIR-00018): phát sinh "3 phút trước" để luôn là hôm nay; phát hiện = giờ cảnh báo, gửi thông báo +3 s.
  'FIR-00018': { kind: 'fire', tag: VAPORIZER_AREA_TAGS.heatTemp, minutesAgo: 3 },
  // Ảnh modal cập nhật xử lý áp suất: nhiệt độ lúc cảnh báo 31.6 °C (áp suất sau PR-101 không có → "–"); 3 tệp mẫu như ảnh.
  'ALT-00128': {
    kind: 'tank-overpressure',
    tag: V101_TAGS.pressure,
    readingsAtAlert: { temperature: 31.6 },
    attachments: [
      { name: 'hien-truong-psv101.jpg', size: 1_240_000, kind: 'image' },
      { name: 'bao-cao-kiem-dinh.pdf', size: 860_000, kind: 'document' },
      { name: 'manual-psv101.pdf', size: 4_200_000, kind: 'manual' },
    ],
  },
  'ALT-00127': { kind: 'gas-leak', tag: GAS_TAGS[3], previousValue: '14', minutesAgo: 6 },
  'ALT-00126': { kind: 'temperature-low', direction: 'below' },
  'ALT-00125': { kind: 'filter-dp-high' },
  'ALT-00124': { kind: 'flow-low', direction: 'below' },
  'ALT-00123': { kind: 'level-low', direction: 'below' },
  'ALT-00122': { kind: 'sensor-signal-lost', direction: 'below' },
  'ALT-00121': { kind: 'temperature-high' },
  // Chờ đóng (tab "Chờ đóng", thử đóng / đóng hàng loạt): bảng Figma ghi Đã hoàn thành → mock đổi sang Đã xử lý (docs/guide/alerts.md).
  'ALT-00120': { kind: 'vibration-high', status: 'resolved', resolvedBy: 'Nguyễn Văn A', cause: 'Bu lông chân đế lỏng', actionTaken: 'Siết lại bu lông chân đế, đo rung còn 3.2 mm/s.', resolvedAgoMin: 30 },
  'ALT-00119': { kind: 'filter-dp-high' },
  'ALT-00118': { kind: 'gas-leak', tag: GAS_TAGS[2], previousValue: '12' },
  'ALT-00117': { kind: 'flow-low', direction: 'below' },
  // Chờ đóng, Nghiêm trọng, người xử lý Phạm Văn D – còn cảnh báo đang mở cùng khu (Khu bồn LPG) → chưa đóng được.
  'ALT-00116': { kind: 'safety-valve-open', status: 'resolved', resolvedBy: 'Phạm Văn D', cause: 'Áp suất bồn vượt điểm đặt', actionTaken: 'Giảm tải nạp, van đã đóng kín lại.', resolvedAgoMin: 90, followUpMin: 60 },
  'ALT-00115': { kind: 'temperature-low', direction: 'below' },
  'ALT-00114': { kind: 'battery-low', direction: 'below' },
  'ALT-00113': { kind: 'pressure-high', tag: VAPORIZER_TAGS.inletPressure },
  'ALT-00112': { kind: 'level-drop', direction: 'below' },
  'ALT-00111': { kind: 'pump-standby', direction: 'below' },
  'ALT-00110': { kind: 'tank-overpressure' },
  'ALT-00109': { kind: 'temperature-high' },
};

const rows: AlertRecord[] = [
  // ---- Báo cháy (ảnh drawer FIR-00018, 27/10/2026) – tiền tố FIR, chung danh sách. Giờ thật = 3 phút trước (`minutesAgo`).
  // Tiêu đề ảnh "…tại khu máy hóa hơi" → tên khu chung "Trạm hóa hơi" (mã FZ-02 ở `AREA_CODES`); ngưỡng = cấu hình đầu báo 57 °C.
  { id: 'FIR-00018', daysAgo: 0, time: '14:32:15', severity: 'critical', code: 'FIR-00018', message: 'Phát hiện tín hiệu báo cháy tại trạm hóa hơi', device: 'HD-02', area: 'Trạm hóa hơi', value: '68', threshold: '57', unit: '°C', status: 'unacknowledged', assignee: null },

  // ---- 5 dòng Figma 70:3058–70:3166 ----
  { id: 'ALT-00128', daysAgo: 0, time: '10:45:22', severity: 'critical', code: 'ALT-00128', message: 'Áp suất bồn V-101 vượt ngưỡng', device: 'V-101', area: 'Khu bồn LPG', value: '11.8', threshold: '10.5', unit: 'bar', status: 'unacknowledged', assignee: null },
  // Thẻ ưu tiên ghi GS-01, bảng ghi GS-04 cho cùng ALT-00127 → GS-04 (bảng Figma + ảnh drawer gas, chốt 27/10/2026).
  // Giờ thật = 6 phút trước (`minutesAgo` ở EXTRA). MT-00127 "GS-01" không trỏ tới cảnh báo này (không có sourceAlertId) → giữ.
  { id: 'ALT-00127', daysAgo: 0, time: '09:12:05', severity: 'high', code: 'ALT-00127', message: 'Cảnh báo rò rỉ Gas nhẹ', device: 'GS-04', area: 'Khu nạp xuất', value: '25', threshold: '20', unit: '% LEL', status: 'in-progress', assignee: 'Nguyễn Văn A' },
  { id: 'ALT-00126', daysAgo: 0, time: '08:45:10', severity: 'high', code: 'ALT-00126', message: 'Nhiệt độ máy hóa hơi thấp', device: 'E-101A', area: 'Trạm hóa hơi', value: '45', threshold: '50', unit: '°C', status: 'unacknowledged', assignee: null },
  { id: 'ALT-00125', daysAgo: 0, time: '08:10:00', severity: 'medium', code: 'ALT-00125', message: 'Chênh áp lọc cao', device: 'F-201', area: 'Khu Lọc', value: '1.2', threshold: '1.0', unit: 'bar', status: 'in-progress', assignee: 'Trần Văn B' },
  // Figma để trống Mã CB → tạm dùng ALT-00124.
  { id: 'ALT-00124', daysAgo: 0, time: '07:30:22', severity: 'low', code: 'ALT-00124', message: 'Cảnh báo lưu lượng thấp', device: 'FT-101', area: 'Tuyến chính', value: '10', threshold: '15', unit: 'm³/h', status: 'done', assignee: 'Lê Thị C' },

  // ---- Bổ sung để thử lọc/phân trang ----
  { id: 'ALT-00123', daysAgo: 0, time: '06:58:41', severity: 'medium', code: 'ALT-00123', message: 'Mức bồn V-102 thấp hơn kế hoạch', device: 'V-102', area: 'Khu bồn LPG', value: '32', threshold: '35', unit: '%', status: 'unacknowledged', assignee: null },
  { id: 'ALT-00122', daysAgo: 0, time: '05:20:13', severity: 'critical', code: 'ALT-00122', message: 'Mất tín hiệu cảm biến áp suất PT-102', device: 'PT-102', area: 'Khu bồn LPG', value: '0', threshold: '1', unit: 'bar', status: 'in-progress', assignee: 'Phạm Văn D' },
  { id: 'ALT-00121', daysAgo: 0, time: '03:47:09', severity: 'low', code: 'ALT-00121', message: 'Nhiệt độ môi trường khu bơm tăng', device: 'TT-305', area: 'Khu bơm', value: '38', threshold: '40', unit: '°C', status: 'done', assignee: 'Trần Văn B' },
  { id: 'ALT-00120', daysAgo: 0, time: '01:15:00', severity: 'high', code: 'ALT-00120', message: 'Rung động bơm P-101A vượt mức', device: 'P-101A', area: 'Khu bơm', value: '7.1', threshold: '6.5', unit: 'mm/s', status: 'done', assignee: 'Nguyễn Văn A' },
  { id: 'ALT-00119', daysAgo: 0, time: '00:32:47', severity: 'medium', code: 'ALT-00119', message: 'Chênh áp lọc F-202 tăng dần', device: 'F-202', area: 'Khu Lọc', value: '0.9', threshold: '1.0', unit: 'bar', status: 'unacknowledged', assignee: null },
  { id: 'ALT-00118', daysAgo: 1, time: '22:41:30', severity: 'high', code: 'ALT-00118', message: 'Rò rỉ gas tại họng nạp số 2', device: 'GS-03', area: 'Khu nạp xuất', value: '22', threshold: '20', unit: '% LEL', status: 'done', assignee: 'Lê Thị C' },
  { id: 'ALT-00117', daysAgo: 1, time: '19:05:12', severity: 'low', code: 'ALT-00117', message: 'Lưu lượng xuất thấp hơn định mức', device: 'FT-102', area: 'Tuyến chính', value: '12', threshold: '15', unit: 'm³/h', status: 'done', assignee: 'Trần Văn B' },
  { id: 'ALT-00116', daysAgo: 1, time: '15:28:55', severity: 'critical', code: 'ALT-00116', message: 'Van an toàn PSV-101 kích hoạt', device: 'PSV-101', area: 'Khu bồn LPG', value: '12.4', threshold: '12.0', unit: 'bar', status: 'done', assignee: 'Phạm Văn D' },
  { id: 'ALT-00115', daysAgo: 1, time: '11:10:03', severity: 'medium', code: 'ALT-00115', message: 'Nhiệt độ máy hóa hơi E-101B dao động', device: 'E-101B', area: 'Trạm hóa hơi', value: '52', threshold: '55', unit: '°C', status: 'in-progress', assignee: 'Nguyễn Văn A' },
  { id: 'ALT-00114', daysAgo: 1, time: '07:44:19', severity: 'low', code: 'ALT-00114', message: 'Pin cảm biến GS-02 yếu', device: 'GS-02', area: 'Khu nạp xuất', value: '15', threshold: '20', unit: '%', status: 'done', assignee: 'Lê Thị C' },
  { id: 'ALT-00113', daysAgo: 3, time: '20:16:37', severity: 'high', code: 'ALT-00113', message: 'Áp suất đầu vào hóa hơi cao', device: VAPORIZER_TAGS.inletPressure, area: 'Trạm hóa hơi', value: '9.8', threshold: '9.5', unit: 'bar', status: 'done', assignee: 'Trần Văn B' },
  { id: 'ALT-00112', daysAgo: 3, time: '14:02:50', severity: 'medium', code: 'ALT-00112', message: 'Mức bồn V-101 giảm nhanh bất thường', device: 'LT-101', area: 'Khu bồn LPG', value: '-4.2', threshold: '-3.0', unit: '%/h', status: 'done', assignee: 'Phạm Văn D' },
  { id: 'ALT-00111', daysAgo: 5, time: '09:37:26', severity: 'low', code: 'ALT-00111', message: 'Bơm P-101B chuyển sang Standby ngoài lịch', device: 'P-101B', area: 'Khu bơm', value: '0', threshold: '1', unit: 'lần', status: 'done', assignee: 'Nguyễn Văn A' },
  { id: 'ALT-00110', daysAgo: 12, time: '16:48:08', severity: 'critical', code: 'ALT-00110', message: 'Áp suất bồn V-102 vượt ngưỡng', device: 'V-102', area: 'Khu bồn LPG', value: '11.2', threshold: '10.5', unit: 'bar', status: 'done', assignee: 'Trần Văn B' },
  { id: 'ALT-00109', daysAgo: 20, time: '04:21:44', severity: 'medium', code: 'ALT-00109', message: 'Nhiệt độ ống xuất cao', device: 'TT-302', area: 'Tuyến chính', value: '48', threshold: '45', unit: '°C', status: 'done', assignee: 'Lê Thị C' },
];

/** "N phút trước" → daysAgo + time theo giờ nhà máy (qua nửa đêm → hôm qua). */
function minutesAgoToRelative(minutes: number, now: Date): Pick<AlertRecord, 'daysAgo' | 'time'> {
  const at = new Date(now.getTime() - minutes * 60_000);
  const d = (k: string) => Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10));
  return { daysAgo: Math.round((d(plantDayKey(now)) - d(plantDateTimeKey(at))) / 86_400_000), time: plantTimeOfDay(at) };
}

const loadedAt = appNow();
export const alertRecords: AlertRecord[] = rows.map((a) => {
  const { minutesAgo, resolvedAgoMin, followUpMin, ...extra } = EXTRA[a.id] ?? {};
  const when = minutesAgo !== undefined ? minutesAgoToRelative(minutesAgo, loadedAt) : {};
  const rec: AlertRecord = { ...a, ...extra, ...when };
  if (resolvedAgoMin !== undefined) {
    const at = loadedAt.getTime() - resolvedAgoMin * 60_000;
    rec.resolvedAt = new Date(at).toISOString();
    if (followUpMin) rec.followUp = { minutes: followUpMin, until: new Date(at + followUpMin * 60_000).toISOString(), unit: rec.unit, owner: rec.resolvedBy ?? rec.assignee ?? '' };
  }
  return { ...rec, notifiedTime: addSeconds(rec.time, NOTIFY_DELAY_S) };
});
