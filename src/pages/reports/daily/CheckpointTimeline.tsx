import { Button, Card, StatusDot, type DotStatus } from '@/components';
import { CHECKPOINT_STATE_LABEL, type CheckpointState, type CheckpointView } from '@/features/reports';
import { cn } from '@/lib/cn';

const DOT: Record<CheckpointState, DotStatus> = {
  confirmed: 'success',
  'needs-verify': 'verify',
  missing: 'warning',
  upcoming: 'offline',
};

const TEXT: Record<CheckpointState, string> = {
  confirmed: 'text-success',
  'needs-verify': 'text-verify',
  missing: 'text-warning',
  upcoming: 'text-fg-secondary',
};

/**
 * Dải 6 mốc kiểm tra trong ngày (frame 117:4250, ô nền #091522 → `bg-app`): giờ + chấm + trạng thái mốc.
 * Bố cục suy ra từ mô tả (không lấy node Figma) – docs/figma-diffs.md.
 */
export function CheckpointTimeline({ items, onRecord }: { items: readonly CheckpointView[]; onRecord?: (key: string) => void }) {
  return (
    <Card title="Mốc kiểm tra trong ngày" radius="lg">
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((c) => (
          <li
            key={c.key}
            className={cn(
              'flex flex-col gap-1 rounded-md border bg-bg-app px-3 py-2.5',
              c.state === 'missing' ? 'border-warning/60' : 'border-line/30',
            )}
          >
            <span className="text-md font-semibold tabular-nums text-fg">{c.label}</span>
            <span className={cn('flex items-center gap-1.5 text-sm', TEXT[c.state])}>
              <StatusDot status={DOT[c.state]} />
              {CHECKPOINT_STATE_LABEL[c.state]}
            </span>
            {/* Mốc tới hạn chưa có dữ liệu → mở modal "Ghi nhận mốc kiểm tra" (Figma 126:8506). */}
            {onRecord && c.state === 'missing' && (
              <Button variant="outline" size="sm" className="mt-1 self-start" aria-label={`Ghi nhận mốc ${c.label}`} onClick={() => onRecord(c.key)}>
                Ghi nhận
              </Button>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}
