import { describe, expect, test } from 'vitest';
import { ASSIGNABLE_STAFF, REVIEWERS, STAFF, maintenanceRecords, staffByName } from '@/mocks/maintenance';
import type { MaintenanceRecord, MaintenanceStatus } from '@/features/maintenance/types';
import {
  BUSY_THRESHOLD,
  applyAssignment,
  bulkAssignMessage,
  assignMode,
  assignWarnings,
  computeWorkloads,
  countUnassignableOwners,
  inShift,
  initialAssignForm,
  planBulkAssign,
  validateAssign,
  workloadLabel,
  workloadOf,
  type AssignForm,
} from './assign';

const rec = (patch: Partial<MaintenanceRecord> = {}): MaintenanceRecord => ({
  id: 'MT-1',
  code: 'MT-1',
  title: 'Kiểm tra van',
  device: 'V-101',
  area: 'Khu bồn LPG',
  type: 'inspection',
  priority: 'critical',
  status: 'pending',
  assignee: null,
  createdAt: '2026-10-26',
  dueAt: '2026-10-26T16:00',
  completedAt: null,
  progress: 0,
  ...patch,
});
// 11:45 ngày 26/10 giờ nhà máy.
const NOW = new Date('2026-10-26T04:45:00Z');
const ctx = { actor: 'Admin', now: NOW };
const form = (r: MaintenanceRecord, patch: Partial<AssignForm> = {}): AssignForm => ({ ...initialAssignForm(r), ...patch });
const ALL: MaintenanceStatus[] = ['pending', 'assigned', 'in-progress', 'review', 'done', 'cancelled'];

describe('nhân sự STAFF dùng chung', () => {
  test('phân công = technician + engineer (không có trưởng ca); nghiệm thu giữ danh sách cũ', () => {
    expect(ASSIGNABLE_STAFF.map((p) => p.name)).not.toContain('Hoàng Minh E');
    expect(ASSIGNABLE_STAFF.map((p) => p.name)).toContain('Nguyễn Văn A');
    expect(REVIEWERS.map((p) => p.name)).toEqual(['Trần Hoàng Nam', 'Trần Văn B', 'Hoàng Minh E', 'Nguyễn Văn A']);
    expect(staffByName('Hoàng Minh E')?.title).toBe('Trưởng ca vận hành'); // tra toàn bộ STAFF
    expect(new Set(STAFF.map((p) => p.id)).size).toBe(STAFF.length);
  });

  test('đếm bản ghi còn mở giao cho người không còn chọn được (mock hiện tại: 0)', () => {
    expect(countUnassignableOwners(maintenanceRecords, ASSIGNABLE_STAFF)).toBe(0);
    const rows = [
      rec({ status: 'assigned', assignee: 'Hoàng Minh E' }),
      rec({ status: 'done', assignee: 'Hoàng Minh E' }),
      rec({ status: 'in-progress', assignee: 'Người lạ' }),
    ];
    expect(countUnassignableOwners(rows, ASSIGNABLE_STAFF)).toBe(2);
  });
});

describe('tải việc: đang làm / quá hạn / Bận', () => {
  test('chỉ Đã phân công + Đang thực hiện, chỉ người xử lý chính; quá hạn theo giờ', () => {
    const rows = [
      rec({ id: 'a', status: 'assigned', assignee: 'A', dueAt: '2026-10-26T10:00' }), // quá hạn (11:45)
      rec({ id: 'b', status: 'in-progress', assignee: 'A', collaborators: ['B'] }),
      rec({ id: 'c', status: 'review', assignee: 'A' }), // không tính
      rec({ id: 'd', status: 'done', assignee: 'A' }),
      rec({ id: 'e', status: 'pending', assignee: 'A' }),
      rec({ id: 'f', status: 'in-progress', assignee: 'B', dueAt: '2026-10-25', dueHasTime: false }), // hạn chỉ ngày, đã qua
    ];
    const map = computeWorkloads(rows, NOW);
    expect(workloadOf(map, 'A')).toEqual({ active: 2, overdue: 1, busy: false });
    expect(workloadOf(map, 'B')).toEqual({ active: 1, overdue: 1, busy: false }); // người phối hợp không tính
    expect(workloadOf(map, 'C')).toEqual({ active: 0, overdue: 0, busy: false });
    expect(workloadOf(map, null)).toEqual({ active: 0, overdue: 0, busy: false });
    expect(workloadLabel(workloadOf(map, 'A'))).toBe('2 đang làm (1 quá hạn)');
    expect(workloadLabel(workloadOf(map, 'C'))).toBe('0 đang làm');
  });

  test(`Bận khi đang làm ≥ ${BUSY_THRESHOLD} (ranh giới)`, () => {
    const mk = (n: number) =>
      Array.from({ length: n }, (_, i) => rec({ id: `x${i}`, status: 'in-progress', assignee: 'A', dueAt: '2099-01-01T08:00' }));
    expect(workloadOf(computeWorkloads(mk(BUSY_THRESHOLD - 1), NOW), 'A').busy).toBe(false);
    expect(workloadOf(computeWorkloads(mk(BUSY_THRESHOLD), NOW), 'A').busy).toBe(true);
    expect(computeWorkloads([], NOW).size).toBe(0);
  });
});

describe('kiểm tra (chặn) + cảnh báo (không chặn)', () => {
  test('mặc định: phân công mới KHÔNG chọn sẵn ai; đổi người điền người hiện tại', () => {
    expect(initialAssignForm(rec()).assignee).toBeNull();
    expect(initialAssignForm(rec({ status: 'assigned', assignee: 'Trần Bình' })).assignee).toBe('Trần Bình');
    expect(initialAssignForm(rec({ dueAt: '2026-10-28', dueHasTime: false })).dueAt).toBe('2026-10-28T23:59');
  });

  test('chặn: thiếu người chính, thiếu hạn, hạn < bắt đầu; đổi người thiếu lý do', () => {
    const r = rec();
    expect(validateAssign(r, form(r)).map((x) => x.id)).toEqual(['assignee']);
    expect(validateAssign(r, form(r, { assignee: 'Trần Bình', dueAt: '' })).map((x) => x.id)).toEqual(['due']);
    expect(validateAssign(r, form(r, { assignee: 'Trần Bình', startAt: '2026-10-26T17:00' })).map((x) => x.id)).toEqual(['due-before-start']);
    expect(validateAssign(r, form(r, { assignee: 'Trần Bình', startAt: '2026-10-26T16:00' }))).toEqual([]); // bằng nhau được
    const a = rec({ status: 'in-progress', assignee: 'Trần Bình' });
    expect(validateAssign(a, form(a, { assignee: 'Lê Thị C' })).map((x) => x.id)).toEqual(['reason']);
    expect(validateAssign(a, form(a, { assignee: 'Lê Thị C', reason: '  ' })).map((x) => x.id)).toEqual(['reason']);
  });

  test('chỉ Chờ tiếp nhận (phân công) và Đã phân công / Đang thực hiện (đổi người)', () => {
    expect(ALL.map(assignMode)).toEqual(['assign', 'reassign', 'reassign', null, null, null]);
    for (const s of ['review', 'done', 'cancelled'] as const) {
      const r = rec({ status: s, assignee: 'A' });
      expect(validateAssign(r, form(r, { assignee: 'B', reason: 'x' })).map((x) => x.id)).toContain('status');
      expect(applyAssignment(r, form(r, { assignee: 'B', reason: 'x' }), ctx, staffByName)).toBe(r);
    }
  });

  test('cảnh báo: Bận, có việc quá hạn, ca không khớp giờ bắt đầu, hạn đã qua', () => {
    const rows = Array.from({ length: 3 }, (_, i) =>
      rec({ id: `x${i}`, status: 'in-progress', assignee: 'Trần Bình', dueAt: i ? '2099-01-01T08:00' : '2026-10-25T08:00' }),
    );
    const map = computeWorkloads(rows, NOW);
    const r = rec();
    const ids = (f: AssignForm) => assignWarnings(f, map, NOW, staffByName).map((w) => w.id);
    expect(ids(form(r, { assignee: 'Trần Bình' }))).toEqual(['busy', 'overdue']);
    expect(ids(form(r, { assignee: 'Lê Thị C', shift: 'shift-1', startAt: '2026-10-26T15:00' }))).toEqual(['shift']);
    // gợi ý đổi sang ca mặc định của người được chọn (Lê Thị C: Ca 2); trùng ca hoặc chưa chọn người → không gợi ý
    expect(assignWarnings(form(r, { assignee: 'Lê Thị C', shift: 'shift-1', startAt: '2026-10-26T15:00' }), map, NOW, staffByName)[0]).toMatchObject({
      suggestShift: 'shift-2',
    });
    expect(
      assignWarnings(form(r, { assignee: 'Lê Thị C', shift: 'shift-2', startAt: '2026-10-26T23:00' }), map, NOW, staffByName)[0]!.suggestShift,
    ).toBeUndefined();
    expect(
      assignWarnings(form(r, { assignee: null, shift: 'shift-1', startAt: '2026-10-26T15:00' }), map, NOW, staffByName)[0]!.suggestShift,
    ).toBeUndefined();
    expect(ids(form(r, { assignee: 'Lê Thị C', shift: 'shift-2', startAt: '2026-10-26T15:00' }))).toEqual([]);
    expect(ids(form(r, { assignee: 'Lê Thị C', dueAt: '2026-10-26T11:00' }))).toEqual(['past-due']);
    // cảnh báo không chặn
    expect(validateAssign(r, form(r, { assignee: 'Trần Bình' }))).toEqual([]);
  });

  test('inShift: ca 3 qua nửa đêm; ranh giới giờ bắt đầu/kết thúc ca', () => {
    expect(inShift('2026-10-26T06:00', 'shift-1')).toBe(true);
    expect(inShift('2026-10-26T14:00', 'shift-1')).toBe(false);
    expect(inShift('2026-10-26T23:30', 'shift-3')).toBe(true);
    expect(inShift('2026-10-27T05:59', 'shift-3')).toBe(true);
    expect(inShift('2026-10-27T06:00', 'shift-3')).toBe(false);
  });
});

describe('applyAssignment', () => {
  test('phân công mới: pending → assigned, đủ trường, phòng ban theo người chính, MỘT dòng lịch sử + ghi chú "Phân công"', () => {
    const r0 = rec({ history: [{ id: 'h1', at: 'x', kind: 'create', text: 'Tạo' }] });
    const r = applyAssignment(
      r0,
      form(r0, {
        assignee: 'Nguyễn Văn A',
        collaborators: ['Lê Thị C', 'Nguyễn Văn A', 'Lê Thị C'],
        startAt: '2026-10-26T14:00',
        dueAt: '2026-10-26T16:00',
        shift: 'shift-2',
        note: ' Ưu tiên kiểm tra rò ',
      }),
      ctx,
      staffByName,
    );
    expect(r).toMatchObject({
      status: 'assigned',
      assignee: 'Nguyễn Văn A',
      department: 'Bảo trì Cơ khí',
      shift: 'shift-2',
      startAt: '2026-10-26T14:00',
      dueAt: '2026-10-26T16:00',
      dueHasTime: true,
      collaborators: ['Lê Thị C'],
    });
    expect(r.history).toHaveLength(2);
    expect(r.history!.at(-1)).toMatchObject({ kind: 'assign', text: 'Phân công: Nguyễn Văn A · phối hợp: Lê Thị C', actor: 'Admin' });
    expect(r.notes!.at(-1)).toMatchObject({ author: 'Admin', text: 'Phân công: Ưu tiên kiểm tra rò' });
  });

  test('đổi hạn ghi vào lịch sử; không ghi chú → không thêm ghi chú; hạn chỉ ngày → có giờ', () => {
    const r0 = rec({ dueAt: '2026-10-28T23:59', dueHasTime: false });
    const r = applyAssignment(r0, form(r0, { assignee: 'Trần Bình', dueAt: '2026-10-27T10:00' }), ctx, staffByName);
    expect(r.history!.at(-1)!.text).toBe('Phân công: Trần Bình · hạn 10:00 27/10');
    expect(r.notes).toBeUndefined();
    expect(r.dueHasTime).toBe(true);
    expect('collaborators' in r).toBe(false);
  });

  test('đổi người khi Đang thực hiện: giữ trạng thái, tiến độ, cờ; lịch sử reassign có lý do', () => {
    const hold = { kind: 'paused' as const, reason: 'Chờ vật tư', at: '2026-10-26T09:00' };
    const r0 = rec({ status: 'in-progress', assignee: 'Trần Bình', reportedProgress: 45, progress: 33, hold, department: 'Bảo trì Cơ khí' });
    const r = applyAssignment(r0, form(r0, { assignee: 'Lê Thị C', reason: ' Trần Bình nghỉ phép ' }), ctx, staffByName);
    expect(r).toMatchObject({
      status: 'in-progress',
      assignee: 'Lê Thị C',
      reportedProgress: 45,
      progress: 33,
      hold,
      department: 'Đo lường – Tự động hóa',
    });
    expect(r.history!.at(-1)).toMatchObject({ kind: 'reassign', text: 'Đổi người xử lý: Trần Bình → Lê Thị C – lý do: Trần Bình nghỉ phép' });
  });

  test('chạy lại khi thiếu điều kiện → không đổi (cùng tham chiếu)', () => {
    const r = rec();
    expect(applyAssignment(r, form(r), ctx, staffByName)).toBe(r);
  });
});

describe('phân công hàng loạt', () => {
  test('chỉ Chờ tiếp nhận; bỏ qua dòng khác; cảnh báo Bận sau cả lô', () => {
    const rows = [
      rec({ id: 'p1' }),
      rec({ id: 'p2' }),
      rec({ id: 'p3', dueAt: '' }), // thiếu hạn → validateAssign chặn
      rec({ id: 'a1', status: 'assigned', assignee: 'Lê Thị C' }), // không đổi người hàng loạt
      rec({ id: 'r1', status: 'review', assignee: 'Lê Thị C' }),
    ];
    const map = computeWorkloads([rec({ id: 'w', status: 'in-progress', assignee: 'Trần Bình', dueAt: '2099-01-01T08:00' })], NOW);
    expect(planBulkAssign(rows, 'Trần Bình', map)).toEqual({
      ids: ['p1', 'p2'],
      skipped: 3,
      skippedBy: { status: 2, due: 1, other: 0 },
      busyAfter: true,
      activeAfter: 3,
    });
    const late = rec({ id: 'p4', startAt: '2026-10-26T17:00' }); // hạn 16:00 < bắt đầu
    expect(planBulkAssign([late], 'Võ Thị F', map).skippedBy).toEqual({ status: 0, due: 0, other: 1 });
    expect(planBulkAssign(rows.slice(0, 1), 'Võ Thị F', map)).toMatchObject({ ids: ['p1'], skipped: 0, busyAfter: false });
    expect(planBulkAssign([], 'Võ Thị F', map)).toMatchObject({ ids: [], skipped: 0 });
  });

  test('thông báo tách lý do bỏ qua (chỉ lý do có số > 0)', () => {
    expect(bulkAssignMessage(2, { status: 2, due: 1, other: 0 })).toBe('Đã phân công 2 · bỏ qua 3 (2 không ở Chờ tiếp nhận, 1 thiếu hạn)');
    expect(bulkAssignMessage(1, { status: 0, due: 0, other: 1 })).toBe('Đã phân công 1 · bỏ qua 1 (1 hạn sớm hơn giờ bắt đầu)');
    expect(bulkAssignMessage(3, { status: 0, due: 0, other: 0 })).toBe('Đã phân công 3');
    expect(bulkAssignMessage(0, { status: 1, due: 0, other: 0 })).toBe('Đã phân công 0 · bỏ qua 1 (1 không ở Chờ tiếp nhận)');
  });
});
