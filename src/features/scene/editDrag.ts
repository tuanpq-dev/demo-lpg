/** Kéo object trên sàn / gắn vào ống bằng con trỏ (Editor 3D). Tách từ EditTools.tsx. */
import { Plane, Vector3, type CatmullRomCurve3, type Ray } from 'three';
import { EDIT_SNAP, GROUND_GRAZING_DOT, GROUND_WORK_LIMIT, snapTo } from './editConstants';
import type { ResolvedObject, ScenePreview } from './geometry';
import type { Vec3 } from './types';
import { type SceneEditState, type ScenePicker } from './EditTools';

/**
 * Mặt phẳng sàn y = 0 – MỌI phép kéo/thả tính bằng `ray.intersectPlane(GROUND_PLANE)`, không raycast mesh sàn/lưới
 * (chỉ để nhìn) nên kết quả không phụ thuộc góc camera hay hình học khác.
 */
const GROUND_PLANE = new Plane(new Vector3(0, 1, 0), 0);

/**
 * Giao điểm tia với sàn; null khi tia gần song song sàn (giao điểm vọt xa, rung), không cắt sàn (nhìn lên),
 * hoặc giao điểm ngoài vùng làm việc ±GROUND_WORK_LIMIT m.
 */
export function groundHit(ray: Ray, out = new Vector3()): Vector3 | null {
  return planeHit(ray, 0, out);
}

/** Như groundHit nhưng với mặt phẳng ngang y = `height` (mặt phẳng làm việc khi vẽ/kéo điểm ống). */
export function planeHit(ray: Ray, height: number, out = new Vector3()): Vector3 | null {
  if (Math.abs(ray.direction.dot(GROUND_PLANE.normal)) < GROUND_GRAZING_DOT) return null;
  const p = ray.intersectPlane(height ? new Plane(GROUND_PLANE.normal, -height) : GROUND_PLANE, out);
  if (!p || Math.abs(p.x) > GROUND_WORK_LIMIT || Math.abs(p.z) > GROUND_WORK_LIMIT) return null;
  return p;
}

export const round = (v: number, digits = 3) => +v.toFixed(digits) || 0;

/** Chuột phải đi quá ngưỡng này (px) mới bắt đầu kéo – click không làm object nhảy theo snap. */
const DRAG_START_PX = 3;

/**
 * Kéo object trên mặt sàn bằng pointer events (thay cho TransformControls translate – gizmo kéo theo mặt phẳng hướng
 * camera nên lẫn trục Y):
 * - pointerdown: offset = giao điểm sàn − (X, Z) của object được nắm;
 * - pointermove: tia qua con trỏ ∩ GROUND_PLANE → X/Z = giao điểm − offset (snap lưới 0.5 m, giữ Alt = tắt snap);
 *   Y KHÔNG đổi (= elevation); cả nhóm dịch cùng một vector delta (object được nắm bám lưới, nhóm giữ khoảng cách);
 *   frame không có giao điểm hợp lệ (`groundHit` null) thì giữ nguyên vị trí trước;
 * - OrbitControls tắt trong lúc kéo; thả chuột → `onTransform` một lần (= 1 bước undo); Esc = huỷ.
 * Trả về false nếu không kéo được (object gắn ống/khoá/ẩn, hoặc điểm bấm không trúng sàn).
 */
export function startGroundDrag({
  picker,
  edit,
  byId,
  grabbed,
  ids,
  clientX,
  clientY,
  onState,
  onPreview,
}: {
  picker: ScenePicker;
  edit: SceneEditState;
  byId: Map<string, ResolvedObject>;
  grabbed: string;
  /** Các object di chuyển cùng (nhóm đang chọn, gồm `grabbed`). */
  ids: readonly string[];
  clientX: number;
  clientY: number;
  /** dragging = true khi bắt đầu dời; false khi kết thúc (moved = đã dời). */
  onState?: (dragging: boolean, moved: boolean) => void;
  /** Có → vị trí khi kéo đi qua bản xem trước (ống nối đi theo ngay); null = bỏ xem trước. Không có → đổi node three. */
  onPreview?: (preview: ScenePreview | null) => void;
}): boolean {
  const locked = new Set(edit.locked);
  const hidden = new Set(edit.hidden);
  const movable = (id: string) => {
    const o = byId.get(id);
    return !!o && !o.attach && !locked.has(id) && !hidden.has(id);
  };
  const anchor = byId.get(grabbed);
  const start = picker.ground(clientX, clientY);
  if (!anchor || !movable(grabbed) || !start) return false;
  const offset = { x: start.x - anchor.position[0], z: start.z - anchor.position[2] };
  const items = [...new Set([grabbed, ...ids])].filter(movable).flatMap((id) => {
    const o = byId.get(id)!;
    const node = picker.node(id);
    return node ? [{ obj: o, node }] : [];
  });

  let moved = false;
  let delta = { x: 0, z: 0 };
  const place = (d: { x: number; z: number }) => {
    if (onPreview) {
      const positions: Record<string, Vec3> = {};
      for (const { obj } of items) positions[obj.id] = [obj.position[0] + d.x, obj.position[1], obj.position[2] + d.z];
      onPreview(d.x || d.z ? { positions } : null);
    } else for (const { obj, node } of items) node.position.set(obj.position[0] + d.x, obj.position[1], obj.position[2] + d.z);
    picker.invalidate();
  };

  picker.orbit(false);
  const move = (ev: PointerEvent) => {
    if (!moved && Math.hypot(ev.clientX - clientX, ev.clientY - clientY) < DRAG_START_PX) return;
    const hit = picker.ground(ev.clientX, ev.clientY);
    if (!hit) return; // tia gần song song sàn / quá xa: bỏ frame
    if (!moved) {
      moved = true;
      onState?.(true, false);
    }
    const snap = edit.snap !== false && !ev.altKey;
    let x = hit.x - offset.x;
    let z = hit.z - offset.z;
    if (snap) [x, z] = [snapTo(x, EDIT_SNAP.translate), snapTo(z, EDIT_SNAP.translate)];
    delta = { x: x - anchor.position[0], z: z - anchor.position[2] };
    place(delta);
  };
  const finish = (commit: boolean) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    window.removeEventListener('keydown', key, true);
    picker.orbit(true);
    if (!commit) place({ x: 0, z: 0 });
    else onPreview?.(null);
    if (commit && moved && (delta.x || delta.z))
      edit.onTransform(
        items.map(({ obj }) => ({
          id: obj.id,
          position: [round(obj.position[0] + delta.x), obj.position[1], round(obj.position[2] + delta.z)],
          rotation: obj.rotation,
          scale: obj.scale ?? [1, 1, 1],
        })),
      );
    onState?.(false, moved);
  };
  const up = () => finish(true);
  const cancel = () => finish(false);
  const key = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    finish(false);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
  window.addEventListener('keydown', key, true);
  return true;
}

/**
 * Kéo object gắn ống dọc theo ống: mỗi lần di chuột, t = điểm trên đường cong gần tia chuột nhất (lấy mẫu 240 điểm
 * + tinh chỉnh quanh mẫu tốt nhất). Hướng object tự theo tiếp tuyến (resolveScene). Thả → onAttach (1 bước undo).
 */
export function startAttachDrag({
  picker,
  edit,
  obj,
  curve,
  clientX,
  clientY,
  onPreview,
  onState,
}: {
  picker: ScenePicker;
  edit: SceneEditState;
  obj: ResolvedObject;
  curve: CatmullRomCurve3;
  clientX: number;
  clientY: number;
  onPreview: (preview: ScenePreview | null) => void;
  onState?: (dragging: boolean, moved: boolean) => void;
}): boolean {
  if (!obj.attach || !edit.onAttach || edit.locked?.includes(obj.id)) return false;
  const attach = obj.attach;
  const tmp = new Vector3();
  const nearestT = (x: number, y: number) => {
    const ray = picker.ray(x, y);
    const N = 240;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i <= N; i++) {
      const d = ray.distanceSqToPoint(curve.getPointAt(i / N, tmp));
      if (d < bestD) [best, bestD] = [i / N, d];
    }
    for (let k = -10; k <= 10; k++) {
      const t = Math.min(1, Math.max(0, best + k / (N * 10)));
      const d = ray.distanceSqToPoint(curve.getPointAt(t, tmp));
      if (d < bestD) [best, bestD] = [t, d];
    }
    return best;
  };
  let moved = false;
  let t = attach.t;
  picker.orbit(false);
  const move = (ev: PointerEvent) => {
    if (!moved && Math.hypot(ev.clientX - clientX, ev.clientY - clientY) < DRAG_START_PX) return;
    if (!moved) {
      moved = true;
      onState?.(true, false);
    }
    t = +nearestT(ev.clientX, ev.clientY).toFixed(3);
    onPreview({ attachT: { [obj.id]: t } });
    picker.invalidate();
  };
  const finish = (commit: boolean) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('keydown', key, true);
    picker.orbit(true);
    onPreview(null);
    if (commit && moved && t !== attach.t) edit.onAttach!(obj.id, { ...attach, t });
    onState?.(false, moved);
  };
  const up = () => finish(true);
  const key = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    finish(false);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('keydown', key, true);
  return true;
}
