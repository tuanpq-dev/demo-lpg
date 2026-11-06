/**
 * Ca làm việc, phòng ban, vai trò nghiệp vụ và kiểu nhân sự. Danh mục nhân sự (`STAFF`) vẫn là mock – trang đọc qua
 * `src/data/staff.ts`. TODO(backend): GET danh mục ca / phòng ban / nhân sự.
 */
import type { ShiftId } from '@demo-lpg/shared/maintenance';
import type { Area } from '@/features/plant/areas';
import type { StaffSkill } from './skills';

export const SHIFTS: { value: ShiftId; label: string; from: number; to: number }[] = [
  { value: 'shift-1', label: 'Ca 1 (06:00 - 14:00)', from: 6, to: 14 },
  { value: 'shift-2', label: 'Ca 2 (14:00 - 22:00)', from: 14, to: 22 },
  { value: 'shift-3', label: 'Ca 3 (22:00 - 06:00)', from: 22, to: 6 },
];

export const DEPARTMENTS = ['Bảo trì Cơ khí', 'Bảo trì Điện', 'Đo lường – Tự động hóa', 'An toàn – HSE', 'Vận hành'] as const;

/**
 * Vai trò nghiệp vụ của nhân sự (khác vai trò đăng nhập):
 * - technician: nhận việc bảo trì (phân công)
 * - engineer:   kỹ sư – vừa nhận việc vừa nghiệm thu được (khớp quyền `maintenance:review` của vai trò engineer)
 * - manager:    quản lý / trưởng ca – chỉ nghiệm thu, KHÔNG nằm trong danh sách phân công
 */
export type StaffRole = 'technician' | 'engineer' | 'manager';
export type StaffMember = {
  id: string;
  name: string;
  title: string;
  department: (typeof DEPARTMENTS)[number];
  /** Chuyên môn – dòng phụ trên thẻ nhân sự (modal Phân công). */
  specialty: string;
  defaultShift: ShiftId;
  role: StaffRole;
  /** Khu thường phụ trách (gợi ý sắp xếp ở modal phân công cảnh báo). Mock tạm – TODO(backend). */
  areas: readonly Area[];
  /** Chuyên môn (khớp `ALERT_KINDS[kind].skills`). Mock tạm – TODO(backend). */
  skills: readonly StaffSkill[];
};
