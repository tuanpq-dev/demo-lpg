import { describe, expect, test } from 'vitest';
import type { AlertRecord } from '@/features/alerts/types';
import {
  allConditionsOk,
  bulkCloseMessage,
  closeAlert,
  closeConditions,
  closerCheck,
  continueMonitoring,
  planBulkClose,
  relatedOpenAlerts,
  type CloseCondition,
  type CloseConditionInput,
} from './close';

const ctx = { by: 'Trần Thị B', at: new Date('2026-10-27T03:52:10Z') }; // 10:52 giờ nhà máy
const alert = (patch: Partial<AlertRecord> = {}): AlertRecord => ({
  id: 'A1',
  code: 'A1',
  daysAgo: 0,
  time: '10:45:22',
  severity: 'high',
  message: 'Áp suất bồn V-101 vượt ngưỡng',
  device: 'V-101',
  area: 'Khu bồn LPG',
  value: '11.8',
  threshold: '10.5',
  unit: 'bar',
  status: 'resolved',
  assignee: 'Nguyễn Văn A',
  resolvedBy: 'Nguyễn Văn A',
  ...patch,
});

const pressure = (value: number | undefined, state: 'ok' | 'lost' | 'pending' = 'ok'): CloseConditionInput => ({
  primary: { label: 'Áp suất bồn', reading: { state, value }, limit: 10.5, unit: 'bar', direction: 'above' },
  secondary: [],
  related: [],
});
const ALL_OK: CloseCondition[] = [
  { id: 'stable', ok: true },
  { id: 'in-range', ok: true },
  { id: 'no-related', ok: true },
];

describe('3 điều kiện hệ thống', () => {
  test('áp suất dưới ngưỡng, không cảnh báo liên quan → đủ điều kiện', () => {
    expect(allConditionsOk(closeConditions(pressure(9.8)))).toBe(true);
  });

  test('vẫn trên ngưỡng → in-range sai, nêu số hiện tại và ngưỡng', () => {
    const [, inRange] = closeConditions(pressure(10.9));
    expect(inRange).toMatchObject({ id: 'in-range', ok: false });
    expect(inRange!.reason).toContain('10.9');
  });

  test('mất tín hiệu → không ổn định, không kiểm được ngưỡng (không đóng dựa trên số cũ)', () => {
    const [stable, inRange] = closeConditions(pressure(9.8, 'lost'));
    expect(stable!.ok).toBe(false);
    expect(inRange!.ok).toBe(false);
  });

  test('ngưỡng dưới (direction below): giá trị phải TRÊN ngưỡng', () => {
    const c = pressure(4);
    c.primary = { ...c.primary!, direction: 'below', limit: 5 };
    expect(closeConditions(c)[1]!.ok).toBe(false);
  });

  test('loại không có số trực tiếp → đạt kèm ghi chú', () => {
    const [stable, inRange] = closeConditions({ primary: null, secondary: [], related: [] });
    expect(stable).toMatchObject({ ok: true, reason: expect.stringContaining('Không có số trực tiếp') });
    expect(inRange!.ok).toBe(true);
  });

  test('báo cháy: đầu báo còn báo động / mất kết nối → không ổn định', () => {
    const base = { primary: null, secondary: [], related: [] };
    expect(closeConditions({ ...base, detector: { name: 'FD-01', alarm: 'active', device: 'online' } })[0]!.ok).toBe(false);
    expect(closeConditions({ ...base, detector: { name: 'FD-01', alarm: 'cleared', device: 'lost' } })[0]!.ok).toBe(false);
    expect(closeConditions({ ...base, detector: { name: 'FD-01', alarm: 'cleared', device: 'online' } })[0]!.ok).toBe(true);
  });

  test('tín hiệu phụ bất thường chặn; mất tín hiệu phụ không chặn', () => {
    expect(closeConditions({ ...pressure(9), secondary: [{ label: 'Nhiệt độ', state: 'abnormal' }] })[0]!.ok).toBe(false);
    expect(closeConditions({ ...pressure(9), secondary: [{ label: 'Nhiệt độ', state: 'lost' }] })[0]!.ok).toBe(true);
  });

  test('cảnh báo liên quan = đang mở, cùng thiết bị HOẶC cùng khu, khác chính nó', () => {
    const all = [
      alert(),
      alert({ id: 'A2', code: 'A2', status: 'unacknowledged' }),
      alert({ id: 'A3', code: 'A3', status: 'in-progress', device: 'P-101' }),
      alert({ id: 'A4', code: 'A4', status: 'in-progress', device: 'P-101', area: 'Cụm bơm' }),
      alert({ id: 'A5', code: 'A5', status: 'done' }),
    ];
    const related = relatedOpenAlerts(all[0]!, all);
    expect(related.map((r) => r.id)).toEqual(['A2', 'A3']);
    expect(closeConditions({ ...pressure(9), related })[2]).toMatchObject({ ok: false, related });
  });
});

describe('người đóng', () => {
  test('Nghiêm trọng: người xử lý không tự đóng; mức khác thì được', () => {
    expect(closerCheck(alert({ severity: 'critical' }), 'Nguyễn Văn A').ok).toBe(false);
    expect(closerCheck(alert({ severity: 'critical' }), 'Trần Thị B').ok).toBe(true);
    expect(closerCheck(alert({ severity: 'high' }), 'Nguyễn Văn A').ok).toBe(true);
  });
  test('thiếu resolvedBy → so với người phụ trách', () => {
    expect(closerCheck(alert({ severity: 'critical', resolvedBy: undefined }), 'Nguyễn Văn A').ok).toBe(false);
  });
});

describe('closeAlert', () => {
  const input = { note: '  Áp suất ổn định  ', followUpMinutes: 0, manualChecks: ['log-updated'] };

  test('đủ điều kiện → Hoàn thành + người đóng + ghi chú kết luận + một dòng lịch sử', () => {
    const r = closeAlert(alert(), input, ALL_OK, {}, ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.record).toMatchObject({ status: 'done', closedBy: 'Trần Thị B', closingNote: 'Áp suất ổn định', closeChecks: ['log-updated'] });
    expect(r.record.followUp).toBeUndefined();
    expect(r.record.notes?.at(-1)?.text).toBe('Kết luận: Áp suất ổn định');
    expect(r.record.history).toHaveLength(1);
    expect(r.record.history![0]).toMatchObject({ kind: 'close' });
  });

  test('chặn theo thứ tự: trạng thái → người đóng → điều kiện → ghi chú', () => {
    expect(closeAlert(alert({ status: 'in-progress' }), input, ALL_OK, {}, ctx)).toMatchObject({ ok: false, reason: 'status' });
    const critical = alert({ severity: 'critical', resolvedBy: ctx.by });
    expect(closeAlert(critical, input, ALL_OK, {}, ctx)).toMatchObject({ ok: false, reason: 'closer' });
    const notOk: CloseCondition[] = [...ALL_OK.slice(0, 2), { id: 'no-related', ok: false }];
    expect(closeAlert(alert(), input, notOk, {}, ctx)).toMatchObject({ ok: false, reason: 'conditions' });
    expect(closeAlert(alert(), { ...input, note: '   ' }, ALL_OK, {}, ctx)).toMatchObject({ ok: false, reason: 'note' });
  });

  test('có theo dõi → khoảng mới từ lúc đóng, người theo dõi mặc định = người xử lý', () => {
    const r = closeAlert(alert(), { ...input, followUpMinutes: 30 }, ALL_OK, { target: 10 }, ctx);
    if (!r.ok) throw new Error(r.message);
    expect(r.record.followUp).toEqual({ minutes: 30, until: '2026-10-27T04:22:10.000Z', target: 10, unit: 'bar', owner: 'Nguyễn Văn A' });
  });

  test('giữ nguyên theo dõi đang chạy khi chọn đúng số phút cũ', () => {
    const cur = { minutes: 60, until: '2026-10-27T04:30:00.000Z', unit: 'bar', owner: 'Lê C' };
    const r = closeAlert(alert({ followUp: cur }), { ...input, followUpMinutes: 60 }, ALL_OK, {}, ctx);
    if (!r.ok) throw new Error(r.message);
    expect(r.record.followUp).toBe(cur);
  });
});

describe('continueMonitoring', () => {
  test('giữ Đã xử lý, bắt buộc số phút > 0, ghi chú không bắt buộc', () => {
    expect(continueMonitoring(alert(), { minutes: 0, note: '' }, {}, ctx)).toMatchObject({ ok: false, reason: 'minutes' });
    expect(continueMonitoring(alert({ status: 'done' }), { minutes: 30, note: '' }, {}, ctx)).toMatchObject({ ok: false, reason: 'status' });
    const r = continueMonitoring(alert(), { minutes: 30, note: '' }, {}, ctx);
    if (!r.ok) throw new Error(r.message);
    expect(r.record.status).toBe('resolved');
    expect(r.record.notes).toBeUndefined();
    expect(r.record.history![0]).toMatchObject({ kind: 'monitor' });
  });
});

describe('đóng hàng loạt', () => {
  test('chỉ dòng chờ đóng đủ điều kiện; nêu lý do bỏ qua, id lạ = sai trạng thái', () => {
    const all = [
      alert({ id: 'A1' }),
      alert({ id: 'A2', status: 'in-progress' }),
      alert({ id: 'A3', severity: 'critical', resolvedBy: ctx.by }),
      alert({ id: 'A4' }),
    ];
    const plan = planBulkClose(all, ['A1', 'A2', 'A3', 'A4', 'X'], (a) => (a.id === 'A4' ? [{ id: 'stable', ok: false }] : ALL_OK), ctx.by);
    expect(plan.eligible).toEqual(['A1']);
    expect(plan.skipped).toEqual([
      { id: 'A2', reason: 'status' },
      { id: 'A3', reason: 'closer' },
      { id: 'A4', reason: 'conditions' },
      { id: 'X', reason: 'status' },
    ]);
    expect(bulkCloseMessage(1, plan.skipped)).toBe(
      'Đã đóng 1 · bỏ qua 4 (2 không ở trạng thái Chờ đóng; 1 Nghiêm trọng – người đóng là người xử lý; 1 chưa đủ điều kiện hệ thống)',
    );
  });
});
