import { describe, expect, test } from 'vitest';
import type { AlertRecord } from '@/mocks/alerts';
import {
  acknowledgeAlerts,
  assignAlerts,
  completeAlerts,
  countByStatus,
  DEFAULT_FILTERS,
  deriveAlertKpis,
  derivePriorityCards,
  fetchAlerts,
  filterAlerts,
  matchAlert,
  resolveOneAlert,
  shiftOf,
  updateFireAlert,
} from './alerts';
import { alertDateTimeLabel, alertGauge, alertMetric, alertOccurredAt, alertPlaybook, alertRecordedValue, alertShortTimeLabel } from './alertDetail';
import { alertRecords } from '@/mocks/alerts';
import { maintenanceRecords } from '@/mocks/maintenance';
import { HEAT_DETECTORS, nearbySensor, sensorsInArea } from '@/mocks/sensors';
import { areaLabel } from '@/mocks/areas';
import { alertKind } from './alertDetail';

const alert = (id: string, patch: Partial<AlertRecord> = {}): AlertRecord => ({
  id,
  daysAgo: 0,
  time: '10:00:00',
  severity: 'high',
  code: id,
  message: 'Áp suất bồn vượt ngưỡng',
  device: 'V-101',
  area: 'Khu bồn LPG',
  value: '11',
  threshold: '10',
  unit: 'bar',
  status: 'unacknowledged',
  assignee: null,
  ...patch,
});

const rows = [
  alert('A1', { severity: 'critical' }),
  alert('A2', { status: 'in-progress', device: 'P-101A', area: 'Khu bơm', time: '15:30:00' }),
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
    expect(filterAlerts(rows, { ...DEFAULT_FILTERS, q: '  KHU BƠM ' }).map((a) => a.id)).toEqual(['A2']);
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

describe('chi tiết cảnh báo – ngưỡng, ngày, playbook', () => {
  test('có tag + cấu hình (ALT-00128 → PT-101): ngưỡng = warn 10.5, nguy hiểm 12 từ assets.ts', () => {
    expect(alertMetric(alert('x', { tag: 'PT-101', value: '11.8', threshold: '9.9' }))).toMatchObject({
      value: 11.8,
      threshold: 10.5,
      danger: 12,
      direction: 'above',
      fromConfig: true,
    });
  });
  test('không tag / tag không có cấu hình → ngưỡng của bản ghi, không có mức nguy hiểm', () => {
    expect(alertMetric(alert('x', { threshold: '20', unit: '% LEL' }))).toMatchObject({ threshold: 20, danger: undefined, fromConfig: false });
    expect(alertMetric(alert('x', { tag: 'PT-201', threshold: '9.5' }))).toMatchObject({ threshold: 9.5, fromConfig: false });
  });
  test('chiều below lấy từ bản ghi', () => {
    expect(alertMetric(alert('x', { direction: 'below', value: '45', threshold: '50' })).direction).toBe('below');
  });
  test('ngày giờ phát sinh theo giờ nhà máy: hôm nay − daysAgo, qua đầu tháng', () => {
    const now = new Date('2026-10-12T05:00:00Z');
    expect(alertDateTimeLabel({ daysAgo: 0, time: '10:45:22' }, now)).toBe('10:45:22 - 12/10/2026');
    expect(alertDateTimeLabel({ daysAgo: 12, time: '08:00:00' }, now)).toBe('08:00:00 - 30/09/2026');
    // 23:30 UTC = 06:30 hôm sau ở nhà máy
    expect(alertDateTimeLabel({ daysAgo: 0, time: '06:00:00' }, new Date('2026-10-11T23:30:00Z'))).toBe('06:00:00 - 12/10/2026');
  });
  test('playbook theo loại, thay {device}/{safetyValve}; thiếu loại → generic', () => {
    const pb = alertPlaybook({ kind: 'tank-overpressure', device: 'V-101' });
    expect(pb.causes).toEqual(['Van an toàn kẹt', 'Nhiệt độ tăng cao', 'Hệ thống làm mát không kích hoạt']);
    expect(pb.steps.map((x) => x.text)).toContain('Xác minh trạng thái van PSV-101');
    expect(alertPlaybook({ device: 'X-1' }).steps[0]!.text).toBe('Kiểm tra X-1 tại hiện trường');
  });
});

describe('dữ liệu gas (ALT-00127) + cảm biến theo khu', () => {
  test('ALT-00127 = GS-04 · Khu nạp xuất · gas-leak · trước đó 14 · phát sinh ~6 phút trước; MT-00127 không trỏ tới → giữ GS-01', () => {
    const a = alertRecords.find((x) => x.id === 'ALT-00127')!;
    expect(a).toMatchObject({ device: 'GS-04', tag: 'GS-04', area: 'Khu nạp xuất', kind: 'gas-leak', previousValue: '14', unit: '% LEL' });
    const mins = (Date.now() - alertOccurredAt(a, new Date()).getTime()) / 60_000;
    expect(mins).toBeGreaterThanOrEqual(5.9);
    expect(mins).toBeLessThan(8);
    const mt = maintenanceRecords.find((m) => m.code === 'MT-00127')!;
    expect(mt.sourceAlertId).toBeUndefined();
    expect(mt.device).toBe('GS-01');
  });
  test('cảm biến trong khu + cảm biến kề cho chữ hướng dẫn', () => {
    expect(sensorsInArea('Khu nạp xuất').map((s) => s.tag)).toEqual(['GS-01', 'GS-02', 'GS-03', 'GS-04']);
    expect(sensorsInArea('Khu bồn LPG')).toEqual([]);
    expect([nearbySensor('GS-04'), nearbySensor('GS-01'), nearbySensor('X')]).toEqual(['GS-03', 'GS-02', undefined]);
    expect(alertPlaybook({ kind: 'gas-leak', device: 'GS-04', tag: 'GS-04' }).steps[1]!.text).toBe('Đối chiếu với GS-03 và các cảm biến lân cận');
  });
  test('thời điểm phát sinh theo giờ nhà máy', () => {
    expect(alertOccurredAt({ daysAgo: 1, time: '23:50:00' }, new Date('2026-10-27T03:00:00Z')).toISOString()).toBe('2026-10-26T16:50:00.000Z');
  });
});

describe('thanh đo theo cấu hình loại cảnh báo', () => {
  test('loại tốc độ thay đổi (level-drop, gauge: false) → off, kể cả khi số dương', () => {
    expect(alertGauge(alert('x', { kind: 'level-drop', value: '-4.2', threshold: '-3.0', unit: '%/h', direction: 'below' }))).toEqual({ kind: 'off' });
    expect(alertGauge(alert('x', { kind: 'level-drop', value: '5', threshold: '3' })).kind).toBe('off');
  });
  test('loại có thang: dựng thang; vượt mức nguy hiểm × 1.2 → nới × 1.05', () => {
    const g = alertGauge(alert('x', { kind: 'tank-overpressure', tag: 'PT-101', value: '11.8' }));
    expect(g.kind === 'scale' && g.scale.max).toBe(14.4);
    const big = alertGauge(alert('x', { kind: 'tank-overpressure', tag: 'PT-101', value: '20' }));
    expect(big.kind === 'scale' && big.scale.max).toBe(21);
  });
  test('loại có thang nhưng số không hợp lệ → invalid; thiếu loại = generic (có thang)', () => {
    expect(alertGauge(alert('x', { kind: 'gas-leak', value: 'abc' })).kind).toBe('invalid');
    expect(alertGauge(alert('x')).kind).toBe('scale');
  });
});

describe('thẻ đầu modal phân công', () => {
  test('"Lúc cảnh báo": giá trị bản ghi / ngưỡng cấu hình; vượt ngưỡng theo chiều; loại không có số → ẩn', () => {
    expect(alertRecordedValue(alert('x', { kind: 'tank-overpressure', tag: 'PT-101', value: '11.8', threshold: '10.5', unit: 'bar' }))).toEqual({
      value: '11.8 bar',
      threshold: '10.5 bar',
      breached: true,
    });
    expect(alertRecordedValue(alert('x', { kind: 'temperature-low', direction: 'below', value: '45', threshold: '50', unit: '°C' }))).toMatchObject({ value: '45°C', breached: true });
    expect(alertRecordedValue(alert('x', { kind: 'sensor-signal-lost' }))).toBeNull();
    expect(alertRecordedValue(alert('x', { kind: 'pump-standby' }))).toBeNull();
    expect(alertRecordedValue(alert('x', { value: 'abc' }))).toBeNull();
  });
  test('giờ phát hiện: hôm nay / hôm qua / ngày cụ thể (giờ nhà máy)', () => {
    const now = new Date('2026-10-27T03:00:00Z'); // 10:00 giờ nhà máy
    expect(alertShortTimeLabel({ daysAgo: 0, time: '10:45:22' }, now)).toBe('10:45 hôm nay');
    expect(alertShortTimeLabel({ daysAgo: 1, time: '22:41:30' }, now)).toBe('22:41 hôm qua');
    expect(alertShortTimeLabel({ daysAgo: 3, time: '20:16:37' }, now)).toBe('20:16 24/10/2026');
  });
});

describe('thao tác trên store (mock) – cùng quy tắc với drawer', () => {
  const get = async (id: string) => (await fetchAlerts()).find((a) => a.id === id)!;
  // Đổi có chủ đích (modal phân công cảnh báo): nhận form thay tên; kết quả kèm số đổi người + câu thông báo.
  test('phân công hàng loạt KHÔNG tự xác nhận; dòng đã hoàn thành bị bỏ qua', async () => {
    const r = await assignAlerts(['ALT-00126', 'ALT-00124'], { assignee: 'Trần Bình', collaborators: [], note: '', notify: false, reason: '' }, 'Tester');
    expect(r).toEqual({ done: 1, skipped: 1, reassigned: 0, message: 'Đã phân công 1 · bỏ qua 1 (1 đã hoàn thành)' });
    expect(await get('ALT-00126')).toMatchObject({ status: 'unacknowledged', assignee: 'Trần Bình' });
    expect((await get('ALT-00124')).assignee).toBe('Lê Thị C');
  });
  test('phân công hàng loạt: dòng của người khác = đổi người cần MỘT lý do chung; dòng đúng người bỏ qua', async () => {
    const f = { assignee: 'Lê Thị C', collaborators: [], note: '', notify: false, reason: '' };
    // ALT-00122 đang giao Phạm Văn D → đổi người; thiếu lý do → không ghi gì.
    expect(await assignAlerts(['ALT-00122', 'ALT-00119'], f, 'Tester')).toMatchObject({ done: 0 });
    expect((await get('ALT-00122')).assignee).toBe('Phạm Văn D');
    const r = await assignAlerts(['ALT-00122', 'ALT-00119', 'ALT-00126'], { ...f, assignee: 'Trần Bình', reason: 'Gom việc khu' }, 'Tester');
    // ALT-00126 đã giao Trần Bình ở test trước → bỏ qua "đã giao đúng người".
    expect(r).toMatchObject({ done: 2, reassigned: 1, skipped: 1 });
    expect(await get('ALT-00122')).toMatchObject({ status: 'in-progress', assignee: 'Trần Bình' });
    expect((await get('ALT-00122')).history!.at(-1)!.text).toBe('Đổi người xử lý: Phạm Văn D → Trần Bình – lý do: Gom việc khu');
    expect((await get('ALT-00119')).status).toBe('unacknowledged');
  });
  test('hoàn thành hàng loạt: chỉ dòng Đang xử lý, ghi chú chung bắt buộc, không nhảy từ Chưa xác nhận', async () => {
    await expect(completeAlerts(['ALT-00125'], '  ', 'Tester')).rejects.toThrow();
    const r = await completeAlerts(['ALT-00123', 'ALT-00125', 'ALT-00124'], 'Đã vệ sinh lọc', 'Tester');
    expect(r).toEqual({ done: 1, skipped: 2 });
    expect((await get('ALT-00123')).status).toBe('unacknowledged');
    const done = await get('ALT-00125');
    expect(done.status).toBe('done');
    expect(done.notes?.at(-1)?.text).toBe('Đã vệ sinh lọc');
  });
  test('xác nhận hàng loạt chỉ dòng Chưa xác nhận; đánh dấu đã xử lý một dòng cần ghi chú', async () => {
    expect(await acknowledgeAlerts(['ALT-00123', 'ALT-00125'], 'Tester')).toEqual({ done: 1, skipped: 1 });
    expect(await resolveOneAlert('ALT-00123', '', 'Tester')).toEqual({ ok: false, reason: 'note' });
    expect((await resolveOneAlert('ALT-00123', 'Đã điều chỉnh lịch nhập', 'Tester')).ok).toBe(true);
    expect((await get('ALT-00123')).status).toBe('done');
  });
});

describe('báo cháy FIR-00018 – chung danh sách cảnh báo', () => {
  const fir = alertRecords.find((a) => a.id === 'FIR-00018')!;
  test('dữ liệu: tiền tố FIR, loại fire, HD-02 · Trạm hóa hơi (FZ-02), ngưỡng = cấu hình đầu báo, chưa phân công cá nhân', () => {
    expect(fir).toMatchObject({ code: 'FIR-00018', kind: 'fire', device: 'HD-02', area: 'Trạm hóa hơi', severity: 'critical', status: 'unacknowledged', assignee: null });
    expect(areaLabel(fir.area)).toBe('Trạm hóa hơi (FZ-02)');
    expect(areaLabel('Khu bồn LPG')).toBe('Khu bồn LPG');
    expect(Number(fir.threshold)).toBe(HEAT_DETECTORS['HD-02']!.alarmAt);
    expect(alertKind(fir)).toMatchObject({ panel: 'fire', defaultOwner: 'Trực ca', actions: ['assign', 'procedure'] });
    // Gửi thông báo = phát hiện + 3 s
    const [h, m, sec] = fir.time.split(':').map(Number);
    const [h2, m2, s2] = fir.notifiedTime!.split(':').map(Number);
    expect(((h2! * 3600 + m2! * 60 + s2!) - (h! * 3600 + m! * 60 + sec!) + 86_400) % 86_400).toBe(3);
  });
  test('tìm kiếm / lọc thiết bị / khu / tab / KPI tính cả FIR', () => {
    const today = alertRecords.filter((a) => a.daysAgo === 0);
    // range 30d: FIR phát sinh "3 phút trước" – chạy test ngay sau nửa đêm thì nó thuộc hôm qua.
    const f = { ...DEFAULT_FILTERS, range: '30d' as const };
    expect(filterAlerts(alertRecords, { ...f, q: 'fir-000' }).map((a) => a.id)).toEqual(['FIR-00018']);
    expect(filterAlerts(alertRecords, { ...f, device: 'HD-02' }).map((a) => a.id)).toEqual(['FIR-00018']);
    expect(filterAlerts(alertRecords, { ...f, area: 'Trạm hóa hơi' }).map((a) => a.id)).toContain('FIR-00018');
    const kpi = Object.fromEntries(deriveAlertKpis(alertRecords, 'today').map((k) => [k.id, Number(k.value)]));
    expect(kpi.total).toBe(today.length);
    expect(kpi.critical).toBe(today.filter((a) => a.severity === 'critical').length);
    expect(countByStatus(filterAlerts(alertRecords, DEFAULT_FILTERS, { ignoreTab: true })).unacknowledged).toBe(today.filter((a) => a.status === 'unacknowledged').length);
    // Nghiêm trọng + chưa xác nhận + mới nhất → thẻ ưu tiên đầu tiên
    expect(derivePriorityCards(alertRecords)[0]!.id).toBe('FIR-00018');
  });
  test('store: báo động giả lưu resolution; không đóng khi còn báo động', async () => {
    const get = async () => (await fetchAlerts()).find((a) => a.id === 'FIR-00018')!;
    await acknowledgeAlerts(['FIR-00018'], 'Tester');
    expect(await updateFireAlert('FIR-00018', { action: 'false-alarm', note: 'x' }, { alarm: 'active', device: 'online', detector: 'HD-02' }, 'Tester')).toMatchObject({ ok: false, reason: 'still-alarm' });
    const r = await updateFireAlert('FIR-00018', { action: 'false-alarm', note: 'Camera không thấy khói' }, { alarm: 'cleared', device: 'online', detector: 'HD-02' }, 'Tester');
    expect(r.ok).toBe(true);
    expect(await get()).toMatchObject({ status: 'done', resolution: { kind: 'false-alarm', closedBy: 'live' } });
  });
});
