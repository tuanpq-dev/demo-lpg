/**
 * Ảnh có nhiều kích thước / định dạng: `src` (dự phòng) + `srcSet` WebP + `avifSrcSet` (tuỳ chọn) + kích thước gốc
 * (`width`/`height` – trình duyệt giữ chỗ đúng tỉ lệ, tránh nhảy layout). Một chuỗi URL thường cũng dùng được.
 */
export type ImageAsset = {
  src: string;
  srcSet?: string;
  avifSrcSet?: string;
  width?: number;
  height?: number;
};

export const toImageAsset = (image: string | ImageAsset): ImageAsset => (typeof image === 'string' ? { src: image } : image);
