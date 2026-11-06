import { describe, expect, test } from 'vitest';
import type { AlertRecord } from '@/features/alerts/types';
import type { StaffMember } from '@/features/staff/org';
import { alertAssignWarnings, alertLoadLabel, alertLoadOf, computeAlertLoads, rankAlertStaff } from './assignStaff';

const alert = (id: string, patch: Partial<AlertRecord> = {}): AlertRecord => ({
  id,
  code: id,
  daysAgo: 0,
  time: '10:00:00',
  severity: 'medium',
  message: 'x',
  device: 'V-101',
  area: 'Khu bồn LPG',
  value: '1',
  threshold: '1',
  unit: 'bar',
  status: 'unacknowledged',
  assignee: null,
  ...patch,
});
const person = (name: string, patch: Partial<StaffMember> = {}): StaffMember => ({
  id: name,
  name,
  title: 'KTV',
  department: 'Bảo trì Cơ khí',
  specialty: 'x',
  defaultShift: 'shift-1',
  role: 'technician',
  areas: [],
  skills: [],
  ...patch,
});
/** Giờ nhà máy (UTC+7). */
const at = (hhmm: string) => new Date(`2026-10-27T${hhmm}:00+07:00`);

describe('tải việc TÍNH TỪ danh sách cảnh báo', () => {
  test('đếm đã giao chưa xác nhận + đang xử lý của người chính; bỏ đã hoàn thành, người phối hợp, chưa giao', () => {
    const loads = computeAlertLoads([
      alert('1', { assignee: 'A' }),
      alert('2', { assignee: 'A', status: 'in-progress', severity: 'critical' }),
      alert('3', { assignee: 'A', status: 'done', severity: 'critical' }),
      alert('4', { assignee: 'B', collaborators: ['A'] }),
      alert('5'),
    ]);
    expect(alertLoadOf(loads, 'A')).toMatchObject({ active: 2, critical: 1, busy: false, criticalAlerts: [{ id: '2', code: '2' }] });
    expect(alertLoadOf(loads, 'B').active).toBe(1);
    expect(alertLoadOf(loads, 'C')).toMatchObject({ active: 0, busy: false });
    expect(alertLoadOf(loads, null).active).toBe(0);
    expect(alertLoadLabel(alertLoadOf(loads, 'A'))).toBe('2 cảnh báo đang xử lý (1 nghiêm trọng)');
    expect(alertLoadLabel(alertLoadOf(loads, 'B'))).toBe('1 cảnh báo đang xử lý');
  });

  test('Bận từ 3 cảnh báo (ranh giới 2 / 3)', () => {
    const two = computeAlertLoads([alert('1', { assignee: 'A' }), alert('2', { assignee: 'A' })]);
    expect(alertLoadOf(two, 'A').busy).toBe(false);
    const three = computeAlertLoads([alert('1', { assignee: 'A' }), alert('2', { assignee: 'A' }), alert('3', { assignee: 'A', status: 'in-progress' })]);
    expect(alertLoadOf(three, 'A').busy).toBe(true);
  });

  test('danh sách rỗng', () => {
    expect(computeAlertLoads([]).size).toBe(0);
  });
});

describe('trạng thái theo ca + sắp xếp gợi ý', () => {
  const staff = [
    person('Đỗ Ngoài ca', { defaultShift: 'shift-2', areas: ['Khu bồn LPG'] }),
    person('Bùi Bận'),
    person('An Sẵn sàng'),
    person('Cao Đúng nghề', { skills: ['pressure'] }),
  ];
  const loads = computeAlertLoads(['1', '2', '3'].map((id) => alert(id, { assignee: 'Bùi Bận' })));

  test('Ngoài ca thắng Bận; theo giờ nhà máy được truyền vào', () => {
    const busyOff = rankAlertStaff([person('Bùi Bận', { defaultShift: 'shift-2' })], { areas: [], skills: [] }, loads, at('10:45'));
    expect(busyOff[0]).toMatchObject({ availability: 'off-shift', onShift: false });
    expect(busyOff[0]!.load.active).toBe(3);
    expect(rankAlertStaff([person('Bùi Bận', { defaultShift: 'shift-2' })], { areas: [], skills: [] }, loads, at('14:00'))[0]!.availability).toBe('busy');
  });

  test('cùng khu / đúng chuyên môn lên trước, rồi Sẵn sàng → Bận → Ngoài ca, rồi theo tên', () => {
    const r = rankAlertStaff(staff, { areas: ['Khu bồn LPG'], skills: ['pressure'] }, loads, at('10:45'));
    expect(r.map((o) => [o.staff.name, o.availability, o.match.join('+')])).toEqual([
      ['Cao Đúng nghề', 'available', 'skill'],
      ['Đỗ Ngoài ca', 'off-shift', 'area'],
      ['An Sẵn sàng', 'available', ''],
      ['Bùi Bận', 'busy', ''],
    ]);
  });

  test('không có tiêu chí gợi ý → chỉ theo trạng thái rồi tên', () => {
    const r = rankAlertStaff(staff, { areas: [], skills: [] }, loads, at('10:45'));
    expect(r.map((o) => o.staff.name)).toEqual(['An Sẵn sàng', 'Cao Đúng nghề', 'Bùi Bận', 'Đỗ Ngoài ca']);
  });
});

describe('cảnh báo không chặn', () => {
  const loads = computeAlertLoads([
    alert('X1', { assignee: 'A', severity: 'critical' }),
    alert('X2', { assignee: 'A', severity: 'critical' }),
    alert('X3', { assignee: 'A' }),
  ]);

  test('chọn người Ngoài ca → có cảnh báo (vẫn chọn được), kèm Bận + nghiêm trọng khác (bỏ cảnh báo đang phân công)', () => {
    const w = alertAssignWarnings({ assignee: 'A' }, { staff: person('A', { defaultShift: 'shift-3' }), loads, now: at('10:45'), alertIds: ['X1'] });
    expect(w.map((x) => x.id)).toEqual(['off-shift', 'busy', 'critical-other']);
    expect(w[0]!.label).toBe('A đang Ngoài ca (Ca 3, 22:00 - 06:00) – có thể chưa xử lý ngay được');
    expect(w[2]!.label).toBe('A đang phụ trách cảnh báo nghiêm trọng khác: X2');
  });

  test('trong ca, không tải → không cảnh báo; chưa chọn ai → không cảnh báo', () => {
    expect(alertAssignWarnings({ assignee: 'B' }, { staff: person('B'), loads, now: at('10:45'), alertIds: [] })).toEqual([]);
    expect(alertAssignWarnings({ assignee: null }, { staff: undefined, loads, now: at('10:45'), alertIds: [] })).toEqual([]);
  });

  test('tên không có trong danh mục → không xét ca', () => {
    expect(alertAssignWarnings({ assignee: 'Lạ' }, { staff: undefined, loads, now: at('03:00'), alertIds: [] })).toEqual([]);
  });
});
