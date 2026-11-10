import { describe, expect, test } from 'vitest';
import type { AlertRecord } from '@/features/alerts/types';
import {
  acknowledgeAlert,
  addAlertNote,
  alertSteps,
  assignAlert,
  bulkMessage,
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
    expect(r).toMatchObject({ status: 'in-progress', phase: 'inspecting', assignee: 'Nguyễn Văn A', acknowledgedAt: ctx.at.toISOString() });
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
  // Đổi có chủ đích (28/10/2026): "Đánh dấu đã xử lý" → Đã xử lý (resolved, chờ đóng), không còn nhảy thẳng sang Hoàn thành.
  test('đánh dấu đã xử lý: bắt buộc ghi chú; → Đã xử lý (chờ đóng) + người xử lý', () => {
    const ip = alert({ status: 'in-progress', assignee: 'Lê Thị C' });
    expect(resolveAlert(ip, '', ctx)).toEqual({ ok: false, reason: 'note' });
    expect(resolveAlert(ip, '   ', ctx)).toEqual({ ok: false, reason: 'note' });
    const res = resolveAlert(ip, '  Đã xả áp, áp suất về 9.8 bar ', ctx);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.record).toMatchObject({
      status: 'resolved',
      resolvedAt: ctx.at.toISOString(),
      resolvedBy: 'Nguyễn Văn A',
      actionTaken: 'Đã xả áp, áp suất về 9.8 bar',
    });
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
    expect(guideLockHint(alert({ status: 'resolved' }))).toMatch(/chờ xác nhận đóng/);
    expect(guideLockHint(alert({ status: 'in-progress' }))).toBeNull();
  });
  test('tick rồi bỏ tick: lưu theo id bước + 2 dòng lịch sử', () => {
    const a = alert({ status: 'in-progress' });
    const on = toggleGuideStep(a, step, ctx);
    // Dạng mới có `status` (28/10/2026 – hạng mục kiểm tra dùng chung drawer/modal); dạng cũ {at, by} vẫn đọc là Đạt (inspection.test).
    expect(on.guide).toEqual({ 'field-gauge': { status: 'pass', at: ctx.at.toISOString(), by: 'Nguyễn Văn A' } });
    const off = toggleGuideStep(on, step, ctx);
    expect(off.guide).toEqual({});
    expect(off.history!.map((h) => h.text)).toEqual(['Đã làm: Kiểm tra đồng hồ áp suất cơ', 'Bỏ đánh dấu: Kiểm tra đồng hồ áp suất cơ']);
    expect(a.guide).toBeUndefined(); // không sửa bản ghi cũ
  });
  test('dạng cũ {at, by} = Đạt → bỏ tick được; hạng mục "Có vấn đề"/"Không áp dụng" không đổi ở drawer', () => {
    const legacy = alert({ status: 'in-progress', guide: { 'field-gauge': { at: ctx.at.toISOString(), by: 'X' } } });
    expect(toggleGuideStep(legacy, step, ctx).guide).toEqual({});
    const issue = alert({ status: 'in-progress', guide: { 'field-gauge': { at: ctx.at.toISOString(), by: 'X', status: 'issue', note: 'Kẹt' } } });
    expect(toggleGuideStep(issue, step, ctx)).toBe(issue);
    const na = alert({ status: 'in-progress', guide: { 'field-gauge': { at: ctx.at.toISOString(), by: 'X', status: 'na' } } });
    expect(toggleGuideStep(na, step, ctx)).toBe(na);
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
    expect(recordMaintenanceCreated(alert(), 'MT-00129', ctx).history![0]).toMatchObject({
      kind: 'maintenance',
      text: 'Tạo yêu cầu bảo trì MT-00129',
    });
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
  // Đổi có chủ đích (28/10/2026): bước "Đã xử lý" xong khi resolved, "Hoàn thành" chỉ xong khi đóng (giờ đóng).
  test('Đang xử lý / Đã xử lý / Hoàn thành + giờ thao tác theo giờ nhà máy', () => {
    const ip = acknowledgeAlert(alert(), ctx);
    const s = alertSteps(ip);
    expect(s).toMatchObject({ completed: 3, current: 3 });
    expect(s.steps[2]).toMatchObject({ label: 'Đã xác nhận', time: '10:52:10' });
    expect(s.steps[3]).toMatchObject({ label: 'Đang xử lý', time: undefined });
    const done = resolveAlert(ip, 'ok', { ...ctx, at: new Date('2026-10-27T04:30:00Z') });
    if (!done.ok) throw new Error('resolve');
    const r = alertSteps(done.record);
    expect(r).toMatchObject({ completed: 4, current: 4 });
    expect(r.steps[3]).toMatchObject({ label: 'Đã xử lý', time: '11:30:00' });
    expect(r.steps[4]).toMatchObject({ label: 'Hoàn thành', time: undefined });
    const d = alertSteps({ ...done.record, status: 'done', closedAt: '2026-10-27T04:45:00Z' });
    expect(d).toMatchObject({ completed: 5, current: null });
    expect(d.steps.map((x) => `${x.label} ${x.time}`)).toEqual([
      'Đã phát hiện 10:45:22',
      'Đã gửi thông báo 10:45:25',
      'Đã xác nhận 10:52:10',
      'Đã xử lý 11:30:00',
      'Hoàn thành 11:45:00',
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
