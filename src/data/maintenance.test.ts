import { describe, expect, test } from 'vitest';
import type { MaintenanceRecord } from '@/mocks/maintenance';
import { daysUntilDue, deriveMaintenanceKpis, dueLabel, isOverdue, matchMaintenance } from './maintenance';

/** Bản ghi tối thiểu cho test; ngày dạng giờ địa phương nhà máy. */
const rec = (patch: Partial<MaintenanceRecord>): MaintenanceRecord =>
  ({
    id: 'r1',
    code: 'MT-1',
    title: 'Kiểm tra van',
    device: 'XV-101',
    area: 'Khu bồn',
    type: 'periodic',
    priority: 'high',
    status: 'pending',
    assignee: null,
    progress: 0,
    createdAt: '2026-10-15',
    dueAt: '2026-10-20T17:00',
    completedAt: null,
    ...patch,
  }) as MaintenanceRecord;

// 10:00 sáng 21/10 giờ nhà máy.
const NOW = new Date('2026-10-21T03:00:00Z');

describe('isOverdue – quá hạn bảo trì (now truyền vào)', () => {
  test('hạn trước hôm nay + chưa hoàn thành → quá hạn', () => {
    expect(isOverdue(rec({ dueAt: '2026-10-20T17:00' }), NOW)).toBe(true);
    expect(dueLabel(rec({ dueAt: '2026-10-19T08:00' }), NOW)).toBe('Quá hạn 2 ngày');
  });
  test('đã hoàn thành → không quá hạn', () => {
    expect(isOverdue(rec({ status: 'done', dueAt: '2026-10-01T08:00' }), NOW)).toBe(false);
  });
  test('hạn = hôm nay → chưa quá hạn (kể cả đã qua giờ hạn), nhãn "Hết hạn hôm nay"', () => {
    const r = rec({ dueAt: '2026-10-21T08:00' });
    expect(isOverdue(r, NOW)).toBe(false);
    expect(dueLabel(r, NOW)).toBe('Hết hạn hôm nay');
    expect(dueLabel(rec({ dueAt: '2026-10-22T08:00' }), NOW)).toBe('Hết hạn ngày mai');
    expect(dueLabel(rec({ dueAt: '2026-10-26T08:00' }), NOW)).toBe('Còn 5 ngày');
  });
  test('ranh giới múi giờ: nửa đêm Asia/Bangkok (17:00 UTC), không theo múi giờ máy', () => {
    const r = rec({ dueAt: '2026-10-20T17:00' });
    expect(isOverdue(r, new Date('2026-10-20T16:59:59Z'))).toBe(false); // 23:59:59 ngày 20 ICT
    expect(isOverdue(r, new Date('2026-10-20T17:00:00Z'))).toBe(true); // 00:00 ngày 21 ICT
    expect(daysUntilDue(r, new Date('2026-10-20T17:00:00Z'))).toBe(-1);
  });
});

describe('matchMaintenance – tab Quá hạn + khoảng ngày', () => {
  const base = { tab: 'all', q: '', area: null, priority: null, type: null, range: 'all', sort: 'created' } as const;
  test('tab overdue dùng cùng now', () => {
    expect(matchMaintenance(rec({}), { ...base, tab: 'overdue' }, NOW)).toBe(true);
    expect(matchMaintenance(rec({ dueAt: '2026-10-25T08:00' }), { ...base, tab: 'overdue' }, NOW)).toBe(false);
  });
  test('range today/7d theo ngày tạo (giờ nhà máy)', () => {
    expect(matchMaintenance(rec({ createdAt: '2026-10-21' }), { ...base, range: 'today' }, NOW)).toBe(true);
    expect(matchMaintenance(rec({ createdAt: '2026-10-20' }), { ...base, range: 'today' }, NOW)).toBe(false);
    expect(matchMaintenance(rec({ createdAt: '2026-10-15' }), { ...base, range: '7d' }, NOW)).toBe(true);
    expect(matchMaintenance(rec({ createdAt: '2026-10-14' }), { ...base, range: '7d' }, NOW)).toBe(false);
  });
});

describe('deriveMaintenanceKpis – tháng theo giờ nhà máy', () => {
  test('00:30 ngày 1/11 ICT: yêu cầu tạo 1/11 thuộc "tháng này", quá hạn đếm đúng', () => {
    const now = new Date('2026-10-31T17:30:00Z');
    const rows = [rec({ id: 'a', createdAt: '2026-11-01' }), rec({ id: 'b', createdAt: '2026-10-20' }), rec({ id: 'c', createdAt: '2026-10-21', status: 'done', completedAt: '2026-10-25' })];
    const kpi = Object.fromEntries(deriveMaintenanceKpis(rows, now).map((k) => [k.id, k.value]));
    expect(kpi.total).toBe('1');
    expect(kpi.overdue).toBe('02'); // a, b hạn 20/10, chưa xong
    expect(kpi.done).toBe('00'); // hoàn thành 25/10 = tháng trước
  });
});
