/**
 * Mock data màn Cảnh báo – 5 dòng đầu nguyên văn Figma 70:3032, 15 dòng bổ sung để thử lọc/phân trang.
 * Đây là NGUỒN DUY NHẤT: thẻ ưu tiên, KPI, số đếm Tabs đều tính ra từ danh sách này (src/data/alerts.ts).
 */
import type { Severity, WorkStatus } from '@/components';

/** Trạng thái xử lý của cảnh báo (dùng chung với Badge status). */
export type AlertStatus = Extract<WorkStatus, 'unacknowledged' | 'in-progress' | 'done'>;

export type AlertRecord = {
  id: string;
  /** Số ngày trước hôm nay (0 = hôm nay). Thời điểm thật = hôm nay − daysAgo, lúc `time`. */
  daysAgo: number;
  /** "HH:mm:ss" */
  time: string;
  severity: Severity;
  /** Mã cảnh báo hiển thị (cột "Mã CB"). */
  code: string;
  message: string;
  device: string;
  area: string;
  value: string;
  threshold: string;
  /** Đơn vị: "bar", "% LEL", "°C", "m³/h". */
  unit: string;
  status: AlertStatus;
  assignee: string | null;
};

export const ALERT_ASSIGNEES = ['Nguyễn Văn A', 'Trần Văn B', 'Lê Thị C', 'Phạm Văn D'] as const;

export const alertRecords: AlertRecord[] = [
  // ---- 5 dòng Figma 70:3058–70:3166 ----
  { id: 'ALT-00128', daysAgo: 0, time: '10:45:22', severity: 'critical', code: 'ALT-00128', message: 'Áp suất bồn V-101 vượt ngưỡng', device: 'V-101', area: 'Bồn chứa', value: '11.8', threshold: '10.5', unit: 'bar', status: 'unacknowledged', assignee: null },
  // Thẻ ưu tiên ghi GS-01, bảng ghi GS-04 cho cùng ALT-00127 → dùng GS-01 (khớp "Kiểm tra cảm biến gas GS-01" bên Bảo trì). Chờ designer xác nhận.
  { id: 'ALT-00127', daysAgo: 0, time: '09:12:05', severity: 'high', code: 'ALT-00127', message: 'Cảnh báo rò rỉ Gas nhẹ', device: 'GS-01', area: 'Khu nạp xuất', value: '25', threshold: '20', unit: '% LEL', status: 'in-progress', assignee: 'Nguyễn Văn A' },
  { id: 'ALT-00126', daysAgo: 0, time: '08:45:10', severity: 'high', code: 'ALT-00126', message: 'Nhiệt độ máy hóa hơi thấp', device: 'E-101A', area: 'Trạm hóa hơi', value: '45', threshold: '50', unit: '°C', status: 'unacknowledged', assignee: null },
  { id: 'ALT-00125', daysAgo: 0, time: '08:10:00', severity: 'medium', code: 'ALT-00125', message: 'Chênh áp lọc cao', device: 'F-201', area: 'Khu Lọc', value: '1.2', threshold: '1.0', unit: 'bar', status: 'in-progress', assignee: 'Trần Văn B' },
  // Figma để trống Mã CB → tạm dùng ALT-00124.
  { id: 'ALT-00124', daysAgo: 0, time: '07:30:22', severity: 'low', code: 'ALT-00124', message: 'Cảnh báo lưu lượng thấp', device: 'FT-101', area: 'Tuyến chính', value: '10', threshold: '15', unit: 'm³/h', status: 'done', assignee: 'Lê Thị C' },

  // ---- Bổ sung để thử lọc/phân trang ----
  { id: 'ALT-00123', daysAgo: 0, time: '06:58:41', severity: 'medium', code: 'ALT-00123', message: 'Mức bồn V-102 thấp hơn kế hoạch', device: 'V-102', area: 'Bồn chứa', value: '32', threshold: '35', unit: '%', status: 'unacknowledged', assignee: null },
  { id: 'ALT-00122', daysAgo: 0, time: '05:20:13', severity: 'critical', code: 'ALT-00122', message: 'Mất tín hiệu cảm biến áp suất PT-102', device: 'PT-102', area: 'Bồn chứa', value: '0', threshold: '1', unit: 'bar', status: 'in-progress', assignee: 'Phạm Văn D' },
  { id: 'ALT-00121', daysAgo: 0, time: '03:47:09', severity: 'low', code: 'ALT-00121', message: 'Nhiệt độ môi trường khu bơm tăng', device: 'TT-305', area: 'Khu bơm', value: '38', threshold: '40', unit: '°C', status: 'done', assignee: 'Trần Văn B' },
  { id: 'ALT-00120', daysAgo: 0, time: '01:15:00', severity: 'high', code: 'ALT-00120', message: 'Rung động bơm P-101A vượt mức', device: 'P-101A', area: 'Khu bơm', value: '7.1', threshold: '6.5', unit: 'mm/s', status: 'done', assignee: 'Nguyễn Văn A' },
  { id: 'ALT-00119', daysAgo: 0, time: '00:32:47', severity: 'medium', code: 'ALT-00119', message: 'Chênh áp lọc F-202 tăng dần', device: 'F-202', area: 'Khu Lọc', value: '0.9', threshold: '1.0', unit: 'bar', status: 'unacknowledged', assignee: null },
  { id: 'ALT-00118', daysAgo: 1, time: '22:41:30', severity: 'high', code: 'ALT-00118', message: 'Rò rỉ gas tại họng nạp số 2', device: 'GS-03', area: 'Khu nạp xuất', value: '22', threshold: '20', unit: '% LEL', status: 'done', assignee: 'Lê Thị C' },
  { id: 'ALT-00117', daysAgo: 1, time: '19:05:12', severity: 'low', code: 'ALT-00117', message: 'Lưu lượng xuất thấp hơn định mức', device: 'FT-102', area: 'Tuyến chính', value: '12', threshold: '15', unit: 'm³/h', status: 'done', assignee: 'Trần Văn B' },
  { id: 'ALT-00116', daysAgo: 1, time: '15:28:55', severity: 'critical', code: 'ALT-00116', message: 'Van an toàn PSV-101 kích hoạt', device: 'PSV-101', area: 'Bồn chứa', value: '12.4', threshold: '12.0', unit: 'bar', status: 'done', assignee: 'Phạm Văn D' },
  { id: 'ALT-00115', daysAgo: 1, time: '11:10:03', severity: 'medium', code: 'ALT-00115', message: 'Nhiệt độ máy hóa hơi E-101B dao động', device: 'E-101B', area: 'Trạm hóa hơi', value: '52', threshold: '55', unit: '°C', status: 'in-progress', assignee: 'Nguyễn Văn A' },
  { id: 'ALT-00114', daysAgo: 1, time: '07:44:19', severity: 'low', code: 'ALT-00114', message: 'Pin cảm biến GS-02 yếu', device: 'GS-02', area: 'Khu nạp xuất', value: '15', threshold: '20', unit: '%', status: 'done', assignee: 'Lê Thị C' },
  { id: 'ALT-00113', daysAgo: 3, time: '20:16:37', severity: 'high', code: 'ALT-00113', message: 'Áp suất đầu vào hóa hơi cao', device: 'PT-101', area: 'Trạm hóa hơi', value: '9.8', threshold: '9.5', unit: 'bar', status: 'done', assignee: 'Trần Văn B' },
  { id: 'ALT-00112', daysAgo: 3, time: '14:02:50', severity: 'medium', code: 'ALT-00112', message: 'Mức bồn V-101 giảm nhanh bất thường', device: 'LT-101', area: 'Bồn chứa', value: '-4.2', threshold: '-3.0', unit: '%/h', status: 'done', assignee: 'Phạm Văn D' },
  { id: 'ALT-00111', daysAgo: 5, time: '09:37:26', severity: 'low', code: 'ALT-00111', message: 'Bơm P-101B chuyển sang Standby ngoài lịch', device: 'P-101B', area: 'Khu bơm', value: '0', threshold: '1', unit: 'lần', status: 'done', assignee: 'Nguyễn Văn A' },
  { id: 'ALT-00110', daysAgo: 12, time: '16:48:08', severity: 'critical', code: 'ALT-00110', message: 'Áp suất bồn V-102 vượt ngưỡng', device: 'V-102', area: 'Bồn chứa', value: '11.2', threshold: '10.5', unit: 'bar', status: 'done', assignee: 'Trần Văn B' },
  { id: 'ALT-00109', daysAgo: 20, time: '04:21:44', severity: 'medium', code: 'ALT-00109', message: 'Nhiệt độ ống xuất cao', device: 'TT-302', area: 'Tuyến chính', value: '48', threshold: '45', unit: '°C', status: 'done', assignee: 'Lê Thị C' },
];
