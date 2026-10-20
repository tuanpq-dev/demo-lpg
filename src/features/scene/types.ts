/**
 * Hợp đồng dữ liệu cảnh 3D – dùng chung cho Viewer (hiện tại) và Editor (sau này).
 * Đơn vị: 1 = 1 m (ước lượng từ ảnh Figma 53:244). Trục Y hướng lên, mặt đất y = 0.
 * Pivot: mọi asset có gốc tại tâm đáy – object nằm trên sàn khi `elevation` = 0 (xem assets/specs.ts).
 * File này không phụ thuộc three – import được ở mọi nơi.
 */

/**
 * Phiên bản định dạng hiện tại (`SceneConfig.schemaVersion`). Khác `version` (số lần lưu).
 * 1 (không có trường): position[1] là độ cao tự do, van/đồng hồ có gốc ở tâm ống.
 * 2: thêm `elevation` (độ cao đáy, position[1] luôn bằng nó), mọi asset gốc tại tâm đáy. Đọc dữ liệu cũ → `migrateScene`.
 */
export const SCENE_SCHEMA_VERSION = 2;
export type Vec3 = [number, number, number];

export const ASSET_TYPES = [
  // equipment
  'tank-horizontal',
  'tank-vertical',
  'pump',
  'valve',
  'filter',
  'vaporizer',
  'tanker-truck',
  'loading-station',
  'flow-meter',
  // environment
  'building',
  'canopy',
  'fence',
] as const;

/** Loại asset; category/tham số/cổng xem `assets/specs.ts`. */
export type AssetType = (typeof ASSET_TYPES)[number];

/** Ngưỡng trạng thái: ≥ warn/danger (cao) hoặc ≤ lowWarn/lowDanger (thấp). */
export interface Thresholds {
  warn?: number;
  danger?: number;
  lowWarn?: number;
  lowDanger?: number;
}

/** Binding = tag cảm biến, hoặc tag + ngưỡng riêng (ghi đè `SceneConfig.thresholds[field]`). */
export type Binding = string | ({ tag: string } & Thresholds);

export interface SceneCamera {
  /** Vị trí camera; chỉ hướng (position − target) có ý nghĩa với camera trực giao. */
  position: Vec3;
  /** Zoom trực giao (px / m) ở khung tham chiếu rộng 1146px (Figma), tự co theo chiều rộng thật. */
  zoom: number;
  target: Vec3;
}

/**
 * Chế độ xem (nút "Toàn cảnh / Bồn chứa / Bơm & Lọc"): bay camera vừa khít `objectIds`,
 * hoặc tới `camera` cố định; không có cả hai → camera mặc định của cảnh.
 */
export interface SceneView {
  id: string;
  label: string;
  objectIds?: string[];
  camera?: SceneCamera;
}

/**
 * Nhãn tự sinh cho object: tiêu đề = `title ?? object.label`, giá trị = `field` (mặc định binding đầu tiên)
 * lấy từ liveData; tone/icon theo trạng thái. Không khai báo → không có nhãn (hover vẫn có tooltip).
 */
export interface SceneObjectMarker {
  /** Kiểu nhãn: callout (mặc định), side (đường nối ngang), tag (nhãn chữ). */
  variant?: 'callout' | 'side' | 'tag';
  /** Tone khi bình thường; success → kèm chấm trạng thái. Cảnh báo luôn ghi đè theo trạng thái. */
  tone?: 'accent' | 'success' | 'warning';
  /** Tiêu đề khác `label` (vd nhãn khu vực "Cụm bơm & lọc" gắn trên bơm P-101A). */
  title?: string;
  /** Trường binding hiển thị làm giá trị. */
  field?: string;
}

export interface SceneConfig {
  id: string;
  name: string;
  /** Số lần lưu (tăng mỗi lần lưu ở Editor / mỗi lần migrate). */
  version: number;
  /** Phiên bản định dạng; thiếu = 1 (cũ). Xem SCENE_SCHEMA_VERSION. */
  schemaVersion?: number;
  camera?: SceneCamera;
  /** Chế độ xem; trống → chỉ "Toàn cảnh". */
  views?: SceneView[];
  /** Ngưỡng mặc định theo trường dữ liệu (level, pressure…) cho mọi binding của cảnh. */
  thresholds?: Record<string, Thresholds>;
  objects: SceneObject[];
  pipes: Pipe[];
}

/** Gắn object lên đường ống: vị trí tại tỉ lệ chiều dài `t` (0 = đầu, 1 = cuối), trục X cục bộ theo hướng ống. */
export interface PipeAttachment {
  pipe: string;
  t: number;
}

export interface SceneObject {
  id: string;
  asset: AssetType;
  /** Bắt buộc, trừ khi có `attach` (khi đó vị trí/hướng lấy từ ống). position[1] luôn = elevation. */
  position?: Vec3;
  /**
   * Độ cao đáy object so với sàn (m), mặc định 0. Editor chỉ đổi qua ô Elevation (kéo chuột chỉ đổi X/Z).
   * > 0 chỉ hợp lý với asset lắp trên ống (`inline`) – còn lại Editor cảnh báo "lơ lửng". Bỏ qua khi có `attach`.
   */
  elevation?: number;
  /** Euler XYZ (radian). Bỏ qua khi có `attach`. */
  rotation?: Vec3;
  scale?: Vec3;
  attach?: PipeAttachment;
  /** Asset dựng theo đoạn (fence): polyline cục bộ; điểm cuối trùng điểm đầu = khép kín. */
  path?: Vec3[];
  /** Tham số hình học theo `paramsSchema` của asset (vd tank: length, diameter); thiếu → mặc định. */
  params?: Record<string, number>;
  label?: string;
  /** Có → hiện nhãn tự sinh (xem SceneObjectMarker). */
  marker?: SceneObjectMarker;
  /** Trường dữ liệu → tag cảm biến, vd { level: "LT-101", pressure: { tag: "PT-101", danger: 17.5 } }. Chỉ cho equipment. */
  bindings?: Record<string, Binding>;
}

export interface Pipe {
  id: string;
  /** Cổng đầu "objectId.port" – vị trí cổng được nối vào trước `points`. */
  from?: string;
  /** Cổng cuối "objectId.port" – vị trí cổng được nối vào sau `points`. */
  to?: string;
  /** Các điểm gấp (toạ độ thế giới). Đoạn thẳng giữa các điểm, góc bo nhỏ. */
  points: Vec3[];
  radius?: number;
  /** Tag lưu lượng – tốc độ hiệu ứng dòng chảy tỉ lệ với giá trị. */
  flowTag?: string;
}

/** Số liệu trực tiếp theo tag cảm biến. */
export type LiveValue = number | string;
export type LiveData = Record<string, LiveValue>;

export type ObjectStatus = 'normal' | 'warning' | 'danger' | 'offline';
