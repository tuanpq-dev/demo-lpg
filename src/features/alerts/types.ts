/**
 * Kiểu dữ liệu cảnh báo phía FE (hợp đồng `Alert` + trường chỉ FE). Tách khỏi `src/mocks/alerts.ts` để logic / trang không
 * phụ thuộc dữ liệu mẫu; mock chỉ còn danh sách mẫu.
 */
import type { Alert, AlertStatus as ApiAlertStatus } from '@demo-lpg/shared/alerts';
import type { AlertKind } from './kinds';

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
