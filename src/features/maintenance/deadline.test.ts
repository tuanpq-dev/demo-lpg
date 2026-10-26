import { describe, expect, test } from 'vitest';
import { deadlineCountdown, deadlineDayLabel, dueInstant, formatClock, isPastDue, speakDuration } from './deadline';

// Hạn 16:00 ngày 26/10 giờ nhà máy = 09:00Z.
const DUE = '2026-10-26T16:00';

describe('deadlineCountdown (now truyền vào, Asia/Bangkok)', () => {
  test('ảnh: 11:45 → còn 04:15:00', () => {
    const c = deadlineCountdown(DUE, new Date('2026-10-26T04:45:00Z'))!;
    expect(c).toMatchObject({ overdue: false, clock: '04:15:00', speech: 'Còn 4 giờ 15 phút' });
    expect(c.remainingMs).toBe(4.25 * 3_600_000);
  });
  // ĐỔI 26/10/2026: đúng mốc hạn nay là ĐÃ quá hạn (quy tắc now ≥ hạn, người dùng duyệt).
  test('1 s trước hạn còn 00:00:01; đúng mốc hạn → quá hạn 00:00:00; 1 s sau → quá hạn 00:00:01', () => {
    expect(deadlineCountdown(DUE, new Date('2026-10-26T08:59:59Z'))).toMatchObject({ overdue: false, clock: '00:00:01' });
    expect(deadlineCountdown(DUE, new Date('2026-10-26T09:00:00Z'))).toMatchObject({ overdue: true, clock: '00:00:00' });
    expect(deadlineCountdown(DUE, new Date('2026-10-26T09:00:01Z'))).toMatchObject({ overdue: true, clock: '00:00:01', speech: 'Quá hạn dưới 1 phút' });
  });
  test('quá hạn: đếm thời gian đã quá', () => {
    expect(deadlineCountdown(DUE, new Date('2026-10-26T10:05:30Z'))).toMatchObject({ overdue: true, clock: '01:05:30', speech: 'Quá hạn 1 giờ 5 phút' });
  });
  test('qua nửa đêm: hạn 00:30 ngày 27, now 23:50 ngày 26 → còn 00:40:00', () => {
    expect(deadlineCountdown('2026-10-27T00:30', new Date('2026-10-26T16:50:00Z'))!.clock).toBe('00:40:00');
  });
  test('≥ 24 giờ → "N ngày HH:MM:SS"', () => {
    expect(deadlineCountdown('2026-10-28T16:00', new Date('2026-10-26T04:45:00Z'))!.clock).toBe('2 ngày 04:15:00');
  });
  test('không phụ thuộc múi giờ máy: hạn hiểu là UTC+7', () => {
    expect(deadlineCountdown(DUE, new Date('2026-10-26T09:00:00Z'))!.remainingMs).toBe(0);
  });
  test('hạn chỉ có ngày (chuỗi ngày hoặc hasTime=false) = 23:59:59; hạn thật 23:59 = 23:59:00', () => {
    expect(dueInstant('2026-10-26')!.toISOString()).toBe('2026-10-26T16:59:59.000Z');
    expect(dueInstant('2026-10-26T23:59', false)!.toISOString()).toBe('2026-10-26T16:59:59.000Z');
    expect(dueInstant('2026-10-26T23:59')!.toISOString()).toBe('2026-10-26T16:59:00.000Z');
    expect(deadlineCountdown('2026-10-26T23:59', new Date('2026-10-26T16:00:00Z'), false)).toMatchObject({ overdue: false, clock: '00:59:59' });
    expect(isPastDue('2026-10-26T23:59', new Date('2026-10-26T16:59:30Z'), false)).toBe(false);
    expect(isPastDue('2026-10-26T23:59', new Date('2026-10-26T16:59:30Z'))).toBe(true);
    expect(deadlineDayLabel('2026-10-26T23:59', new Date('2026-10-26T04:45:00Z'), false)).toBe('Cuối ngày Hôm nay');
  });
  test('quá hạn: đồng hồ đếm lên theo thời gian', () => {
    const a = deadlineCountdown(DUE, new Date('2026-10-26T09:00:10Z'))!;
    const b = deadlineCountdown(DUE, new Date('2026-10-26T09:00:20Z'))!;
    expect([a.clock, b.clock]).toEqual(['00:00:10', '00:00:20']);
  });
  test('hạn sai định dạng → null / không quá hạn', () => {
    expect(isPastDue('abc', new Date())).toBe(false);
    expect(deadlineCountdown('abc', new Date())).toBeNull();
  });
});

describe('formatClock / speakDuration', () => {
  test('0 và làm tròn xuống giây', () => {
    expect(formatClock(0)).toBe('00:00:00');
    expect(formatClock(999)).toBe('00:00:00');
    expect(formatClock(-61_000)).toBe('00:01:01');
  });
  test('câu đọc độ phân giải phút, bỏ phần 0', () => {
    expect(speakDuration(3_600_000)).toBe('1 giờ');
    expect(speakDuration(86_400_000 + 60_000)).toBe('1 ngày 1 phút');
    expect(speakDuration(59_999)).toBe('dưới 1 phút');
  });
});

describe('deadlineDayLabel', () => {
  const NOW = new Date('2026-10-26T04:45:00Z');
  test('hôm nay / ngày mai / hôm qua / ngày khác', () => {
    expect(deadlineDayLabel(DUE, NOW)).toBe('16:00 Hôm nay');
    expect(deadlineDayLabel('2026-10-27T08:00', NOW)).toBe('08:00 Ngày mai');
    expect(deadlineDayLabel('2026-10-25T08:00', NOW)).toBe('08:00 Hôm qua');
    expect(deadlineDayLabel('2026-11-02T08:00', NOW)).toBe('08:00 02/11/2026');
  });
  test('ranh giới nửa đêm Bangkok: 23:30 ICT ngày 26 → hạn 27 là "Ngày mai"; 00:10 ICT ngày 27 → "Hôm nay"', () => {
    expect(deadlineDayLabel('2026-10-27T08:00', new Date('2026-10-26T16:30:00Z'))).toBe('08:00 Ngày mai');
    expect(deadlineDayLabel('2026-10-27T08:00', new Date('2026-10-26T17:10:00Z'))).toBe('08:00 Hôm nay');
  });
});
