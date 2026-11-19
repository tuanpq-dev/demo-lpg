/**
 * Kiểu của chế độ sửa cảnh 3D (Editor `/settings/map-editor` và `?edit=1`) – hợp đồng giữa trang Editor, logic thuần
 * `features/scene-editor` và lớp vẽ R3F (`src/scene3d`). Không phụ thuộc three / React.
 */
import type { AssetType, Pipe, PipeAttachment, Vec3 } from './types';

export type EditTool = 'select' | 'translate' | 'rotate' | 'scale' | 'pipe';
export type ObjectTransform = { id: string; position: Vec3; rotation: Vec3; scale: Vec3 };
export type SelectHow = 'replace' | 'toggle' | 'add';

export type SceneEditState = {
  selected: readonly string[];
  /**
   * select: chỉ chọn · translate: kéo object (đang chọn) trên mặt sàn – chỉ đổi X/Z, giữ elevation ·
   * rotate (chỉ quanh Y) / scale (đáy giữ tại elevation): gizmo trên nhóm đang chọn ·
   * pipe: vẽ ống (PipeTools – click đặt điểm trên mặt phẳng làm việc, bắt cổng).
   * `selected` có thể chứa id ỐNG (chọn ống → điểm gập kéo được, click vào đoạn = thêm điểm).
   */
  mode: EditTool;
  /** Vẽ ống: chế độ vuông góc (chèn điểm gập theo X → Z → Y). */
  ortho?: boolean;
  /** Vẽ ống: cao độ mặt phẳng làm việc (m). */
  pipeHeight?: number;
  onPipeHeight?: (y: number) => void;
  /** Kết thúc vẽ ống (from/to = "objectId.port" khi bắt đầu/kết thúc tại cổng). */
  onCreatePipe?: (draft: { from?: string; to?: string; points: Vec3[] }) => void;
  /** Sửa ống (kéo/thêm/xoá điểm) – 1 lần gọi = 1 bước undo. */
  onUpdatePipe?: (id: string, fn: (p: Pipe) => Pipe) => void;
  /** Click vào đoạn của ống đang chọn → chèn điểm gập tại `at` (toạ độ thế giới, trên tâm ống). */
  onInsertPipePoint?: (id: string, at: Vec3) => void;
  /** Kéo object gắn ống dọc ống (thả chuột). */
  onAttach?: (id: string, attach: PipeAttachment) => void;
  /** Snap theo EDIT_SNAP (mặc định bật). */
  snap?: boolean;
  /** Hiện lưới sàn + vạch chân y = 0 và khoảng cách đáy–sàn của object đang chọn (mặc định bật; phím G). */
  grid?: boolean;
  /** Không vẽ (ống nối vẫn tính cổng). */
  hidden?: readonly string[];
  /** Không chọn/kéo được trên canvas (vẫn chọn được ở Outliner). */
  locked?: readonly string[];
  /** Vẽ viền vùng sàn ±floor m. */
  floor?: number;
  /** Click object = replace (Ctrl/Shift+click = toggle) · click vùng trống = [] · kéo vùng (Shift+kéo) = add. */
  onSelect: (ids: string[], how?: SelectHow) => void;
  onTransform: (changes: ObjectTransform[]) => void;
  /** Thả asset từ thư viện (dataTransfer SCENE_ASSET_MIME) → điểm trên sàn (đã snap nếu bật). */
  onDropAsset?: (asset: AssetType, at: Vec3) => void;
};
