import { cn } from '@/lib/cn';
import { ProgressBar, type ProgressTone } from '../ProgressBar';
import { formatNumber } from '@/lib/number';

export type CategoryBarItem = {
  id: string;
  label: string;
  value: number;
  tone?: ProgressTone;
};

export type CategoryBarListProps = {
  items: readonly CategoryBarItem[];
  /** Giá trị ứng với thanh đầy. Mặc định = giá trị lớn nhất. */
  max?: number;
  /** Đơn vị cho aria-label, ví dụ "Nm³/h". */
  unit?: string;
  format?: (v: number) => string;
  className?: string;
};

/** "Tiêu thụ theo khu vực" – nhãn + giá trị + ProgressBar 6px (Figma 53:341). */
export function CategoryBarList({ items, max, unit, format, className }: CategoryBarListProps) {
  const top = max ?? Math.max(...items.map((i) => i.value), 1);
  const fmt = format ?? ((v: number) => formatNumber(v));
  return (
    <ul className={cn('flex flex-col gap-3 pt-5', className)}>
      {items.map((item) => (
        <li key={item.id} className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-fg-muted">{item.label}</span>
            <span className="tabular-nums text-fg">{fmt(item.value)}</span>
          </div>
          <ProgressBar
            value={item.value}
            max={top}
            size="md"
            tone={item.tone ?? 'accent'}
            label={`${item.label}: ${fmt(item.value)}${unit ? ` ${unit}` : ''}`}
          />
        </li>
      ))}
    </ul>
  );
}
