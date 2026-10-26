import { checklistProgress } from '@/features/maintenance/checklist';
import { appNow } from '@/lib/demoNow';
import { plantDayKey } from '@/lib/plantTime';
/**
 * Mock yêu cầu bảo trì – Figma 70:3964. Ngày tính TƯƠNG ĐỐI theo hôm nay (Figma: hôm nay = 15/10).
 * Đây là NGUỒN DUY NHẤT: KPI, thẻ ưu tiên, số đếm Tabs, Lịch sắp tới đều suy ra từ danh sách này.
 */

// Kiểu gốc = hợp đồng API dùng chung FE/BE (packages/shared/src/maintenance.ts). FE MỞ RỘNG thêm cho trang chi tiết
// (/maintenance/:id) – KHÔNG sửa packages/shared; đưa vào hợp đồng API khi làm backend (CLAUDE.md mục 7).
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
  | 'accept'
  | 'start'
  | 'progress'
  | 'pause'
  | 'block'
  | 'resume'
  | 'review'
  | 'rework'
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
};

/** Trường chỉ có ở FE – bỏ đi khi so với hợp đồng API (`contracts.test.ts`). */
export const FE_ONLY_FIELDS = ['cancelledFrom', 'cancelReason', 'reportedProgress', 'hold', 'dueHasTime', 'createdBy', 'objectives', 'notes', 'history'] as const;

export const SOURCE_OPTIONS: { value: MaintenanceSource; label: string }[] = [
  { value: 'alert', label: 'Từ cảnh báo hệ thống' },
  { value: 'manual', label: 'Tạo thủ công' },
  { value: 'schedule', label: 'Theo lịch định kỳ' },
  { value: 'inspection', label: 'Từ kiểm tra hiện trường' },
];

export const SHIFTS: { value: ShiftId; label: string; from: number; to: number }[] = [
  { value: 'shift-1', label: 'Ca 1 (06:00 - 14:00)', from: 6, to: 14 },
  { value: 'shift-2', label: 'Ca 2 (14:00 - 22:00)', from: 14, to: 22 },
  { value: 'shift-3', label: 'Ca 3 (22:00 - 06:00)', from: 22, to: 6 },
];

export const DEPARTMENTS = ['Bảo trì Cơ khí', 'Bảo trì Điện', 'Đo lường – Tự động hóa', 'An toàn – HSE', 'Vận hành'] as const;

/** Danh bạ nhân sự cho "Người phụ trách chính" / "Người phối hợp". */
export const PEOPLE: { name: string; department: (typeof DEPARTMENTS)[number] }[] = [
  { name: 'Nguyễn Văn A', department: 'Bảo trì Cơ khí' },
  { name: 'Trần Bình', department: 'Bảo trì Cơ khí' },
  { name: 'Lê Thị C', department: 'Đo lường – Tự động hóa' },
  { name: 'Phạm Văn D', department: 'Bảo trì Điện' },
  { name: 'Trần Thị B', department: 'An toàn – HSE' },
  { name: 'Hoàng Minh E', department: 'Vận hành' },
  { name: 'Võ Thị F', department: 'Đo lường – Tự động hóa' },
];

/** Checklist mẫu – "Chọn checklist mẫu". */
export const CHECKLIST_TEMPLATES: { id: string; label: string; items: string[] }[] = [
  {
    id: 'pressure',
    label: 'Sự cố áp suất bồn / van',
    items: ['Kiểm tra trực quan van', 'Đối chiếu áp suất tại hiện trường', 'Kiểm tra tín hiệu cảm biến', 'Kiểm tra hệ thống làm mát', 'Ghi nhận hình ảnh và kết quả'],
  },
  {
    id: 'gas',
    label: 'Kiểm tra cảm biến gas',
    items: ['Khoanh vùng & thông gió khu vực', 'Đo nồng độ bằng máy cầm tay', 'Hiệu chuẩn cảm biến bằng khí chuẩn', 'Kiểm tra liên động báo động', 'Ghi nhận kết quả hiệu chuẩn'],
  },
  {
    id: 'vaporizer',
    label: 'Bảo dưỡng máy hóa hơi',
    items: ['Cô lập & xả áp thiết bị', 'Kiểm tra bộ trao đổi nhiệt', 'Kiểm tra van điều nhiệt', 'Vệ sinh bộ lọc đầu vào', 'Chạy thử & ghi thông số'],
  },
  {
    id: 'periodic',
    label: 'Bảo dưỡng định kỳ chung',
    items: ['Kiểm tra ngoại quan & rò rỉ', 'Bôi trơn / siết chặt', 'Kiểm tra thông số vận hành', 'Cập nhật sổ bảo trì'],
  },
];

export const MAINTENANCE_ASSIGNEES = ['Nguyễn Văn A', 'Trần Bình', 'Lê Thị C', 'Phạm Văn D'] as const;
// (PEOPLE ở dưới là danh bạ đầy đủ cho form tạo yêu cầu.)

const pad = (n: number) => String(n).padStart(2, '0');
/** Ngày (local) cách hôm nay `offset` ngày → "yyyy-mm-dd". */
/** "yyyy-mm-dd" cách hôm nay (giờ nhà máy – khớp cách tính quá hạn) `offset` ngày. */
export function isoDay(offset = 0, base = appNow()) {
  const [y, m, d] = plantDayKey(base).split('-').map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d! + offset));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
/** Không có `dueTime` → hạn chỉ có ngày (`dueHasTime: false`, lưu "T23:59", quá hạn sau 23:59:59). */
const at = (offset: number, time = '23:59') => `${isoDay(offset)}T${time}`;

type Seed = Omit<MaintenanceRecord, 'id' | 'createdAt' | 'dueAt' | 'completedAt'> & {
  created: number;
  due: number;
  dueTime?: string;
  completed?: number;
};

const seeds: Seed[] = [
  // ---- Figma: 3 thẻ ưu tiên (70:4581–70:4621) + bảng (70:5363–70:5441); MT-00128/127 lấy nội dung theo thẻ ----
  // MT-00128 theo ảnh trang chi tiết (26/10/2026): chưa phân công, hạn 16:00 hôm nay, "Khu bồn LPG", tiêu đề V-101, từ ALT-00128.
  // Figma danh sách ghi "PSV-101", "Quá hạn 2 ngày", người phụ trách Nguyễn Văn A – lệch, ghi CLAUDE.md mục 8.
  { code: 'MT-00128', title: 'Kiểm tra van an toàn V-101', device: 'V-101', area: 'Khu bồn LPG', type: 'inspection', priority: 'critical', status: 'pending', assignee: null, created: 0, due: 0, dueTime: '16:00', progress: 0, sourceAlertId: 'ALT-00128', source: 'alert', department: 'Bảo trì Cơ khí', shift: 'shift-1' },
  { code: 'MT-00127', title: 'Kiểm tra cảm biến gas GS-01', device: 'GS-01', area: 'Khu nạp xuất', type: 'inspection', priority: 'high', status: 'pending', assignee: 'Trần Bình', created: -2, due: 0, progress: 0 },
  { code: 'MT-00126', title: 'Bảo dưỡng máy hóa hơi E-101A', device: 'E-101A', area: 'Trạm hóa hơi', type: 'periodic', priority: 'high', status: 'assigned', assignee: 'Lê Thị C', created: -6, due: 1, dueTime: '16:00', progress: 0 },
  { code: 'MT-00125', title: 'Cảnh báo rò rỉ Gas nhẹ', device: 'P-203', area: 'Khu bơm', type: 'incident', priority: 'medium', status: 'in-progress', assignee: 'Trần Bình', created: -4, due: 0, progress: 60 },
  { code: 'MT-00120', title: 'Nhiệt độ máy hóa hơi thấp', device: 'T-01', area: 'Trạm hóa hơi', type: 'incident', priority: 'low', status: 'done', assignee: 'Trần Bình', created: -7, due: 0, completed: -1, progress: 100 },
  // ---- Figma "Lịch sắp tới" (70:4897, 70:4909) ----
  { code: 'MT-00124', title: 'Bảo dưỡng định kỳ Cụm nạp', device: 'CN-01', area: 'Khu vực B', type: 'periodic', priority: 'medium', status: 'assigned', assignee: 'Phạm Văn D', created: -3, due: 0, dueTime: '14:00', progress: 0 },
  { code: 'MT-00123', title: 'Thay màng lọc F-102', device: 'F-102', area: 'Bồn chứa', type: 'periodic', priority: 'low', status: 'assigned', assignee: 'Nguyễn Văn A', created: -3, due: 1, dueTime: '08:30', progress: 0 },

  // ---- Bổ sung: tháng này ----
  { code: 'MT-00122', title: 'Kiểm tra rung động bơm P-101A', device: 'P-101A', area: 'Khu bơm', type: 'inspection', priority: 'medium', status: 'pending', assignee: null, created: -1, due: 3, progress: 0 },
  { code: 'MT-00121', title: 'Hiệu chuẩn đồng hồ lưu lượng FT-101', device: 'FT-101', area: 'Tuyến chính', type: 'periodic', priority: 'low', status: 'pending', assignee: null, created: 0, due: 6, progress: 0 },
  { code: 'MT-00119', title: 'Thay gioăng mặt bích tuyến xuất', device: 'L-201', area: 'Tuyến chính', type: 'incident', priority: 'medium', status: 'in-progress', assignee: 'Lê Thị C', created: -8, due: -1, progress: 45, reportedProgress: 40, hold: { kind: 'blocked', reason: 'Gioăng thay thế sai kích cỡ, chờ vật tư đúng chủng loại', at: at(-1, '15:20') } },
  // Hạn −1 (trước: +2) để KPI "Quá hạn" giữ 04 sau khi MT-00128 hết quá hạn.
  { code: 'MT-00118', title: 'Vệ sinh bộ lọc F-202', device: 'F-202', area: 'Khu Lọc', type: 'periodic', priority: 'low', status: 'in-progress', assignee: 'Phạm Văn D', created: -6, due: -1, progress: 30, hold: { kind: 'paused', reason: 'Chờ dừng tuyến lọc theo lịch vận hành', at: at(-1, '09:10') } },
  { code: 'MT-00117', title: 'Kiểm tra mức bồn V-102', device: 'V-102', area: 'Bồn chứa', type: 'inspection', priority: 'medium', status: 'in-progress', assignee: 'Nguyễn Văn A', created: -9, due: 4, progress: 70 },
  { code: 'MT-00116', title: 'Sửa cảm biến áp suất PT-102', device: 'PT-102', area: 'Bồn chứa', type: 'incident', priority: 'high', status: 'in-progress', assignee: 'Trần Bình', created: -10, due: 5, progress: 50 },
  { code: 'MT-00115', title: 'Bảo dưỡng máy hóa hơi E-101B', device: 'E-101B', area: 'Trạm hóa hơi', type: 'periodic', priority: 'medium', status: 'review', assignee: 'Lê Thị C', created: -12, due: -3, progress: 100 },
  { code: 'MT-00114', title: 'Kiểm tra họng nạp số 2', device: 'GS-03', area: 'Khu nạp xuất', type: 'inspection', priority: 'medium', status: 'review', assignee: 'Phạm Văn D', created: -11, due: 1, progress: 100 },
  { code: 'MT-00113', title: 'Thay pin cảm biến GS-02', device: 'GS-02', area: 'Khu nạp xuất', type: 'incident', priority: 'low', status: 'done', assignee: 'Nguyễn Văn A', created: -14, due: -10, completed: -11, progress: 100 },
  { code: 'MT-00112', title: 'Kiểm tra van an toàn PSV-102', device: 'PSV-102', area: 'Bồn chứa', type: 'inspection', priority: 'high', status: 'done', assignee: 'Trần Bình', created: -15, due: -9, completed: -9, progress: 100 },
  { code: 'MT-00111', title: 'Bảo dưỡng định kỳ bơm P-101B', device: 'P-101B', area: 'Khu bơm', type: 'periodic', priority: 'low', status: 'done', assignee: 'Lê Thị C', created: -13, due: -6, completed: -7, progress: 100 },
  { code: 'MT-00110', title: 'Sửa rò rỉ đường ống hồi', device: 'L-105', area: 'Tuyến chính', type: 'incident', priority: 'high', status: 'done', assignee: 'Phạm Văn D', created: -16, due: -14, completed: -14, progress: 100 },
  { code: 'MT-00109', title: 'Kiểm tra tiếp địa bồn V-101', device: 'V-101', area: 'Bồn chứa', type: 'inspection', priority: 'low', status: 'in-progress', assignee: 'Nguyễn Văn A', created: -17, due: -4, progress: 80 },
  // ---- Bổ sung: tháng trước ----
  { code: 'MT-00108', title: 'Bảo dưỡng định kỳ máy nén khí', device: 'C-301', area: 'Khu bơm', type: 'periodic', priority: 'medium', status: 'done', assignee: 'Trần Bình', created: -22, due: -16, completed: -17, progress: 100 },
  { code: 'MT-00107', title: 'Thay đồng hồ áp suất PI-104', device: 'PI-104', area: 'Trạm hóa hơi', type: 'incident', priority: 'medium', status: 'done', assignee: 'Lê Thị C', created: -25, due: -20, completed: -21, progress: 100 },
  { code: 'MT-00106', title: 'Kiểm tra hệ thống chữa cháy khu bồn', device: 'FS-01', area: 'Bồn chứa', type: 'inspection', priority: 'high', status: 'done', assignee: 'Phạm Văn D', created: -28, due: -21, completed: -22, progress: 100 },
  { code: 'MT-00105', title: 'Vệ sinh bộ lọc F-201', device: 'F-201', area: 'Khu Lọc', type: 'periodic', priority: 'low', status: 'done', assignee: 'Nguyễn Văn A', created: -30, due: -24, completed: -25, progress: 100 },
  { code: 'MT-00104', title: 'Sửa van điều áp PCV-201', device: 'PCV-201', area: 'Trạm hóa hơi', type: 'incident', priority: 'critical', status: 'done', assignee: 'Trần Bình', created: -33, due: -30, completed: -30, progress: 100 },
  { code: 'MT-00103', title: 'Kiểm tra cân xe bồn', device: 'WB-01', area: 'Khu nạp xuất', type: 'inspection', priority: 'low', status: 'done', assignee: 'Lê Thị C', created: -36, due: -29, completed: -29, progress: 100 },
  { code: 'MT-00102', title: 'Bảo dưỡng định kỳ máy phát dự phòng', device: 'G-01', area: 'Khu vực B', type: 'periodic', priority: 'medium', status: 'done', assignee: 'Phạm Văn D', created: -40, due: -33, completed: -34, progress: 100 },
  { code: 'MT-00101', title: 'Thay cảm biến nhiệt TT-302', device: 'TT-302', area: 'Tuyến chính', type: 'incident', priority: 'high', status: 'done', assignee: 'Nguyễn Văn A', created: -44, due: -40, completed: -41, progress: 100 },
  // Trang chi tiết V-101: "Bảo trì gần nhất" (ảnh ghi 12/3/2024 → ngày tương đối, không dùng năm 2024).
  { code: 'MT-00100', title: 'Bảo dưỡng định kỳ bồn V-101', device: 'V-101', area: 'Bồn chứa', type: 'periodic', priority: 'medium', status: 'done', assignee: 'Nguyễn Văn A', created: -52, due: -45, completed: -46, progress: 100 },
];

const at2 = (time: string, offset = 0) => `${isoDay(offset)}T${time}`;

/** Nội dung trang chi tiết (ảnh MT-00128). Giờ trong ngày theo ảnh; ngày = hôm nay (ảnh ghi 15/10/2023 – dữ liệu mẫu cũ). */
const DETAILS: Record<string, () => Partial<MaintenanceRecord>> = {
  'MT-00128': () => ({
    createdBy: 'Nguyen Abc',
    description:
      'Cảnh báo ALT-00128 cho thấy áp suất tại bồn V-101 đang dao động bất thường quanh mức 11.8 bar (vượt ngưỡng cảnh báo 1). Yêu cầu khẩn cấp kiểm tra hoạt động của van an toàn PSV-101.',
    objectives: [
      'Đảm bảo van xả áp hoạt động đúng thiết kế, không bị kẹt cơ học.',
      'Kiểm tra áp suất thực tế tại bồn V-101.',
      'Kiểm tra cảm biến hành trình báo tín hiệu chính xác về DCS.',
      'Kiểm tra hệ thống đường ống kết nối.',
      'Kiểm tra hệ thống làm mát.',
      'Xác định nguyên nhân dao động áp suất.',
    ],
    requiresPermit: true,
    checklist: [
      { id: 'c1', text: 'Chuẩn bị dụng cụ và giấy phép làm việc (PTW)', done: true, doneAt: at2('10:15') },
      { id: 'c2', text: 'Kiểm tra trực quan tình trạng bên ngoài PSV-101', done: true, doneAt: at2('10:45') },
      { id: 'c3', text: 'Sử dụng thiết bị dò siêu âm kiểm tra rò rỉ khí qua seat', done: false, active: true },
      { id: 'c4', text: 'Kiểm tra cáp tín hiệu cảm biến hành trình ZSO/ZSC', done: false },
      { id: 'c5', text: 'Vệ sinh bề mặt tiếp xúc và bu-lông mặt bích', done: false },
      { id: 'c6', text: 'Ghi nhận thông số áp suất hiện tại lúc kiểm tra', done: false },
      { id: 'c7', text: 'Trả lại mặt bằng, dọn dẹp và ký đóng PTW', done: false, na: true },
    ],
    notes: [{ id: 'n1', author: 'Nguyễn Văn A', at: at2('10:50'), text: 'Kiểm tra trực quan không thấy rò rỉ bên ngoài. Bắt đầu siêu âm.' }],
    attachments: [
      { id: 'f1', name: 'hien-truong-psv101.jpg', size: 2_480_000, kind: 'image' },
      { id: 'f2', name: 'bao-cao-kiem-dinh.pdf', size: 860_000, kind: 'document' },
      { id: 'f3', name: 'manual-psv101.pdf', size: 4_150_000, kind: 'manual' },
    ],
    history: [
      { id: 'h1', at: at2('08:30'), kind: 'create', text: 'Tạo yêu cầu (Auto-Trigger)', actor: 'Hệ thống' },
      { id: 'h2', at: at2('08:31'), kind: 'notify', text: 'Gửi thông báo đến bộ phận Bảo trì', actor: 'Hệ thống' },
      { id: 'h3', at: at2('08:35'), kind: 'priority', text: 'Cập nhật mức ưu tiên: Nghiêm trọng', actor: 'Hệ thống' },
    ],
  }),
};

export const maintenanceRecords: MaintenanceRecord[] = seeds.map(({ created, due, dueTime, completed, ...s }) => {
  const r: MaintenanceRecord = {
    ...s,
    id: s.code,
    createdAt: isoDay(created),
    dueAt: at(due, dueTime),
    ...(dueTime ? {} : { dueHasTime: false }),
    completedAt: completed === undefined ? null : isoDay(completed),
    ...DETAILS[s.code]?.(),
  };
  // Tiến độ của bản ghi có checklist = tính từ checklist (bỏ mục Không áp dụng).
  if (r.checklist?.length) r.progress = checklistProgress(r.checklist).percent;
  return r;
});
