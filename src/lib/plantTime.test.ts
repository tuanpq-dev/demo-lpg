import { describe, expect, test } from 'vitest';
import {
  dayNumber,
  daysFromToday,
  formatDayVi,
  formatPlantClock,
  formatPlantDateTime,
  formatPlantTimeDay,
  parsePlantDateTime,
  plantDateTimeKey,
  plantDayKey,
  plantHourFromNow,
  plantMonthKey,
  plantTimeOfDay,
} from './plantTime';

describe('plantTime – ngày theo giờ nhà máy (Asia/Bangkok, UTC+7)', () => {
  test('qua nửa đêm Bangkok trước nửa đêm UTC', () => {
    expect(plantDayKey(new Date('2026-10-20T16:59:59Z'))).toBe('2026-10-20'); // 23:59:59 ICT
    expect(plantDayKey(new Date('2026-10-20T17:00:00Z'))).toBe('2026-10-21'); // 00:00 ICT
  });
  test('không phụ thuộc múi giờ máy: cùng thời điểm, múi giờ khác → ngày khác', () => {
    const t = new Date('2026-10-20T20:00:00Z');
    expect(plantDayKey(t)).toBe('2026-10-21');
    expect(plantDayKey(t, 'UTC')).toBe('2026-10-20');
    expect(plantDayKey(t, 'America/New_York')).toBe('2026-10-20');
  });
  test('hiệu ngày nguyên kể cả qua tháng/năm', () => {
    expect(dayNumber('2027-01-01') - dayNumber('2026-12-31')).toBe(1);
    expect(daysFromToday('2026-10-19T08:00', new Date('2026-10-21T03:00:00Z'))).toBe(-2);
  });
  test('tháng hiện tại và dời tháng', () => {
    expect(plantMonthKey(new Date('2026-10-31T17:30:00Z'))).toBe('2026-11'); // 00:30 ngày 1/11 ICT
    expect(plantMonthKey(new Date('2026-01-10T00:00:00Z'), -1)).toBe('2025-12');
  });
});

describe('plantDateTimeKey / parsePlantDateTime', () => {
  test('giờ nhà máy, qua nửa đêm Bangkok', () => {
    expect(plantDateTimeKey(new Date('2026-10-26T16:59:00Z'))).toBe('2026-10-26T23:59');
    expect(plantDateTimeKey(new Date('2026-10-26T17:00:00Z'))).toBe('2026-10-27T00:00');
    expect(plantDateTimeKey(new Date('2026-12-31T17:00:00Z'))).toBe('2027-01-01T00:00');
  });
  test('đọc lại = cùng thời điểm (chạy hai chiều)', () => {
    const t = new Date('2026-10-26T04:45:00Z');
    expect(parsePlantDateTime(plantDateTimeKey(t))!.getTime()).toBe(t.getTime());
  });
  test('sai định dạng / ngoài giới hạn → null', () => {
    for (const v of ['', '2026-10-26', '2026-10-26 10:00', '2026-00-10T10:00', '2026-10-26T24:00', '2026-10-26T10:60']) {
      expect(parsePlantDateTime(v)).toBeNull();
    }
  });
});

describe('plantTimeOfDay / formatDayVi', () => {
  test('giờ nhà máy có giây, qua nửa đêm UTC vẫn đúng', () => {
    expect(plantTimeOfDay(new Date('2026-10-27T03:45:22Z'))).toBe('10:45:22');
    expect(plantTimeOfDay(new Date('2026-10-27T17:00:05Z'))).toBe('00:00:05');
  });
  test('dd/mm/yyyy, bỏ phần giờ', () => {
    expect(formatDayVi('2026-10-12')).toBe('12/10/2026');
    expect(formatDayVi('2026-01-05T08:00')).toBe('05/01/2026');
  });
});

describe('plantHourFromNow – giá trị mặc định ô thời gian (giờ chẵn kế tiếp, giờ nhà máy)', () => {
  test('làm tròn lên giờ chẵn tới, theo giờ nhà máy chứ không theo UTC', () => {
    expect(plantHourFromNow(new Date('2026-10-27T03:45:22Z'))).toBe('2026-10-27T11:00'); // 10:45 ICT
    expect(plantHourFromNow(new Date('2026-10-27T03:00:00Z'))).toBe('2026-10-27T11:00'); // đúng 10:00 → 11:00
  });
  test('qua nửa đêm nhà máy khi ngày UTC còn là hôm trước', () => {
    expect(plantHourFromNow(new Date('2026-10-27T16:30:00Z'))).toBe('2026-10-28T00:00'); // 23:30 ICT
    expect(plantHourFromNow(new Date('2026-10-27T16:30:00Z'), 24)).toBe('2026-10-29T00:00');
    expect(plantHourFromNow(new Date('2026-10-27T16:30:00Z'), -1)).toBe('2026-10-27T23:00');
  });
});

describe('định dạng hiển thị giờ nhà máy', () => {
  test('đồng hồ header, mốc ngắn, chuỗi ngày giờ', () => {
    const t = new Date('2026-10-27T17:05:09Z'); // 00:05:09 ICT ngày 28
    expect(formatPlantClock(t)).toBe('28/10/2026 ; 00:05:09');
    expect(formatPlantTimeDay(t)).toBe('00:05 28/10');
    expect(formatPlantDateTime('2026-10-26T08:30')).toBe('26/10/2026 08:30');
    expect(formatPlantDateTime('2026-10-26')).toBe('26/10/2026');
  });
});
