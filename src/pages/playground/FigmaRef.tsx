/**
 * Cắt một vùng từ ảnh chụp toàn màn hình Figma (tỉ lệ 1:1, rộng 1565px) để đặt cạnh component.
 * Toạ độ lấy từ get_metadata (tuyệt đối trong frame).
 */
export function FigmaRef({
  src,
  x,
  y,
  w,
  h,
  scale = 1,
  caption,
}: {
  /** undefined (bản build) → không vẽ: ảnh Figma chỉ có ở máy dev (`scratch/figma-ref/`, gitignore). */
  src?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  scale?: number;
  caption?: string;
}) {
  if (!src) return null;
  return (
    <figure className="flex max-w-full flex-col gap-2">
      <figcaption className="text-xs text-fg-muted/65">{caption ?? 'Figma (tham chiếu)'}</figcaption>
      {/* Ảnh rộng hơn khung → cuộn ngang; vùng cuộn focus được (WCAG 2.1.1). */}
      <div role="region" aria-label={caption ?? 'Ảnh Figma tham chiếu'} tabIndex={0} className="max-w-full overflow-x-auto">
      <div
        role="img"
        aria-label={caption ?? 'Figma reference'}
        className="shrink-0 rounded-sm border border-dashed border-line/30"
        style={{
          width: w * scale,
          height: h * scale,
          backgroundImage: `url(${src})`,
          backgroundPosition: `-${x * scale}px -${y * scale}px`,
          backgroundSize: `${1565 * scale}px auto`,
          backgroundRepeat: 'no-repeat',
        }}
      />
      </div>
    </figure>
  );
}
