/**
 * Hằng dùng chung giữa SceneViewer (chế độ sửa) và Editor – module thuần (không three/React)
 * để UI Editor (thư viện asset, ops) import mà không kéo three vào chunk của trang.
 */

/** MIME của dữ liệu kéo thả từ thư viện asset vào canvas (value = AssetType). */
export const SCENE_ASSET_MIME = 'application/x-scene-asset';

/** Bước snap: kéo/đặt (m), xoay (rad, 15°), scale, độ cao đáy (m). Giữ Alt khi kéo = tắt snap. */
export const EDIT_SNAP = { translate: 0.5, rotate: Math.PI / 12, scale: 0.1, elevation: 0.25 } as const;

/**
 * Kéo trên mặt sàn: bỏ frame khi tia gần song song sàn (|dot(tia, pháp tuyến)| < GROUND_GRAZING_DOT – giao điểm
 * vọt ra xa) hoặc giao điểm ngoài ±GROUND_WORK_LIMIT m (xa vùng làm việc).
 */
export const GROUND_GRAZING_DOT = 0.05;

/** Vùng sàn hợp lệ: hình vuông ±FLOOR_HALF_SIZE m quanh gốc (Editor vẽ viền + cảnh báo object nằm ngoài). */
export const FLOOR_HALF_SIZE = 60;
export const GROUND_WORK_LIMIT = FLOOR_HALF_SIZE * 2;

/** Làm tròn `v` về bội số gần nhất của `step`, 3 số lẻ (bỏ sai số dấu phẩy động, -0 → 0). */
export const snapTo = (v: number, step: number) => +(Math.round(v / step) * step).toFixed(3) || 0;
