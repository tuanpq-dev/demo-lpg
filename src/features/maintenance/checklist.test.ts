import { describe, expect, test } from 'vitest';
import type { MaintenanceChecklistItem } from '@/features/maintenance/types';
import { checklistLock, checklistProgress, toggleChecklistItem } from './checklist';

const item = (id: string, patch: Partial<MaintenanceChecklistItem> = {}): MaintenanceChecklistItem => ({ id, text: id, done: false, ...patch });

describe('checklistProgress – bỏ qua mục Không áp dụng', () => {
  test('ảnh MT-00128: 2 xong, 4 chưa, 1 N/A → 2/6 · 33%', () => {
    const items = [item('1', { done: true }), item('2', { done: true }), item('3'), item('4'), item('5'), item('6'), item('7', { na: true })];
    expect(checklistProgress(items)).toEqual({ done: 2, total: 6, percent: 33 });
  });
  test('rỗng / undefined / toàn N/A → 0/0 · 0%', () => {
    expect(checklistProgress([])).toEqual({ done: 0, total: 0, percent: 0 });
    expect(checklistProgress(undefined)).toEqual({ done: 0, total: 0, percent: 0 });
    expect(checklistProgress([item('a', { na: true })])).toEqual({ done: 0, total: 0, percent: 0 });
  });
  test('mục N/A có done = true vẫn không tính', () => {
    expect(checklistProgress([item('a', { done: true, na: true }), item('b')])).toEqual({ done: 0, total: 1, percent: 0 });
  });
  test('xong hết → 100%', () => {
    expect(checklistProgress([item('a', { done: true }), item('b', { done: true })]).percent).toBe(100);
  });
});

describe('checklistLock', () => {
  test('chỉ tick khi Đã phân công / Đang thực hiện', () => {
    expect(checklistLock('assigned')).toBeNull();
    expect(checklistLock('in-progress')).toBeNull();
    expect(checklistLock('pending')).toBe('pending');
    expect(checklistLock('review')).toBe('readonly');
    expect(checklistLock('done')).toBe('readonly');
    expect(checklistLock('cancelled')).toBe('readonly');
  });
});

describe('toggleChecklistItem', () => {
  const NOW = new Date('2026-10-26T03:15:00Z'); // 10:15 giờ nhà máy
  test('tick: ghi giờ nhà máy + bỏ "Đang làm"', () => {
    const [a] = toggleChecklistItem([item('a', { active: true })], 'a', NOW);
    expect(a).toEqual({ id: 'a', text: 'a', done: true, doneAt: '2026-10-26T10:15' });
  });
  test('bỏ tick: xoá giờ; tick lại hai lần quay về như cũ', () => {
    const once = toggleChecklistItem([item('a')], 'a', NOW);
    expect(toggleChecklistItem(once, 'a', NOW)).toEqual([item('a')]);
  });
  test('mục N/A và id lạ: không đổi', () => {
    const items = [item('a', { na: true }), item('b')];
    expect(toggleChecklistItem(items, 'a', NOW)).toEqual(items);
    expect(toggleChecklistItem(items, 'zzz', NOW)).toEqual(items);
  });
  test('tick 23:59 → ngày đó; 00:00 Bangkok → ngày sau (không theo múi giờ máy)', () => {
    expect(toggleChecklistItem([item('a')], 'a', new Date('2026-10-26T16:59:00Z'))[0]!.doneAt).toBe('2026-10-26T23:59');
    expect(toggleChecklistItem([item('a')], 'a', new Date('2026-10-26T17:00:00Z'))[0]!.doneAt).toBe('2026-10-27T00:00');
  });
});
