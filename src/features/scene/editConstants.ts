/**
 * Hằng dùng chung giữa SceneViewer (chế độ sửa) và Editor – module thuần (không three/React)
 * để UI Editor (thư viện asset, ops) import mà không kéo three vào chunk của trang.
 */

/** MIME của dữ liệu kéo thả từ thư viện asset vào canvas (value = AssetType). */
export const SCENE_ASSET_MIME = 'application/x-scene-asset';

/** Bước snap: kéo/đặt (m), xoay (rad, 15°), scale. */
export const EDIT_SNAP = { translate: 0.5, rotate: Math.PI / 12, scale: 0.1 } as const;

/** Vùng sàn hợp lệ: hình vuông ±FLOOR_HALF_SIZE m quanh gốc (Editor vẽ viền + cảnh báo object nằm ngoài). */
export const FLOOR_HALF_SIZE = 60;
