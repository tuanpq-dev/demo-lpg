/*
 * Đường dẫn trang chi tiết tài sản – file nhẹ (không import mock) để router trong bundle chính dùng được.
 * Kiểm tra mã có trang hay không: `resolveAssetId` (src/data/assetDetail.ts, tải cùng trang).
 */

/** Tài sản mở khi bấm tab "Bản đồ nội khu" (`/map` → `/map/V-101`, như ảnh 5D). */
export const DEFAULT_ASSET_ID = 'V-101';

/** Đường dẫn trang chi tiết tài sản (dưới tab "Bản đồ nội khu"). */
export const assetPath = (id: string) => `/map/${encodeURIComponent(id)}`;
