import { describe, expect, test } from 'vitest';
import type { AlertRecord } from './types';
import { alertCounts, priorityAlerts, queryAlerts, type AlertListQuery } from './query';

const alert = (id: string, patch: Partial<AlertRecord> = {}): AlertRecord => ({
  id,
  code: id,
  daysAgo: 0,
  time: '10:00:00',
  severity: 'medium',
  message: 'Áp suất bồn V-101 vượt ngưỡng',
  device: 'V-101',
  area: 'Khu bồn LPG',
  value: '11.8',
  threshold: '10.5',
  unit: 'bar',
  status: 'unacknowledged',
  assignee: null,
  ...patch,
});

const q = (patch: Partial<AlertListQuery> = {}): AlertListQuery => ({
  tab: 'all',
  q: '',
  severity: null,
  area: null,
  device: null,
  shift: null,
  range: 'today',
  page: 1,
  pageSize: 2,
  ...patch,
});

const all = [
  alert('A1', { time: '08:00:00', status: 'unacknowledged', severity: 'critical' }),
  alert('A2', { time: '09:00:00', status: 'in-progress', severity: 'high', device: 'P-101', area: 'Cụm bơm' }),
  alert('A3', { time: '11:00:00', status: 'resolved' }),
  alert('A4', { time: '12:00:00', status: 'done' }),
  alert('OLD', { daysAgo: 3, status: 'unacknowledged', severity: 'critical' }),
];

describe('GET /alerts – lọc, phân trang, đếm tab', () => {
  test('mới nhất trước, cắt đúng trang, tổng = số khớp', () => {
    const r = queryAlerts(all, q());
    expect(r.rows.map((a) => a.id)).toEqual(['A4', 'A3']);
    expect(r.total).toBe(4);
    expect(queryAlerts(all, q({ page: 2 })).rows.map((a) => a.id)).toEqual(['A2', 'A1']);
  });

  test('trang vượt số trang (URL cũ) → kẹp về trang cuối', () => {
    const r = queryAlerts(all, q({ page: 9 }));
    expect(r.page).toBe(2);
    expect(r.rows.map((a) => a.id)).toEqual(['A2', 'A1']);
  });

  test('đếm tab theo các bộ lọc CÒN LẠI (không tính tab đang chọn)', () => {
    const r = queryAlerts(all, q({ tab: 'resolved', range: '7d' }));
    expect(r.total).toBe(1);
    expect(r.tabCounts).toEqual({ all: 5, unacknowledged: 2, 'in-progress': 1, resolved: 1, done: 1 });
  });

  test('khoảng thời gian + tìm kiếm + facet lấy từ toàn bộ dữ liệu', () => {
    const r = queryAlerts(all, q({ q: 'p-101' }));
    expect(r.rows.map((a) => a.id)).toEqual(['A2']);
    expect(r.facets).toEqual({ areas: ['Cụm bơm', 'Khu bồn LPG'], devices: ['P-101', 'V-101'] });
  });
});

describe('GET /alerts/summary – KPI + ưu tiên', () => {
  test('số đếm chỉ trong khoảng thời gian; Đã xử lý chỉ vào tổng', () => {
    expect(alertCounts(all, 'today')).toEqual({ total: 4, critical: 1, unacknowledged: 1, inProgress: 1, done: 1 });
    expect(alertCounts(all, '7d')).toMatchObject({ total: 5, critical: 2, unacknowledged: 2 });
  });

  test('ưu tiên = còn phải xử lý + Nghiêm trọng/Cao, mới nhất trước', () => {
    expect(priorityAlerts(all).map((a) => a.id)).toEqual(['A2', 'A1', 'OLD']);
  });
});
