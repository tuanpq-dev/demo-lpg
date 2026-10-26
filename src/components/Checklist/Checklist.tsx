import { useId } from 'react';
import { cn } from '@/lib/cn';
import { Badge } from '../Badge';
import { Checkbox } from '../Checkbox';
import { ProgressBar } from '../ProgressBar';

export type ChecklistItemView = {
  id: string;
  text: string;
  done: boolean;
  /** Không áp dụng: luôn khoá, mờ, chip "Không áp dụng". */
  na?: boolean;
  /** Đang làm: nền + vạch trái primary, chữ đậm, chip "Đang làm". */
  active?: boolean;
  /** Giờ hoàn thành đã định dạng, vd "10:15". */
  time?: string;
};

export type ChecklistProgressView = { done: number; total: number; percent: number };

export type ChecklistProps = {
  items: readonly ChecklistItemView[];
  /** Tiến độ đã tính ở lớp dữ liệu (bỏ mục N/A). */
  progress: ChecklistProgressView;
  /** Bấm ô → id mục. Không truyền = chỉ đọc. */
  onToggle?: (id: string) => void;
  /** Có giá trị → khoá mọi ô + hiện gợi ý này (vd "Tiếp nhận yêu cầu trước…"). */
  lockHint?: string | null;
  className?: string;
};

/** "2/6 công việc hoàn thành · 33%" – đặt ở header card. */
export const checklistSummary = (p: ChecklistProgressView) => `${p.done}/${p.total} công việc hoàn thành · ${p.percent}%`;

/**
 * Checklist công việc – ảnh MT-00128 (số đo ước lượng): thanh tiến độ 6px màu primary (pixel ảnh #22D3EE = primary), mỗi mục
 * một hàng viền line/30 bo 4px cao `--checklist-row-height`,
 * checkbox thật + `<label>`; mục xong chữ primary + giờ bên phải; "Đang làm" nổi bật; "Không áp dụng" mờ + luôn khoá.
 */
export function Checklist({ items, progress, onToggle, lockHint, className }: ChecklistProps) {
  const uid = useId();
  const hintId = `${uid}-hint`;
  const locked = !!lockHint || !onToggle;
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <ProgressBar value={progress.percent} tone="primary" size="md" track="solid" label="Tiến độ checklist" />
      {lockHint && (
        <p id={hintId} className="text-sm text-fg-secondary">
          {lockHint}
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {items.map((it) => {
          const id = `${uid}-${it.id}`;
          const metaId = `${id}-meta`;
          const meta = it.na ? 'Không áp dụng' : it.done && it.time ? `Hoàn thành lúc ${it.time}` : it.active ? 'Đang làm' : undefined;
          return (
            <li
              key={it.id}
              className={cn(
                'flex min-h-[var(--checklist-row-height)] items-center gap-3 rounded-sm border px-3 py-2',
                it.active && !it.done ? 'border-primary/30 border-l-2 border-l-primary bg-primary/10' : 'border-line/30',
              )}
            >
              <Checkbox
                id={id}
                checked={it.done}
                disabled={locked || it.na}
                onChange={() => onToggle?.(it.id)}
                label={it.text}
                aria-label={undefined}
                aria-describedby={[meta ? metaId : null, lockHint ? hintId : null].filter(Boolean).join(' ') || undefined}
              />
              <label
                htmlFor={id}
                className={cn(
                  'min-w-0 flex-1 text-base',
                  // N/A: mờ chữ (nhãn của ô bị khoá – WCAG miễn tương phản); chip "Không áp dụng" giữ đủ tương phản.
                  it.na ? 'text-fg-secondary/50' : it.done ? 'text-primary' : it.active ? 'font-semibold text-fg' : 'text-fg',
                  !(locked || it.na) && 'cursor-pointer',
                )}
              >
                {it.text}
              </label>
              {it.na ? (
                <Badge variant="tag" tone="muted">
                  <span id={metaId}>Không áp dụng</span>
                </Badge>
              ) : it.done && it.time ? (
                <span id={metaId} className="shrink-0 text-sm tabular-nums text-fg-secondary">
                  <span className="sr-only">Hoàn thành lúc </span>
                  {it.time}
                </span>
              ) : it.active ? (
                <Badge variant="tag" tone="primary">
                  <span id={metaId}>Đang làm</span>
                </Badge>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
