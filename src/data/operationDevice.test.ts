import { describe, expect, test } from 'vitest';
import type { AlertRecord } from '@/mocks/alerts';
import type { MaintenanceSummary } from './assetDetail';
import type { MaintenanceRecord } from './maintenance';
import { deriveDeviceAlerts, deriveDeviceMaintenance, deviceHistory, deviceLiveTags, fetchOperationDevice, plcLatencyHistory, resolveOperationDeviceId, trendPoints } from './operationDevice';

const NOW = new Date('2026-10-31T09:00:00Z');
const alert = (o: Partial<AlertRecord>): AlertRecord =>
  ({ id: 'A', code: 'A', message: 'm', device: 'E-101A', area: 'Trạm hóa hơi', daysAgo: 0, time: '10:00:00', severity: 'high', status: 'unacknowledged', value: '1', threshold: '2', unit: '°C', assignee: null, ...o }) as AlertRecord;

describe('resolveOperationDeviceId / fetch', () => {
  test('không phân biệt hoa thường, mã lạ → null', async () => {
    expect(resolveOperationDeviceId(' e-101a ')).toBe('E-101A');
    expect(resolveOperationDeviceId('XYZ')).toBeNull();
    expect(resolveOperationDeviceId('')).toBeNull();
    await expect(fetchOperationDevice('XYZ')).rejects.toThrow('E-101A');
  });
});

describe('deriveDeviceAlerts', () => {
  const list = [
    alert({ id: '1', daysAgo: 1, time: '09:00:00', status: 'done' }),
    alert({ id: '2', time: '08:00:00', severity: 'critical' }),
    alert({ id: '3', time: '11:00:00', severity: 'critical', status: 'resolved' }),
    alert({ id: '4', device: 'V-101' }),
    alert({ id: '5', device: 'PT-202', time: '07:00:00' }),
  ];
  test('lọc theo thiết bị/tag, mới nhất trước, tổng + nghiêm trọng còn mở', () => {
    const r = deriveDeviceAlerts(list, ['E-101A', 'PT-202'], NOW, 3);
    expect(r.total).toBe(4);
    expect(r.criticalOpen).toBe(1);
    expect(r.items.map((i) => i.id)).toEqual(['3', '2', '5']);
    expect(r.items[0]).toMatchObject({ tone: 'success', statusLabel: 'Đã xử lý', time: '11:00' });
    expect(r.items[1]).toMatchObject({ tone: 'danger', statusLabel: 'Chưa xác nhận' });
  });
  test('đã đóng → "Hoàn thành"; không có cảnh báo → rỗng', () => {
    expect(deriveDeviceAlerts([list[0]!], ['E-101A'], NOW).items[0]).toMatchObject({ statusLabel: 'Hoàn thành', time: 'Hôm qua' });
    expect(deriveDeviceAlerts([], ['E-101A'], NOW)).toEqual({ items: [], total: 0, criticalOpen: 0 });
  });
  test('thêm cảnh báo theo LOẠI (hệ PLC/SCADA: mất tín hiệu cảm biến)', () => {
    const lost = { ...list[0]!, id: 'X', device: 'PT-102', kind: 'sensor-signal-lost' as const };
    expect(deriveDeviceAlerts([...list, lost], ['PLC-SCADA'], NOW, 3, ['sensor-signal-lost']).items.map((a) => a.id)).toEqual(['X']);
    expect(deriveDeviceAlerts([lost], ['PLC-SCADA'], NOW).total).toBe(0);
  });
});

describe('deriveDeviceMaintenance', () => {
  const rec = (o: Partial<MaintenanceRecord>) => ({ assignee: 'Lê Thị C', completedAt: undefined, ...o }) as MaintenanceRecord;
  const next = (o: Partial<NonNullable<MaintenanceSummary['next']>>): NonNullable<MaintenanceSummary['next']> => ({
    record: rec({}),
    date: '',
    dueText: 'Quá hạn 2 ngày',
    overdue: false,
    daysLeft: 12,
    ...o,
  });
  test('đúng hạn / hôm nay / quá hạn', () => {
    expect(deriveDeviceMaintenance({ next: next({}) })).toMatchObject({ badge: { label: 'Đúng hạn' }, next: { text: '12 ngày' }, technician: 'Lê Thị C', lastDate: 'Chưa có' });
    expect(deriveDeviceMaintenance({ next: next({ daysLeft: 0 }) }).next).toEqual({ text: 'Hôm nay', tone: 'warning' });
    expect(deriveDeviceMaintenance({ next: next({ overdue: true, daysLeft: -2 }) })).toMatchObject({
      badge: { label: 'Quá hạn', tone: 'danger' },
      next: { text: 'Quá hạn 2 ngày', tone: 'danger' },
    });
  });
  test('chưa lên lịch; lần cuối lấy ngày hoàn thành', () => {
    const v = deriveDeviceMaintenance({ last: { record: rec({ assignee: 'Nguyễn Văn A', completedAt: '2026-09-12T10:00' }), date: '' } });
    expect(v).toMatchObject({ badge: { label: 'Chưa lên lịch' }, next: { text: 'Chưa lên lịch' }, technician: 'Nguyễn Văn A', lastDate: '12/09/2026' });
    expect(deriveDeviceMaintenance({}).technician).toBe('Chưa phân công');
  });
});

describe('PLC-SCADA', () => {
  test('mã viết thường → PLC-SCADA; tag trực tiếp gồm chẩn đoán + 21 tag giám sát; lịch sử độ trễ 61 điểm', async () => {
    expect(resolveOperationDeviceId('plc-scada')).toBe('PLC-SCADA');
    const d = await fetchOperationDevice('PLC-SCADA');
    if (d.kind !== 'plc-scada') throw new Error('PLC-SCADA phải là hệ PLC/SCADA');
    const tags = deviceLiveTags(d);
    expect(tags).toContain(d.tags.heartbeat);
    for (const t of d.monitoredTags) expect(tags).toContain(t);
    expect(new Set(tags).size).toBe(tags.length);
    const h = plcLatencyHistory(d, NOW.getTime());
    expect(h).toHaveLength(61);
    expect(Math.min(...h)).toBeGreaterThan(0.8);
    expect(Math.max(...h)).toBeLessThan(1.6);
  });
});

describe('xu hướng', () => {
  test('lịch sử đủ điểm cho 2 tag của biểu đồ', async () => {
    const d = await fetchOperationDevice('E-101A');
    if (d.kind !== 'vaporizer') throw new Error('E-101A phải là máy hóa hơi');
    const h = deviceHistory(d, NOW.getTime());
    expect(Object.keys(h).sort()).toEqual(['PT-202', 'TT-201']);
    expect(h['TT-201']).toHaveLength(61);
  });
  test('điểm cuối = số trực tiếp; mất tín hiệu → null (không lùi số cũ)', () => {
    const pts = trendPoints(2, [
      { key: 't', history: [1, 2, 3], current: 9 },
      { key: 'p', history: [4, 5, 6], current: undefined },
    ]);
    expect(pts).toEqual([
      { label: '-2m', t: 1, p: 4 },
      { label: '-1m', t: 2, p: 5 },
      { label: 'Bây giờ', t: 9, p: null },
    ]);
  });
});
