/*
 * Khối nội dung của modal "Ghi nhận mốc kiểm tra" (Figma bản sao 126:7966; style bảng lấy từ node 126:8062, phần còn lại
 * theo ảnh chụp node – scratch/figma-ref/report-record/). Màu Figma map về token: #8AEBFF → primary, #31E6A1 → success,
 * #90A5BD → fg-secondary, #EAF3FF → fg, nền #0B1626 → surface-raised, viền #1A344E → line-card.
 * Phần dùng chung: khung thẻ, tiêu đề mục, nhãn nguồn, ô nhập đồng hồ cơ, ô giá trị, dòng nhãn – giá trị.
 */
import { forwardRef, type ReactNode } from 'react';
import { Badge, NumberField } from '@/components';
import {
  effectiveValue,
  formatRecordValue,
  valueState,
  valueStateLabel,
  type ManualValues,
  type RecordReading,
  type SensorHealth,
  type ValueSource,
  type ValueState,
} from '@/features/reports';
import { cn } from '@/lib/cn';

export type ManualProps = {
  manual: ManualValues;
  /** null = bỏ giá trị nhập tay (quay về số IoT). */
  onManual: (id: string, value: number | null) => void;
};

export const STATE_TEXT: Record<ValueState, string> = {
  normal: 'text-success',
  warning: 'text-warning',
  abnormal: 'text-danger-text',
  missing: 'text-fg-secondary',
};

export const sensorText = (h: SensorHealth) => (h === 'normal' ? 'text-success' : h === 'stale' ? 'text-warning' : 'text-danger-text');

/** Khung thẻ chung của modal (nền #0B1626, viền #1A344E, bo 6). */
export const boxClass = 'rounded-md border border-line-card bg-surface-raised';

/** Tiêu đề mục + nội dung; `id` để tab điều hướng cuộn tới. */
export const RecordSection = forwardRef<HTMLElement, { id: string; title: string; end?: ReactNode; children: ReactNode; className?: string }>(
  function RecordSection({ id, title, end, children, className }, ref) {
    return (
      <section ref={ref} id={id} aria-labelledby={`${id}-title`} className={cn('flex scroll-mt-2 flex-col gap-3', className)}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={`${id}-title`} className="text-lg font-semibold text-fg">
            {title}
          </h3>
          {end}
        </div>
        {children}
      </section>
    );
  },
);

const SOURCE_BADGE: Record<Exclude<ValueSource, 'missing'>, { label: string; tone: 'primary' | 'success' | 'warning' }> = {
  iot: { label: 'PLC', tone: 'primary' },
  field: { label: 'Đồng hồ', tone: 'success' },
  manual: { label: 'Thủ công', tone: 'warning' },
};

/** Ô "Nguồn": PLC (IoT) · Đồng hồ (xác minh hiện trường) · Thủ công (ghi nhận thủ công) · "—". */
export function SourceBadge({ source }: { source: ValueSource }) {
  if (source === 'missing') return <span className="text-sm text-fg-secondary">—</span>;
  const b = SOURCE_BADGE[source];
  return (
    <Badge variant="tag" tone={b.tone} className="font-bold">
      {b.label}
    </Badge>
  );
}

/** Ô nhập giá trị đồng hồ cơ (nhập tay) – trống + rời ô → bỏ nhập tay. */
export function ManualInput({ reading: r, manual, onManual }: { reading: RecordReading } & ManualProps) {
  return (
    <NumberField
      size="sm"
      hideLabel
      label={`Giá trị đồng hồ cơ – ${r.label} (${r.unit})`}
      value={r.id in manual ? manual[r.id] : null}
      placeholder={r.value === null ? 'Nhập' : formatRecordValue(r.value, r.digits)}
      precision={r.digits}
      min={0}
      onChange={(v) => onManual(r.id, v)}
      onClear={() => onManual(r.id, null)}
    />
  );
}

/** Giá trị hiển thị; ô nhập khi đang nhập đồng hồ cơ hoặc IoT không có số. */
export function ValueCell({ reading: r, editing, manual, onManual, className }: { reading: RecordReading; editing: boolean; className?: string } & ManualProps) {
  if (editing || r.value === null) {
    return (
      <span className="block w-28">
        <ManualInput reading={r} manual={manual} onManual={onManual} />
      </span>
    );
  }
  return <span className={cn('tabular-nums', className)}>{formatRecordValue(effectiveValue(r, manual), r.digits)}</span>;
}

/** Dòng nhãn – giá trị dùng chung (máy hóa hơi, đường cấp, PLC). */
export function Row({ label, children, dim }: { label: string; children: ReactNode; dim?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <dt className={cn('font-semibold', dim ? 'text-fg-secondary/80' : 'text-fg-secondary')}>{label}</dt>
      <dd className={cn('text-right font-bold', dim ? 'text-fg-secondary' : 'text-fg')}>{children}</dd>
    </div>
  );
}

export function ReadingRow({ reading: r, dim, ...m }: { reading: RecordReading; dim?: boolean } & ManualProps) {
  const st = valueState(r, m.manual);
  const v = effectiveValue(r, m.manual);
  return (
    <Row label={`${r.label}:`} dim={dim}>
      {v === null ? (
        <span className="ml-auto block w-28">
          <ManualInput reading={r} {...m} />
        </span>
      ) : (
        <span className={cn('tabular-nums', st === 'warning' || st === 'abnormal' ? STATE_TEXT[st] : undefined)}>
          {formatRecordValue(v, r.digits)}
          {r.unit.startsWith('°') ? r.unit : ` ${r.unit}`}
          {st === 'warning' || st === 'abnormal' ? <span className="sr-only"> – {valueStateLabel(r, m.manual)}</span> : null}
        </span>
      )}
    </Row>
  );
}
