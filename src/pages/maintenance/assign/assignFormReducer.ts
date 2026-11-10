import { staffByName, type ShiftId } from '@/data/maintenance';
import type { AssignForm } from '@/features/maintenance/assign';

export type AssignFormState = {
  form: AssignForm;
  /** Đã chọn ca (tay / nút "Đổi sang Ca …" / nháp / bản ghi có ca) → chọn người không tự điền ca mặc định. */
  shiftTouched: boolean;
  /** Bộ lọc danh sách nhân sự (không thuộc form). */
  query: string;
  dept: string | null;
  shiftFilter: ShiftId | null;
  /** Lỗi lưu tạm / gửi (mạng, máy chủ). */
  error: string;
};

export type AssignFormAction =
  | { type: 'set'; patch: Partial<AssignForm> }
  | { type: 'assignee'; name: string | null }
  | { type: 'shift'; shift: ShiftId | null }
  | { type: 'query'; value: string }
  | { type: 'dept'; value: string | null }
  | { type: 'shift-filter'; value: ShiftId | null }
  | { type: 'clear-filters' }
  | { type: 'error'; text: string };

/**
 * Sửa giá trị form (kể cả chọn người, chọn ca) → bỏ lỗi. Chọn người chính: bỏ khỏi người phối hợp; chưa chọn ca → điền ca
 * mặc định của người đó. Bộ lọc danh sách không đổi form / lỗi.
 */
export function assignFormReducer(s: AssignFormState, a: AssignFormAction): AssignFormState {
  switch (a.type) {
    case 'set':
      return { ...s, form: { ...s.form, ...a.patch }, error: '' };
    case 'assignee': {
      const staff = staffByName(a.name);
      const cur = s.form;
      return {
        ...s,
        form: {
          ...cur,
          assignee: a.name,
          collaborators: cur.collaborators.filter((c) => c !== a.name),
          shift: !s.shiftTouched && staff ? staff.defaultShift : cur.shift,
        },
        error: '',
      };
    }
    case 'shift':
      return { ...s, shiftTouched: true, form: { ...s.form, shift: a.shift }, error: '' };
    case 'query':
      return { ...s, query: a.value };
    case 'dept':
      return { ...s, dept: a.value };
    case 'shift-filter':
      return { ...s, shiftFilter: a.value };
    case 'clear-filters':
      return { ...s, query: '', dept: null, shiftFilter: null };
    case 'error':
      return { ...s, error: a.text };
  }
}
