import { useId } from 'react';
import {
  AssignNotices,
  Badge,
  Button,
  Combobox,
  DatePicker,
  DeviceArmIcon,
  FormField,
  MapIcon,
  SearchInput,
  Select,
  StaffList,
  Switch,
  Textarea,
} from '@/components';
import { ASSIGNABLE_STAFF, DEPARTMENTS, SHIFTS, STATUS_LABEL, type MaintenanceRecord } from '@/data/maintenance';
import { shiftShortLabel } from '@/features/maintenance/assign';
import { SHIFT_SHORT, type AssignFormModel } from './useAssignForm';

/** Dải thông tin yêu cầu (trải hết bề ngang thân modal): mã, tiêu đề, thiết bị, khu vực, mức độ, trạng thái hiện tại. */
export function AssignRequestBand({ record: r }: { record: MaintenanceRecord }) {
  return (
    <section
      aria-label={`Yêu cầu ${r.code}`}
      className="-mx-5 -mt-4 flex flex-wrap items-start justify-between gap-3 border-b border-line/30 bg-surface-raised/50 px-5 py-3"
    >
      <div className="flex min-w-0 flex-col gap-2">
        <p className="flex flex-wrap items-center gap-3">
          <Badge variant="tag" size="md">
            {r.code}
          </Badge>
          <span className="text-lg font-semibold text-fg">{r.title}</span>
        </p>
        <p className="flex flex-wrap items-center gap-4 text-sm text-fg-secondary">
          <span className="inline-flex items-center gap-1">
            <DeviceArmIcon size={14} />
            <span className="sr-only">Thiết bị: </span>
            {r.device}
          </span>
          <span className="inline-flex items-center gap-1">
            <MapIcon size={14} />
            <span className="sr-only">Khu vực: </span>
            {r.area}
          </span>
          <Badge variant="severity" value={r.priority} withIcon={r.priority === 'critical'} size="md" />
        </p>
      </div>
      <p className="text-sm text-fg-secondary">
        Trạng thái: <span className="font-semibold text-warning">{STATUS_LABEL[r.status]}</span>
      </p>
    </section>
  );
}

/** Cột trái: tìm + lọc phòng ban / ca + danh sách nhân sự (radiogroup, KHÔNG chọn sẵn) + trạng thái rỗng "Xóa bộ lọc". */
export function StaffPickerColumn({ a }: { a: AssignFormModel }) {
  const uid = useId();
  const listLabelId = `${uid}-list`;
  return (
    <div className="flex min-w-0 flex-col gap-3 border-line/30 px-5 py-4 md:border-r">
      <h3 id={listLabelId} className="sr-only">
        Danh sách nhân sự
      </h3>
      <SearchInput value={a.query} onChange={a.setQuery} placeholder="Tìm kiếm nhân sự..." label="Tìm kiếm nhân sự" />
      <div className="grid grid-cols-[3fr_2fr] gap-3">
        <span id={`${uid}-dept`} className="sr-only">
          Lọc phòng ban
        </span>
        <span id={`${uid}-shift`} className="sr-only">
          Lọc ca
        </span>
        <Select
          variant="field"
          labelledBy={`${uid}-dept`}
          label="Lọc phòng ban"
          placeholder="Tất cả phòng ban"
          allLabel="Tất cả phòng ban"
          options={DEPARTMENTS.filter((d) => ASSIGNABLE_STAFF.some((p) => p.department === d)).map((d) => ({ value: d, label: d }))}
          value={a.dept}
          onChange={a.setDept}
        />
        <Select
          variant="field"
          labelledBy={`${uid}-shift`}
          label="Lọc ca"
          placeholder="Tất cả ca"
          allLabel="Tất cả ca"
          options={SHIFTS.map((s) => ({ value: s.value, label: SHIFT_SHORT[s.value] }))}
          value={a.shiftFilter}
          onChange={a.setShiftFilter}
        />
      </div>
      <StaffList
        label="Danh sách nhân sự"
        labelledBy={listLabelId}
        items={a.staffItems}
        value={a.form.assignee}
        onChange={a.chooseAssignee}
        emptyState={
          <span className="flex flex-col items-center gap-2">
            Không có nhân sự phù hợp với bộ lọc.
            <Button variant="link" onClick={a.clearFilters}>
              Xóa bộ lọc
            </Button>
          </span>
        }
      />
    </div>
  );
}

/** Cột phải "Chi tiết phân công": lý do đổi người, người chính / phối hợp, thời gian, ca, ghi chú, thông báo, cảnh báo + lý do chặn. */
export function AssignDetailsColumn({ a, record: r, blockId }: { a: AssignFormModel; record: MaintenanceRecord; blockId: string }) {
  const f = a.form;
  return (
    <div className="flex min-w-0 flex-col gap-4 px-5 py-4">
      <h3 className="border-b border-line/30 pb-3 text-lg font-semibold text-fg">Chi tiết phân công</h3>
      {a.reassign && (
        <Textarea
          label="Lý do đổi người xử lý"
          required
          value={f.reason}
          onChange={(v) => a.set({ reason: v })}
          rows={2}
          maxLength={500}
          placeholder="Vì sao cần đổi người xử lý…"
          hint={`Người hiện tại: ${r.assignee ?? '—'}. Tiến độ, cờ tạm dừng/sự cố và trạng thái giữ nguyên.`}
        />
      )}
      <FormField label="Người xử lý chính" required>
        {({ id, labelId, describedBy }) => (
          <Combobox
            id={id}
            labelledBy={labelId}
            describedBy={describedBy}
            showAvatar
            options={a.comboOptions}
            value={f.assignee}
            onChange={a.chooseAssignee}
            placeholder="Chọn ở danh sách bên trái hoặc gõ tên…"
          />
        )}
      </FormField>
      <FormField label="Người phối hợp">
        {({ id, labelId, describedBy }) => (
          <Combobox
            multiple
            id={id}
            labelledBy={labelId}
            describedBy={describedBy}
            showAvatar
            options={a.comboOptions.filter((o) => o.value !== f.assignee)}
            value={f.collaborators}
            onChange={(v) => a.set({ collaborators: v })}
            placeholder="Chọn người phối hợp..."
          />
        )}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <DatePicker type="datetime-local" label="Bắt đầu dự kiến" value={f.startAt} onChange={(v) => a.set({ startAt: v })} />
        <DatePicker type="datetime-local" label="Hạn chót (Deadline)" required value={f.dueAt} onChange={(v) => a.set({ dueAt: v })} />
      </div>
      <FormField label="Ca làm việc">
        {({ id, labelId, describedBy }) => (
          <Select
            variant="field"
            id={id}
            labelledBy={labelId}
            describedBy={describedBy}
            label="Ca làm việc"
            placeholder="Chọn ca"
            options={SHIFTS}
            value={f.shift}
            onChange={a.setShift}
          />
        )}
      </FormField>
      <Textarea
        label="Ghi chú phân công"
        value={f.note}
        onChange={(v) => a.set({ note: v })}
        rows={2}
        maxLength={500}
        placeholder="Lưu ý cho người xử lý…"
        hint='Ghi vào ghi chú kỹ thuật với nhãn "Phân công".'
      />
      <div className="border-t border-line/30 pt-4">
        <Switch
          label="Gửi thông báo đẩy và SMS cho người được phân công"
          description="Chưa gửi được – chờ backend (bản demo không gửi thông báo)."
          checked={f.notify}
          onChange={(v) => a.set({ notify: v })}
        />
      </div>

      {/* Cảnh báo không chặn + lý do chặn (khối dùng chung với modal phân công cảnh báo). */}
      <AssignNotices
        warnings={a.warnings.map((w) => ({
          id: w.id,
          label: w.label,
          action: w.suggestShift && (
            <Button variant="link" onClick={() => a.applySuggestedShift(w.suggestShift!)}>
              Đổi sang {shiftShortLabel(w.suggestShift)}
            </Button>
          ),
        }))}
        issues={a.issues}
        blockId={blockId}
        blockTitle={`Chưa thể ${a.reassign ? 'đổi người' : 'phân công'} – còn thiếu:`}
      />
      {a.error && (
        <p role="alert" className="text-sm text-danger-text">
          {a.error}
        </p>
      )}
    </div>
  );
}
