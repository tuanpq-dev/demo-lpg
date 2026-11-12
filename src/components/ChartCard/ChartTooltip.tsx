import { formatNumber } from '@/lib/number';

/** Một dòng trong tooltip: chấm màu · tên (tuỳ chọn) · giá trị. */
export type ChartTooltipItem = {
  key: string;
  /** Tên series – bỏ trống khi chart chỉ có một series. */
  name?: string;
  value: number | string;
  /** Màu chấm (đã đổi từ token). */
  color: string;
};

export type ChartTooltipProps = {
  active?: boolean;
  items?: readonly ChartTooltipItem[];
  /** Giá trị trục X của điểm đang trỏ. */
  label?: number | string;
  /** Đơn vị hiển thị sau giá trị, ví dụ "Nm³", "bar". */
  unit?: string;
  /** Định dạng số; mặc định `formatNumber` (12,450.5). */
  format?: (v: number) => string;
  /** Định dạng nhãn (giá trị trục X) – trục số (giây) → "06:32". */
  labelFormat?: (label: number | string) => string;
};

/** Tooltip dùng chung cho chart – nền surface-raised, viền line/30 (theo style tối của app). */
export function ChartTooltip({ active, items, label, unit, format, labelFormat }: ChartTooltipProps) {
  if (!active || !items?.length) return null;
  const fmt = format ?? ((v: number) => formatNumber(v));
  return (
    <div className="rounded-md border border-line/30 bg-surface-raised px-3 py-2 shadow-card">
      {label !== undefined && <p className="mb-1 text-2xs text-fg-muted">{labelFormat ? labelFormat(label) : label}</p>}
      {items.map((p) => (
        <p key={p.key} className="flex items-center gap-2 whitespace-nowrap text-sm text-fg">
          <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} aria-hidden="true" />
          {p.name !== undefined && <span className="text-fg-secondary">{p.name}</span>}
          <span className="font-semibold tabular-nums">
            {typeof p.value === 'number' ? fmt(p.value) : p.value}
            {unit && <span className="ml-0.5 font-normal text-fg-muted">{unit}</span>}
          </span>
        </p>
      ))}
    </div>
  );
}
