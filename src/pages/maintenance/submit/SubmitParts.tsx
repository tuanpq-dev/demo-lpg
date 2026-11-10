/** Khối giao diện của modal "Gửi yêu cầu nghiệm thu". Tách từ SubmitReviewModal. */
import { useId, type ReactNode } from 'react';
import {
  AlertCircleIcon,
  Badge,
  CheckCircleIcon,
  Checklist,
  EyeIcon,
  KpiCard,
  Select,
  StatusOptionGroup,
  type KpiTone,
  type StatusOption,
} from '@/components';
import type { Reading } from '@/data/assetDetail';
import { STATUS_LABEL, dueHasTime, type MaintenanceRecord } from '@/data/maintenance';
import type { useRelatedDevice } from '@/data/maintenanceDetail';
import { checklistProgress } from '@/features/maintenance/checklist';
import { deadlineDayLabel } from '@/features/maintenance/deadline';
import { isNearOrPastDue, reportedProgressOf } from '@/features/maintenance/progress';
import {
  DEVICE_CONDITION_OPTIONS,
  SENSOR_STATUS_OPTIONS,
  VALVE_STATUS_OPTIONS,
  type DeviceCondition,
  type SensorStatus,
  type ValveStatus,
} from '@/features/maintenance/review';

const CONDITION_ICON: Record<DeviceCondition, ReactNode> = {
  normal: <CheckCircleIcon size={22} />,
  monitor: <EyeIcon size={22} />,
  unresolved: <AlertCircleIcon size={22} />,
};
const CONDITION_TONE = { normal: 'primary', monitor: 'warning', unresolved: 'danger' } as const;
const CONDITION_OPTIONS: StatusOption<DeviceCondition>[] = DEVICE_CONDITION_OPTIONS.map((o) => ({
  id: o.id,
  label: o.label,
  icon: CONDITION_ICON[o.id],
  tone: CONDITION_TONE[o.id],
}));

// Bình thường = chữ trắng (ảnh); vượt ngưỡng mới tô màu.
const readingTone = (r: Reading): KpiTone => (r.status === 'danger' ? 'danger' : r.status === 'warning' ? 'warning' : 'neutral');

/** Ô chọn trạng thái nhỏ (Cảm biến / Van xả) – cùng khung với ô số liệu. */
function SelectTile<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: V;
  options: readonly { value: V; label: string }[];
  onChange: (v: V) => void;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-md border border-line/30 px-3.5 py-3">
      <span id={`${id}-l`} className="text-base text-fg-secondary">
        {label}
      </span>
      <Select variant="field" id={id} labelledBy={`${id}-l`} label={label} options={options} value={value} onChange={(v) => v && onChange(v)} />
    </div>
  );
}

/** Ô số liệu trực tiếp (áp suất / nhiệt độ); không có thiết bị live → "—". */
function ReadingTile({ label, unit, reading }: { label: string; unit: string; reading: Reading | undefined }) {
  if (!reading) return <KpiCard size="sm" emphasis label={label} value="—" footnote="Không có số liệu trực tiếp" />;
  return (
    <KpiCard
      size="sm"
      emphasis
      label={label}
      value={reading.value?.toFixed(1) ?? '—'}
      unit={unit}
      tone={readingTone(reading)}
      signalLost={reading.state === 'lost'}
    />
  );
}

/** Thẻ đầu: mã + tên yêu cầu, nhân sự / tiến độ / hạn chót, danh sách điều kiện còn thiếu. */
export function SubmitSummaryCard({
  record: r,
  now,
  missing,
  missingId,
}: {
  record: MaintenanceRecord;
  now: Date;
  missing: readonly { id: string; label: string }[];
  missingId: string;
}) {
  const eligible = missing.length === 0;
  const hasTime = dueHasTime(r);
  const dueRed = isNearOrPastDue(r.dueAt, now, hasTime);
  return (
    <section aria-label={`Yêu cầu ${r.code}`} className="flex flex-col gap-4 rounded-lg border border-line-card bg-surface-raised/40 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-lg text-fg">
            <span className="font-semibold">{r.code}</span>
            <span aria-hidden="true" className="mx-2 text-fg-secondary">
              |
            </span>
            <span className="sr-only"> – </span>
            {r.title}
          </p>
          <p className="text-sm text-fg-secondary">
            Thiết bị: {r.device} <span aria-hidden="true">|</span>
            <span className="sr-only">,</span> Khu vực: {r.area}
          </p>
        </div>
        <Badge variant="tag" size="md" tone={eligible ? 'success' : 'danger'}>
          {eligible ? 'Đủ điều kiện gửi nghiệm thu' : 'Chưa đủ điều kiện'}
        </Badge>
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <dt className="text-sm text-fg-secondary">Nhân sự</dt>
          <dd className="text-md font-semibold text-fg">{r.assignee ?? 'Chưa phân công'}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-sm text-fg-secondary">Tiến độ</dt>
          <dd className="text-md font-semibold text-success">
            {reportedProgressOf(r)}% <span aria-hidden="true">|</span>
            <span className="sr-only">,</span> {STATUS_LABEL[r.status]}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-sm text-fg-secondary">Hạn chót</dt>
          <dd className={dueRed ? 'text-md font-semibold text-danger-text' : 'text-md font-semibold text-fg'}>
            {deadlineDayLabel(r.dueAt, now, hasTime)}
          </dd>
        </div>
      </dl>
      {!eligible && (
        <div id={missingId} className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-fg">
          <p className="font-semibold">Chưa đủ điều kiện gửi – còn thiếu:</p>
          <ul className="mt-1 list-disc pl-5">
            {missing.map((m) => (
              <li key={m.id}>{m.label}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Checklist hoàn thành (chỉ xem). */
export function ChecklistSection({ record: r, headingId }: { record: MaintenanceRecord; headingId: string }) {
  const progress = r.checklist?.length ? checklistProgress(r.checklist) : null;
  return (
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby={headingId}>
      <div className="flex items-center justify-between gap-2">
        <h3 id={headingId} className="text-lg font-semibold text-fg-secondary">
          Checklist hoàn thành
        </h3>
        {progress && (
          <span
            className={
              progress.done === progress.total ? 'text-lg font-semibold tabular-nums text-success' : 'text-lg font-semibold tabular-nums text-warning'
            }
          >
            {progress.done}/{progress.total}
            <span className="sr-only"> mục hoàn thành</span>
          </span>
        )}
      </div>
      <div className="flex-1 rounded-md border border-line/30 px-4 py-3">
        {progress && r.checklist ? (
          <Checklist variant="summary" items={r.checklist} progress={progress} />
        ) : (
          <p className="text-base text-fg-secondary">Yêu cầu không có checklist.</p>
        )}
      </div>
    </section>
  );
}

export type DeviceConditionValues = { deviceCondition: DeviceCondition; sensorStatus: SensorStatus; valveStatus: ValveStatus };

/** Tình trạng thiết bị sau bảo trì + số liệu trực tiếp + cảm biến / van xả. */
export function DeviceConditionSection({
  uid,
  values,
  device,
  onChange,
}: {
  uid: string;
  values: DeviceConditionValues;
  device: ReturnType<typeof useRelatedDevice>;
  onChange: <K extends keyof DeviceConditionValues>(key: K, value: DeviceConditionValues[K]) => void;
}) {
  const headingId = `${uid}-condition`;
  const noteId = `${uid}-condition-note`;
  const live = device.kind === 'live' ? device : null;
  return (
    <section className="flex flex-col gap-3">
      <h3 id={headingId} className="text-lg font-semibold text-fg-secondary">
        Tình trạng thiết bị sau bảo trì
      </h3>
      <StatusOptionGroup
        label="Tình trạng thiết bị sau bảo trì"
        labelledBy={headingId}
        describedBy={values.deviceCondition === 'unresolved' ? noteId : undefined}
        columns={3}
        options={CONDITION_OPTIONS}
        value={values.deviceCondition}
        onChange={(x) => onChange('deviceCondition', x)}
      />
      {values.deviceCondition === 'unresolved' && (
        <p id={noteId} className="flex items-center gap-2 text-sm text-warning">
          <AlertCircleIcon size={16} className="shrink-0" />
          Thiết bị chưa khắc phục – vẫn gửi được, người nghiệm thu sẽ xem xét. Nêu rõ phần còn tồn tại trong Biện pháp.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-6">
        <ReadingTile label="Áp suất" unit="bar" reading={live?.pressure} />
        <ReadingTile label="Nhiệt độ" unit="°C" reading={live?.temperature} />
        <SelectTile<SensorStatus>
          label="Cảm biến"
          value={values.sensorStatus}
          options={SENSOR_STATUS_OPTIONS}
          onChange={(x) => onChange('sensorStatus', x)}
        />
        <SelectTile<ValveStatus>
          label="Van xả"
          value={values.valveStatus}
          options={VALVE_STATUS_OPTIONS}
          onChange={(x) => onChange('valveStatus', x)}
        />
      </div>
      {live && (
        <p className="text-sm text-fg-secondary">
          Áp suất ({live.tags.pressure}) và nhiệt độ ({live.tags.temperature}) là số liệu trực tiếp – được chụp lại lúc bấm “Gửi nghiệm thu”.
        </p>
      )}
    </section>
  );
}
