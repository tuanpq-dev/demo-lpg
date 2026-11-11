import { useId, useRef, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from 'react';
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

/** Giá trị mới theo phím (WAI-ARIA slider): ←/↓ −bước · →/↑ +bước · PageDown/PageUp ±2 bước · Home/End; phím khác → undefined. */
function keyValue(key: string, value: number, min: number, max: number, step: number): number | undefined {
  const delta: Record<string, number> = {
    ArrowLeft: -step,
    ArrowDown: -step,
    ArrowRight: step,
    ArrowUp: step,
    PageDown: -2 * step,
    PageUp: 2 * step,
  };
  if (key in delta) return value + delta[key]!;
  if (key === 'Home') return min;
  if (key === 'End') return max;
  return undefined;
}

/** Bấm / kéo trên rãnh (pointer capture) → `onRatio(0…1)` theo vị trí ngang; focus về nút kéo khi bấm. */
function sliderPointer(
  trackRef: RefObject<HTMLDivElement | null>,
  thumbRef: RefObject<HTMLDivElement | null>,
  disabled: boolean,
  onRatio: (ratio: number) => void,
) {
  const fromPointer = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (rect && rect.width > 0) onRatio((clientX - rect.left) / rect.width);
  };
  return {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      if (disabled || e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      thumbRef.current?.focus();
      fromPointer(e.clientX);
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      if (!disabled && e.currentTarget.hasPointerCapture?.(e.pointerId)) fromPointer(e.clientX);
    },
  };
}

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

  const { onPointerDown, onPointerMove } = sliderPointer(trackRef, thumbRef, !!disabled, (ratio) => set(min + ratio * (max - min)));

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = disabled ? undefined : keyValue(e.key, value, min, max, step);
    if (next === undefined) return;
    set(next);
    e.preventDefault();
  };

  return (
    <div className={cn('flex flex-col', threshold ? 'gap-2' : 'gap-3', className)}>
      <SliderHeader labelId={labelId} label={label} threshold={threshold} display={valueDisplay ?? `${value}${unit}`} />
      {/* Vùng bấm cao 20px (dễ trúng) bao rãnh 8px. */}
      <div
        ref={trackRef}
        className={cn('relative flex h-5 touch-none items-center', disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
      >
        <SliderTrack threshold={threshold} pct={pct} markerPct={marker ? markerPct : undefined} />
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
            threshold ? 'size-4.5 border-2 border-primary' : 'size-4 border-2 border-surface',
          )}
          style={{ left: `${pct}%` }}
        />
      </div>
      {threshold && (
        <ThresholdScale min={scaleLabels?.[0] ?? `${min}${unit}`} max={scaleLabels?.[1] ?? `${max}${unit}`} marker={marker} markerPct={markerPct} />
      )}
    </div>
  );
}

/** Rãnh: tiến độ = thanh tô tới giá trị; ngưỡng = rãnh trơn + vạch ngưỡng (`markerPct`). */
function SliderTrack({ threshold, pct, markerPct }: { threshold: boolean; pct: number; markerPct?: number }) {
  if (!threshold) {
    return (
      <div aria-hidden="true" className="absolute inset-x-0 h-2 overflow-hidden rounded-full bg-surface-muted">
        <div className="h-full rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-100" style={{ width: `${pct}%` }} />
      </div>
    );
  }
  return (
    <>
      <div aria-hidden="true" className="absolute inset-x-0 h-1.5 rounded-full bg-surface-muted" />
      {markerPct !== undefined && (
        <span aria-hidden="true" className="absolute h-4 w-1 -translate-x-1/2 rounded-full bg-warning" style={{ left: `${markerPct}%` }} />
      )}
    </>
  );
}

/** Thang: min · nhãn ngưỡng (canh theo vạch, kẹp trong khung) · max. Ẩn với trình đọc – nhãn ngưỡng đã nằm trong mô tả. */
function ThresholdScale({ min, max, marker, markerPct }: { min: string; max: string; marker?: { label: string }; markerPct: number }) {
  return (
    <div aria-hidden="true" className="relative flex h-4 items-center justify-between text-sm tabular-nums text-fg-secondary">
      <span>{min}</span>
      {marker && (
        <span
          className="absolute whitespace-nowrap text-warning"
          style={{ left: `${markerPct}%`, transform: `translateX(-${Math.min(100, Math.max(0, markerPct))}%)` }}
        >
          {marker.label}
        </span>
      )}
      <span>{max}</span>
    </div>
  );
}

/** Nhãn + số hiện tại (số ẩn với trình đọc – đã có aria-valuetext ở nút kéo). */
function SliderHeader({ labelId, label, threshold, display }: { labelId: string; label: ReactNode; threshold: boolean; display: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <span id={labelId} className={threshold ? 'text-base text-fg-secondary' : 'text-lg font-semibold text-fg-secondary'}>
        {label}
      </span>
      <span aria-hidden="true" className={cn('leading-none tabular-nums', threshold ? 'text-xl' : 'text-3xl font-semibold text-primary')}>
        {display}
      </span>
    </div>
  );
}
