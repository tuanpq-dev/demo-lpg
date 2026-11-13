import { useReducer, useState } from 'react';
import type { StaffPickerItem } from '@/components';
import { ASSIGNABLE_STAFF, SHIFTS, staffByName, type MaintenanceRecord, type ShiftId } from '@/data/maintenance';
import { clearAssignDraft, loadAssignDraft, saveAssignDraft } from '@/data/maintenanceDetail';
import { useMaintenanceLoads } from '@/data/maintenanceApi';
import {
  WORKLOAD_HINT,
  assignMode,
  assignWarnings,
  initialAssignForm,
  shiftShortLabel,
  validateAssign,
  workloadOf,
  type AssignForm,
} from '@/features/maintenance/assign';
import { announce } from '@/lib/announce';
import { useFormModal } from '@/hooks/useFormModal';
import { useNow } from '@/hooks/useNow';
import { assignFormReducer } from './assignFormReducer';

export const SHIFT_SHORT = Object.fromEntries(SHIFTS.map((s) => [s.value, s.label.split(' (')[0]])) as Record<ShiftId, string>;
const DEPT_SHORT: Record<string, string> = {
  'Bảo trì Cơ khí': 'Cơ khí',
  'Bảo trì Điện': 'Điện',
  'Đo lường – Tự động hóa': 'Đo lường',
  'An toàn – HSE': 'HSE',
  'Vận hành': 'Vận hành',
};

export type UseAssignFormOptions = {
  record: MaintenanceRecord;
  onClose: () => void;
  onSubmit: (form: AssignForm) => Promise<void>;
};

/**
 * State + kiểm tra của "Phân công / Đổi người xử lý" (reducer `assignFormReducer`): form, ca đã chọn tay, bộ lọc danh sách,
 * lỗi; suy ra tải việc từng người, lý do chặn (`validateAssign`), cảnh báo không chặn (`assignWarnings`), mục danh sách
 * nhân sự + ô chọn. Vòng đời modal qua `useFormModal` (lưu tạm sessionStorage – công tắc thông báo không tính là sửa).
 */
export function useAssignForm({ record: r, onClose, onSubmit }: UseAssignFormOptions) {
  const now = useNow(60_000);
  const reassign = assignMode(r.status) === 'reassign';
  const [initial] = useState(() => {
    const base = initialAssignForm(r);
    const draft = loadAssignDraft(r.id);
    return { base, draft, form: draft ? { ...draft, notify: base.notify } : base };
  });
  const [s, dispatch] = useReducer(assignFormReducer, undefined, () => ({
    form: initial.form,
    shiftTouched: !!initial.draft || !!r.shift,
    query: '',
    dept: null,
    shiftFilter: null,
    error: '',
  }));
  const f = s.form;

  // Đang làm / quá hạn / Bận của từng người: máy chủ đếm (GET /staff/maintenance-loads) – không duyệt toàn bộ yêu cầu.
  const workloads = useMaintenanceLoads();
  const issues = validateAssign(r, f);
  const blocked = issues.length > 0;
  const modal = useFormModal({
    initial: initial.base,
    values: f,
    // Công tắc "Gửi thông báo" không tính là thay đổi (chỉ giao diện, không lưu vào nháp).
    isDirty: (v, i) => JSON.stringify({ ...v, notify: true }) !== JSON.stringify({ ...i, notify: true }),
    draft: {
      exists: !!initial.draft,
      save: (v) =>
        saveAssignDraft(r.id, {
          assignee: v.assignee,
          collaborators: [...v.collaborators],
          startAt: v.startAt,
          dueAt: v.dueAt,
          shift: v.shift,
          note: v.note,
          reason: v.reason,
          savedAt: new Date().toISOString(),
        }),
      clear: () => clearAssignDraft(r.id),
    },
    onSubmit,
    onClose,
    onSubmitError: (text) => dispatch({ type: 'error', text }),
  });

  // Người đang được giao nhưng không còn trong danh sách chọn (vd trưởng ca) → vẫn hiện đúng tên trong ô chọn.
  const extra = [r.assignee, ...(r.collaborators ?? [])].filter((n): n is string => !!n && !ASSIGNABLE_STAFF.some((p) => p.name === n));
  const comboOptions = [
    ...ASSIGNABLE_STAFF.map((p) => ({ value: p.name, label: p.name, meta: `${p.title} · ${p.department}` })),
    ...extra.map((n) => ({ value: n, label: n, meta: `${staffByName(n)?.title ?? 'Không có trong danh mục'} · không còn chọn được để phân công` })),
  ];

  const q = s.query.trim().toLowerCase();
  const staffItems: StaffPickerItem[] = ASSIGNABLE_STAFF.filter(
    (p) =>
      (!s.dept || p.department === s.dept) &&
      (!s.shiftFilter || p.defaultShift === s.shiftFilter) &&
      (!q || [p.name, p.specialty, p.department, p.title].some((t) => t.toLowerCase().includes(q))),
  ).map((p) => {
    const w = workloadOf(workloads, p.name);
    return {
      id: p.name,
      name: p.name,
      subtitle: `${DEPT_SHORT[p.department] ?? p.department} • ${p.specialty}`,
      shiftLabel: SHIFT_SHORT[p.defaultShift],
      shiftMatch: !!f.shift && p.defaultShift === f.shift,
      busy: w.busy,
      active: w.active,
      overdue: w.overdue,
      workloadHint: WORKLOAD_HINT,
    };
  });

  return {
    ...s,
    reassign,
    issues,
    blocked,
    warnings: assignWarnings(f, workloads, now, staffByName),
    comboOptions,
    staffItems,
    initialDraft: initial.draft,
    modal,
    set: (patch: Partial<AssignForm>) => dispatch({ type: 'set', patch }),
    chooseAssignee: (name: string | null) => dispatch({ type: 'assignee', name }),
    setShift: (shift: ShiftId | null) => dispatch({ type: 'shift', shift }),
    /** Nút "Đổi sang Ca …" của cảnh báo lệch ca. */
    applySuggestedShift: (shift: ShiftId) => {
      dispatch({ type: 'shift', shift });
      announce(`Đã đổi ca làm việc sang ${shiftShortLabel(shift)}.`);
    },
    setQuery: (value: string) => dispatch({ type: 'query', value }),
    setDept: (value: string | null) => dispatch({ type: 'dept', value }),
    setShiftFilter: (value: ShiftId | null) => dispatch({ type: 'shift-filter', value }),
    clearFilters: () => dispatch({ type: 'clear-filters' }),
    submit: async () => {
      if (blocked || modal.submitting) return; // nút aria-disabled đã chặn; chặn thêm cho chắc
      await modal.submit(f);
    },
    saveDraft: () => {
      if (!modal.saveDraft()) {
        dispatch({ type: 'error', text: 'Không lưu được nháp (bộ nhớ trình duyệt không khả dụng).' });
        return;
      }
      announce(`Đã lưu tạm phân công ${r.code} – trạng thái yêu cầu không đổi.`);
    },
  };
}

export type AssignFormModel = ReturnType<typeof useAssignForm>;
