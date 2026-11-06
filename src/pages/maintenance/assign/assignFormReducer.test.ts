import { describe, expect, test } from 'vitest';
import type { AssignForm } from '@/features/maintenance/assign';
import { assignFormReducer, type AssignFormState } from './assignFormReducer';

const form: AssignForm = { assignee: null, collaborators: ['Nguyễn Văn A', 'Võ Thị F'], startAt: '', dueAt: '2099-10-26T16:00', shift: null, note: '', notify: true, reason: '' };
const s0 = (over: Partial<AssignFormState> = {}): AssignFormState => ({ form, shiftTouched: false, query: '', dept: null, shiftFilter: null, error: '', ...over });

describe('assignFormReducer', () => {
  test('set: đổi trường + bỏ lỗi', () => {
    expect(assignFormReducer(s0({ error: 'x' }), { type: 'set', patch: { note: 'a' } })).toMatchObject({ form: { note: 'a' }, error: '' });
  });
  test('assignee: bỏ khỏi người phối hợp; chưa chọn ca → ca mặc định của người; đã chọn ca → giữ', () => {
    const a = assignFormReducer(s0({ error: 'x' }), { type: 'assignee', name: 'Nguyễn Văn A' });
    expect(a.form).toMatchObject({ assignee: 'Nguyễn Văn A', collaborators: ['Võ Thị F'], shift: 'shift-2' });
    expect(a.error).toBe('');
    const touched = assignFormReducer(s0(), { type: 'shift', shift: 'shift-3' });
    expect(touched.shiftTouched).toBe(true);
    expect(assignFormReducer(touched, { type: 'assignee', name: 'Nguyễn Văn A' }).form.shift).toBe('shift-3');
    expect(assignFormReducer(s0(), { type: 'assignee', name: 'Người lạ' }).form.shift).toBeNull();
  });
  test('bộ lọc: đổi / xoá không đụng form và lỗi', () => {
    const f = assignFormReducer(assignFormReducer(s0({ error: 'x' }), { type: 'query', value: 'điện' }), { type: 'dept', value: 'Bảo trì Điện' });
    expect(f).toMatchObject({ query: 'điện', dept: 'Bảo trì Điện', error: 'x', form });
    expect(assignFormReducer(assignFormReducer(f, { type: 'shift-filter', value: 'shift-1' }), { type: 'clear-filters' })).toMatchObject({ query: '', dept: null, shiftFilter: null });
  });
  test('error ghi lỗi', () => {
    expect(assignFormReducer(s0(), { type: 'error', text: 'mạng' }).error).toBe('mạng');
  });
});
