/**
 * Mock yêu cầu bảo trì – Figma 70:3964. Ngày tính TƯƠNG ĐỐI theo hôm nay (Figma: hôm nay = 15/10).
 * Đây là NGUỒN DUY NHẤT: KPI, thẻ ưu tiên, số đếm Tabs, Lịch sắp tới đều suy ra từ danh sách này.
 */
import type { Severity } from '@/components';

export type MaintenanceStatus = 'pending' | 'assigned' | 'in-progress' | 'review' | 'done';
export type MaintenanceType = 'periodic' | 'incident' | 'inspection';

export type MaintenanceRecord = {
  id: string;
  /** "MT-00128" */
  code: string;
  /** Cột "Nội dung". */
  title: string;
  description?: string;
  device: string;
  area: string;
  type: MaintenanceType;
  priority: Severity;
  status: MaintenanceStatus;
  assignee: string | null;
  /** "yyyy-mm-dd" */
  createdAt: string;
  /** "yyyy-mm-ddTHH:mm" */
  dueAt: string;
  /** "yyyy-mm-dd" khi hoàn thành. */
  completedAt: string | null;
  /** 0–100 */
  progress: number;
  /** Cảnh báo gốc (nếu tạo từ /alerts). */
  sourceAlertId?: string;

  // ---- Trường của form "Tạo yêu cầu bảo trì" (ảnh thiết kế) – tuỳ chọn để dữ liệu cũ vẫn hợp lệ ----
  /** Nguồn tạo yêu cầu. */
  source?: MaintenanceSource;
  /** Mã tham chiếu / cảnh báo, ví dụ "ALT-00128". */
  referenceCode?: string;
  /** "yyyy-mm-ddTHH:mm" */
  startAt?: string;
  department?: string;
  shift?: ShiftId;
  /** Người phối hợp. */
  collaborators?: string[];
  checklist?: { id: string; text: string; done: boolean }[];
  attachments?: { id: string; name: string; size: number }[];
  /** Ghi chú nội bộ / lưu ý an toàn. */
  notes?: string;
  /** Yêu cầu Giấy phép Làm việc (Permit to Work – PTW). */
  requiresPermit?: boolean;
};

export type MaintenanceSource = 'alert' | 'manual' | 'schedule' | 'inspection';
export const SOURCE_OPTIONS: { value: MaintenanceSource; label: string }[] = [
  { value: 'alert', label: 'Từ cảnh báo hệ thống' },
  { value: 'manual', label: 'Tạo thủ công' },
  { value: 'schedule', label: 'Theo lịch định kỳ' },
  { value: 'inspection', label: 'Từ kiểm tra hiện trường' },
];

export type ShiftId = 'shift-1' | 'shift-2' | 'shift-3';
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
export function isoDay(offset = 0, base = new Date()) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const at = (offset: number, time = '17:00') => `${isoDay(offset)}T${time}`;

type Seed = Omit<MaintenanceRecord, 'id' | 'createdAt' | 'dueAt' | 'completedAt'> & {
  created: number;
  due: number;
  dueTime?: string;
  completed?: number;
};

const seeds: Seed[] = [
  // ---- Figma: 3 thẻ ưu tiên (70:4581–70:4621) + bảng (70:5363–70:5441); MT-00128/127 lấy nội dung theo thẻ ----
  { code: 'MT-00128', title: 'Kiểm tra van an toàn PSV-101', device: 'V-101', area: 'Bồn chứa', type: 'inspection', priority: 'critical', status: 'pending', assignee: 'Nguyễn Văn A', created: -5, due: -2, progress: 0 },
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
  { code: 'MT-00119', title: 'Thay gioăng mặt bích tuyến xuất', device: 'L-201', area: 'Tuyến chính', type: 'incident', priority: 'medium', status: 'in-progress', assignee: 'Lê Thị C', created: -8, due: -1, progress: 45 },
  { code: 'MT-00118', title: 'Vệ sinh bộ lọc F-202', device: 'F-202', area: 'Khu Lọc', type: 'periodic', priority: 'low', status: 'in-progress', assignee: 'Phạm Văn D', created: -6, due: 2, progress: 30 },
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
];

export const maintenanceRecords: MaintenanceRecord[] = seeds.map(({ created, due, dueTime, completed, ...s }) => ({
  ...s,
  id: s.code,
  createdAt: isoDay(created),
  dueAt: at(due, dueTime),
  completedAt: completed === undefined ? null : isoDay(completed),
}));
