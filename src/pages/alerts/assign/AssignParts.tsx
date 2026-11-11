/** Khối giao diện của modal "Phân công xử lý cảnh báo". Tách từ AlertAssignModal. */
import type { RefObject } from 'react';
import { Button, SearchInput, StaffFilters, StaffList, DiscardConfirmButtons } from '@/components';
import { ALERT_STAFF } from '@/data/alertDetail';
import type { planBulkAlertAssign } from '@/features/alerts/assign';
import { shiftShortLabel } from '@/features/staff/availability';
import { DEPARTMENTS, SHIFTS } from '@/features/staff/org';
import type { AlertStaffPicker } from './useAlertStaffPicker';

const DEPARTMENT_OPTIONS = DEPARTMENTS.filter((d) => ALERT_STAFF.some((p) => p.department === d)).map((d) => ({ value: d, label: d }));
const SHIFT_OPTIONS = SHIFTS.map((s) => ({ value: s.value, label: shiftShortLabel(s.value) }));

/** Cột trái: tìm + lọc + danh sách nhân sự (radiogroup). */
export function StaffSection({
  labelId,
  picker,
  value,
  onChange,
}: {
  labelId: string;
  picker: AlertStaffPicker;
  value: string | null;
  onChange: (name: string | null) => void;
}) {
  return (
    <section aria-labelledby={labelId} className="flex min-w-0 flex-col gap-3">
      <h3 id={labelId} className="text-lg font-semibold text-fg">
        Chọn nhân sự
      </h3>
      <StaffFilters
        search={<SearchInput value={picker.query} onChange={picker.setQuery} placeholder="Tìm kiếm theo tên..." label="Tìm kiếm nhân sự theo tên" />}
        departments={DEPARTMENT_OPTIONS}
        department={picker.dept}
        onDepartmentChange={picker.setDept}
        shifts={SHIFT_OPTIONS}
        shift={picker.shift}
        onShiftChange={picker.setShift}
        onShiftOnly={picker.onShiftOnly}
        onShiftOnlyChange={picker.setOnShiftOnly}
      />
      <p className="text-sm text-fg-secondary">
        Người cùng khu hoặc đúng chuyên môn xếp trước, rồi Sẵn sàng → Bận → Ngoài ca. Người ngoài ca vẫn chọn được.
      </p>
      <StaffList
        label="Chọn nhân sự"
        labelledBy={labelId}
        items={picker.items}
        value={value}
        onChange={onChange}
        emptyState={
          <span className="flex flex-col items-center gap-2">
            Không có nhân sự phù hợp với bộ lọc.
            <Button variant="link" onClick={picker.clearFilters}>
              Xóa bộ lọc
            </Button>
          </span>
        }
      />
    </section>
  );
}

type BulkPlan = ReturnType<typeof planBulkAlertAssign>;

/** Hàng loạt: liệt kê dòng sẽ đổi người và dòng bị bỏ qua trước khi xác nhận. */
export function BulkAssignPlan({ plan, assignee }: { plan: BulkPlan; assignee: string }) {
  const skipped = plan.skippedDone.length + plan.skippedSame.length;
  if (plan.reassign.length === 0 && skipped === 0) return null;
  return (
    <div className="flex flex-col gap-2 text-sm">
      {plan.reassign.length > 0 && (
        <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-fg">
          <p className="font-semibold">Sẽ đổi người ({plan.reassign.length}):</p>
          <ul aria-label="Cảnh báo sẽ đổi người" className="mt-1 flex flex-col gap-0.5">
            {plan.reassign.map((a) => (
              <li key={a.id}>
                {a.code}: {a.assignee} → {assignee}
              </li>
            ))}
          </ul>
        </div>
      )}
      {skipped > 0 && (
        <p className="text-fg-secondary">
          Bỏ qua {skipped}:{' '}
          {[
            plan.skippedDone.length && `${plan.skippedDone.map((a) => a.code).join(', ')} (đã hoàn thành)`,
            plan.skippedSame.length && `${plan.skippedSame.map((a) => a.code).join(', ')} (đã giao ${assignee})`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
    </div>
  );
}

export type AssignFooterProps = {
  confirming: boolean;
  hasDraft: boolean;
  keepEditingRef: RefObject<HTMLButtonElement>;
  onKeepEditing: () => void;
  onDiscard: () => void;
  /** undefined = không có nút Nháp (hàng loạt). */
  onSaveDraft?: () => void;
  confirmLabel: string;
  blocked: boolean;
  submitting: boolean;
  blockId: string;
};

/** Chân modal: hỏi bỏ thay đổi khi đang có nháp chưa lưu, hoặc Nháp + nút xác nhận. */
export function AssignFooter(p: AssignFooterProps) {
  if (p.confirming) {
    return <DiscardConfirmButtons keepEditingRef={p.keepEditingRef} onKeepEditing={p.onKeepEditing} onDiscard={p.onDiscard} hasDraft={p.hasDraft} />;
  }
  return (
    <>
      {p.onSaveDraft && (
        <Button variant="subtle" onClick={p.onSaveDraft}>
          Nháp
        </Button>
      )}
      <Button
        type="submit"
        variant="primary"
        aria-disabled={p.blocked || p.submitting || undefined}
        aria-describedby={p.blocked ? p.blockId : undefined}
      >
        {p.confirmLabel}
      </Button>
    </>
  );
}
