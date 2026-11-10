import { describe, expect, test } from 'vitest';
import type { AlertRecord } from '@/features/alerts/types';
import {
  allConditionsOk,
  bulkCloseMessage,
  closeAlert,
  closeConditions,
  closerCheck,
  continueMonitoring,
  followUpFor,
  planBulkClose,
  relatedOpenAlerts,
  type CloseCondition,
  type CloseConditionInput,
} from './close';
import { canResolve } from './workflow';

const ctx = { by: 'Trần Văn B', at: new Date('2026-10-28T04:30:00Z') }; // 11:30 giờ nhà máy
const alert = (patch: Partial<AlertRecord> = {}): AlertRecord => ({
  id: 'ALT-00128',
  code: 'ALT-00128',
  daysAgo: 0,
  time: '10:45:22',
  severity: 'critical',
  message: 'Áp suất bồn V-101 vượt ngưỡng',
  device: 'V-101',
  area: 'Khu bồn LPG',
  value: '11.8',
  threshold: '10.5',
  unit: 'bar',
  status: 'resolved',
  assignee: 'Nguyễn Văn A',
  resolvedBy: 'Nguyễn Văn A',
  resolvedAt: '2026-10-28T04:00:00Z',
  ...patch,
});
const OK: CloseCondition[] = [
  { id: 'stable', ok: true },
  { id: 'in-range', ok: true },
  { id: 'no-related', ok: true },
];
const input = (p: Partial<CloseConditionInput> = {}): CloseConditionInput => ({
  primary: { label: 'Áp suất V-101', reading: { state: 'ok', value: 9.2 }, limit: 10.5, unit: 'bar', direction: 'above' },
  secondary: [],
  related: [],
  ...p,
});
const byId = (list: CloseCondition[]) => Object.fromEntries(list.map((c) => [c.id, c]));

describe('3 điều kiện hệ thống', () => {
  test('đủ điều kiện: live dưới ngưỡng, tín hiệu đọc được, không còn cảnh báo mở', () => {
    const c = closeConditions(input());
    expect(c.map((x) => x.id)).toEqual(['stable', 'in-range', 'no-related']);
    expect(allConditionsOk(c)).toBe(true);
  });
  test('live ≥ ngưỡng (biên = ngưỡng) → "trong ngưỡng" sai; chiều thấp → phải trên ngưỡng', () => {
    expect(byId(closeConditions(input({ primary: { ...input().primary!, reading: { state: 'ok', value: 10.5 } } })))['in-range']).toMatchObject({
      ok: false,
      reason: 'Áp suất V-101 hiện tại 10.5 bar chưa dưới ngưỡng 10.5 bar.',
    });
    const below = { label: 'TT', reading: { state: 'ok' as const, value: 49 }, limit: 50, unit: '°C', direction: 'below' as const };
    expect(byId(closeConditions(input({ primary: below })))['in-range']!.ok).toBe(false);
    expect(byId(closeConditions(input({ primary: { ...below, reading: { state: 'ok', value: 52 } } })))['in-range']!.ok).toBe(true);
  });
  test('mất tín hiệu / đang đọc → cả "ổn định" và "trong ngưỡng" đều sai (không dùng số cũ)', () => {
    const lost = byId(closeConditions(input({ primary: { ...input().primary!, reading: { state: 'lost' } } })));
    expect(lost.stable!.ok).toBe(false);
    expect(lost['in-range']!.reason).toMatch(/mất tín hiệu/);
    expect(byId(closeConditions(input({ primary: { ...input().primary!, reading: { state: 'pending' } } }))).stable!.reason).toMatch(/Đang đọc/);
  });
  test('tín hiệu phụ bất thường → "ổn định" sai, nêu tên; tín hiệu phụ mất tín hiệu không chặn', () => {
    const c = byId(
      closeConditions(
        input({
          secondary: [
            { label: 'Nhiệt độ bồn', state: 'abnormal' },
            { label: 'Áp suất sau PR-101', state: 'lost' },
          ],
        }),
      ),
    );
    expect(c.stable).toMatchObject({ ok: false, reason: 'Còn tín hiệu bất thường: Nhiệt độ bồn.' });
    expect(closeConditions(input({ secondary: [{ label: 'X', state: 'lost' }] }))[0]!.ok).toBe(true);
  });
  test('báo cháy: đầu báo còn báo động / mất kết nối / lỗi → "ổn định" sai', () => {
    const d = (alarm: 'active' | 'cleared' | 'unknown', device: 'online' | 'lost' | 'fault' | 'pending' = 'online') =>
      byId(closeConditions(input({ detector: { name: 'HD-02', alarm, device } }))).stable!;
    expect(d('cleared').ok).toBe(true);
    expect(d('active').reason).toMatch(/vẫn đang báo động/);
    expect(d('unknown', 'lost').reason).toMatch(/mất kết nối/);
    expect(d('cleared', 'fault').reason).toMatch(/lỗi/);
    expect(d('cleared', 'pending').ok).toBe(false);
  });
  test('loại không có số trực tiếp → 2 điều kiện đầu đạt kèm ghi chú', () => {
    const c = closeConditions(input({ primary: null }));
    expect(c[0]).toMatchObject({ ok: true, reason: expect.stringMatching(/Không có số trực tiếp/) });
    expect(c[1]).toMatchObject({ ok: true, reason: expect.stringMatching(/Không có số trực tiếp/) });
  });
  test('cảnh báo đang mở cùng thiết bị HOẶC cùng khu; Đã xử lý / Hoàn thành / chính nó không tính', () => {
    const a = alert();
    const all = [
      a,
      alert({ id: 'X1', code: 'X1', status: 'unacknowledged', device: 'V-102' }),
      alert({ id: 'X2', code: 'X2', status: 'in-progress', area: 'Khu bơm' }),
      alert({ id: 'X3', code: 'X3', status: 'resolved' }),
      alert({ id: 'X4', code: 'X4', status: 'done' }),
      alert({ id: 'X5', code: 'X5', status: 'in-progress', device: 'P-1', area: 'Khu bơm' }),
    ];
    expect(relatedOpenAlerts(a, all).map((r) => r.id)).toEqual(['X1', 'X2']);
    const c = byId(closeConditions(input({ related: relatedOpenAlerts(a, all) })));
    expect(c['no-related']).toMatchObject({ ok: false, reason: 'Còn 2 cảnh báo đang mở cùng thiết bị/khu: X1, X2.' });
    expect(c['no-related']!.related).toHaveLength(2);
  });
});

describe('người đóng', () => {
  test('Nghiêm trọng: người đóng phải khác người xử lý (resolvedBy, thiếu → người phụ trách)', () => {
    expect(closerCheck(alert(), 'Nguyễn Văn A')).toMatchObject({ ok: false, reason: expect.stringMatching(/khác người xử lý \(Nguyễn Văn A\)/) });
    expect(closerCheck(alert(), 'Trần Văn B').ok).toBe(true);
    expect(closerCheck(alert({ resolvedBy: undefined }), 'Nguyễn Văn A').ok).toBe(false);
    // chưa đăng nhập: người hiện tại = 'Admin'
    expect(closerCheck(alert({ resolvedBy: 'Admin' }), 'Admin').ok).toBe(false);
  });
  test('mức khác: người xử lý tự đóng được', () => {
    for (const severity of ['high', 'medium', 'low'] as const) expect(closerCheck(alert({ severity }), 'Nguyễn Văn A').ok).toBe(true);
  });
});

describe('xác nhận đóng', () => {
  const cfg = { target: 10 };
  test('Đã xử lý → Hoàn thành + người đóng + ghi chú kết luận + lịch sử; mục tick tay lưu lại', () => {
    const r = closeAlert(alert(), { note: '  Ổn định sau 30 phút ', followUpMinutes: 0, manualChecks: ['log-updated'] }, OK, cfg, ctx);
    if (!r.ok) throw new Error(r.message);
    expect(r.record).toMatchObject({
      status: 'done',
      closedAt: ctx.at.toISOString(),
      closedBy: 'Trần Văn B',
      closingNote: 'Ổn định sau 30 phút',
      closeChecks: ['log-updated'],
      followUp: undefined,
    });
    expect(r.record.notes!.at(-1)!.text).toBe('Kết luận: Ổn định sau 30 phút');
    expect(r.record.history!.at(-1)).toMatchObject({ kind: 'close', text: 'Xác nhận đóng cảnh báo: Ổn định sau 30 phút', actor: 'Trần Văn B' });
    // chỉ đi tiến: đóng rồi không đóng lại / không quay về Đang xử lý
    expect(closeAlert(r.record, { note: 'x', followUpMinutes: 0, manualChecks: [] }, OK, cfg, ctx)).toMatchObject({ ok: false, reason: 'status' });
    expect(canResolve(r.record)).toBe(false);
  });
  test('chặn: chưa Đã xử lý · người đóng = người xử lý (Nghiêm trọng) · thiếu điều kiện · thiếu ghi chú', () => {
    const go = (a: AlertRecord, conds = OK, note = 'ok', by = 'Trần Văn B') =>
      closeAlert(a, { note, followUpMinutes: 0, manualChecks: [] }, conds, cfg, { ...ctx, by });
    expect(go(alert({ status: 'in-progress' }))).toMatchObject({ ok: false, reason: 'status' });
    expect(go(alert({ status: 'unacknowledged' }))).toMatchObject({ ok: false, reason: 'status' });
    expect(go(alert(), OK, 'ok', 'Nguyễn Văn A')).toMatchObject({ ok: false, reason: 'closer' });
    expect(go(alert(), [OK[0]!, { id: 'in-range', ok: false }, OK[2]!])).toMatchObject({ ok: false, reason: 'conditions' });
    expect(go(alert(), [])).toMatchObject({ ok: false, reason: 'conditions' });
    expect(go(alert(), OK, '   ')).toMatchObject({ ok: false, reason: 'note' });
  });
  test('thời gian theo dõi: MỘT giá trị – giữ nguyên nếu không đổi và chưa hết giờ; đổi → tính lại từ lúc lưu', () => {
    const cur = { minutes: 120, until: '2026-10-28T06:00:00.000Z', target: 10, unit: 'bar', owner: 'Nguyễn Văn A' };
    const a = alert({ followUp: cur });
    expect(followUpFor(a, 120, ctx.at, cfg, 'X')).toBe(cur);
    expect(followUpFor(a, 30, ctx.at, cfg, 'X')).toEqual({
      minutes: 30,
      until: '2026-10-28T05:00:00.000Z',
      target: 10,
      unit: 'bar',
      owner: 'Nguyễn Văn A',
    });
    expect(followUpFor(a, 0, ctx.at, cfg, 'X')).toBeUndefined();
    // hết giờ → cùng số phút cũng tính lại
    expect(followUpFor(a, 120, new Date('2026-10-28T06:00:00Z'), cfg, 'X')!.until).toBe('2026-10-28T08:00:00.000Z');
    // chưa có theo dõi: mục tiêu theo cấu hình loại (cháy: không có), người theo dõi = người xử lý
    expect(followUpFor(alert(), 60, ctx.at, {}, 'X')).toEqual({ minutes: 60, until: '2026-10-28T05:30:00.000Z', unit: 'bar', owner: 'Nguyễn Văn A' });
    const r = closeAlert(a, { note: 'ok', followUpMinutes: 30, manualChecks: [] }, OK, cfg, ctx);
    if (!r.ok) throw new Error(r.message);
    expect(r.record.followUp?.minutes).toBe(30);
    expect(r.record.history!.at(-1)!.text).toBe('Xác nhận đóng cảnh báo · theo dõi đến 12:00: ok');
  });
});

describe('tiếp tục theo dõi', () => {
  test('giữ Đã xử lý + theo dõi mới; ghi chú không bắt buộc; lịch sử "Tiếp tục theo dõi đến HH:MM"', () => {
    const r = continueMonitoring(alert(), { minutes: 60, note: '' }, { target: 10 }, ctx);
    if (!r.ok) throw new Error(r.message);
    expect(r.record).toMatchObject({ status: 'resolved', followUp: { minutes: 60, until: '2026-10-28T05:30:00.000Z', target: 10 } });
    expect(r.record.notes).toBeUndefined();
    expect(r.record.history!.at(-1)).toMatchObject({ kind: 'monitor', text: 'Tiếp tục theo dõi đến 12:30' });
    const withNote = continueMonitoring(r.record, { minutes: 30, note: 'Áp suất dao động nhẹ' }, { target: 10 }, ctx);
    if (!withNote.ok) throw new Error(withNote.message);
    expect(withNote.record.notes!.at(-1)!.text).toBe('Áp suất dao động nhẹ');
    expect(withNote.record.history!.at(-1)!.text).toBe('Tiếp tục theo dõi đến 12:00: Áp suất dao động nhẹ');
  });
  test('không theo dõi (0 phút) hoặc không ở Đã xử lý → chặn; không kiểm điều kiện hệ thống / người đóng', () => {
    expect(continueMonitoring(alert(), { minutes: 0, note: '' }, {}, ctx)).toMatchObject({ ok: false, reason: 'minutes' });
    expect(continueMonitoring(alert({ status: 'done' }), { minutes: 30, note: '' }, {}, ctx)).toMatchObject({ ok: false, reason: 'status' });
    expect(continueMonitoring(alert(), { minutes: 30, note: '' }, {}, { ...ctx, by: 'Nguyễn Văn A' }).ok).toBe(true);
  });
});

describe('đóng hàng loạt', () => {
  const rows = [
    alert({ id: 'R1', code: 'R1', severity: 'high' }),
    alert({ id: 'R2', code: 'R2' }), // Nghiêm trọng, người xử lý = người đóng
    alert({ id: 'R3', code: 'R3', severity: 'low' }), // thiếu điều kiện
    alert({ id: 'P1', code: 'P1', status: 'in-progress' }),
  ];
  const conds = (a: AlertRecord) => (a.id === 'R3' ? [OK[0]!, OK[1]!, { id: 'no-related' as const, ok: false }] : OK);
  test('chỉ dòng Đã xử lý đủ điều kiện; bỏ qua Nghiêm trọng khi người đóng là người xử lý; id lạ = không ở Chờ đóng', () => {
    const p = planBulkClose(rows, ['R1', 'R2', 'R3', 'P1', 'ZZ'], conds, 'Nguyễn Văn A');
    expect(p.eligible).toEqual(['R1']);
    expect(p.skipped).toEqual([
      { id: 'R2', reason: 'closer' },
      { id: 'R3', reason: 'conditions' },
      { id: 'P1', reason: 'status' },
      { id: 'ZZ', reason: 'status' },
    ]);
    expect(planBulkClose(rows, ['R1', 'R2'], conds, 'Trần Văn B').eligible).toEqual(['R1', 'R2']);
  });
  test('câu thông báo "Đã đóng X · bỏ qua N (lý do)"', () => {
    expect(bulkCloseMessage(2, [])).toBe('Đã đóng 2');
    expect(bulkCloseMessage(1, [{ reason: 'closer' }, { reason: 'conditions' }, { reason: 'conditions' }])).toBe(
      'Đã đóng 1 · bỏ qua 3 (1 Nghiêm trọng – người đóng là người xử lý; 2 chưa đủ điều kiện hệ thống)',
    );
  });
});
