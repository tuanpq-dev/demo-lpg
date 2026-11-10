import { useId } from 'react';
import { cn } from '@/lib/cn';
import { Badge } from '../Badge';
import { Checkbox } from '../Checkbox';
import { CheckCircleIcon } from '../Icon';
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
  /** (plain) Chip trạng thái bên phải ("Có vấn đề" / "Không áp dụng" – hạng mục kiểm tra cảnh báo). */
  flag?: { label: string; tone: 'warning' | 'danger' | 'muted' };
  /** (plain) Khoá riêng mục này (aria-disabled) + gợi ý đọc kèm (vd "Đổi trong Cập nhật xử lý"). */
  lockedHint?: string;
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
  /**
   * summary = danh sách chỉ đọc gọn (✓ tròn + chữ, không ô/thanh tiến độ) – "Checklist hoàn thành" ở modal Gửi nghiệm thu.
   * Bỏ qua `onToggle`/`lockHint`.
   * plain = ô tròn + chữ, không thanh tiến độ/khung từng dòng ("Hướng dẫn xử lý" ở drawer cảnh báo). Vẫn là checkbox thật
   * (input ẩn + vòng tròn vẽ, focus hiện viền accent quanh vòng); `onToggle`/`lockHint` như default, nhưng khoá bằng
   * `aria-disabled` + `aria-describedby` → dòng gợi ý (focus được, không tick được).
   */
  variant?: 'default' | 'summary' | 'plain';
  className?: string;
};

/** "2/6 công việc hoàn thành · 33%" – đặt ở header card. */
export const checklistSummary = (p: ChecklistProgressView) => `${p.done}/${p.total} công việc hoàn thành · ${p.percent}%`;

/**
 * Checklist công việc – ảnh MT-00128 (số đo ước lượng): thanh tiến độ 6px màu primary (pixel ảnh #22D3EE = primary), mỗi mục
 * một hàng viền line/30 bo 4px cao `--checklist-row-height`,
 * checkbox thật + `<label>`; mục xong chữ primary + giờ bên phải; "Đang làm" nổi bật; "Không áp dụng" mờ + luôn khoá.
 */
export function Checklist({ items, progress, onToggle, lockHint, variant = 'default', className }: ChecklistProps) {
  const uid = useId();
  if (variant === 'summary') {
    return (
      <ul className={cn('flex flex-col gap-2.5', className)} aria-label={`Checklist: ${progress.done}/${progress.total} hoàn thành`}>
        {items.map((it) => (
          <li key={it.id} className={cn('flex items-start gap-2.5 text-base', it.na ? 'text-fg-secondary/65' : 'text-fg-secondary')}>
            {it.done ? (
              <CheckCircleIcon size={18} className="mt-px shrink-0 text-success" />
            ) : (
              <span aria-hidden="true" className="mt-px size-[18px] shrink-0 rounded-full border-[1.5px] border-fg-secondary/60" />
            )}
            <span className="min-w-0">
              {it.text}
              <span className="sr-only">{it.na ? ' – không áp dụng' : it.done ? ' – đã xong' : ' – chưa xong'}</span>
              {it.na && (
                <span aria-hidden="true" className="ml-2 text-xs">
                  (Không áp dụng)
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    );
  }
  const hintId = `${uid}-hint`;
  const locked = !!lockHint || !onToggle;
  if (variant === 'plain') {
    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        {lockHint && (
          <p id={hintId} className="text-sm text-fg-secondary">
            {lockHint}
          </p>
        )}
        <ul className="flex flex-col">
          {items.map((it) => {
            const id = `${uid}-${it.id}`;
            const metaId = `${id}-meta`;
            const flagId = `${id}-flag`;
            const off = locked || !!it.na || !!it.lockedHint;
            return (
              <li key={it.id} className={cn('flex min-h-10 items-center gap-3 rounded-md px-2.5', !off && 'hover:bg-surface-muted/40')}>
                {/* Khoá = aria-disabled (KHÔNG `disabled`): vẫn Tab tới được, trình đọc đọc dòng gợi ý (aria-describedby);
                    click/Space không đổi trạng thái (onChange trả ô về giá trị cũ, không gọi onToggle). */}
                <input
                  id={id}
                  type="checkbox"
                  className="peer sr-only"
                  checked={it.done}
                  aria-disabled={off || undefined}
                  onChange={(e) => {
                    // Khoá: trả ô về đúng trạng thái (trình duyệt đã đảo trước khi tới đây), không gọi onToggle.
                    if (off) e.currentTarget.checked = it.done;
                    else onToggle?.(it.id);
                  }}
                  aria-describedby={
                    [it.done && it.time ? metaId : null, it.flag ? flagId : null, lockHint ? hintId : null].filter(Boolean).join(' ') || undefined
                  }
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid size-[18px] shrink-0 place-items-center rounded-full border-[1.5px] peer-aria-disabled:opacity-60 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
                    it.done ? 'border-primary bg-primary text-fg-inverse' : 'border-line',
                  )}
                >
                  {it.done && (
                    <svg viewBox="0 0 16 16" className="size-3">
                      <path
                        d="M4 8.5l2.5 2.5L12 5.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <label htmlFor={id} className={cn('min-w-0 flex-1 text-md', it.done ? 'text-primary' : 'text-fg', !off && 'cursor-pointer')}>
                  {it.text}
                </label>
                {it.flag && (
                  <Badge variant="tag" tone={it.flag.tone}>
                    <span id={flagId}>
                      {it.flag.label}
                      {it.lockedHint && <span className="sr-only"> – {it.lockedHint}</span>}
                    </span>
                  </Badge>
                )}
                {it.done && it.time && (
                  <span id={metaId} className="shrink-0 text-sm tabular-nums text-fg-secondary">
                    <span className="sr-only">Đã làm lúc </span>
                    {it.time}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
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
