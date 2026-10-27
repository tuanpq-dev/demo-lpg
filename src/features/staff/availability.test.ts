import { describe, expect, it } from 'vitest';
import { AVAILABILITY_LABEL, inShift, isOnShift, shiftHasHour, shiftShortLabel, staffAvailability } from './availability';

/** Giờ nhà máy (UTC+7) → Date. */
const plant = (hhmm: string) => new Date(`2026-10-27T${hhmm}:00+07:00`);

describe('shiftHasHour / isOnShift', () => {
  it('ranh giới ca 1 (06:00 → 14:00): 06:00 trong, 14:00 ngoài', () => {
    expect(shiftHasHour('shift-1', 5)).toBe(false);
    expect(shiftHasHour('shift-1', 6)).toBe(true);
    expect(shiftHasHour('shift-1', 13)).toBe(true);
    expect(shiftHasHour('shift-1', 14)).toBe(false);
  });

  it('ca 3 qua nửa đêm (22:00 → 06:00)', () => {
    expect(shiftHasHour('shift-3', 21)).toBe(false);
    expect(shiftHasHour('shift-3', 22)).toBe(true);
    expect(shiftHasHour('shift-3', 0)).toBe(true);
    expect(shiftHasHour('shift-3', 5)).toBe(true);
    expect(shiftHasHour('shift-3', 6)).toBe(false);
  });

  it('isOnShift theo giờ nhà máy, không theo múi giờ máy', () => {
    expect(isOnShift('shift-1', plant('10:45'))).toBe(true);
    expect(isOnShift('shift-2', plant('10:45'))).toBe(false);
    expect(isOnShift('shift-2', plant('14:00'))).toBe(true);
    expect(isOnShift('shift-2', plant('21:59'))).toBe(true);
    expect(isOnShift('shift-3', plant('23:30'))).toBe(true);
    // 23:30 giờ nhà máy = 16:30 UTC – nếu lấy giờ UTC sẽ ra ca 2.
    expect(isOnShift('shift-2', plant('23:30'))).toBe(false);
  });

  it('inShift (giờ bắt đầu dự kiến): chuỗi thiếu giờ → không cảnh báo', () => {
    expect(inShift('2026-10-27T14:00', 'shift-1')).toBe(false);
    expect(inShift('2026-10-27T13:59', 'shift-1')).toBe(true);
    expect(inShift('2026-10-27', 'shift-1')).toBe(true);
    expect(inShift('', 'shift-2')).toBe(true);
  });
});

describe('staffAvailability', () => {
  it('Ngoài ca thắng Bận; không xét ca (bảo trì) → chỉ Sẵn sàng / Bận', () => {
    expect(staffAvailability({ busy: true, onShift: false })).toBe('off-shift');
    expect(staffAvailability({ busy: false, onShift: false })).toBe('off-shift');
    expect(staffAvailability({ busy: true, onShift: true })).toBe('busy');
    expect(staffAvailability({ busy: false, onShift: true })).toBe('available');
    expect(staffAvailability({ busy: true })).toBe('busy');
    expect(staffAvailability({ busy: false })).toBe('available');
  });

  it('nhãn chung', () => {
    expect(Object.values(AVAILABILITY_LABEL)).toEqual(['Sẵn sàng', 'Bận', 'Ngoài ca']);
    expect(shiftShortLabel('shift-2')).toBe('Ca 2');
  });
});
