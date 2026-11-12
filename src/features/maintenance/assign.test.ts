import { describe, expect, test } from 'vitest';
import type { MaintenanceRecord } from '@/features/maintenance/types';
import {
  applyAssignment,
  assignWarnings,
  bulkAssignMessage,
  computeWorkloads,
  initialAssignForm,
  planBulkAssign,
  validateAssign,
  type StaffLookup,
} from './assign';

const rec = (id: string, patch: Partial<MaintenanceRecord> = {}): MaintenanceRecord => ({
  id,
  code: id,
  title: 'Kiểm tra van',
  device: 'V-101',
  area: 'Khu bồn LPG',
  type: 'inspection',
  priority: 'high',
  status: 'pending',
  assignee: null,
  createdAt: '2026-10-26',
  dueAt: '2026-10-27T16:00',
  completedAt: null,
  progress: 0,
  ...patch,
});

// 11:45 ngày 26/10 giờ nhà máy.
const NOW = new Date('2026-10-26T04:45:00Z');
const ctx = { actor: 'Trưởng ca', now: NOW };
const staffOf: StaffLookup = (name) => (name === 'Nguyễn Văn A' ? { defaultShift: 'shift-1', department: 'Bảo trì Cơ khí' } : undefined);

describe('tải việc', () => {
  test('chỉ đếm Đã phân công + Đang thực hiện của người chính; Bận từ 3 việc; quá hạn theo giờ hạn', () => {
    const w = computeWorkloads(
      [
        rec('1', { status: 'assigned', assignee: 'A' }),
        rec('2', { status: 'in-progress', assignee: 'A', dueAt: '2026-10-26T09:00' }),
        rec('3', { status: 'in-progress', assignee: 'A' }),
        rec('4', { status: 'review', assignee: 'A' }),
        rec('5', { status: 'assigned', assignee: 'B' }),
      ],
      NOW,
    );
    expect(w.get('A')).toEqual({ active: 3, overdue: 1, busy: true });
    expect(w.get('B')).toEqual({ active: 1, overdue: 0, busy: false });
  });
});

describe('phân công một yêu cầu', () => {
  test('lỗi chặn: người chính, hạn, hạn trước giờ bắt đầu, lý do khi đổi người', () => {
    const f = { ...initialAssignForm(rec('1')), assignee: null, dueAt: '' };
    expect(validateAssign(rec('1'), f).map((i) => i.id)).toEqual(['assignee', 'due']);
    const early = { ...initialAssignForm(rec('1')), assignee: 'A', startAt: '2026-10-28T08:00' };
    expect(validateAssign(rec('1'), early).map((i) => i.id)).toEqual(['due-before-start']);
    const reassign = rec('1', { status: 'in-progress', assignee: 'A' });
    expect(validateAssign(reassign, { ...initialAssignForm(reassign), assignee: 'B' }).map((i) => i.id)).toEqual(['reason']);
    expect(validateAssign(rec('1', { status: 'done' }), initialAssignForm(rec('1'))).map((i) => i.id)).toContain('status');
  });

  test('cảnh báo không chặn: người Bận / có việc quá hạn, hạn đã qua', () => {
    const w = computeWorkloads(
      [1, 2, 3].map((i) => rec(`x${i}`, { status: 'assigned', assignee: 'A', dueAt: '2026-10-25T08:00' })),
      NOW,
    );
    const f = { ...initialAssignForm(rec('1')), assignee: 'A', dueAt: '2026-10-26T09:00' };
    expect(assignWarnings(f, w, NOW, staffOf).map((x) => x.id)).toEqual(['busy', 'overdue', 'past-due']);
  });

  test('phân công mới: Chờ tiếp nhận → Đã phân công, phòng ban theo người chính, bỏ người chính khỏi phối hợp', () => {
    const f = { ...initialAssignForm(rec('1')), assignee: 'Nguyễn Văn A', collaborators: ['Nguyễn Văn A', 'Lê C'], note: 'Mang gioăng' };
    const r = applyAssignment(rec('1'), f, ctx, staffOf);
    expect(r).toMatchObject({
      status: 'assigned',
      assignee: 'Nguyễn Văn A',
      department: 'Bảo trì Cơ khí',
      collaborators: ['Lê C'],
      dueHasTime: true,
    });
    expect(r.history?.at(-1)).toMatchObject({ kind: 'assign', text: 'Phân công: Nguyễn Văn A · phối hợp: Lê C' });
    expect(r.notes?.at(-1)?.text).toBe('Phân công: Mang gioăng');
  });

  test('đổi người: giữ trạng thái, lịch sử ghi người cũ → mới + lý do', () => {
    const cur = rec('1', { status: 'in-progress', assignee: 'B', progress: 40 });
    const r = applyAssignment(cur, { ...initialAssignForm(cur), assignee: 'Nguyễn Văn A', reason: 'B nghỉ ốm' }, ctx, staffOf);
    expect(r).toMatchObject({ status: 'in-progress', progress: 40, assignee: 'Nguyễn Văn A' });
    expect(r.history?.at(-1)).toMatchObject({ kind: 'reassign', text: 'Đổi người xử lý: B → Nguyễn Văn A – lý do: B nghỉ ốm' });
  });

  test('không hợp lệ → trả nguyên bản ghi', () => {
    const r = rec('1');
    expect(applyAssignment(r, initialAssignForm(r), ctx, staffOf)).toBe(r);
  });
});

describe('phân công hàng loạt', () => {
  test('chỉ dòng Chờ tiếp nhận hợp lệ; đếm lý do bỏ qua; cảnh báo người sẽ thành Bận', () => {
    const rows = [
      rec('1'),
      rec('2'),
      rec('3', { status: 'assigned', assignee: 'B' }),
      rec('4', { startAt: '2026-10-28T08:00' }), // hạn trước giờ bắt đầu
    ];
    const w = computeWorkloads([rec('x', { status: 'assigned', assignee: 'A' })], NOW);
    const plan = planBulkAssign(rows, 'A', w);
    expect(plan).toMatchObject({ ids: ['1', '2'], skipped: 2, skippedBy: { status: 1, due: 0, other: 1 }, busyAfter: true, activeAfter: 3 });
    expect(bulkAssignMessage(2, plan.skippedBy)).toBe('Đã phân công 2 · bỏ qua 2 (1 không ở Chờ tiếp nhận, 1 hạn sớm hơn giờ bắt đầu)');
  });
});
