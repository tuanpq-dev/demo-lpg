import { describe, expect, test } from 'vitest';
import type { AlertRecord } from '@/mocks/alerts';
import { countByStatus, DEFAULT_FILTERS, deriveAlertKpis, derivePriorityCards, filterAlerts, matchAlert, shiftOf } from './alerts';

const alert = (id: string, patch: Partial<AlertRecord> = {}): AlertRecord => ({
  id,
  daysAgo: 0,
  time: '10:00:00',
  severity: 'high',
  code: id,
  message: 'Áp suất bồn vượt ngưỡng',
  device: 'V-101',
  area: 'Bồn chứa',
  value: '11',
  threshold: '10',
  unit: 'bar',
  status: 'unacknowledged',
  assignee: null,
  ...patch,
});

const rows = [
  alert('A1', { severity: 'critical' }),
  alert('A2', { status: 'in-progress', device: 'P-101A', area: 'Bơm', time: '15:30:00' }),
  alert('A3', { status: 'done', daysAgo: 3, time: '23:10:00' }),
  alert('A4', { daysAgo: 20, severity: 'low' }),
];

describe('matchAlert / filterAlerts', () => {
  test('mặc định = hôm nay, mọi trạng thái', () => {
    expect(filterAlerts(rows, DEFAULT_FILTERS).map((a) => a.id)).toEqual(['A1', 'A2']);
  });
  test('khoảng 7d/30d theo daysAgo (biên: 6 ngày vẫn trong 7d)', () => {
    expect(filterAlerts(rows, { ...DEFAULT_FILTERS, range: '7d' }).map((a) => a.id)).toEqual(['A1', 'A2', 'A3']);
    expect(matchAlert(alert('x', { daysAgo: 6 }), { ...DEFAULT_FILTERS, range: '7d' })).toBe(true);
    expect(matchAlert(alert('x', { daysAgo: 7 }), { ...DEFAULT_FILTERS, range: '7d' })).toBe(false);
    expect(filterAlerts(rows, { ...DEFAULT_FILTERS, range: '30d' })).toHaveLength(4);
  });
  test('tìm kiếm không phân biệt hoa thường, theo mã/thiết bị/khu vực', () => {
    expect(filterAlerts(rows, { ...DEFAULT_FILTERS, q: 'p-101a' }).map((a) => a.id)).toEqual(['A2']);
    expect(filterAlerts(rows, { ...DEFAULT_FILTERS, q: '  BƠM ' }).map((a) => a.id)).toEqual(['A2']);
  });
  test('ca làm việc: biên 6h/14h/22h', () => {
    expect(shiftOf('05:59:59')).toBe('night');
    expect(shiftOf('06:00:00')).toBe('morning');
    expect(shiftOf('14:00:00')).toBe('afternoon');
    expect(shiftOf('22:00:00')).toBe('night');
  });
  test('ignoreTab: số đếm tab theo các bộ lọc còn lại', () => {
    const f = { ...DEFAULT_FILTERS, tab: 'done' as const, range: '30d' as const };
    expect(filterAlerts(rows, f)).toHaveLength(1);
    expect(countByStatus(filterAlerts(rows, f, { ignoreTab: true }))).toEqual({ all: 4, unacknowledged: 2, 'in-progress': 1, done: 1 });
  });
});

describe('deriveAlertKpis / derivePriorityCards', () => {
  test('KPI theo khoảng đang chọn, tính từ cùng danh sách', () => {
    const v = (range: Parameters<typeof deriveAlertKpis>[1]) => Object.fromEntries(deriveAlertKpis(rows, range).map((k) => [k.id, k.value]));
    expect(v('today')).toEqual({ total: '2', critical: '1', unacknowledged: '1', 'in-progress': '1', done: '0' });
    expect(v('30d')).toEqual({ total: '4', critical: '1', unacknowledged: '2', 'in-progress': '1', done: '1' });
    expect(deriveAlertKpis([], 'today')[0]!.value).toBe('0');
  });
  test('thẻ ưu tiên: chưa xong, mức nghiêm trọng/cao, mới nhất trước', () => {
    expect(derivePriorityCards(rows).map((c) => c.id)).toEqual(['A2', 'A1']);
    expect(derivePriorityCards(rows)[1]!.handling).toBe('action-required');
  });
});
