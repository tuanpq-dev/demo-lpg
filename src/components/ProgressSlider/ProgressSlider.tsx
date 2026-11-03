import { useId, useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
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
  /**
   * progress = modal tiến độ (nhãn 18px, số 32px primary, rãnh 8px tô phần đã đạt) ·
   * threshold = thanh chọn mức mô phỏng (màn cấu hình kịch bản): nhãn 14px, số 24px, rãnh 6px KHÔNG tô, vạch ngưỡng
   * `marker` + thang min/max dưới rãnh.
   */
  variant?: 'progress' | 'threshold';
  /** Số hiển thị bên phải nhãn (thay "{value}{unit}") – vd "35%" đỏ + "LEL" xám. aria-valuetext vẫn theo `valueText`. */
  valueDisplay?: ReactNode;
  /** aria-valuetext (mặc định "{value}{unit}"). */
  valueText?: string;
  /** Vạch ngưỡng (variant threshold): vạch vàng trên rãnh + nhãn dưới ("20% LEL: Ngưỡng cảnh báo PLC"). */
  marker?: { value: number; label: string };
  /** Chữ hai đầu thang (variant threshold) – mặc định "{min}{unit}" / "{max}{unit}". */
  scaleLabels?: [string, string];
  className?: string;
};

const snap = (v: number, min: number, max: number, step: number) => Math.min(max, Math.max(min, Math.round((v - min) / step) * step + min));

/**
 * Thanh trượt tiến độ – modal "Cập nhật tiến độ bảo trì" (ảnh thiết kế, số đo ước lượng): nhãn 18px trái + số lớn 32px
 * primary phải, rãnh 8px bo tròn (surface-muted) + phần đã đạt primary. Ảnh KHÔNG có nút kéo → thêm nút tròn 16px
 * (phần thêm ngoài Figma, docs/figma-diffs.md) để thấy được là kéo được và có chỗ hiện viền focus.
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
  variant = 'progress',
  valueDisplay,
  valueText,
  marker,
  scaleLabels,
  className,
}: ProgressSliderProps) {
  const labelId = useId();
  const threshold = variant === 'threshold';
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const toPct = (v: number) => (max > min ? ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * 100 : 0);
  const pct = toPct(value);
  const markerPct = marker ? toPct(marker.value) : 0;

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
    <div className={cn('flex flex-col', threshold ? 'gap-2' : 'gap-3', className)}>
      <div className="flex items-end justify-between gap-3">
        <span id={labelId} className={threshold ? 'text-base text-fg-secondary' : 'text-lg font-semibold text-fg-secondary'}>
          {label}
        </span>
        <span
          aria-hidden="true"
          className={cn('leading-none tabular-nums', threshold ? 'text-xl' : 'text-3xl font-semibold text-primary')}
        >
          {valueDisplay ?? (
            <>
              {value}
              {unit}
            </>
          )}
        </span>
      </div>
      {/* Vùng bấm cao 20px (dễ trúng) bao rãnh 8px. */}
      <div
        ref={trackRef}
        className={cn('relative flex h-5 touch-none items-center', disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
      >
        {threshold ? (
          <div aria-hidden="true" className="absolute inset-x-0 h-1.5 rounded-full bg-surface-muted" />
        ) : (
          <div aria-hidden="true" className="absolute inset-x-0 h-2 overflow-hidden rounded-full bg-surface-muted">
            <div className="h-full rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-100" style={{ width: `${pct}%` }} />
          </div>
        )}
        {threshold && marker && (
          <span aria-hidden="true" className="absolute h-4 w-1 -translate-x-1/2 rounded-full bg-warning" style={{ left: `${markerPct}%` }} />
        )}
        <div
          ref={thumbRef}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-labelledby={labelId}
          aria-describedby={describedBy}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={valueText ?? `${value}${unit}`}
          aria-disabled={disabled || undefined}
          onKeyDown={onKeyDown}
          className={cn(
            'absolute -translate-x-1/2 rounded-full bg-primary shadow-card',
            threshold ? 'size-[18px] border-2 border-primary' : 'size-4 border-2 border-surface',
          )}
          style={{ left: `${pct}%` }}
        />
      </div>
      {threshold && (
        // Thang: min · nhãn ngưỡng (canh theo vạch, kẹp trong khung) · max. Nhãn ngưỡng ẩn với trình đọc – đã nằm trong mô tả.
        <div aria-hidden="true" className="relative flex h-4 items-center justify-between text-sm tabular-nums text-fg-secondary">
          <span>{scaleLabels?.[0] ?? `${min}${unit}`}</span>
          {marker && (
            <span
              className="absolute whitespace-nowrap text-warning"
              style={{ left: `${markerPct}%`, transform: `translateX(-${Math.min(100, Math.max(0, markerPct))}%)` }}
            >
              {marker.label}
            </span>
          )}
          <span>{scaleLabels?.[1] ?? `${max}${unit}`}</span>
        </div>
      )}
    </div>
  );
}
