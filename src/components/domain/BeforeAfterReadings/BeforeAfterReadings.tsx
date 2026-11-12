import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { NumberField } from '../../FormField/NumberField';

export type ReadingTone = 'danger' | 'warning' | 'normal';

export type ReadingRowView = {
  id: string;
  label: string;
  /** Dòng nhỏ dưới nhãn, vd "Giới hạn: 10.5 bar". */
  limit?: string;
  unit: string;
  before?: number;
  after?: number;
  beforeTone?: ReadingTone;
  afterTone?: ReadingTone;
  /** Ô "Sau" sửa tay được (nguồn xác minh có đồng hồ cơ). */
  editable: boolean;
  /** Chữ thay số khi không có giá trị "Sau" (vd "Mất tín hiệu"). */
  afterPlaceholder?: string;
  /** Giá trị "Sau" dạng chữ (tag trạng thái, vd đầu báo khói "Bình thường" / "Báo động") – tô theo `afterTone`. */
  afterText?: string;
};

export type BeforeAfterReadingsProps = {
  /** Tên nhóm (aria) – vd "Thông số trước và sau xử lý". */
  label: string;
  rows: readonly ReadingRowView[];
  onAfterChange: (id: string, value: number | undefined) => void;
  /** Nội dung dưới các dòng (nguồn xác minh, thời gian ghi nhận). */
  footer?: ReactNode;
  className?: string;
};

const toneClass: Record<ReadingTone, string> = { danger: 'text-danger-text', warning: 'text-warning', normal: 'text-fg' };
const toneWord: Record<ReadingTone, string> = { danger: ' (vượt mức nguy hiểm)', warning: ' (vượt ngưỡng cảnh báo)', normal: '' };
/** Một chữ số lẻ (như `formatMeasure`) – số live dao động không hiện 2 chữ số lẻ. */
const fmt = (n: number, unit: string) => `${+n.toFixed(1)} ${unit}`;

/**
 * "Thông số trước và sau xử lý" (modal cập nhật xử lý cảnh báo áp suất – ảnh): nhãn (+ giới hạn) · ô Trước (số lúc
 * cảnh báo, chỉ đọc, "–" khi không có) · → · ô Sau (số trực tiếp; sửa tay khi `editable`). Màu số theo ngưỡng do nơi gọi tính
 * (`tone`) – màu kèm chữ ẩn "(vượt ngưỡng…)" để không chỉ dựa vào màu. Dưới `sm` mỗi dòng xếp nhãn lên trên hai ô.
 */
export function BeforeAfterReadings({ label, rows, onAfterChange, footer, className }: BeforeAfterReadingsProps) {
  return (
    <div role="group" aria-label={label} className={cn('flex flex-col gap-4 rounded-lg border border-line/30 bg-surface-sunken/30 p-4', className)}>
      {rows.map((r) => (
        <div
          key={r.id}
          className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_minmax(0,1fr)]"
        >
          <div className="col-span-3 min-w-0 sm:col-span-1">
            <p className="text-md text-fg-secondary">{r.label}</p>
            {r.limit && <p className="text-xs text-danger-text">{r.limit}</p>}
          </div>
          <div className="flex h-field items-center justify-center rounded-md border border-line/30 bg-surface-sunken text-base font-semibold tabular-nums">
            <span className="sr-only">{r.label} trước xử lý: </span>
            {r.before !== undefined ? (
              <span className={toneClass[r.beforeTone ?? 'normal']}>
                {fmt(r.before, r.unit)}
                <span className="sr-only">{toneWord[r.beforeTone ?? 'normal']}</span>
              </span>
            ) : (
              <span className="text-fg-secondary">
                –<span className="sr-only">không có số liệu</span>
              </span>
            )}
          </div>
          <span aria-hidden="true" className="text-fg-secondary">
            →
          </span>
          {r.editable ? (
            <NumberField
              label={`${r.label} sau xử lý`}
              hideLabel
              value={r.after}
              onChange={(v) => onAfterChange(r.id, v)}
              onClear={() => onAfterChange(r.id, undefined)}
              min={0}
              step={0.1}
              precision={1}
              unit={r.unit}
              placeholder="Nhập số đo"
              align="center"
              tone={r.afterTone === 'danger' ? 'danger' : r.afterTone === 'warning' ? 'warning' : 'default'}
            />
          ) : (
            <div className="flex h-field items-center justify-center rounded-md border border-line/30 bg-surface-sunken text-base font-semibold tabular-nums">
              <span className="sr-only">{r.label} sau xử lý: </span>
              {r.afterText !== undefined ? (
                <span className={toneClass[r.afterTone ?? 'normal']}>{r.afterText}</span>
              ) : r.after !== undefined ? (
                <span className={toneClass[r.afterTone ?? 'normal']}>
                  {fmt(r.after, r.unit)}
                  <span className="sr-only">{toneWord[r.afterTone ?? 'normal']}</span>
                </span>
              ) : (
                <span className="text-sm font-normal text-fg-secondary">{r.afterPlaceholder ?? '–'}</span>
              )}
            </div>
          )}
        </div>
      ))}
      {footer && <div className="border-t border-line/30 pt-4">{footer}</div>}
    </div>
  );
}
