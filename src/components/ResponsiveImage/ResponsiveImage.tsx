import { toImageAsset, type ImageAsset } from '@/lib/imageAsset';

export type ResponsiveImageProps = {
  image: string | ImageAsset;
  alt: string;
  /** Chiều rộng hiển thị (thuộc tính `sizes`) để trình duyệt chọn đúng bản trong `srcSet`. */
  sizes?: string;
  /**
   * true = ảnh chính của màn (LCP): tải ngay, ưu tiên cao. false (mặc định) = tải lười khi gần vào khung nhìn.
   */
  priority?: boolean;
  className?: string;
  draggable?: boolean;
};

/** `<picture>` AVIF → WebP → `src`, có `width/height` gốc. `picture` dùng `display: contents` nên không đổi layout của `img`. */
export function ResponsiveImage({ image, alt, sizes = '100vw', priority = false, className, draggable }: ResponsiveImageProps) {
  const a = toImageAsset(image);
  // React 18 chưa nhận prop `fetchPriority` (camelCase) – truyền thuộc tính HTML chữ thường.
  const fetchPriority = priority ? ({ fetchpriority: 'high' } as Record<string, string>) : undefined;
  return (
    <picture className="contents">
      {a.avifSrcSet && <source type="image/avif" srcSet={a.avifSrcSet} sizes={sizes} />}
      {a.srcSet && <source type="image/webp" srcSet={a.srcSet} sizes={sizes} />}
      <img
        src={a.src}
        alt={alt}
        width={a.width}
        height={a.height}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        draggable={draggable}
        className={className}
        {...fetchPriority}
      />
    </picture>
  );
}
