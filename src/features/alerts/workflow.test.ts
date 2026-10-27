import { describe, expect, test } from 'vitest';
import type { AlertRecord } from '@/mocks/alerts';
import {
  acknowledgeAlert,
  addAlertNote,
  alertSteps,
  assignAlert,
  bulkMessage,
  fireUpdate,
  gasUpdate,
  requestSupport,
  guideLockHint,
  linkedMaintenance,
  planBulk,
  recordMaintenanceCreated,
  resolveAlert,
  toggleGuideStep,
} from './workflow';

const ctx = { by: 'Nguyễn Văn A', at: new Date('2026-10-27T03:52:10Z') }; // 10:52:10 giờ nhà máy
const alert = (patch: Partial<AlertRecord> = {}): AlertRecord => ({
  id: 'A1',
  code: 'A1',
  daysAgo: 0,
  time: '10:45:22',
  notifiedTime: '10:45:25',
  severity: 'critical',
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
const step = { id: 'field-gauge', text: 'Kiểm tra đồng hồ áp suất cơ' };

describe('quy trình chỉ đi tiến', () => {
  test('xác nhận: Chưa xác nhận → Đang xử lý, người xác nhận nhận xử lý + lịch sử', () => {
    const r = acknowledgeAlert(alert(), ctx);
    expect(r).toMatchObject({ status: 'in-progress', assignee: 'Nguyễn Văn A', acknowledgedAt: ctx.at.toISOString() });
    expect(r.history).toHaveLength(1);
    expect(r.history![0]).toMatchObject({ kind: 'acknowledge', actor: 'Nguyễn Văn A' });
  });
  test('xác nhận giữ người phụ trách đã phân công', () => {
    expect(acknowledgeAlert(alert({ assignee: 'Lê Thị C' }), ctx).assignee).toBe('Lê Thị C');
  });
  test('xác nhận lần hai / khi đã xong → giữ nguyên bản ghi (không lùi, không ghi lịch sử)', () => {
    const once = acknowledgeAlert(alert(), ctx);
    expect(acknowledgeAlert(once, ctx)).toBe(once);
    const done = alert({ status: 'done' });
    expect(acknowledgeAlert(done, ctx)).toBe(done);
  });
  test('không có đường từ Chưa xác nhận sang Hoàn thành', () => {
    expect(resolveAlert(alert(), 'Đã xử lý', ctx)).toEqual({ ok: false, reason: 'status' });
  });
  test('đánh dấu đã xử lý: bắt buộc ghi chú (trống / chỉ khoảng trắng bị chặn)', () => {
    const ip = alert({ status: 'in-progress', assignee: 'Lê Thị C' });
    expect(resolveAlert(ip, '', ctx)).toEqual({ ok: false, reason: 'note' });
    expect(resolveAlert(ip, '   ', ctx)).toEqual({ ok: false, reason: 'note' });
    const res = resolveAlert(ip, '  Đã xả áp, áp suất về 9.8 bar ', ctx);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.record).toMatchObject({ status: 'done', resolvedAt: ctx.at.toISOString() });
    expect(res.record.notes).toEqual([{ id: 'A1-n1', author: 'Nguyễn Văn A', at: ctx.at.toISOString(), text: 'Đã xả áp, áp suất về 9.8 bar' }]);
    expect(res.record.history!.at(-1)).toMatchObject({ kind: 'resolve' });
    expect(resolveAlert(res.record, 'lại', ctx)).toEqual({ ok: false, reason: 'status' });
  });
});

describe('phân công – không tự xác nhận', () => {
  test('giữ trạng thái Chưa xác nhận, ghi lịch sử', () => {
    const r = assignAlert(alert(), 'Trần Bình', ctx);
    expect(r).toMatchObject({ status: 'unacknowledged', assignee: 'Trần Bình' });
    expect(r.history![0]!.text).toBe('Phân công xử lý cho Trần Bình');
  });
  test('đổi người ghi "cũ → mới"; trùng người / trống / đã xong → không đổi', () => {
    const a = alert({ status: 'in-progress', assignee: 'Lê Thị C' });
    expect(assignAlert(a, 'Trần Bình', ctx).history![0]!.text).toBe('Đổi người phụ trách: Lê Thị C → Trần Bình');
    expect(assignAlert(a, 'Lê Thị C', ctx)).toBe(a);
    expect(assignAlert(a, '  ', ctx)).toBe(a);
    const done = alert({ status: 'done' });
    expect(assignAlert(done, 'Trần Bình', ctx)).toBe(done);
  });
});

describe('hướng dẫn xử lý (checklist)', () => {
  test('khoá khi Chưa xác nhận và khi đã xong', () => {
    const un = alert();
    expect(toggleGuideStep(un, step, ctx)).toBe(un);
    expect(guideLockHint(un)).toBe('Xác nhận cảnh báo để bắt đầu xử lý.');
    expect(guideLockHint(alert({ status: 'done' }))).toMatch(/chỉ xem/);
    expect(guideLockHint(alert({ status: 'in-progress' }))).toBeNull();
  });
  test('tick rồi bỏ tick: lưu theo id bước + 2 dòng lịch sử', () => {
    const a = alert({ status: 'in-progress' });
    const on = toggleGuideStep(a, step, ctx);
    expect(on.guide).toEqual({ 'field-gauge': { at: ctx.at.toISOString(), by: 'Nguyễn Văn A' } });
    const off = toggleGuideStep(on, step, ctx);
    expect(off.guide).toEqual({});
    expect(off.history!.map((h) => h.text)).toEqual(['Đã làm: Kiểm tra đồng hồ áp suất cơ', 'Bỏ đánh dấu: Kiểm tra đồng hồ áp suất cơ']);
    expect(a.guide).toBeUndefined(); // không sửa bản ghi cũ
  });
});

describe('ghi chú', () => {
  test('lưu ghi chú + lịch sử; trống hoặc đã xong → không đổi', () => {
    const a = alert();
    const r = addAlertNote(a, ' Đang trên đường ra hiện trường ', ctx);
    expect(r.notes).toHaveLength(1);
    expect(r.notes![0]!.text).toBe('Đang trên đường ra hiện trường');
    expect(addAlertNote(a, ' ', ctx)).toBe(a);
    const done = alert({ status: 'done' });
    expect(addAlertNote(done, 'x', ctx)).toBe(done);
  });
});

describe('yêu cầu bảo trì từ cảnh báo – không tạo trùng', () => {
  test('tìm yêu cầu đang có theo sourceAlertId, bỏ qua yêu cầu đã hủy', () => {
    const recs = [
      { id: 'm1', code: 'MT-1', status: 'cancelled', sourceAlertId: 'A1' },
      { id: 'm2', code: 'MT-2', status: 'pending', sourceAlertId: 'A2' },
    ];
    expect(linkedMaintenance('A1', recs)).toBeUndefined();
    expect(linkedMaintenance('A2', recs)?.code).toBe('MT-2');
    expect(linkedMaintenance('A1', [...recs, { id: 'm3', code: 'MT-3', status: 'done', sourceAlertId: 'A1' }])?.code).toBe('MT-3');
  });
  test('ghi lịch sử tạo yêu cầu', () => {
    expect(recordMaintenanceCreated(alert(), 'MT-00129', ctx).history![0]).toMatchObject({ kind: 'maintenance', text: 'Tạo yêu cầu bảo trì MT-00129' });
  });
});

describe('hàng loạt', () => {
  const rows = [alert({ id: 'U' }), alert({ id: 'P', status: 'in-progress' }), alert({ id: 'D', status: 'done' })];
  test('chỉ dòng đủ điều kiện, id lạ tính bỏ qua, rỗng → 0/0', () => {
    expect(planBulk(rows, ['U', 'P', 'D', 'X'], (a) => a.status === 'in-progress')).toEqual({ eligible: ['P'], skipped: 3 });
    expect(planBulk(rows, [], () => true)).toEqual({ eligible: [], skipped: 0 });
  });
  test('câu thông báo', () => {
    expect(bulkMessage('Đã hoàn thành', 2, 1)).toBe('Đã hoàn thành 2 · bỏ qua 1');
    expect(bulkMessage('Đã hoàn thành', 2, 0)).toBe('Đã hoàn thành 2');
  });
});

describe('tiến trình 5 bước', () => {
  test('Chưa xác nhận: 2 bước xong, bước 3 đang chờ, có giờ hệ thống', () => {
    const s = alertSteps(alert());
    expect(s).toMatchObject({ completed: 2, current: 2 });
    expect(s.steps.map((x) => x.label)).toEqual(['Đã phát hiện', 'Đã gửi thông báo', 'Chưa xác nhận', 'Đang xử lý', 'Hoàn thành']);
    expect(s.steps.map((x) => x.time)).toEqual(['10:45:22', '10:45:25', undefined, undefined, undefined]);
  });
  test('Đang xử lý / Hoàn thành + giờ thao tác theo giờ nhà máy', () => {
    const ip = acknowledgeAlert(alert(), ctx);
    const s = alertSteps(ip);
    expect(s).toMatchObject({ completed: 3, current: 3 });
    expect(s.steps[2]).toMatchObject({ label: 'Đã xác nhận', time: '10:52:10' });
    expect(s.steps[3]).toMatchObject({ label: 'Đang xử lý', time: undefined });
    const done = resolveAlert(ip, 'ok', { ...ctx, at: new Date('2026-10-27T04:30:00Z') });
    if (!done.ok) throw new Error('resolve');
    const d = alertSteps(done.record);
    expect(d).toMatchObject({ completed: 5, current: null });
    expect(d.steps.map((x) => `${x.label} ${x.time}`)).toEqual([
      'Đã phát hiện 10:45:22',
      'Đã gửi thông báo 10:45:25',
      'Đã xác nhận 10:52:10',
      'Đã xử lý 11:30:00',
      'Hoàn thành 11:30:00',
    ]);
  });
});

describe('yêu cầu hỗ trợ', () => {
  test('thêm người phối hợp (không trùng), lý do bắt buộc, không đổi trạng thái/người phụ trách', () => {
    const a = alert({ status: 'in-progress', assignee: 'Nguyễn Văn A', collaborators: ['Trần Thị B'] });
    const r = requestSupport(a, { people: ['Hoàng Minh E', 'Trần Thị B'], reason: ' Nồng độ tăng nhanh ' }, ctx);
    expect(r).toMatchObject({ status: 'in-progress', assignee: 'Nguyễn Văn A', collaborators: ['Trần Thị B', 'Hoàng Minh E'] });
    expect(r.history!.at(-1)).toMatchObject({ kind: 'support', text: 'Yêu cầu hỗ trợ: Hoàng Minh E, Trần Thị B – Nồng độ tăng nhanh' });
    expect(requestSupport(a, { people: ['X'], reason: '  ' }, ctx)).toBe(a);
    expect(requestSupport(a, { people: [], reason: 'x' }, ctx)).toBe(a);
    const done = alert({ status: 'done' });
    expect(requestSupport(done, { people: ['X'], reason: 'y' }, ctx)).toBe(done);
  });
});

describe('cập nhật xử lý (gas)', () => {
  const ip = alert({ status: 'in-progress', device: 'GS-04', unit: '% LEL' });
  const chk = (live: number | undefined) => ({ live, limit: 10, unit: '% LEL' });
  test('tiếp tục: ghi chú bắt buộc, giữ Đang xử lý, lịch sử kèm số đo lại', () => {
    expect(gasUpdate(ip, { action: 'continue', note: ' ' }, chk(25), ctx)).toEqual({ ok: false, reason: 'note' });
    const r = gasUpdate(ip, { action: 'continue', note: 'Đã khoanh vùng', measured: 22 }, chk(25), ctx);
    expect(r.ok && r.record.status).toBe('in-progress');
    expect(r.ok && r.record.history!.at(-1)!.text).toBe('Tiếp tục xử lý · đo lại tại chỗ: 22% LEL: Đã khoanh vùng');
  });
  test('đã xử lý xong: khoá khi live còn trên ngưỡng hoặc mất tín hiệu mà không đo lại', () => {
    expect(gasUpdate(ip, { action: 'close', note: 'ok' }, chk(25), ctx)).toMatchObject({ ok: false, reason: 'above' });
    expect(gasUpdate(ip, { action: 'close', note: 'ok' }, chk(undefined), ctx)).toMatchObject({ ok: false, reason: 'need-measure' });
  });
  test('đã xử lý xong khi live < ngưỡng / số đo lại < ngưỡng → Hoàn thành, lịch sử ghi nồng độ lúc đóng', () => {
    const r = gasUpdate(ip, { action: 'close', note: 'Đã siết khớp nối' }, chk(6), ctx);
    if (!r.ok) throw new Error('close');
    expect(r.record).toMatchObject({ status: 'done', closingReading: { value: 6, source: 'live' } });
    expect(r.record.history!.at(-1)!.text).toBe('Đã xử lý xong – nồng độ lúc đóng 6% LEL (số trực tiếp): Đã siết khớp nối');
    const m = gasUpdate(ip, { action: 'close', note: 'Đo tay', measured: 3 }, chk(undefined), ctx);
    expect(m.ok && m.record.closingReading).toEqual({ value: 3, source: 'measured' });
    expect(gasUpdate(alert(), { action: 'close', note: 'x' }, chk(1), ctx)).toEqual({ ok: false, reason: 'status' });
  });
});

describe('cập nhật xử lý (báo cháy)', () => {
  const ip = alert({ status: 'in-progress', device: 'HD-02', unit: '°C', value: '68', threshold: '57' });
  const live = { alarm: 'cleared' as const, device: 'online' as const, detector: 'HD-02' };
  const active = { ...live, alarm: 'active' as const };
  const lost = { alarm: 'unknown' as const, device: 'lost' as const, detector: 'HD-02' };
  test('ghi chú bắt buộc cho CẢ 3 lựa chọn; chỉ Đang xử lý', () => {
    for (const action of ['continue', 'handled', 'false-alarm'] as const) expect(fireUpdate(ip, { action, note: '  ' }, live, ctx)).toEqual({ ok: false, reason: 'note' });
    expect(fireUpdate(alert(), { action: 'continue', note: 'x' }, live, ctx)).toEqual({ ok: false, reason: 'status' });
  });
  test('tiếp tục: giữ Đang xử lý (được cả khi còn báo động), một ghi chú + một dòng lịch sử, không có resolution', () => {
    const r = fireUpdate(ip, { action: 'continue', note: 'Đã cử người kiểm tra' }, active, ctx);
    if (!r.ok) throw new Error();
    expect(r.record.status).toBe('in-progress');
    expect(r.record.resolution).toBeUndefined();
    expect(r.record.notes).toHaveLength(1);
    expect(r.record.history!.at(-1)).toMatchObject({ kind: 'update', text: 'Tiếp tục xử lý: Đã cử người kiểm tra' });
  });
  test('đóng khi còn báo động → chặn; mất tín hiệu chưa kiểm tra tại chỗ → chặn', () => {
    expect(fireUpdate(ip, { action: 'handled', note: 'ok' }, active, ctx)).toMatchObject({ ok: false, reason: 'still-alarm' });
    expect(fireUpdate(ip, { action: 'false-alarm', note: 'ok' }, lost, ctx)).toMatchObject({ ok: false, reason: 'need-field-check' });
  });
  test('đã xử lý sự cố (phục hồi live) → Hoàn thành + resolution handled/live', () => {
    const r = fireUpdate(ip, { action: 'handled', note: 'Dập cháy nhỏ bằng bình CO2' }, live, ctx);
    if (!r.ok) throw new Error();
    expect(r.record).toMatchObject({ status: 'done', resolvedAt: ctx.at.toISOString(), resolution: { kind: 'handled', closedBy: 'live' } });
    expect(r.record.history!.at(-1)).toMatchObject({ kind: 'resolve', text: 'Đã xử lý sự cố (đầu báo HD-02 đã phục hồi): Dập cháy nhỏ bằng bình CO2' });
  });
  test('báo động giả → resolution false-alarm (thống kê); mất tín hiệu + kiểm tra tại chỗ → closedBy field', () => {
    const r = fireUpdate(ip, { action: 'false-alarm', note: 'Hơi nóng từ ống xả', fieldChecked: true }, lost, ctx);
    if (!r.ok) throw new Error();
    expect(r.record.resolution).toEqual({ kind: 'false-alarm', closedBy: 'field' });
    expect(r.record.history!.at(-1)!.text).toBe('Báo động giả (đầu báo HD-02 mất tín hiệu – đã kiểm tra tại chỗ): Hơi nóng từ ống xả');
    // Chạy lại trên bản đã đóng → không đổi trạng thái
    expect(fireUpdate(r.record, { action: 'handled', note: 'x' }, live, ctx)).toEqual({ ok: false, reason: 'status' });
  });
});
