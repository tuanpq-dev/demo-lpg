import { describe, expect, test } from 'vitest';
import type { MaintenanceRecord, MaintenanceStatus } from '@/mocks/maintenance';
import {
  NEXT_ACTION_LABEL,
  WORKFLOW_STEPS,
  addNoteRecord,
  advanceRecord,
  assignRecord,
  canCancel,
  canTransition,
  cancelRecord,
  workflowPosition,
} from './workflow';

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
const ctx = { actor: 'Lê Thị C', now: NOW };
const ALL: MaintenanceStatus[] = ['pending', 'assigned', 'in-progress', 'review', 'done', 'cancelled'];

describe('canTransition – không nhảy bước', () => {
  test('chỉ bước kế tiếp hợp lệ', () => {
    expect(canTransition('pending', 'assigned')).toBe(true);
    expect(canTransition('assigned', 'in-progress')).toBe(true);
    expect(canTransition('in-progress', 'review')).toBe(true);
    expect(canTransition('review', 'done')).toBe(true);
  });
  test('nhảy bước / lùi bước / đứng yên đều bị chặn', () => {
    expect(canTransition('pending', 'in-progress')).toBe(false);
    expect(canTransition('pending', 'done')).toBe(false);
    expect(canTransition('review', 'in-progress')).toBe(false);
    expect(canTransition('assigned', 'assigned')).toBe(false);
    for (const to of ALL) expect(canTransition('done', to)).toBe(false);
    for (const to of ALL) expect(canTransition('cancelled', to)).toBe(false);
  });
  test('hủy chỉ khi chưa hoàn thành / chưa hủy', () => {
    expect(['pending', 'assigned', 'in-progress', 'review'].every((s) => canTransition(s as MaintenanceStatus, 'cancelled'))).toBe(true);
    expect(canCancel('done')).toBe(false);
    expect(canCancel('cancelled')).toBe(false);
  });
  test('nhãn nút chính theo trạng thái', () => {
    expect(NEXT_ACTION_LABEL.pending).toBe('Tiếp nhận ngay');
    expect(NEXT_ACTION_LABEL.assigned).toBe('Bắt đầu thực hiện');
    expect(NEXT_ACTION_LABEL['in-progress']).toBe('Chuyển nghiệm thu');
    expect(NEXT_ACTION_LABEL.review).toBe('Nghiệm thu đạt');
    expect(NEXT_ACTION_LABEL.done).toBeUndefined();
    expect(NEXT_ACTION_LABEL.cancelled).toBeUndefined();
  });
});

describe('advanceRecord', () => {
  test('"Tiếp nhận ngay": pending → assigned (bước 2), người nhận = người thao tác, thêm 1 dòng lịch sử', () => {
    const r = advanceRecord(rec({ history: [{ id: 'h1', at: '2026-10-26T08:30', kind: 'create', text: 'Tạo' }] }), ctx);
    expect(r.status).toBe('assigned');
    expect(r.assignee).toBe('Lê Thị C');
    expect(r.history).toHaveLength(2);
    expect(r.history!.at(-1)).toEqual({ id: 'h2', at: '2026-10-26T11:45', kind: 'accept', text: 'Tiếp nhận yêu cầu – phụ trách: Lê Thị C', actor: 'Lê Thị C' });
    expect(workflowPosition(r).current).toBe(2);
  });
  test('đã có người phụ trách → giữ người đó', () => {
    expect(advanceRecord(rec({ assignee: 'Trần Bình' }), ctx).assignee).toBe('Trần Bình');
  });
  test('đi đủ 4 bước, mỗi lần đúng một bước; hoàn thành ghi ngày giờ nhà máy', () => {
    let r = rec();
    const seen: MaintenanceStatus[] = [];
    for (let i = 0; i < 4; i++) {
      r = advanceRecord(r, ctx);
      seen.push(r.status);
    }
    expect(seen).toEqual(['assigned', 'in-progress', 'review', 'done']);
    expect(r.completedAt).toBe('2026-10-26');
    expect(r.history!.map((h) => h.kind)).toEqual(['accept', 'start', 'review', 'done']);
  });
  test('hoàn thành qua nửa đêm Bangkok (17:00 UTC) → ngày mới', () => {
    const r = advanceRecord(rec({ status: 'review' }), { actor: 'A', now: new Date('2026-10-26T17:00:00Z') });
    expect(r.completedAt).toBe('2026-10-27');
  });
  test('done / cancelled: không đổi (cùng tham chiếu)', () => {
    const done = rec({ status: 'done' });
    const cancelled = rec({ status: 'cancelled' });
    expect(advanceRecord(done, ctx)).toBe(done);
    expect(advanceRecord(cancelled, ctx)).toBe(cancelled);
  });
  test('không có checklist: bắt đầu ≥ 10%, nghiệm thu = 100%; có checklist: giữ tiến độ checklist', () => {
    expect(advanceRecord(rec({ status: 'assigned', progress: 0 }), ctx).progress).toBe(10);
    expect(advanceRecord(rec({ status: 'in-progress', progress: 40 }), ctx).progress).toBe(100);
    const withList = rec({ status: 'in-progress', progress: 33, checklist: [{ id: 'a', text: 'x', done: true }, { id: 'b', text: 'y', done: false }] });
    expect(advanceRecord(withList, ctx).progress).toBe(33);
  });
});

describe('cancelRecord', () => {
  test('ghi bước đã tới + lý do vào lịch sử', () => {
    const r = cancelRecord(rec({ status: 'in-progress' }), { ...ctx, reason: '  Trùng yêu cầu MT-00127 ' });
    expect(r.status).toBe('cancelled');
    expect(r.cancelledFrom).toBe('in-progress');
    expect(r.cancelReason).toBe('Trùng yêu cầu MT-00127');
    expect(r.history!.at(-1)!.text).toBe('Hủy yêu cầu – lý do: Trùng yêu cầu MT-00127');
  });
  test('lý do trống/khoảng trắng → không lý do', () => {
    const r = cancelRecord(rec(), { ...ctx, reason: '   ' });
    expect(r.cancelReason).toBeUndefined();
    expect(r.history!.at(-1)!.text).toBe('Hủy yêu cầu');
  });
  test('đã hoàn thành / đã hủy → không đổi; hủy hai lần chỉ một dòng lịch sử', () => {
    const done = rec({ status: 'done' });
    expect(cancelRecord(done, ctx)).toBe(done);
    const once = cancelRecord(rec(), ctx);
    expect(cancelRecord(once, ctx)).toBe(once);
    expect(once.history).toHaveLength(1);
  });
});

describe('workflowPosition – stepper', () => {
  test('pending: bước 1 ✓, đang chờ bước 2 (Tiếp nhận)', () => {
    expect(workflowPosition(rec())).toEqual({ completed: 1, current: 1, cancelled: false });
    expect(WORKFLOW_STEPS[1]!.label).toBe('Tiếp nhận');
  });
  test('done: đủ 5 bước, không còn bước chờ', () => {
    expect(workflowPosition(rec({ status: 'done' }))).toEqual({ completed: 5, current: null, cancelled: false });
  });
  test('cancelled: dừng ở bước đã tới; thiếu cancelledFrom → bước 1', () => {
    expect(workflowPosition(rec({ status: 'cancelled', cancelledFrom: 'in-progress' }))).toEqual({ completed: 3, current: null, cancelled: true });
    expect(workflowPosition(rec({ status: 'cancelled' }))).toEqual({ completed: 1, current: null, cancelled: true });
  });
});

describe('assignRecord / addNoteRecord', () => {
  test('phân công: pending → assigned + phòng ban/ca; bước sau giữ trạng thái', () => {
    const r = assignRecord(rec(), { assignee: 'Trần Bình', department: 'Bảo trì Cơ khí', shift: 'shift-2' }, ctx);
    expect(r).toMatchObject({ status: 'assigned', assignee: 'Trần Bình', department: 'Bảo trì Cơ khí', shift: 'shift-2' });
    expect(r.history!.at(-1)!.kind).toBe('assign');
    expect(assignRecord(rec({ status: 'in-progress' }), { assignee: 'Trần Bình' }, ctx).status).toBe('in-progress');
  });
  test('phân công: tên trống / đã xong / đã hủy → không đổi', () => {
    const r = rec();
    expect(assignRecord(r, { assignee: '  ' }, ctx)).toBe(r);
    const done = rec({ status: 'done' });
    expect(assignRecord(done, { assignee: 'A' }, ctx)).toBe(done);
  });
  test('ghi chú: thêm cuối luồng, giờ nhà máy; trống → không đổi', () => {
    const r = addNoteRecord(rec({ notes: [{ id: 'n1', author: 'A', at: '2026-10-26T10:50', text: 'cũ' }] }), '  Đã siêu âm xong ', ctx);
    expect(r.notes!.at(-1)).toEqual({ id: 'n2', author: 'Lê Thị C', at: '2026-10-26T11:45', text: 'Đã siêu âm xong' });
    const same = rec();
    expect(addNoteRecord(same, '   ', ctx)).toBe(same);
  });
});
