import { useId, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { cn } from '@/lib/cn';

export type ProgressSliderProps = {
  /** Nhãn hiển thị bên trái (cũng là tên truy cập của thanh trượt). */
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Bước (mặc định 5). PageUp/PageDown = 2 bước. */
  step?: number;
  /** Đơn vị sau số (mặc định "%"). */
  unit?: string;
  disabled?: boolean;
  /** id của phần tử mô tả thêm (vd dòng "Checklist 2/6"). */
  describedBy?: string;
  className?: string;
};

const snap = (v: number, min: number, max: number, step: number) => Math.min(max, Math.max(min, Math.round((v - min) / step) * step + min));

/**
 * Thanh trượt tiến độ – modal "Cập nhật tiến độ bảo trì" (ảnh thiết kế, số đo ước lượng): nhãn 18px trái + số lớn 32px
 * primary phải, rãnh 8px bo tròn (surface-muted) + phần đã đạt primary. Ảnh KHÔNG có nút kéo → thêm nút tròn 16px
 * (phần thêm ngoài Figma, CLAUDE.md mục 8) để thấy được là kéo được và có chỗ hiện viền focus.
 *
 * `role="slider"` + `aria-valuenow/min/max/valuetext`. Bàn phím: ←/↓ −bước · →/↑ +bước · PageDown/PageUp ±2 bước ·
 * Home/End. Chuột/cảm ứng: bấm hoặc kéo trên rãnh (pointer capture).
 */
export function ProgressSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 5,
  unit = '%',
  disabled,
  describedBy,
  className,
}: ProgressSliderProps) {
  const labelId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const pct = max > min ? ((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100 : 0;

  const set = (v: number) => {
    const next = snap(v, min, max, step);
    if (next !== value) onChange(next);
  };

  const fromPointer = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    set(min + ((clientX - rect.left) / rect.width) * (max - min));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    thumbRef.current?.focus();
    fromPointer(e.clientX);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || !e.currentTarget.hasPointerCapture?.(e.pointerId)) return;
    fromPointer(e.clientX);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const delta: Record<string, number> = {
      ArrowLeft: -step,
      ArrowDown: -step,
      ArrowRight: step,
      ArrowUp: step,
      PageDown: -2 * step,
      PageUp: 2 * step,
    };
    if (e.key in delta) set(value + delta[e.key]!);
    else if (e.key === 'Home') set(min);
    else if (e.key === 'End') set(max);
    else return;
    e.preventDefault();
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-end justify-between gap-3">
        <span id={labelId} className="text-lg font-semibold text-fg-secondary">
          {label}
        </span>
        <span aria-hidden="true" className="text-3xl font-semibold leading-none tabular-nums text-primary">
          {value}
          {unit}
        </span>
      </div>
      {/* Vùng bấm cao 20px (dễ trúng) bao rãnh 8px. */}
      <div
        ref={trackRef}
        className={cn('relative flex h-5 touch-none items-center', disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
      >
        <div aria-hidden="true" className="absolute inset-x-0 h-2 overflow-hidden rounded-full bg-surface-muted">
          <div className="h-full rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-100" style={{ width: `${pct}%` }} />
        </div>
        <div
          ref={thumbRef}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-labelledby={labelId}
          aria-describedby={describedBy}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={`${value}${unit}`}
          aria-disabled={disabled || undefined}
          onKeyDown={onKeyDown}
          className="absolute size-4 -translate-x-1/2 rounded-full border-2 border-surface bg-primary shadow-card"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}
