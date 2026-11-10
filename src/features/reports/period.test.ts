import { describe, expect, it } from 'vitest';
import { dayFromNumber, daysInMonth, periodContains, periodKeyOf, periodLabel, periodRange, reportCode, weekdayVi } from './period';
import { dayNumber } from '@/lib/plantTime';

describe('periodRange', () => {
  it('ngày / tháng / quý / năm', () => {
    expect(periodRange('daily', '2026-06-24')).toEqual({ start: '2026-06-24', end: '2026-06-24' });
    expect(periodRange('monthly', '2026-06')).toEqual({ start: '2026-06-01', end: '2026-06-30' });
    expect(periodRange('quarterly', '2026-Q2')).toEqual({ start: '2026-04-01', end: '2026-06-30' });
    expect(periodRange('quarterly', '2026-Q4')).toEqual({ start: '2026-10-01', end: '2026-12-31' });
    expect(periodRange('yearly', '2026')).toEqual({ start: '2026-01-01', end: '2026-12-31' });
  });

  it('tháng 2 năm nhuận', () => {
    expect(periodRange('monthly', '2028-02').end).toBe('2028-02-29');
    expect(daysInMonth(2026, 2)).toBe(28);
  });

  it('mã sai định dạng → ném lỗi', () => {
    expect(() => periodRange('monthly', '2026-6')).toThrow();
    expect(() => periodRange('quarterly', '2026-Q5')).toThrow();
    expect(() => periodRange('daily', '2026-06')).toThrow();
  });
});

describe('periodKeyOf / periodContains', () => {
  it('ngày → mã kỳ', () => {
    expect(periodKeyOf('daily', '2026-06-24')).toBe('2026-06-24');
    expect(periodKeyOf('monthly', '2026-06-24')).toBe('2026-06');
    expect(periodKeyOf('quarterly', '2026-07-01')).toBe('2026-Q3');
    expect(periodKeyOf('yearly', '2026-12-31')).toBe('2026');
  });

  it('biên đầu/cuối kỳ', () => {
    expect(periodContains('quarterly', '2026-Q2', '2026-04-01')).toBe(true);
    expect(periodContains('quarterly', '2026-Q2', '2026-06-30')).toBe(true);
    expect(periodContains('quarterly', '2026-Q2', '2026-07-01')).toBe(false);
    expect(periodContains('daily', '2026-06-24', '2026-06-24T23:59')).toBe(true);
  });
});

describe('nhãn + mã', () => {
  it('periodLabel', () => {
    expect(periodLabel('daily', '2026-06-24')).toBe('24/06/2026');
    expect(periodLabel('monthly', '2026-06')).toBe('Tháng 06/2026');
    expect(periodLabel('quarterly', '2026-Q2')).toBe('Quý 2/2026');
    expect(periodLabel('yearly', '2026')).toBe('Năm 2026');
  });

  it('reportCode – báo cáo ngày như ảnh', () => {
    expect(reportCode('daily', '2026-06-24')).toBe('BCVH-N-24062026');
    expect(reportCode('monthly', '2026-06')).toBe('BCVH-T-062026');
    expect(reportCode('quarterly', '2026-Q2')).toBe('BCVH-Q-22026');
    expect(reportCode('yearly', '2026')).toBe('BCVH-NAM-2026');
  });

  it('weekdayVi: 26/06/2026 thứ Sáu, 30/06/2026 thứ Ba, 28/06/2026 Chủ nhật', () => {
    expect(weekdayVi('2026-06-26')).toBe('T6');
    expect(weekdayVi('2026-06-30')).toBe('T3');
    expect(weekdayVi('2026-06-28')).toBe('CN');
  });

  it('dayFromNumber ngược với dayNumber', () => {
    for (const d of ['1970-01-01', '2026-02-28', '2028-02-29', '2026-12-31']) expect(dayFromNumber(dayNumber(d))).toBe(d);
  });
});
