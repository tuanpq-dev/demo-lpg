/**
 * Kiểu dữ liệu yêu cầu bảo trì phía FE (hợp đồng `MaintenanceRequest` + trường chỉ FE). Tách khỏi `src/mocks/maintenance.ts`
 * để logic / trang không phụ thuộc dữ liệu mẫu.
 */
// Kiểu gốc = hợp đồng API dùng chung FE/BE (packages/shared/src/maintenance.ts). FE MỞ RỘNG thêm cho trang chi tiết
// (/maintenance/:id) – KHÔNG sửa packages/shared; đưa vào hợp đồng API khi làm backend (docs/decisions.md).
import type {
  MaintenanceRequest,
  MaintenanceSource,
  MaintenanceStatus as ApiMaintenanceStatus,
  MaintenanceType,
  ShiftId,
} from '@demo-lpg/shared/maintenance';
export type { ApiMaintenanceStatus, MaintenanceSource, MaintenanceType, ShiftId };

/** Trạng thái FE = 5 bước của API + `cancelled` (chỉ FE – chưa có trong hợp đồng). */
export type MaintenanceStatus = ApiMaintenanceStatus | 'cancelled';

/** Mục checklist. `done` giữ như hợp đồng; FE thêm giờ hoàn thành, "Không áp dụng", "Đang làm". */
export type MaintenanceChecklistItem = {
  id: string;
  text: string;
  done: boolean;
  /** "yyyy-mm-ddTHH:mm" giờ nhà máy – lúc tick. */
  doneAt?: string;
  /** Không áp dụng: luôn khoá, không tính vào tiến độ. */
  na?: boolean;
  /** Đang làm (chip nổi bật). */
  active?: boolean;
};

/** Ghi chú kỹ thuật (luồng). Hợp đồng API hiện chỉ có `notes: string` (ghi chú của form tạo). */
export type MaintenanceNote = { id: string; author: string; /** "yyyy-mm-ddTHH:mm" giờ nhà máy */ at: string; text: string };

export type MaintenanceAttachmentKind = 'image' | 'document' | 'manual';
/**
 * `isTemp` = tệp thêm trong modal "Cập nhật tiến độ" khi CHƯA có backend: chỉ lưu tên/kích thước/loại – KHÔNG lưu object URL
 * (URL bị revoke khi đóng modal → link chết). Trang chi tiết hiện nhãn "Chưa tải lên máy chủ". TODO(backend): upload thật.
 */
export type MaintenanceAttachment = { id: string; name: string; size: number; kind?: MaintenanceAttachmentKind; isTemp?: boolean };

export type MaintenanceHistoryKind =
  | 'create'
  | 'notify'
  | 'priority'
  | 'assign'
  | 'reassign'
  | 'accept'
  | 'start'
  | 'progress'
  | 'pause'
  | 'block'
  | 'resume'
  | 'review'
  | 'rework'
  | 'submit'
  | 'review-pass'
  | 'review-needs-info'
  | 'review-fail'
  | 'done'
  | 'cancel';

/**
 * Cờ phụ khi đang thực hiện (status vẫn `in-progress`, stepper vẫn bước 3): tạm dừng (lý do bắt buộc) / gặp sự cố (mô tả bắt buộc).
 * Chỉ FE – đưa vào hợp đồng API khi làm backend.
 */
export type MaintenanceHold = { kind: 'paused' | 'blocked'; reason: string; /** "yyyy-mm-ddTHH:mm" giờ nhà máy */ at: string };
export type MaintenanceHistoryEntry = {
  id: string;
  /** "yyyy-mm-ddTHH:mm" giờ nhà máy */
  at: string;
  kind: MaintenanceHistoryKind;
  text: string;
  actor?: string;
};

/** Tình trạng thiết bị sau bảo trì (modal "Gửi yêu cầu nghiệm thu"). */
export type DeviceCondition = 'normal' | 'monitor' | 'unresolved';
export type SensorStatus = 'normal' | 'monitor' | 'fault';
export type ValveStatus = 'stable' | 'leak' | 'stuck';
export type ReviewResult = 'pass' | 'needs-info' | 'fail';

/**
 * Một số liệu chụp lúc gửi nghiệm thu: `value` null = mất tín hiệu lúc gửi; `warn` = ngưỡng cảnh báo lấy từ cấu hình tag
 * của tài sản lúc gửi (không viết cứng).
 */
export type ReadingSnapshot = { tag?: string; value: number | null; warn?: number };

/**
 * Hồ sơ gửi nghiệm thu (kỹ thuật viên, in-progress → review). `readings` = ẢNH CHỤP số liệu trực tiếp lúc bấm Gửi – không
 * đổi theo live sau đó; thiếu `pressure`/`temperature` = thiết bị không có số liệu trực tiếp. Chỉ FE (`FE_ONLY_FIELDS`).
 */
export type ReviewSubmission = {
  summary: string;
  cause: string;
  remedy: string;
  deviceCondition: DeviceCondition;
  readings: { pressure?: ReadingSnapshot; temperature?: ReadingSnapshot; /** "yyyy-mm-ddTHH:mm" giờ nhà máy */ at: string };
  sensorStatus: SensorStatus;
  valveStatus: ValveStatus;
  /** Người nghiệm thu được đề nghị (khác người thực hiện). */
  reviewer: string;
  /** Thời gian đề nghị nghiệm thu "yyyy-mm-ddTHH:mm" (không bắt buộc). */
  proposedAt?: string;
  submittedBy: string;
  submittedAt: string;
};

/** Kết quả nghiệm thu gần nhất (người nghiệm thu, review → done | in-progress). Chỉ FE. */
export type ReviewOutcome = {
  result: ReviewResult;
  reviewer: string;
  comment?: string;
  /** Đạt: số giờ theo dõi thêm (0 = không); `followUpUntil` = mốc hết theo dõi "yyyy-mm-ddTHH:mm". */
  followUpHours?: number;
  followUpUntil?: string;
  at: string;
};

/**
 * Bản ghi FE = hợp đồng API (bỏ `status/checklist/attachments/notes` để mở rộng) + trường của trang chi tiết.
 * `deadline` = `dueAt`; `workflowStep` KHÔNG lưu – suy từ `status` (`features/maintenance/workflow.ts`).
 */
export type MaintenanceRecord = Omit<MaintenanceRequest, 'status' | 'checklist' | 'attachments' | 'notes'> & {
  status: MaintenanceStatus;
  /** Bước đã tới khi bị hủy – stepper dừng ở đó. */
  cancelledFrom?: ApiMaintenanceStatus;
  cancelReason?: string;
  /**
   * Tiến độ người thực hiện BÁO CÁO (0–100, bước 5) – modal "Cập nhật tiến độ". Khác `progress` (= tiến độ checklist, bỏ mục N/A).
   * Thiếu → coi như bằng `progress`. Được phép giảm.
   */
  reportedProgress?: number;
  /** Tạm dừng / gặp sự cố (chỉ khi `in-progress`). */
  hold?: MaintenanceHold;
  /**
   * false = hạn chỉ có NGÀY (không có giờ riêng): `dueAt` vẫn lưu "…T23:59" cho khớp hợp đồng, hiển thị "Cuối ngày",
   * quá hạn tính tại 23:59:59. Thiếu / true = `dueAt` là giờ thật. KHÔNG suy từ chuỗi "23:59".
   */
  dueHasTime?: boolean;
  /** Người tạo (ảnh: "Nguyen Abc"). */
  createdBy?: string;
  /** "Mục tiêu xử lý". */
  objectives?: string[];
  checklist?: MaintenanceChecklistItem[];
  attachments?: MaintenanceAttachment[];
  /** Luồng ghi chú kỹ thuật (ghi chú của form tạo → ghi chú đầu tiên). */
  notes?: MaintenanceNote[];
  history?: MaintenanceHistoryEntry[];
  /** Hồ sơ gửi nghiệm thu gần nhất. */
  submission?: ReviewSubmission;
  /** Kết quả nghiệm thu gần nhất. */
  review?: ReviewOutcome;
  /** Cờ "Không đạt nghiệm thu" (in-progress sau khi bị đánh giá Không đạt; bỏ khi gửi lại). */
  reviewFailed?: boolean;
};

/** Trường chỉ có ở FE – bỏ đi khi so với hợp đồng API (`contracts.test.ts`). */
export const FE_ONLY_FIELDS = ['cancelledFrom', 'cancelReason', 'reportedProgress', 'hold', 'dueHasTime', 'createdBy', 'objectives', 'notes', 'history', 'submission', 'review', 'reviewFailed'] as const;
