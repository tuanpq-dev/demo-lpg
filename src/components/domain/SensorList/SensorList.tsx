import { cn } from '@/lib/cn';
import { Badge, type TagTone } from '../../Badge';
import { SignalLostIcon } from '../../Icon';

export type SensorRow = {
  id: string;
  name: string;
  /** Giá trị đã định dạng ("25% LEL"); null = mất tín hiệu (không hiện số cũ) · undefined = chưa có số liệu. */
  valueText: string | null | undefined;
  /** Nhãn mức ("Bình thường", "Cảnh báo cấp 2") – null khi mất tín hiệu / chưa có số. */
  levelLabel: string | null;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
  /** Cảm biến gây cảnh báo – vạch trái theo tone + chữ theo tone đậm. */
  highlight?: boolean;
};

export type SensorListProps = { label: string; rows: readonly SensorRow[]; className?: string };

const DOT = { success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', neutral: 'bg-neutral/70' } as const;
const TEXT = { success: 'text-fg', warning: 'text-warning', danger: 'text-danger-text', neutral: 'text-fg' } as const;
/** Dòng gây cảnh báo: vạch mép trái theo mức (KHÔNG nền sáng – `surface-muted` làm chữ đỏ < 4.5:1; ảnh nền sáng hơn). */
const BAR = { success: 'border-l-success', warning: 'border-l-warning', danger: 'border-l-danger', neutral: 'border-l-neutral' } as const;
const BADGE: Record<SensorRow['tone'], TagTone> = { success: 'success', warning: 'warning', danger: 'danger', neutral: 'neutral' };

/**
 * "Cảm biến trong khu vực" – drawer cảnh báo gas (ảnh): danh sách khung viền, mỗi dòng chấm màu · tên · giá trị · badge mức.
 * Dòng gây cảnh báo: vạch màu mức ở mép trái + chữ màu mức đậm (ảnh: nền sáng hơn – đổi vì tương phản chữ đỏ). Mất tín hiệu: "Mất tín hiệu" + icon, chấm xám, không có badge mức.
 */
export function SensorList({ label, rows, className }: SensorListProps) {
  return (
    <ul aria-label={label} className={cn('overflow-hidden rounded-md border border-line/30 bg-surface-muted/40', className)}>
      {rows.map((r) => {
        const lost = r.valueText === null;
        return (
          <li
            key={r.id}
            className={cn(
              'flex min-h-12 items-center gap-3 border-b border-line/30 px-4 py-2 last:border-b-0',
              r.highlight && cn('border-l-[3px] pl-[13px]', BAR[r.tone]),
            )}
          >
            <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', lost ? DOT.neutral : DOT[r.tone])} />
            <span className={cn('min-w-0 flex-1 text-md', r.highlight ? cn('font-semibold', TEXT[r.tone]) : 'text-fg')}>
              {r.name}
              {r.highlight && <span className="sr-only"> – cảm biến gây cảnh báo</span>}
            </span>
            {lost ? (
              <span className="flex items-center gap-1 text-base text-fg-secondary">
                <SignalLostIcon size={14} className="shrink-0" /> Mất tín hiệu
              </span>
            ) : (
              <span className={cn('shrink-0 text-md tabular-nums', r.highlight ? cn('font-semibold', TEXT[r.tone]) : 'text-fg')}>
                {r.valueText ?? '—'}
              </span>
            )}
            {r.levelLabel && !lost && (
              // Lót nền đặc: badge trong mờ trên nền thẻ sáng hơn → chữ đỏ ESD < 4.5:1 (cùng cách chip "quá hạn" ở 5H).
              <span className="shrink-0 rounded-sm bg-surface">
                <Badge variant="tag" tone={BADGE[r.tone]}>
                  {r.levelLabel}
                </Badge>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
