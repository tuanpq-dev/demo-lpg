import { useId } from 'react';
import { DatePicker, NumberField, Select, StatusOptionGroup, TextField, type StatusOption } from '@/components';
import { STAFF } from '@/data/staff';
import type { AlertUpdateConfig } from '@/features/alerts/kinds';
import { followUpChoiceLabel, type AlertUpdateInput, type FollowUpChoice } from '@/features/alerts/update';
import { plantTimeOfDay } from '@/lib/plantTime';

const OWNER_OPTIONS = STAFF.map((p) => ({ value: p.name, label: p.name }));

type FollowUp = AlertUpdateInput['followUp'];

export type UpdateFollowUpSectionProps = {
  cfg: AlertUpdateConfig;
  value: FollowUp;
  /** Giờ nhà máy "yyyy-mm-ddTHH:mm" – theo dõi Tùy chỉnh. */
  customAtLocal: string;
  unit: string;
  /** Đang chọn trạng thái đã xử lý (chỉ khi đó mới chọn được thời gian theo dõi). */
  resolved: boolean;
  /** Nhãn trạng thái đã xử lý theo loại. */
  resolvedLabel: string;
  /** Đã xử lý + có theo dõi → mở các ô mục tiêu / thời điểm / người. */
  active: boolean;
  /** Khung theo dõi tự tính (lúc lưu + thời gian) – hiện "Thời điểm kiểm tra lại". */
  window: { until: Date } | null;
  onChange: (followUp: FollowUp) => void;
  onCustomAtChange: (t: string) => void;
};

/** Khối "Theo dõi sau xử lý": thời gian theo dõi, mục tiêu (số hoặc "Không có mục tiêu số"), thời điểm kiểm tra lại, người chịu trách nhiệm. */
export function UpdateFollowUpSection({
  cfg,
  value,
  customAtLocal,
  unit,
  resolved,
  resolvedLabel,
  active,
  window,
  onChange,
  onCustomAtChange,
}: UpdateFollowUpSectionProps) {
  const uid = useId();
  const hintId = `${uid}-follow-hint`;
  const options: StatusOption<string>[] = [...cfg.followUp.options, 'custom' as const].map((c) => ({
    id: String(c),
    label: followUpChoiceLabel(c),
    disabled: !resolved,
    describedBy: !resolved ? hintId : undefined,
  }));
  return (
    <section className="flex flex-col gap-3" aria-labelledby={`${uid}-h`}>
      <h3 id={`${uid}-h`} className="text-lg font-semibold text-fg-secondary">
        Theo dõi sau xử lý
      </h3>
      <StatusOptionGroup
        labelledBy={`${uid}-h`}
        label="Theo dõi sau xử lý"
        options={options}
        value={String(value.choice)}
        onChange={(c) => onChange({ ...value, choice: (c === 'custom' ? 'custom' : Number(c)) as FollowUpChoice })}
        layout="inline"
        size="sm"
        columns="auto"
        describedBy={!resolved ? hintId : undefined}
      />
      {!resolved && (
        <p id={hintId} className="text-sm text-fg-secondary">
          Áp dụng khi chọn "{resolvedLabel}" – cảnh báo hiện "Đang theo dõi đến …" ở drawer và bảng; chỉnh lại được khi xác nhận đóng.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {cfg.followUp.target !== undefined ? (
          <NumberField
            label="Giá trị mục tiêu"
            prefix="<"
            unit={unit}
            value={value.target}
            onChange={(n) => onChange({ ...value, target: n })}
            onClear={() => onChange({ ...value, target: undefined })}
            min={0}
            step={0.1}
            precision={2}
            disabled={!active}
          />
        ) : (
          <TextField
            label="Giá trị mục tiêu"
            value="Không có mục tiêu số"
            onChange={() => {}}
            readOnly
            hint="Theo dõi trạng thái đầu báo và tín hiệu liên quan."
          />
        )}
        {value.choice === 'custom' ? (
          <DatePicker type="datetime-local" label="Thời điểm kiểm tra lại" value={customAtLocal} onChange={onCustomAtChange} disabled={!active} />
        ) : (
          <TextField
            label="Thời điểm kiểm tra lại"
            value={active && window ? plantTimeOfDay(window.until).slice(0, 5) : '–'}
            onChange={() => {}}
            readOnly
            hint={active ? 'Tự tính = lúc lưu + thời gian theo dõi.' : undefined}
          />
        )}
        <div className="flex flex-col gap-1.5">
          <span id={`${uid}-owner`} className="text-sm text-fg-secondary">
            Người chịu trách nhiệm
          </span>
          <Select
            variant="field"
            label="Người chịu trách nhiệm"
            labelledBy={`${uid}-owner`}
            options={OWNER_OPTIONS}
            value={value.owner || null}
            onChange={(o) => onChange({ ...value, owner: o ?? '' })}
            placeholder="Chọn người"
            disabled={!active}
            side="top"
          />
        </div>
      </div>
      <p className="text-sm text-fg-secondary">Tự tạo lại cảnh báo khi vượt mục tiêu trong thời gian theo dõi: chờ backend.</p>
    </section>
  );
}
