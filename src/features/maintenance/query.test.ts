import { describe, expect, test } from 'vitest';
import type { MaintenanceRecord } from './types';
import { maintenanceCounts, priorityMaintenance, queryMaintenance, upcomingPeriodic, type MaintenanceListQuery } from './query';

const rec = (id: string, patch: Partial<MaintenanceRecord> = {}): MaintenanceRecord => ({
  id,
  code: id,
  title: 'Kiểm tra van',
  device: 'V-101',
  area: 'Khu bồn LPG',
  type: 'inspection',
  priority: 'medium',
  status: 'pending',
  assignee: null,
  createdAt: '2026-10-20',
  dueAt: '2026-10-30T16:00',
  completedAt: null,
  progress: 0,
  ...patch,
});

// 11:45 ngày 26/10/2026 giờ nhà máy.
const NOW = new Date('2026-10-26T04:45:00Z');

const q = (patch: Partial<MaintenanceListQuery> = {}): MaintenanceListQuery => ({
  tab: 'all',
  q: '',
  area: null,
  priority: null,
  type: null,
  range: 'all',
  sort: 'created',
  page: 1,
  pageSize: 2,
  ...patch,
});

const all = [
  rec('MT-1', { createdAt: '2026-10-21', status: 'pending', priority: 'critical', dueAt: '2026-10-25T16:00' }), // quá hạn
  rec('MT-2', { createdAt: '2026-10-22', status: 'in-progress', priority: 'high', dueAt: '2026-10-27T08:00', area: 'Cụm bơm' }),
  rec('MT-3', { createdAt: '2026-10-23', status: 'done', completedAt: '2026-10-24' }),
  rec('MT-4', { createdAt: '2026-10-24', status: 'cancelled', dueAt: '2026-10-01T08:00' }), // đã hủy – không quá hạn
  rec('MT-5', { createdAt: '2026-09-15', status: 'review', type: 'periodic', dueAt: '2026-10-28T09:00' }),
  rec('MT-6', { createdAt: '2026-10-25', status: 'assigned', type: 'periodic', dueAt: '2026-10-26T10:00' }), // quá giờ hôm nay
];

describe('GET /maintenance – lọc, phân trang, đếm tab', () => {
  test('mới tạo trước, cắt đúng trang, kẹp trang vượt', () => {
    expect(queryMaintenance(all, q(), NOW).rows.map((r) => r.id)).toEqual(['MT-6', 'MT-4']);
    const last = queryMaintenance(all, q({ page: 9 }), NOW);
    expect(last.page).toBe(3);
    expect(last.rows.map((r) => r.id)).toEqual(['MT-1', 'MT-5']);
  });

  test('đếm tab theo bộ lọc còn lại; Đã hủy chỉ vào "Tất cả"; quá hạn = còn mở + qua giờ hạn', () => {
    const r = queryMaintenance(all, q({ tab: 'overdue' }), NOW);
    expect(r.rows.map((x) => x.id)).toEqual(['MT-6', 'MT-1']);
    expect(r.tabCounts).toEqual({ all: 6, pending: 1, assigned: 1, 'in-progress': 1, review: 1, done: 1, overdue: 2 });
  });

  test('sắp xếp theo hạn, tìm kiếm, khoảng thời gian, facet khu vực', () => {
    expect(queryMaintenance(all, q({ sort: 'due', pageSize: 3 }), NOW).rows.map((r) => r.id)).toEqual(['MT-4', 'MT-1', 'MT-6']);
    expect(queryMaintenance(all, q({ q: 'cụm' }), NOW).rows.map((r) => r.id)).toEqual(['MT-2']);
    expect(queryMaintenance(all, q({ range: '7d', pageSize: 10 }), NOW).total).toBe(5);
    expect(queryMaintenance(all, q(), NOW).facets.areas).toEqual(['Cụm bơm', 'Khu bồn LPG']);
  });
});

describe('GET /maintenance/summary – KPI, ưu tiên, lịch', () => {
  test('số đếm KPI bỏ yêu cầu đã hủy; tạo / hoàn thành theo tháng giờ nhà máy', () => {
    expect(maintenanceCounts(all, NOW)).toEqual({
      createdThisMonth: 4,
      createdLastMonth: 1,
      pending: 1,
      inProgress: 1,
      review: 1,
      doneThisMonth: 1,
      overdue: 2,
    });
  });

  test('ưu tiên = còn mở + Nghiêm trọng/Cao, hạn gần trước; lịch = định kỳ chưa tới giờ hạn', () => {
    expect(priorityMaintenance(all, NOW).map((r) => r.id)).toEqual(['MT-1', 'MT-2']);
    expect(upcomingPeriodic(all, NOW).map((r) => r.id)).toEqual(['MT-5']);
  });
});
