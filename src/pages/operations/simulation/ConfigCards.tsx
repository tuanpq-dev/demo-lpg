import { useId } from 'react';
import {
  Badge,
  Card,
  Checkbox,
  CheckSquareIcon,
  DataTable,
  FormField,
  InfoGrid,
  InfoIcon,
  LightbulbIcon,
  ProgressSlider,
  Select,
  StatusDot,
  StatusOptionGroup,
  type DataTableColumn,
  type InfoGridTone,
  type Severity,
} from '@/components';
import {
  DATA_SYNC_LABEL,
  DURATION_OPTIONS,
  END_CONDITIONS,
  LEAK_RATES,
  REFERENCE_STATUS_LABEL,
  endConditionLabel,
  formatQty,
  formatVariable,
  leakRateLabel,
  lowerFirst,
  reachesThreshold,
  referenceReading,
  type ConfigCheck,
  type DataSyncState,
  type EndCondition,
  type LeakRate,
  type Readiness,
  type ReferenceRow,
  type ReferenceStatus,
  type ScenarioConfig,
} from '@/features/simulation/config';
import type { Scenario, ScenarioRisk } from '@/features/simulation/scenarios';
import { SIGNAL_LOST_LABEL } from '@/features/live/signal';
import type { TagValue } from '@/features/live/types';
import { cn } from '@/lib/cn';

const RISK_SEVERITY: Record<ScenarioRisk, Severity> = { critical: 'critical', high: 'high', medium: 'medium' };
const READINESS_TONE: Record<Readiness['tone'], InfoGridTone> = { success: 'success', warning: 'warning', muted: 'default' };

/** "Thông tin kịch bản" (ảnh `info.png`): lưới 4 cột (Tên kịch bản chiếm 2 cột) + khung mô tả có bóng đèn. */
export function ScenarioInfoCard({ scenario: s, readiness, inputSync }: { scenario: Scenario; readiness: Readiness; inputSync: DataSyncState }) {
  return (
    <Card title="Thông tin kịch bản" headerVariant="plain" radius="lg" titleSize="lg" aria-label="Thông tin kịch bản">
      <InfoGrid
        strong
        className="px-2.5"
        items={[
          { id: 'code', label: 'Mã kịch bản', value: s.code },
          { id: 'title', label: 'Tên kịch bản', value: s.title, tone: 'link', span: 2 },
          { id: 'type', label: 'Loại sự cố', value: s.setup.incidentType },
          { id: 'area', label: 'Khu vực', value: s.area, newRow: true },
          { id: 'equipment', label: 'Thiết bị liên quan', value: s.setup.equipment },
          { id: 'risk', label: 'Mức độ gốc', value: <Badge variant="severity" size="chip" value={RISK_SEVERITY[s.risk]} /> },
          { id: 'status', label: 'Trạng thái', value: readiness.label, tone: READINESS_TONE[readiness.tone] },
          {
            id: 'input',
            label: 'Dữ liệu đầu vào',
            value: DATA_SYNC_LABEL[inputSync],
            newRow: true,
            tone: inputSync === 'missing' ? 'warning' : 'default',
          },
        ]}
      />
      <p className="mt-5 flex items-start gap-2.5 rounded-md border border-line/30 bg-surface-raised px-4 py-3 text-base text-fg-secondary">
        <LightbulbIcon size={18} className="mt-px shrink-0 text-primary" />
        {s.setup.description}
      </p>
    </Card>
  );
}

export type InputParamsCardProps = {
  scenario: Scenario;
  config: ScenarioConfig;
  onChange: (patch: Partial<ScenarioConfig>) => void;
  check: ConfigCheck;
  /** Giá trị hiện tại của biến chính – undefined = mất tín hiệu / chưa có số liệu. */
  start: number | undefined;
  /** Không có quyền cấu hình → khoá mọi ô (vẫn đọc được). */
  readOnly: boolean;
};

/**
 * "Tham số đầu vào" (ảnh `params.png`): [bắt đầu (thực tế) · mục tiêu (thanh trượt + vạch ngưỡng PLC) · tốc độ] |
 * [thời lượng · điều kiện kết thúc (radio) · khu vực ảnh hưởng (checkbox)].
 */
export function InputParamsCard({ scenario: s, config, onChange, check, start, readOnly }: InputParamsCardProps) {
  const uid = useId();
  const v = s.setup.variable;
  const hintId = `${uid}-hint`;
  const targetMsgId = `${uid}-target-msg`;
  const endId = `${uid}-end`;
  const areasId = `${uid}-areas`;
  const areasErrId = `${uid}-areas-err`;
  const hot = reachesThreshold(v, config.target);
  const targetMsg = check.errors.target ?? check.warnings.target;
  const toggleArea = (area: string, on: boolean) =>
    onChange({ areas: on ? [...config.areas.filter((a) => a !== area), area] : config.areas.filter((a) => a !== area) });

  return (
    <Card title="Tham số đầu vào" headerVariant="plain" radius="lg" titleSize="lg" aria-label="Tham số đầu vào">
      <div className="grid grid-cols-1 gap-x-6 gap-y-5 px-2.5 lg:grid-cols-[minmax(0,38fr)_minmax(0,62fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* Giá trị thực tế – chỉ đọc (không phải ô nhập). */}
          <div className="flex flex-col gap-2">
            <span className="text-base text-fg-secondary">{v.startLabel}</span>
            <p className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-line bg-surface-sunken px-4">
              {start === undefined ? (
                <span className="flex items-center gap-2 text-base text-fg-muted">
                  <StatusDot status="offline" />
                  {SIGNAL_LOST_LABEL}
                </span>
              ) : (
                <span className="text-xl leading-none tabular-nums text-fg">{formatQty(start, v.unit, v.digits)}</span>
              )}
              <span className="truncate text-base text-fg-secondary">
                {v.qualifier ? `${v.qualifier} ` : ''}(Source: {v.plcTag})
              </span>
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <ProgressSlider
              variant="threshold"
              label={v.targetLabel}
              value={config.target}
              onChange={(target) => onChange({ target })}
              min={v.min}
              max={v.max}
              step={v.step}
              unit={v.unit === '%' ? '%' : ` ${v.unit}`}
              disabled={readOnly}
              valueText={`${formatVariable(config.target, v)}${hot ? ` – ${v.direction === 'above' ? 'vượt' : 'dưới'} ${lowerFirst(v.thresholdLabel)}` : ''}`}
              valueDisplay={
                <>
                  <span className={hot ? 'text-danger-text' : 'text-fg'}>{formatQty(config.target, v.unit, v.digits)}</span>
                  {v.qualifier && <span className="text-fg-secondary"> {v.qualifier}</span>}
                </>
              }
              marker={{ value: v.threshold, label: `${formatVariable(v.threshold, v)}: ${v.thresholdLabel}` }}
              scaleLabels={[formatQty(v.min, v.unit), formatQty(v.max, v.unit)]}
              describedBy={[hintId, targetMsg ? targetMsgId : ''].filter(Boolean).join(' ')}
            />
            {/* Nhãn ngưỡng trên thang là aria-hidden → đọc qua dòng ẩn này. */}
            <span id={hintId} className="sr-only">
              {formatVariable(v.threshold, v)}: {v.thresholdLabel}. {v.hint ?? ''}
            </span>
            {v.hint && (
              <p aria-hidden="true" className="flex items-center gap-1.5 text-sm text-primary">
                <InfoIcon size={14} className="shrink-0" />
                {v.hint}
              </p>
            )}
            {targetMsg && (
              <p id={targetMsgId} className={cn('text-sm', check.errors.target ? 'text-danger-text' : 'text-warning')}>
                {targetMsg}
              </p>
            )}
          </div>

          <FormField label={v.rateLabel} labelVariant="plain">
            {({ id, labelId }) => (
              <Select<LeakRate>
                id={id}
                labelledBy={labelId}
                variant="field"
                size="lg"
                label={v.rateLabel}
                options={LEAK_RATES.map((r) => ({ value: r, label: leakRateLabel(r, v.direction) }))}
                value={config.rate}
                onChange={(rate) => rate && onChange({ rate })}
                disabled={readOnly}
              />
            )}
          </FormField>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <FormField label="Thời lượng mô phỏng" labelVariant="plain" error={check.errors.durationMin}>
            {({ id, labelId, describedBy, invalid }) => (
              <Select<string>
                id={id}
                labelledBy={labelId}
                describedBy={describedBy}
                invalid={invalid}
                variant="field"
                size="lg"
                label="Thời lượng mô phỏng"
                placeholder="Chọn thời lượng"
                options={DURATION_OPTIONS.map((m) => ({ value: String(m), label: `${m} phút` }))}
                value={(DURATION_OPTIONS as readonly number[]).includes(config.durationMin) ? String(config.durationMin) : null}
                onChange={(m) => m && onChange({ durationMin: Number(m) })}
                disabled={readOnly}
              />
            )}
          </FormField>

          <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.55fr)]">
            <div className="flex min-w-0 flex-col gap-3">
              <span id={endId} className="text-base text-fg-secondary">
                Điều kiện kết thúc
              </span>
              <StatusOptionGroup<EndCondition>
                label="Điều kiện kết thúc"
                labelledBy={endId}
                layout="plain"
                columns={1}
                options={END_CONDITIONS.map((c) => ({ id: c, label: endConditionLabel(c, v), disabled: readOnly }))}
                value={config.endCondition}
                onChange={(endCondition) => onChange({ endCondition })}
              />
            </div>
            <fieldset aria-describedby={check.errors.areas ? areasErrId : undefined} className="flex min-w-0 flex-col gap-3">
              <legend id={areasId} className="mb-3 text-base text-fg-secondary">
                Khu vực ảnh hưởng
              </legend>
              <div className="flex flex-col gap-2.5">
                {s.setup.areaOptions.map((a) => (
                  <Checkbox
                    key={a}
                    variant="list"
                    label={a}
                    checked={config.areas.includes(a)}
                    onChange={(on) => toggleArea(a, on)}
                    disabled={readOnly}
                  />
                ))}
              </div>
              {check.errors.areas && (
                <p id={areasErrId} className="text-sm text-danger-text">
                  {check.errors.areas}
                </p>
              )}
            </fieldset>
          </div>
        </div>
      </div>
    </Card>
  );
}

const STATUS_CLASS: Record<ReferenceStatus, string> = {
  normal: 'text-success',
  online: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger-text',
  offline: 'text-danger-text',
  lost: 'text-fg-muted',
};

type RefRowView = ReferenceRow & { valueText: string | null; status: ReferenceStatus };

/**
 * "Dữ liệu PLC/SCADA tham chiếu" (ảnh `plc-table.png`): Tag / Nguồn · Giá trị hiện tại · Đơn vị · Trạng thái + "Live Sync".
 * Mất tín hiệu → "Mất tín hiệu" xám, KHÔNG hiện số cũ.
 */
export function ReferenceDataCard({
  rows,
  live,
  now,
  liveSynced,
}: {
  rows: readonly ReferenceRow[];
  live: Readonly<Record<string, TagValue>> | undefined;
  now: number;
  /** Mọi dòng còn tín hiệu → chấm xanh "Live Sync"; thiếu → vàng. */
  liveSynced: boolean | undefined;
}) {
  const view: RefRowView[] = rows.map((r) => ({ ...r, ...referenceReading(r, live?.[r.tag], now) }));
  const columns: DataTableColumn<RefRowView>[] = [
    {
      id: 'tag',
      header: <span className="pl-6">Tag / Nguồn</span>,
      align: 'start',
      cell: (r) => (
        <span className="flex flex-col gap-0.5 py-1.5 pl-6">
          <span className="text-base text-fg">{r.label}</span>
          <span className="text-xs text-primary">{r.plcTag}</span>
        </span>
      ),
    },
    {
      id: 'value',
      header: 'Giá trị hiện tại',
      align: 'start',
      cell: (r) =>
        r.valueText === null ? (
          <span className="flex items-center gap-1.5 text-base text-fg-muted">
            <StatusDot status="offline" />
            {SIGNAL_LOST_LABEL}
          </span>
        ) : (
          <span className={cn('tabular-nums text-fg', r.kind === 'heartbeat' ? 'text-md' : 'text-base')}>{r.valueText}</span>
        ),
    },
    { id: 'unit', header: 'Đơn vị', align: 'start', width: '18%', cell: (r) => <span className="text-base text-fg-secondary">{r.unit}</span> },
    {
      id: 'status',
      header: 'Trạng thái',
      align: 'start',
      width: '18%',
      cell: (r) => <span className={cn('text-base', STATUS_CLASS[r.status])}>{REFERENCE_STATUS_LABEL[r.status]}</span>,
    },
  ];
  return (
    <Card
      title="Dữ liệu PLC/SCADA tham chiếu"
      headerVariant="plain"
      radius="lg"
      titleSize="lg"
      aria-label="Dữ liệu PLC/SCADA tham chiếu"
      headerEnd={
        <span
          className={cn(
            'flex items-center gap-1.5 text-base',
            liveSynced === false ? 'text-warning' : liveSynced ? 'text-success' : 'text-fg-secondary',
          )}
        >
          <StatusDot status={liveSynced === false ? 'warning' : liveSynced ? 'success' : 'offline'} />
          {liveSynced === false ? 'Thiếu dữ liệu' : liveSynced ? 'Live Sync' : 'Đang kết nối'}
        </span>
      }
    >
      {/* Bảng tràn sát mép card như ảnh (nền tiêu đề cột trải hết bề rộng). */}
      <DataTable
        className="-mx-4 -mt-1"
        label="Dữ liệu PLC/SCADA tham chiếu"
        columns={columns}
        rows={view}
        getRowId={(r) => r.id}
        density="compact"
        headerStyle="plain"
        minWidth={560}
      />
      <p className="-mx-4 -mb-4 border-t border-line/30 px-9 py-3 text-sm italic text-fg-secondary">
        Dữ liệu tham chiếu được dùng làm trạng thái ban đầu cho mô phỏng, không thay đổi dữ liệu trên thiết bị thật.
      </p>
    </Card>
  );
}

/** "Kết quả mong đợi của mô phỏng" (ảnh `expected.png`) – danh sách cố định 2 cột (đọc theo cột), icon ô tick. */
export function ExpectedOutcomesCard({ outcomes }: { outcomes: readonly string[] }) {
  const half = Math.ceil(outcomes.length / 2);
  return (
    <Card title="Kết quả mong đợi của mô phỏng" headerVariant="plain" radius="lg" titleSize="lg" aria-label="Kết quả mong đợi của mô phỏng">
      <ul className="grid grid-cols-1 gap-x-6 gap-y-3 px-2.5 md:grid-flow-col md:grid-cols-2" style={{ gridTemplateRows: `repeat(${half}, auto)` }}>
        {outcomes.map((o) => (
          <li key={o} className="flex items-center gap-2.5 text-base text-fg-secondary">
            <CheckSquareIcon size={18} className="shrink-0 text-primary" />
            {o}
          </li>
        ))}
      </ul>
    </Card>
  );
}
