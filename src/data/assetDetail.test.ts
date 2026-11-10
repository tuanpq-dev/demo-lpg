import { describe, expect, it } from 'vitest';
import type { LiveData, TagValue } from '@/features/live/types';
import type { AlertRecord } from '@/features/alerts/types';
import { DEFAULT_ASSET_ID, assetPath } from '@/app/assetRoutes';
import { assetMocks, type AssetEvent } from '@/mocks/assets';
import type { MaintenanceRecord } from '@/features/maintenance/types';
import {
  assetName,
  dayTimeLabel,
  deriveAssetLive,
  deriveMaintenanceSummary,
  deriveRelatedAlerts,
  fetchAssetDetail,
  resolveAssetId,
  filterAssetEvents,
  formatLongDate,
  parseHiddenTypes,
  toggleHiddenType,
} from './assetDetail';

const V101 = assetMocks['V-101']!;
const T0 = Date.UTC(2026, 9, 23, 3, 0, 0); // 10:00 giờ nhà máy (UTC+7)
const NOW = new Date(T0);
const tv = (value: number, ts = T0, quality: TagValue['quality'] = 'good'): TagValue => ({ value, ts, quality });
const live = (o: Partial<Record<'level' | 'water' | 'p' | 't', TagValue>>): LiveData => ({
  ...(o.level && { 'LT-101': o.level }),
  ...(o.water && { 'LT-101W': o.water }),
  ...(o.p && { 'PT-101': o.p }),
  ...(o.t && { 'TT-101': o.t }),
});
const all = live({ level: tv(73), water: tv(5.2), p: tv(9.2), t: tv(28.6) });

describe('deriveAssetLive', () => {
  it('đủ tag: ba lớp khớp ảnh, tổng 100 %, trạng thái bình thường', () => {
    const v = deriveAssetLive(V101, all, T0);
    expect(v.layersState).toBe('ok');
    expect([v.layers!.lpg.percent, v.layers!.vapor.percent, v.layers!.water.percent]).toEqual([76.2, 21.8, 2]);
    expect(v.layers!.lpg.percent + v.layers!.vapor.percent + v.layers!.water.percent).toBeCloseTo(100, 10);
    expect(v.pressure).toEqual({ state: 'ok', value: 9.2, status: 'normal' });
    expect(v.waterStatus).toBe('normal');
    expect(v.storageStatus).toBe('normal');
  });

  it('chưa có ảnh chụp đầu → pending, không báo mất tín hiệu', () => {
    const v = deriveAssetLive(V101, undefined, T0);
    expect(v.level.state).toBe('pending');
    expect(v.layers).toBeNull();
    expect(v.storageStatus).toBe('pending');
  });

  it('mất tín hiệu (bad / quá 10 s / thiếu tag) → lost, không giữ số cũ, không tính lớp', () => {
    expect(deriveAssetLive(V101, live({ ...all, level: tv(73, T0, 'bad') } as never), T0).level).toEqual({ state: 'lost', status: 'offline' });
    const stale = deriveAssetLive(V101, all, T0 + 10_000);
    expect(stale.pressure.state).toBe('lost');
    expect(stale.layersState).toBe('lost');
    expect(stale.storageStatus).toBe('offline');
    const noWater = deriveAssetLive(V101, live({ level: tv(73), p: tv(9.2), t: tv(28) }), T0);
    expect(noWater.layers).toBeNull();
    expect(noWater.layersState).toBe('lost');
    expect(noWater.pressure.state).toBe('ok');
  });

  it('ngưỡng cảnh báo áp suất 10.5 / 12 (khác áp suất định mức thiết kế 12.0)', () => {
    expect(deriveAssetLive(V101, live({ p: tv(10.49) }), T0).pressure.status).toBe('normal');
    expect(deriveAssetLive(V101, live({ p: tv(10.5) }), T0).pressure.status).toBe('warning');
    expect(deriveAssetLive(V101, live({ p: tv(12) }), T0).pressure.status).toBe('danger');
    expect(V101.designPressure).toBe(12);
  });

  it('nước đáy vượt ngưỡng → trạng thái tồn chứa theo nước; mức cao → theo mức', () => {
    const wet = deriveAssetLive(V101, live({ level: tv(73), water: tv(12) }), T0);
    expect(wet.waterStatus).toBe('danger');
    expect(wet.storageStatus).toBe('danger');
    const high = deriveAssetLive(V101, live({ level: tv(90), water: tv(5.2) }), T0);
    expect(high.level.status).toBe('warning');
    expect(high.storageStatus).toBe('warning');
  });
});

const ev = (id: string, daysAgo: number, time: string, type: AssetEvent['type'], asset = 'V-101'): AssetEvent => ({
  id,
  asset,
  daysAgo,
  time,
  type,
  title: id,
  status: 'normal',
});
const EVENTS = [
  ev('a', 0, '09:00:00', 'sensor'),
  ev('b', 1, '23:00:00', 'alert'),
  ev('c', 0, '11:00:00', 'system'),
  ev('d', 0, '10:00:00', 'operation'),
  ev('x', 0, '12:00:00', 'sensor', 'V-102'),
];

describe('bộ lọc sự kiện', () => {
  it('theo tài sản, mới nhất trước (ngày rồi giờ), không đổi mảng gốc', () => {
    const before = EVENTS.map((e) => e.id);
    expect(filterAssetEvents(EVENTS, 'V-101').map((e) => e.id)).toEqual(['c', 'd', 'a', 'b']);
    expect(EVENTS.map((e) => e.id)).toEqual(before);
  });
  it('ẩn loại; ẩn hết → rỗng; tài sản lạ → rỗng', () => {
    expect(filterAssetEvents(EVENTS, 'V-101', ['sensor', 'alert']).map((e) => e.id)).toEqual(['c', 'd']);
    expect(filterAssetEvents(EVENTS, 'V-101', ['sensor', 'alert', 'system', 'operation'])).toEqual([]);
    expect(filterAssetEvents(EVENTS, 'V-999')).toEqual([]);
    expect(filterAssetEvents([], 'V-101')).toEqual([]);
  });
  it('parseHiddenTypes bỏ giá trị lạ/trùng, giữ thứ tự chuẩn', () => {
    expect(parseHiddenTypes(null)).toEqual([]);
    expect(parseHiddenTypes('')).toEqual([]);
    expect(parseHiddenTypes('alert,foo,sensor,alert')).toEqual(['sensor', 'alert']);
  });
  it('toggleHiddenType bật/tắt, chạy hai lần về như cũ, hết loại ẩn → null', () => {
    expect(toggleHiddenType(null, 'alert')).toBe('alert');
    expect(toggleHiddenType('alert', 'sensor')).toBe('sensor,alert');
    expect(toggleHiddenType('sensor,alert', 'alert')).toBe('sensor');
    expect(toggleHiddenType(toggleHiddenType(null, 'system'), 'system')).toBeNull();
  });
  it('mock V-101: 5 dòng đầu theo ảnh', async () => {
    const d = await fetchAssetDetail('V-101');
    expect(
      filterAssetEvents(d.events, 'V-101')
        .slice(0, 5)
        .map((e) => e.time),
    ).toEqual(['11:24:05', '11:15:22', '10:55:10', '10:42:00', '09:30:15']);
    expect(d.events.every((e) => e.asset === 'V-101')).toBe(true);
  });
});

describe('fetchAssetDetail', () => {
  it('mã lạ → lỗi liệt kê mã có', async () => {
    await expect(fetchAssetDetail('V-999')).rejects.toThrow(/V-999.*V-101/);
  });
});

const alert = (id: string, device: string, daysAgo: number, time: string, over: Partial<AlertRecord> = {}): AlertRecord => ({
  id,
  code: id,
  device,
  daysAgo,
  time,
  severity: 'high',
  message: id,
  area: 'Khu bồn LPG',
  value: '1',
  threshold: '1',
  unit: 'bar',
  status: 'unacknowledged',
  assignee: null,
  ...over,
});

describe('cảnh báo liên quan', () => {
  it('lọc theo thiết bị liên quan, mới nhất trước, tối đa 3, tone theo mức độ/trạng thái', () => {
    const rows = [
      alert('A1', 'V-101', 0, '10:45:22', { severity: 'critical' }),
      alert('A2', 'PSV-101', 1, '15:28:55', { status: 'done' }),
      alert('A3', 'LT-101', 3, '14:02:50'),
      alert('A4', 'LT-101', 4, '10:00:00'),
      alert('B1', 'V-102', 0, '11:00:00'),
    ];
    const r = deriveRelatedAlerts(rows, V101.relatedDevices, NOW);
    expect(r.map((a) => [a.id, a.tone, a.time])).toEqual([
      ['A1', 'danger', '10:45'],
      ['A2', 'success', 'Hôm qua'],
      ['A3', 'warning', '20/10'],
    ]);
    expect(deriveRelatedAlerts([], V101.relatedDevices, NOW)).toEqual([]);
  });
  it('dayTimeLabel qua ranh giới tháng theo giờ nhà máy', () => {
    const early = new Date(Date.UTC(2026, 10, 1, 18, 0)); // 02/11 01:00 giờ nhà máy (UTC vẫn 01/11)
    expect(dayTimeLabel(1, '08:00:00', early)).toBe('Hôm qua');
    expect(dayTimeLabel(2, '08:00:00', early)).toBe('31/10');
  });
});

const rec = (
  code: string,
  status: MaintenanceRecord['status'],
  dueAt: string,
  completedAt: string | null = null,
  device = 'V-101',
): MaintenanceRecord => ({
  id: code,
  code,
  title: code,
  device,
  area: 'Khu bồn LPG',
  type: 'periodic',
  priority: 'medium',
  status,
  assignee: null,
  createdAt: '2026-01-01',
  dueAt,
  completedAt,
  progress: 0,
});

describe('tóm tắt bảo trì', () => {
  it('tiếp theo = chưa xong có hạn sớm nhất (kể cả quá hạn); gần nhất = hoàn thành mới nhất', () => {
    const rows = [
      rec('M1', 'pending', '2026-10-21T17:00'),
      rec('M2', 'assigned', '2026-11-05T17:00'),
      rec('M3', 'done', '2026-09-01T17:00', '2026-09-02'),
      rec('M4', 'done', '2026-09-10T17:00', '2026-09-08'),
      rec('X1', 'pending', '2026-10-01T17:00', null, 'V-102'),
    ];
    const s = deriveMaintenanceSummary(rows, 'V-101', NOW);
    expect(s.next).toMatchObject({ date: '21 Tháng 10, 2026', overdue: true, dueText: 'Quá hạn 2 ngày', daysLeft: -2 });
    expect(s.next!.record.code).toBe('M1');
    expect(s.last).toMatchObject({ date: '8 Tháng 9, 2026' });
    expect(s.last!.record.code).toBe('M4');
  });
  // ĐỔI 26/10/2026 (quá hạn theo giờ): trước đây hạn 08:00 hôm nay lúc 10:00 vẫn "chưa quá hạn".
  it('hạn hôm nay: chưa tới giờ → chưa quá hạn, đã qua giờ → quá hạn; không có bản ghi → rỗng', () => {
    expect(deriveMaintenanceSummary([rec('M1', 'pending', '2026-10-23T16:00')], 'V-101', NOW).next).toMatchObject({ overdue: false, daysLeft: 0 });
    expect(deriveMaintenanceSummary([rec('M1', 'pending', '2026-10-23T08:00')], 'V-101', NOW).next).toMatchObject({
      overdue: true,
      daysLeft: 0,
      dueText: 'Quá hạn từ 08:00',
    });
    expect(deriveMaintenanceSummary([], 'V-101', NOW)).toEqual({ next: undefined, last: undefined });
  });
  it('formatLongDate', () => {
    expect(formatLongDate('2026-09-15T17:00')).toBe('15 Tháng 9, 2026');
    expect(formatLongDate('2027-01-01')).toBe('1 Tháng 1, 2027');
  });
});

describe('resolveAssetId / assetPath', () => {
  it('khớp không phân biệt hoa thường, bỏ khoảng trắng', () => {
    expect(resolveAssetId('V-101')).toBe('V-101');
    expect(resolveAssetId('v-101')).toBe('V-101');
    expect(resolveAssetId('  v-101 ')).toBe('V-101');
  });
  it('không có / rỗng / null → null', () => {
    expect(resolveAssetId('XYZ')).toBeNull();
    expect(resolveAssetId('V-1010')).toBeNull();
    expect(resolveAssetId('')).toBeNull();
    expect(resolveAssetId(undefined)).toBeNull();
  });
  it('đường dẫn dưới /map, mã mặc định có trang', () => {
    expect(assetPath('V-101')).toBe('/map/V-101');
    expect(assetPath('A/B')).toBe('/map/A%2FB');
    expect(resolveAssetId(DEFAULT_ASSET_ID)).toBe(DEFAULT_ASSET_ID);
  });
});

describe('assetName', () => {
  it('mã đúng kiểu chữ → tên tài sản; mã lạ / sai kiểu chữ → undefined', () => {
    expect(assetName('V-101')).toBe(assetMocks['V-101']!.name);
    expect(assetName('v-101')).toBeUndefined();
    expect(assetName('XYZ')).toBeUndefined();
  });
});
