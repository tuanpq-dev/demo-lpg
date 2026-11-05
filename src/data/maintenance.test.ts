import { describe, expect, test } from 'vitest';
import type { MaintenanceRecord } from '@/mocks/maintenance';
import { maintenanceRecords } from '@/mocks/maintenance';
import type { AlertRecord } from '@/mocks/alerts';
import { daysUntilDue, deriveMaintenanceKpis, createMaintenance, deriveDeviceDirectory, derivePriorityTasks, deriveSchedule, dueLabel, isOverdue, matchMaintenance, scheduleLabel } from './maintenance';

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
  // ĐỔI 26/10/2026 (quy tắc quá hạn theo GIỜ, người dùng duyệt): trước đây "hạn = hôm nay → chưa quá hạn kể cả đã qua giờ".
  test('hạn hôm nay chưa tới giờ → "Hết hạn hôm nay"; đã qua giờ → quá hạn "Quá hạn từ 08:00"', () => {
    expect(isOverdue(rec({ dueAt: '2026-10-21T16:00' }), NOW)).toBe(false);
    expect(dueLabel(rec({ dueAt: '2026-10-21T16:00' }), NOW)).toBe('Hết hạn hôm nay');
    expect(isOverdue(rec({ dueAt: '2026-10-21T08:00' }), NOW)).toBe(true);
    expect(dueLabel(rec({ dueAt: '2026-10-21T08:00' }), NOW)).toBe('Quá hạn từ 08:00');
    expect(dueLabel(rec({ dueAt: '2026-10-22T08:00' }), NOW)).toBe('Hết hạn ngày mai');
    expect(dueLabel(rec({ dueAt: '2026-10-26T08:00' }), NOW)).toBe('Còn 5 ngày');
  });
  // ĐỔI 26/10/2026: trước đây kiểm tra mốc NỬA ĐÊM (quá hạn theo ngày); nay mốc là GIỜ hạn (17:00 ICT = 10:00Z).
  test('ranh giới múi giờ: giờ hạn hiểu theo Asia/Bangkok, không theo múi giờ máy', () => {
    const r = rec({ dueAt: '2026-10-20T17:00' });
    expect(isOverdue(r, new Date('2026-10-20T09:59:59Z'))).toBe(false); // 16:59:59 ICT
    expect(isOverdue(r, new Date('2026-10-20T10:00:00Z'))).toBe(true); // 17:00 ICT
    expect(daysUntilDue(r, new Date('2026-10-20T17:00:00Z'))).toBe(-1);
  });
});

describe('quy tắc quá hạn theo giờ (hạn 16:00 ngày 21/10 ICT = 09:00Z)', () => {
  const r = rec({ dueAt: '2026-10-21T16:00' });
  test('trước 16:00 → chưa quá hạn', () => {
    expect(isOverdue(r, new Date('2026-10-21T08:59:59Z'))).toBe(false);
  });
  test('đúng 16:00 và sau đó → quá hạn', () => {
    expect(isOverdue(r, new Date('2026-10-21T09:00:00Z'))).toBe(true);
    expect(isOverdue(r, new Date('2026-10-21T12:00:00Z'))).toBe(true);
    expect(dueLabel(r, new Date('2026-10-21T09:00:00Z'))).toBe('Quá hạn từ 16:00');
  });
  test('qua nửa đêm: hôm sau ghi "Quá hạn 1 ngày"; hạn 00:30 ngày 22 lúc 23:50 ngày 21 chưa quá hạn', () => {
    expect(dueLabel(r, new Date('2026-10-21T17:00:00Z'))).toBe('Quá hạn 1 ngày');
    const night = rec({ dueAt: '2026-10-22T00:30' });
    expect(isOverdue(night, new Date('2026-10-21T16:50:00Z'))).toBe(false);
    expect(dueLabel(night, new Date('2026-10-21T16:50:00Z'))).toBe('Hết hạn ngày mai');
    expect(isOverdue(night, new Date('2026-10-21T17:30:00Z'))).toBe(true);
  });
  test('hạn chỉ có ngày (dueHasTime=false, lưu T23:59) → quá hạn tại 23:59:59, nhãn "Cuối ngày"', () => {
    const d = rec({ dueAt: '2026-10-21T23:59', dueHasTime: false, type: 'periodic' });
    expect(isOverdue(d, new Date('2026-10-21T16:59:00Z'))).toBe(false); // 23:59:00 ICT
    expect(isOverdue(d, new Date('2026-10-21T16:59:58Z'))).toBe(false); // 23:59:58 ICT
    expect(isOverdue(d, new Date('2026-10-21T16:59:59Z'))).toBe(true); // 23:59:59 ICT
    expect(dueLabel(d, new Date('2026-10-21T16:59:59Z'))).toBe('Quá hạn hôm nay');
    expect(scheduleLabel(d, NOW)).toBe('Hôm nay, Cuối ngày');
  });
  test('hạn THẬT 23:59 (có giờ) → quá hạn từ 23:59:00, hiện "23:59" – không nhầm với hạn chỉ có ngày', () => {
    const t = rec({ dueAt: '2026-10-21T23:59', type: 'periodic' });
    expect(isOverdue(t, new Date('2026-10-21T16:58:59Z'))).toBe(false);
    expect(isOverdue(t, new Date('2026-10-21T16:59:00Z'))).toBe(true);
    expect(dueLabel(t, new Date('2026-10-21T16:59:00Z'))).toBe('Quá hạn từ 23:59');
    expect(scheduleLabel(t, NOW)).toBe('Hôm nay, 23:59');
  });
  test('đã xong / đã hủy không bao giờ quá hạn', () => {
    const late = new Date('2026-10-25T00:00:00Z');
    expect(isOverdue({ ...r, status: 'done' }, late)).toBe(false);
    expect(isOverdue({ ...r, status: 'cancelled' }, late)).toBe(false);
  });
  test('KPI, thẻ ưu tiên, lịch dùng cùng quy tắc', () => {
    const rows = [rec({ id: 'p', type: 'periodic', priority: 'high', dueAt: '2026-10-21T16:00', createdAt: '2026-10-21' })];
    const before = new Date('2026-10-21T08:00:00Z'); // 15:00 ICT
    const after = new Date('2026-10-21T09:30:00Z'); // 16:30 ICT
    const overdueKpi = (now: Date) => deriveMaintenanceKpis(rows, now).find((k) => k.id === 'overdue')!.value;
    expect(overdueKpi(before)).toBe('00');
    expect(overdueKpi(after)).toBe('01');
    expect(derivePriorityTasks(rows, before)[0]).toMatchObject({ overdue: false, dueLabel: 'Hết hạn hôm nay' });
    expect(derivePriorityTasks(rows, after)[0]).toMatchObject({ overdue: true, dueLabel: 'Quá hạn từ 16:00' });
    expect(deriveSchedule(rows, before)).toHaveLength(1);
    expect(deriveSchedule(rows, after)).toHaveLength(0);
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

describe('Đã hủy (cancelled – chỉ FE)', () => {
  const base = { tab: 'all', q: '', area: null, priority: null, type: null, range: 'all', sort: 'created' } as const;
  const cancelled = rec({ status: 'cancelled', cancelledFrom: 'pending', dueAt: '2026-10-01T08:00', createdAt: '2026-10-20', type: 'periodic' });
  test('không quá hạn dù hạn đã qua', () => {
    expect(isOverdue(cancelled, NOW)).toBe(false);
  });
  test('chỉ hiện ở tab "Tất cả"', () => {
    expect(matchMaintenance(cancelled, base, NOW)).toBe(true);
    for (const tab of ['pending', 'assigned', 'in-progress', 'review', 'done', 'overdue'] as const) {
      expect(matchMaintenance(cancelled, { ...base, tab }, NOW)).toBe(false);
    }
  });
  test('không tính vào KPI nào, không vào việc ưu tiên / lịch', () => {
    const rows = [cancelled, { ...cancelled, id: 'x2', status: 'cancelled' as const, dueAt: '2026-10-25T08:00' }];
    const kpi = Object.fromEntries(deriveMaintenanceKpis(rows, NOW).map((k) => [k.id, k.value]));
    expect(kpi).toMatchObject({ total: '0', pending: '00', 'in-progress': '00', review: '00', overdue: '00', done: '00' });
    expect(derivePriorityTasks(rows, NOW)).toEqual([]);
    expect(deriveSchedule(rows, NOW)).toEqual([]);
  });
});

describe('mock MT-00128 theo ảnh chi tiết', () => {
  const r = maintenanceRecords.find((m) => m.id === 'MT-00128')!;
  test('chờ tiếp nhận, chưa phân công, hạn 16:00, Khu bồn LPG, từ ALT-00128', () => {
    expect(r).toMatchObject({ status: 'pending', assignee: null, area: 'Khu bồn LPG', title: 'Kiểm tra van an toàn V-101', sourceAlertId: 'ALT-00128' });
    expect(r.dueAt.slice(11)).toBe('16:00');
    expect(r.dueAt.slice(0, 10)).toBe(r.createdAt);
  });
  test('7 mục checklist (2 xong, 1 N/A) → tiến độ bản ghi 33%; 3 tệp, 1 ghi chú, 3 dòng lịch sử', () => {
    expect(r.checklist).toHaveLength(7);
    expect(r.progress).toBe(33);
    expect(r.attachments).toHaveLength(3);
    expect(r.notes).toHaveLength(1);
    expect(r.history!.map((h) => h.kind)).toEqual(['create', 'notify', 'priority']);
  });
});

describe('danh bạ thiết bị → khu vực', () => {
  const m = (device: string, area: string) => ({ device, area }) as MaintenanceRecord;
  const a = (device: string, area: string) => ({ device, area }) as AlertRecord;

  test('gộp cảnh báo + bảo trì, mỗi thiết bị một dòng, sắp theo mã', () => {
    expect(deriveDeviceDirectory([m('V-101', 'Khu bồn LPG'), m('E-101A', 'Trạm hóa hơi')], [a('GS-03', 'Khu nạp xuất')])).toEqual([
      { device: 'E-101A', area: 'Trạm hóa hơi' },
      { device: 'GS-03', area: 'Khu nạp xuất' },
      { device: 'V-101', area: 'Khu bồn LPG' },
    ]);
  });

  test('trùng thiết bị: khu vực của bảo trì thắng cảnh báo', () => {
    expect(deriveDeviceDirectory([m('V-101', 'Khu bồn LPG')], [a('V-101', 'Khác')])).toEqual([{ device: 'V-101', area: 'Khu bồn LPG' }]);
  });

  test('rỗng → rỗng; không truyền cảnh báo vẫn chạy', () => {
    expect(deriveDeviceDirectory([], [])).toEqual([]);
    expect(deriveDeviceDirectory([m('P-101A', 'Khu bơm')])).toEqual([{ device: 'P-101A', area: 'Khu bơm' }]);
  });
});

describe('createMaintenance – khu vực', () => {
  const base = { title: 'Kiểm tra', device: 'THIET-BI-LA', type: 'inspection', priority: 'medium', startAt: '2026-10-26T08:00', dueAt: '2099-10-26T16:00', assignee: null } as const;

  test('dùng khu vực form truyền vào (không tra bảng toàn cục)', async () => {
    const r = await createMaintenance({ ...base, area: 'Khu bơm' });
    expect(r.area).toBe('Khu bơm');
  });

  test('khu vực rỗng → "Khác"', async () => {
    const r = await createMaintenance({ ...base, area: '' });
    expect(r.area).toBe('Khác');
  });
});
