import { Combobox, DatePicker, FormField, Icon, PeopleIcon, SegmentedControl, Select, Textarea, TextField, type Severity } from '@/components';
import { DEPARTMENTS, FORM_PRIORITY_OPTIONS, FORM_TYPE_OPTIONS, PEOPLE, SHIFTS, SOURCE_OPTIONS } from '@/data/maintenance';
import type { CreateMaintenanceForm } from './useCreateMaintenanceForm';

type Props = { f: CreateMaintenanceForm; devices: readonly { device: string; area: string }[] };

/** Cột trái: tên, mô tả, loại, mức độ ưu tiên, thiết bị (tìm), khu vực (tự điền), phòng ban. */
export function RequestInfoColumn({ f, devices }: Props) {
  const { form, errors, set } = f;
  return (
    <div className="flex flex-col gap-4">
      <TextField
        label="Tên yêu cầu bảo trì"
        required
        value={form.title}
        onChange={(v) => set('title', v)}
        error={errors.title}
        placeholder="Ví dụ: Kiểm tra và khắc phục sự cố tăng áp suất van V-101"
        maxLength={160}
      />
      <Textarea
        label="Mô tả chi tiết"
        value={form.description}
        onChange={(v) => set('description', v)}
        rows={3}
        maxLength={1000}
        placeholder="Hiện tượng, phạm vi công việc, yêu cầu đặc biệt…"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Loại bảo trì">
          {({ id, labelId }) => (
            <Select
              variant="field"
              id={id}
              labelledBy={labelId}
              label="Loại bảo trì"
              options={FORM_TYPE_OPTIONS}
              value={form.type}
              onChange={(v) => v && set('type', v)}
            />
          )}
        </FormField>
        <FormField label="Mức độ ưu tiên">
          {({ id, labelId }) => (
            <SegmentedControl
              variant="field"
              id={id}
              labelledBy={labelId}
              label="Mức độ ưu tiên"
              options={FORM_PRIORITY_OPTIONS}
              value={form.priority === 'low' ? 'medium' : form.priority}
              onChange={(v) => set('priority', v as Severity)}
            />
          )}
        </FormField>
        <FormField label="Thiết bị" required error={errors.device}>
          {({ id, labelId, describedBy, invalid }) => (
            <Combobox
              id={id}
              labelledBy={labelId}
              describedBy={describedBy}
              invalid={invalid}
              leading={<Icon name="search" box={16} />}
              placeholder="Tìm mã thiết bị…"
              options={devices.map((d) => ({ value: d.device, label: d.device, meta: d.area }))}
              value={form.device}
              onChange={f.setDevice}
              clearable={false}
            />
          )}
        </FormField>
        <TextField
          label="Khu vực"
          value={form.device ? `Khu vực ${f.areaOf(form.device)}` : ''}
          onChange={() => undefined}
          readOnly
          placeholder="Tự điền theo thiết bị"
          className="[&_input]:bg-surface-muted [&_input]:text-fg-secondary"
        />
      </div>
      <FormField label="Phòng ban phụ trách">
        {({ id, labelId }) => (
          <Select
            variant="field"
            id={id}
            labelledBy={labelId}
            label="Phòng ban phụ trách"
            placeholder="Chọn phòng ban"
            options={DEPARTMENTS.map((d) => ({ value: d, label: d }))}
            value={form.department}
            onChange={f.setDepartment}
          />
        )}
      </FormField>
    </div>
  );
}

const PEOPLE_OPTIONS = PEOPLE.map((p) => ({ value: p.name, label: p.name, meta: p.department }));

/** Cột phải: nguồn tạo, mã tham chiếu, thời gian bắt đầu / hạn, người phụ trách, người phối hợp, ca vận hành. */
export function PlanColumn({ f }: { f: CreateMaintenanceForm }) {
  const { form, errors, set } = f;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Nguồn tạo yêu cầu">
          {({ id, labelId }) => (
            <Select
              variant="field"
              id={id}
              labelledBy={labelId}
              label="Nguồn tạo yêu cầu"
              options={SOURCE_OPTIONS}
              value={form.source}
              onChange={(v) => v && set('source', v)}
            />
          )}
        </FormField>
        <TextField label="Mã tham chiếu / Cảnh báo" value={form.referenceCode} onChange={(v) => set('referenceCode', v)} placeholder="ALT-…" />
        <DatePicker type="datetime-local" label="Thời gian bắt đầu dự kiến" value={form.startAt} onChange={f.setStart} />
        <DatePicker
          type="datetime-local"
          label="Hạn hoàn thành"
          required
          value={form.dueAt}
          min={form.startAt || undefined}
          onChange={(v) => set('dueAt', v)}
          error={errors.dueAt}
        />
      </div>
      <FormField label="Người phụ trách chính" hint={form.assignee ? undefined : 'Để trống → trạng thái "Chờ tiếp nhận".'}>
        {({ id, labelId, describedBy }) => (
          <Combobox
            id={id}
            labelledBy={labelId}
            describedBy={describedBy}
            showAvatar
            placeholder="Chọn người phụ trách…"
            options={PEOPLE_OPTIONS}
            value={form.assignee}
            onChange={(v) => set('assignee', v)}
          />
        )}
      </FormField>
      <FormField label="Người phối hợp">
        {({ id, labelId }) => (
          <Combobox
            multiple
            id={id}
            labelledBy={labelId}
            showAvatar
            leading={<PeopleIcon />}
            placeholder="Tìm kiếm nhân sự…"
            options={PEOPLE_OPTIONS.filter((p) => p.value !== form.assignee)}
            value={form.collaborators}
            onChange={(v) => set('collaborators', v)}
          />
        )}
      </FormField>
      <FormField label="Ca vận hành">
        {({ id, labelId }) => (
          <Select
            variant="field"
            id={id}
            labelledBy={labelId}
            label="Ca vận hành"
            options={SHIFTS}
            value={form.shift}
            onChange={(v) => v && f.setShift(v)}
          />
        )}
      </FormField>
    </div>
  );
}
