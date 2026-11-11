/*
 * Trạng thái sẵn sàng của nhân sự – thuần, dùng CHUNG cho modal phân công bảo trì và cảnh báo.
 * Nhãn chung: Sẵn sàng / Bận / Ngoài ca.
 * - Bảo trì: chỉ Sẵn sàng / Bận (việc bảo trì thường xếp cho ca sau → không xét "Ngoài ca" theo giờ hiện tại; lệch ca
 *   kiểm bằng `inShift` với giờ BẮT ĐẦU dự kiến).
 * - Cảnh báo: Ngoài ca THẮNG Bận (người ngoài ca không xử lý ngay được), tính bằng `isOnShift(ca, now)`.
 * "Lịch ca" hiện là ca mặc định của từng người (`STAFF.defaultShift`) – TODO(backend): lịch ca thật theo ngày.
 */
import { plantTimeOfDay } from '@/lib/plantTime';
import type { Availability } from '@/components/domain/StaffPicker/availability';
import { SHIFTS } from '@/features/staff/org';
import type { ShiftId } from '@/features/maintenance/types';

/** Bận khi đang có ≥ 3 việc (bảo trì) / cảnh báo (cảnh báo) với vai trò người phụ trách chính. */
export const BUSY_THRESHOLD = 3;

export { type Availability } from '@/components/domain/StaffPicker/availability';

/** Thứ tự sắp xếp: Sẵn sàng → Bận → Ngoài ca. */
export const AVAILABILITY_ORDER: Readonly<Record<Availability, number>> = { available: 0, busy: 1, 'off-shift': 2 };

/** Giờ (0–23) có thuộc ca không – ca 3 qua nửa đêm (22:00 → 06:00). Ca lạ → true (không cảnh báo nhầm). */
function shiftHasHour(shift: ShiftId, hour: number): boolean {
  const s = SHIFTS.find((x) => x.value === shift);
  if (!s || !Number.isFinite(hour)) return true;
  return s.from < s.to ? hour >= s.from && hour < s.to : hour >= s.from || hour < s.to;
}

/** Giờ "yyyy-mm-ddTHH:mm" có nằm trong khung ca không (giờ bắt đầu dự kiến – modal bảo trì). */
export function inShift(dateTime: string, shift: ShiftId): boolean {
  if (dateTime.length < 16) return true;
  return shiftHasHour(shift, Number(dateTime.slice(11, 13)));
}

/** Người có ca `shift` đang trong ca lúc `now` không (giờ nhà máy). */
export const isOnShift = (shift: ShiftId, now: Date): boolean => shiftHasHour(shift, Number(plantTimeOfDay(now).slice(0, 2)));

/** Ngoài ca thắng Bận. `onShift` không truyền (bảo trì) → chỉ Sẵn sàng / Bận. */
export function staffAvailability({ busy, onShift }: { busy: boolean; onShift?: boolean }): Availability {
  if (onShift === false) return 'off-shift';
  return busy ? 'busy' : 'available';
}

/** "Ca 2 (14:00 - 22:00)". */
export const shiftLabel = (shift: ShiftId) => SHIFTS.find((s) => s.value === shift)?.label ?? shift;
/** "Ca 2". */
export const shiftShortLabel = (shift: ShiftId) => shiftLabel(shift).split(' (')[0]!;
