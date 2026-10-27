import { cn } from '@/lib/cn';

export type GaugeBand = { from: number; to?: number; tone: 'success' | 'warning-dim' | 'warning' | 'danger'; label: string };
export type GaugeTickView = { value: number; label: string; /** Mốc nguy hiểm (ESD) – chữ `danger-text`. */ danger?: boolean };

export type ThresholdGaugeProps = {
  /** Tên cho trình đọc màn hình, vd "Áp suất lúc cảnh báo so với ngưỡng". */
  label: string;
  value: number;
  min: number;
  max: number;
  threshold: number;
  /** above (mặc định): xanh tới ngưỡng, đỏ sau ngưỡng · below: đảo – đỏ dưới ngưỡng, xanh trên ngưỡng. */
  direction?: 'above' | 'below';
  /** aria-valuetext – phải nói rõ "vượt ngưỡng" / "dưới ngưỡng" (`gaugeValueText` ở features/alerts/gauge). */
  valueText: string;
  /** Chữ trên nhãn vạch giá trị, vd "11.8". */
  valueLabel: string;
  /**
   * Nhiều mức (drawer cảnh báo gas): đoạn màu đặc theo token (success · warning/60 · warning · danger), thanh cao 24px,
   * vạch primary + nhãn nổi trên thanh, mốc trục dưới thanh (`ticks`). Có `bands` thì bỏ qua `threshold`/`direction`.
   */
  bands?: readonly GaugeBand[];
  ticks?: readonly GaugeTickView[];
  /** Mất tín hiệu (bands): vạch + nhãn nét đứt màu chữ phụ – giá trị vẽ là giá trị LÚC cảnh báo, không phải số hiện tại. */
  stale?: boolean;
  className?: string;
};

const BAND_CLASS: Record<GaugeBand['tone'], string> = {
  success: 'bg-success',
  'warning-dim': 'bg-warning/60',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

/** Vị trí mốc trục: đầu/cuối canh mép, còn lại canh giữa. */
const tickAlign = (i: number, n: number) => (i === 0 ? 'translate-x-0' : i === n - 1 ? '-translate-x-full' : '-translate-x-1/2');

function BandGauge({ label, value, min, max, valueText, valueLabel, bands, ticks = [], stale, className }: ThresholdGaugeProps & { bands: readonly GaugeBand[] }) {
  const v = pct(value, min, max);
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.min(max, Math.max(min, value))}
      aria-valuetext={valueText}
      className={cn('relative', className)}
    >
      <div aria-hidden="true" className="relative pb-6 pt-8">
        <div className="flex h-6 overflow-hidden rounded-sm">
          {bands.map((b) => {
            const from = Math.max(min, b.from);
            const to = Math.min(max, b.to ?? max);
            return to > from ? <span key={b.from} className={BAND_CLASS[b.tone]} style={{ width: `${((to - from) / (max - min)) * 100}%` }} /> : null;
          })}
        </div>
        {/* Vạch giá trị + nhãn (nền surface, viền primary); mất tín hiệu → nét đứt màu chữ phụ. */}
        <span
          className={cn('absolute bottom-5 top-6 -translate-x-1/2', stale ? 'w-0 border-l-2 border-dashed border-fg-secondary' : 'w-0.5 bg-primary')}
          style={{ left: v }}
        />
        <span
          className={cn(
            'absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-xs border bg-surface px-1.5 text-xs leading-5 tabular-nums',
            stale ? 'border-dashed border-fg-secondary text-fg-secondary' : 'border-primary text-primary',
          )}
          style={{ left: v }}
        >
          {valueLabel}
        </span>
        {ticks.map((t, i) => (
          <span
            key={t.value}
            className={cn('absolute bottom-0 whitespace-nowrap text-xs leading-4 tabular-nums', tickAlign(i, ticks.length), t.danger ? 'text-danger-text' : 'text-fg-secondary')}
            style={{ left: pct(t.value, min, max) }}
          >
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}

const pct = (v: number, min: number, max: number) => `${Math.min(100, Math.max(0, ((v - min) / (max - min || 1)) * 100))}%`;

/**
 * Thanh đo giá trị so với ngưỡng – drawer chi tiết cảnh báo (ảnh, chưa có node): khung bo 6px nền chip, thanh 8px bo tròn
 * hai đoạn (an toàn `success` / vượt ngưỡng `danger`), vạch trắng tại giá trị + nhãn nhỏ nền trắng chữ đỏ đậm.
 * `role="meter"` (min/max/now + valuetext); phần vẽ ẩn khỏi trình đọc. Giá trị ngoài thang được kẹp khi vẽ.
 * Có `bands` → thang nhiều mức (`BandGauge`, drawer gas); không có → một ngưỡng như drawer áp suất.
 */
export function ThresholdGauge(props: ThresholdGaugeProps) {
  if (props.bands) return <BandGauge {...props} bands={props.bands} />;
  const { label, value, min, max, threshold, direction = 'above', valueText, valueLabel, className } = props;
  const t = pct(threshold, min, max);
  const v = pct(value, min, max);
  const [first, second] = direction === 'above' ? ['bg-success', 'bg-danger'] : ['bg-danger', 'bg-success'];
  const breached = direction === 'above' ? value > threshold : value < threshold;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.min(max, Math.max(min, value))}
      aria-valuetext={valueText}
      className={cn('relative h-9 rounded-md border border-line/30 bg-surface-chip/70', className)}
    >
      <div aria-hidden="true" className="absolute inset-x-2 inset-y-0">
        <div className="absolute inset-x-0 top-1/2 flex h-2 -translate-y-1/2 overflow-hidden rounded-full">
          <span className={first} style={{ width: t }} />
          <span className={cn('flex-1', second)} />
        </div>
        <span className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-fg" style={{ left: v }} />
        <span
          className={cn(
            'absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xs bg-fg px-1 text-2xs font-bold leading-4 tabular-nums',
            breached ? 'text-danger-solid' : 'text-fg-inverse',
          )}
          style={{ left: v }}
        >
          {valueLabel}
        </span>
      </div>
    </div>
  );
}
