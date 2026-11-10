import { checklistProgress } from '@/features/maintenance/checklist';
/**
 * Mock yêu cầu bảo trì – Figma 70:3964. Ngày tính TƯƠNG ĐỐI theo hôm nay (Figma: hôm nay = 15/10).
 * Đây là NGUỒN DUY NHẤT: KPI, thẻ ưu tiên, số đếm Tabs, Lịch sắp tới đều suy ra từ danh sách này.
 */

import type { MaintenanceRecord, MaintenanceSource } from '@/features/maintenance/types';
import { type DEPARTMENTS, type StaffMember } from '@/features/staff/org';
import { DETAILS } from './maintenanceDetails';
import { at, isoDay } from './maintenanceDates';

export { isoDay } from './maintenanceDates';
import { seeds } from './maintenanceSeeds';

export const SOURCE_OPTIONS: { value: MaintenanceSource; label: string }[] = [
  { value: 'alert', label: 'Từ cảnh báo hệ thống' },
  { value: 'manual', label: 'Tạo thủ công' },
  { value: 'schedule', label: 'Theo lịch định kỳ' },
  { value: 'inspection', label: 'Từ kiểm tra hiện trường' },
];

/**
 * MỘT nguồn nhân sự cho phân công, form tạo yêu cầu và nghiệm thu. Tên giữ như dữ liệu yêu cầu mẫu (ảnh Figma phân công
 * ghi "Trần Minh B", "Lê Hoàng C" – docs/figma-diffs.md). TODO(backend): GET danh mục nhân sự (+ vai trò, ca, chuyên môn).
 */
export const STAFF: readonly StaffMember[] = [
  {
    id: 's01',
    name: 'Nguyễn Văn A',
    title: 'Kỹ sư cơ khí',
    department: 'Bảo trì Cơ khí',
    specialty: 'Chuyên gia Van/Bồn',
    defaultShift: 'shift-2',
    role: 'engineer',
    areas: ['Khu bồn LPG'],
    skills: ['pressure', 'mechanical'],
  },
  {
    id: 's02',
    name: 'Trần Bình',
    title: 'Kỹ thuật viên cơ khí',
    department: 'Bảo trì Cơ khí',
    specialty: 'Thiết bị áp lực',
    defaultShift: 'shift-1',
    role: 'technician',
    areas: ['Khu bồn LPG', 'Khu bơm'],
    skills: ['pressure', 'mechanical'],
  },
  {
    id: 's03',
    name: 'Lê Thị C',
    title: 'Kỹ thuật viên đo lường',
    department: 'Đo lường – Tự động hóa',
    specialty: 'Cảm biến',
    defaultShift: 'shift-2',
    role: 'technician',
    areas: ['Khu nạp xuất', 'Trạm hóa hơi'],
    skills: ['instrument', 'gas'],
  },
  {
    id: 's04',
    name: 'Phạm Văn D',
    title: 'Kỹ thuật viên điện',
    department: 'Bảo trì Điện',
    specialty: 'Động cơ / Tủ điện',
    defaultShift: 'shift-1',
    role: 'technician',
    areas: ['Khu bơm', 'Tuyến chính'],
    skills: ['electrical'],
  },
  {
    id: 's05',
    name: 'Trần Thị B',
    title: 'Chuyên viên an toàn',
    department: 'An toàn – HSE',
    specialty: 'Hệ thống PCCC',
    defaultShift: 'shift-1',
    role: 'technician',
    areas: ['Trạm hóa hơi', 'Khu nạp xuất'],
    skills: ['fire', 'safety', 'gas'],
  },
  {
    id: 's06',
    name: 'Võ Thị F',
    title: 'Kỹ thuật viên đo lường',
    department: 'Đo lường – Tự động hóa',
    specialty: 'Lưu lượng / Hiệu chuẩn',
    defaultShift: 'shift-3',
    role: 'technician',
    areas: ['Tuyến chính', 'Khu Lọc'],
    skills: ['instrument'],
  },
  {
    id: 's07',
    name: 'Trần Hoàng Nam',
    title: 'Quản lý vận hành',
    department: 'Vận hành',
    specialty: 'Quản lý vận hành',
    defaultShift: 'shift-1',
    role: 'manager',
    areas: [],
    skills: ['operations'],
  },
  {
    id: 's08',
    name: 'Trần Văn B',
    title: 'Quản lý',
    department: 'Bảo trì Cơ khí',
    specialty: 'Quản lý bảo trì',
    defaultShift: 'shift-1',
    role: 'manager',
    areas: [],
    skills: ['mechanical'],
  },
  // Trước đây có trong danh sách "Người phụ trách chính" (PEOPLE) – nay là trưởng ca (manager) nên không còn chọn để phân công.
  {
    id: 's09',
    name: 'Hoàng Minh E',
    title: 'Trưởng ca vận hành',
    department: 'Vận hành',
    specialty: 'Vận hành khu bồn',
    defaultShift: 'shift-2',
    role: 'manager',
    areas: ['Khu bồn LPG'],
    skills: ['operations', 'safety'],
  },
];

/** Nhận việc bảo trì (phân công, form tạo yêu cầu, người phối hợp): technician + engineer. */
export const ASSIGNABLE_STAFF = STAFF.filter((p) => p.role !== 'manager');
/** Nghiệm thu: manager trước, rồi engineer (giữ thứ tự danh sách người nghiệm thu cũ). */
const REVIEWER_STAFF = [...STAFF.filter((p) => p.role === 'manager'), ...STAFF.filter((p) => p.role === 'engineer')];
/** Tra theo TOÀN BỘ STAFF (kể cả người không còn chọn được) – bản ghi cũ vẫn hiện đúng thông tin. */
export const staffByName = (name: string | null | undefined) => (name ? STAFF.find((p) => p.name === name) : undefined);

/** Danh bạ cho "Người phụ trách chính" / "Người phối hợp" (form tạo yêu cầu) – suy từ STAFF. */
export const PEOPLE: { name: string; department: (typeof DEPARTMENTS)[number] }[] = ASSIGNABLE_STAFF.map(({ name, department }) => ({
  name,
  department,
}));

/** Checklist mẫu – "Chọn checklist mẫu". */
export const CHECKLIST_TEMPLATES: { id: string; label: string; items: string[] }[] = [
  {
    id: 'pressure',
    label: 'Sự cố áp suất bồn / van',
    items: [
      'Kiểm tra trực quan van',
      'Đối chiếu áp suất tại hiện trường',
      'Kiểm tra tín hiệu cảm biến',
      'Kiểm tra hệ thống làm mát',
      'Ghi nhận hình ảnh và kết quả',
    ],
  },
  {
    id: 'gas',
    label: 'Kiểm tra cảm biến gas',
    items: [
      'Khoanh vùng & thông gió khu vực',
      'Đo nồng độ bằng máy cầm tay',
      'Hiệu chuẩn cảm biến bằng khí chuẩn',
      'Kiểm tra liên động báo động',
      'Ghi nhận kết quả hiệu chuẩn',
    ],
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

/** Người nghiệm thu (tên + chức danh) – suy từ STAFF (manager + engineer). TODO(backend): user có quyền `maintenance:review`. */
export const REVIEWERS: readonly { name: string; title: string }[] = REVIEWER_STAFF.map(({ name, title }) => ({ name, title }));

/** Tên người nhận việc (thao tác hàng loạt). */
export const MAINTENANCE_ASSIGNEES: readonly string[] = ASSIGNABLE_STAFF.map((p) => p.name);

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
