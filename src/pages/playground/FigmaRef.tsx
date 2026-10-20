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
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  scale?: number;
  caption?: string;
}) {
  return (
    <figure className="flex max-w-full flex-col gap-2 overflow-x-auto">
      <figcaption className="text-xs text-fg-muted/60">{caption ?? 'Figma (tham chiếu)'}</figcaption>
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
    </figure>
  );
}
