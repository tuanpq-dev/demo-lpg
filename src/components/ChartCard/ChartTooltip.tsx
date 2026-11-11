import type { TooltipContentProps } from 'recharts';

type ValueType = number | string | Array<number | string>;
type NameType = number | string;

/** recharts tự truyền `active` / `payload` / `label` khi dùng `<Tooltip content={<ChartTooltip … />} />` → để tuỳ chọn. */
export type ChartTooltipProps = Partial<Pick<TooltipContentProps<ValueType, NameType>, 'active' | 'payload' | 'label'>> & {
  /** Đơn vị hiển thị sau giá trị, ví dụ "Nm³", "bar". */
  unit?: string;
  /** Định dạng số; mặc định toLocaleString('en-US'). */
  format?: (v: number) => string;
  /** Định dạng nhãn (giá trị trục X) – trục số (giây) → "06:32". */
  labelFormat?: (label: number | string) => string;
};

/** Tooltip dùng chung cho chart – nền surface-raised, viền line/30 (theo style tối của app). */
export function ChartTooltip({ active, payload, label, unit, format, labelFormat }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const fmt = format ?? ((v: number) => v.toLocaleString('en-US'));
  return (
    <div className="rounded-md border border-line/30 bg-surface-raised px-3 py-2 shadow-card">
      {label !== undefined && <p className="mb-1 text-2xs text-fg-muted">{labelFormat ? labelFormat(label) : label}</p>}
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-sm text-fg">
          <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} aria-hidden="true" />
          {p.name !== undefined && p.name !== p.dataKey && <span className="text-fg-secondary">{p.name}</span>}
          <span className="font-semibold tabular-nums">
            {typeof p.value === 'number' ? fmt(p.value) : String(p.value)}
            {unit && <span className="ml-0.5 font-normal text-fg-muted">{unit}</span>}
          </span>
        </p>
      ))}
    </div>
  );
}
