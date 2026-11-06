import { describe, expect, test } from 'vitest';
import type { AlertRecord } from '@/features/alerts/types';
import {
  alertAssignChange,
  applyAlertAssignment,
  bulkAlertAssignMessage,
  bulkRowForm,
  initialAlertAssignForm,
  planBulkAlertAssign,
  validateAlertAssign,
  validateBulkAlertAssign,
  type AlertAssignForm,
} from './assign';

const ctx = { by: 'Trưởng ca', at: new Date('2026-10-27T03:52:10Z') };
const alert = (patch: Partial<AlertRecord> = {}): AlertRecord => ({
  id: 'A1',
  code: 'A1',
  daysAgo: 0,
  time: '10:45:22',
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
const form = (patch: Partial<AlertAssignForm> = {}): AlertAssignForm => ({ assignee: null, collaborators: [], note: '', notify: false, reason: '', ...patch });

describe('form mặc định', () => {
  test('một cảnh báo: chọn sẵn người hiện tại + người phối hợp; tick thông báo chỉ khi Nghiêm trọng', () => {
    expect(initialAlertAssignForm([alert()])).toEqual(form({ notify: true }));
    expect(initialAlertAssignForm([alert({ severity: 'high', assignee: 'Lê Thị C', collaborators: ['Trần Bình'] })])).toEqual(
      form({ assignee: 'Lê Thị C', collaborators: ['Trần Bình'], notify: false }),
    );
  });
  test('hàng loạt: không chọn sẵn; tick khi có ít nhất một Nghiêm trọng', () => {
    expect(initialAlertAssignForm([alert({ id: 'x', assignee: 'Lê Thị C', severity: 'low' }), alert({ id: 'y', severity: 'medium' })])).toEqual(form());
    expect(initialAlertAssignForm([alert({ id: 'x', severity: 'low' }), alert({ id: 'y' })]).notify).toBe(true);
  });
});

describe('một cảnh báo', () => {
  test('chặn khi chưa chọn người; phân công KHÔNG tự xác nhận', () => {
    expect(validateAlertAssign(alert(), form()).map((i) => i.id)).toEqual(['assignee']);
    const r = applyAlertAssignment(alert(), form({ assignee: 'Trần Bình', collaborators: ['Lê Thị C', 'Trần Bình', ' '] }), ctx);
    expect(r).toMatchObject({ status: 'unacknowledged', assignee: 'Trần Bình', collaborators: ['Lê Thị C'] });
    expect(r.acknowledgedAt).toBeUndefined();
    expect(r.history!.at(-1)).toMatchObject({ kind: 'assign', text: 'Phân công xử lý cho Trần Bình · phối hợp: Lê Thị C', actor: 'Trưởng ca' });
  });

  test('ghi chú chỉ đạo → ghi chú xử lý "Chỉ đạo: …" + lịch sử nhắc tới', () => {
    const r = applyAlertAssignment(alert(), form({ assignee: 'Trần Bình', note: '  Kiểm tra van PSV-101 trước  ' }), ctx);
    expect(r.notes).toEqual([{ id: 'A1-n1', author: 'Trưởng ca', at: ctx.at.toISOString(), text: 'Chỉ đạo: Kiểm tra van PSV-101 trước' }]);
    expect(r.history!.at(-1)!.text).toBe('Phân công xử lý cho Trần Bình · kèm ghi chú chỉ đạo');
    expect(r.history).toHaveLength(1);
  });

  test('đổi người: bắt buộc lý do, giữ trạng thái, lịch sử có lý do', () => {
    const a = alert({ status: 'in-progress', assignee: 'Nguyễn Văn A' });
    expect(alertAssignChange(a, form({ assignee: 'Trần Bình' }))).toBe('reassign');
    expect(validateAlertAssign(a, form({ assignee: 'Trần Bình', reason: '  ' })).map((i) => i.id)).toEqual(['reason']);
    expect(applyAlertAssignment(a, form({ assignee: 'Trần Bình' }), ctx)).toBe(a);
    const r = applyAlertAssignment(a, form({ assignee: 'Trần Bình', reason: 'Hết ca' }), ctx);
    expect(r).toMatchObject({ status: 'in-progress', assignee: 'Trần Bình' });
    expect(r.history!.at(-1)!.text).toBe('Đổi người xử lý: Nguyễn Văn A → Trần Bình – lý do: Hết ca');
  });

  test('giữ nguyên người, sửa phối hợp/ghi chú → "Cập nhật phân công", không bắt lý do; không đổi gì → chặn', () => {
    const a = alert({ assignee: 'Nguyễn Văn A', collaborators: ['Lê Thị C'] });
    expect(validateAlertAssign(a, form({ assignee: 'Nguyễn Văn A', collaborators: ['Lê Thị C'] })).map((i) => i.id)).toEqual(['unchanged']);
    expect(alertAssignChange(a, form({ assignee: 'Nguyễn Văn A', collaborators: [] }))).toBe('update');
    const r = applyAlertAssignment(a, form({ assignee: 'Nguyễn Văn A', collaborators: [] }), ctx);
    expect(r.collaborators).toBeUndefined();
    expect(r.history!.at(-1)!.text).toBe('Cập nhật phân công (Nguyễn Văn A) · phối hợp: không');
    expect(applyAlertAssignment(a, form({ assignee: 'Nguyễn Văn A', collaborators: ['Lê Thị C'], note: 'Ưu tiên' }), ctx).history!.at(-1)!.text).toBe(
      'Cập nhật phân công (Nguyễn Văn A) · kèm ghi chú chỉ đạo',
    );
  });

  test('đã hoàn thành → chặn, trả nguyên bản ghi', () => {
    const a = alert({ status: 'done', assignee: 'Lê Thị C' });
    expect(validateAlertAssign(a, form({ assignee: 'Trần Bình', reason: 'x' })).map((i) => i.id)).toEqual(['status']);
    expect(applyAlertAssignment(a, form({ assignee: 'Trần Bình', reason: 'x' }), ctx)).toBe(a);
  });

  test('chạy lại hai lần: lịch sử/ghi chú tăng đúng một mỗi lần', () => {
    const once = applyAlertAssignment(alert(), form({ assignee: 'Trần Bình', note: 'a' }), ctx);
    const twice = applyAlertAssignment(once, form({ assignee: 'Trần Bình', note: 'b' }), ctx);
    expect(twice.history).toHaveLength(2);
    expect(twice.notes!.map((n) => n.id)).toEqual(['A1-n1', 'A1-n2']);
  });
});

describe('hàng loạt', () => {
  const rows = [
    alert({ id: 'a', code: 'ALT-a' }),
    alert({ id: 'b', code: 'ALT-b', assignee: 'Lê Thị C', status: 'in-progress' }),
    alert({ id: 'c', code: 'ALT-c', assignee: 'Trần Bình' }),
    alert({ id: 'd', code: 'ALT-d', status: 'done', assignee: 'Lê Thị C' }),
  ];

  test('tách: phân công / đổi người / bỏ qua (hoàn thành, đúng người, không còn)', () => {
    const p = planBulkAlertAssign(rows, ['a', 'b', 'c', 'd', 'zz'], 'Trần Bình');
    expect(p.assign.map((a) => a.id)).toEqual(['a']);
    expect(p.reassign.map((a) => a.id)).toEqual(['b']);
    expect(p.skippedSame.map((a) => a.id)).toEqual(['c']);
    expect(p.skippedDone.map((a) => a.id)).toEqual(['d']);
    expect(p.missing).toBe(1);
    expect(bulkAlertAssignMessage(p)).toBe('Đã phân công 2 (đổi người 1) · bỏ qua 3 (1 đã hoàn thành, 1 đã giao đúng người, 1 không còn tồn tại)');
  });

  test('chưa chọn người: dòng có người khác chưa coi là "đúng người"', () => {
    const p = planBulkAlertAssign(rows, ['b', 'c'], null);
    expect(p.reassign.map((a) => a.id)).toEqual(['b', 'c']);
    expect(validateBulkAlertAssign(p, form()).map((i) => i.id)).toEqual(['assignee']);
  });

  test('có dòng đổi người → bắt buộc MỘT lý do chung; không còn dòng nào → chặn', () => {
    const p = planBulkAlertAssign(rows, ['a', 'b'], 'Trần Bình');
    expect(validateBulkAlertAssign(p, form({ assignee: 'Trần Bình' })).map((i) => i.id)).toEqual(['reason']);
    expect(validateBulkAlertAssign(p, form({ assignee: 'Trần Bình', reason: 'Gom việc' }))).toEqual([]);
    const none = planBulkAlertAssign(rows, ['c', 'd'], 'Trần Bình');
    expect(validateBulkAlertAssign(none, form({ assignee: 'Trần Bình' })).map((i) => i.id)).toEqual(['none-eligible']);
    expect(bulkAlertAssignMessage(none)).toBe('Đã phân công 0 · bỏ qua 2 (1 đã hoàn thành, 1 đã giao đúng người)');
  });

  test('áp từng dòng: gộp người phối hợp cũ, không tự xác nhận', () => {
    const b = alert({ id: 'b', assignee: 'Lê Thị C', status: 'in-progress', collaborators: ['Võ Thị F'] });
    const r = applyAlertAssignment(b, bulkRowForm(b, form({ assignee: 'Trần Bình', collaborators: ['Phạm Văn D'], reason: 'Gom việc' })), ctx);
    expect(r).toMatchObject({ status: 'in-progress', assignee: 'Trần Bình', collaborators: ['Võ Thị F', 'Phạm Văn D'] });
    const a = applyAlertAssignment(rows[0]!, bulkRowForm(rows[0]!, form({ assignee: 'Trần Bình' })), ctx);
    expect(a.status).toBe('unacknowledged');
  });
});
