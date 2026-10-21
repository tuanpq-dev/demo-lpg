import { Html, Line, TransformControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, type ElementRef, type MutableRefObject } from 'react';
import { DoubleSide, Euler, Object3D, Plane, Raycaster, Vector2, Vector3, type CatmullRomCurve3, type Ray } from 'three';
import type { ScenePalette } from './colors';
import { EDIT_SNAP, GROUND_GRAZING_DOT, GROUND_WORK_LIMIT } from './editConstants';
import { worldCorners, type ResolvedObject, type ScenePreview } from './geometry';
import { GROUND_EPS, worldBaseY } from './ground';
import type { AssetType, Pipe, PipeAttachment, Vec3 } from './types';

/*
 * Công cụ của chế độ sửa (Editor /editor và `?edit=1`): kéo object trên mặt sàn, gizmo xoay/scale nhiều object,
 * chọn bằng tia/vùng, viền vùng sàn, vạch chân + khoảng cách đáy–sàn.
 * Chỉ thao tác trực tiếp lên object three khi đang kéo; thả chuột mới báo `onTransform` (1 bước undo).
 */

/**
 * Mặt phẳng sàn y = 0 – MỌI phép kéo/thả tính bằng `ray.intersectPlane(GROUND_PLANE)`, không raycast mesh sàn/lưới
 * (chỉ để nhìn) nên kết quả không phụ thuộc góc camera hay hình học khác.
 */
export const GROUND_PLANE = new Plane(new Vector3(0, 1, 0), 0);

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

export type EditTool = 'select' | 'translate' | 'rotate' | 'scale' | 'pipe';
export type ObjectTransform = { id: string; position: Vec3; rotation: Vec3; scale: Vec3 };
export type SelectHow = 'replace' | 'toggle' | 'add';

export { EDIT_SNAP, SCENE_ASSET_MIME } from './editConstants';

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

/** Hàm chọn bằng tia gắn vào ref (SceneViewer dùng cho handle, kéo vùng, thả asset, kéo trên sàn). */
export type ScenePicker = {
  /** Điểm trên mặt sàn y = 0 dưới toạ độ màn hình (client px) – null nếu tia gần song song sàn / quá xa (`groundHit`). */
  ground(clientX: number, clientY: number): Vector3 | null;
  /** Object (id) đầu tiên trúng tia, bỏ qua `skip`. */
  object(clientX: number, clientY: number, skip: ReadonlySet<string>): string | null;
  /** Toạ độ màn hình (client px) của một điểm thế giới. */
  screen(p: Vec3): { x: number; y: number };
  /** Object có hộp bao (chiếu lên màn hình) giao với hình chữ nhật client px. */
  inRect(rect: { left: number; top: number; right: number; bottom: number }, skip: ReadonlySet<string>): string[];
  /** Group three của object (name = id). */
  node(id: string): Object3D | undefined;
  /** Bật/tắt OrbitControls (tắt trong lúc kéo object). */
  orbit(enabled: boolean): void;
  invalidate(): void;
  /** Tia qua điểm màn hình (bản sao). */
  ray(clientX: number, clientY: number): Ray;
  /** Điểm trên mặt phẳng ngang y = height (`planeHit`). */
  plane(clientX: number, clientY: number, height: number): Vector3 | null;
  /** Tay nắm điểm ống (userData.pipeHandle) đầu tiên trúng tia. */
  handle(clientX: number, clientY: number): { pipe: string; index: number } | null;
};

/** Đăng ký ScenePicker vào ref (cần camera/scene của R3F). */
export function PickerBridge({ pickerRef, byId }: { pickerRef: MutableRefObject<ScenePicker | null>; byId: Map<string, ResolvedObject> }) {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const get = useThree((s) => s.get);
  useEffect(() => {
    const ray = new Raycaster();
    const ndc = (x: number, y: number) => {
      const r = gl.domElement.getBoundingClientRect();
      return new Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    };
    pickerRef.current = {
      ground(x, y) {
        ray.setFromCamera(ndc(x, y), camera);
        return groundHit(ray.ray);
      },
      object(x, y, skip) {
        ray.setFromCamera(ndc(x, y), camera);
        for (const hit of ray.intersectObjects(scene.children, true)) {
          for (let o: Object3D | null = hit.object; o; o = o.parent) {
            // Ống nằm trước object → không nắm object phía sau (click ống = chọn ống).
            if (o.userData.pipeId) return null;
            if (byId.has(o.name)) {
              if (!skip.has(o.name)) return o.name;
              break;
            }
          }
        }
        return null;
      },
      screen(p) {
        const r = gl.domElement.getBoundingClientRect();
        const v = new Vector3(...p).project(camera);
        return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
      },
      inRect(rect, skip) {
        const r = gl.domElement.getBoundingClientRect();
        const out: string[] = [];
        for (const obj of byId.values()) {
          if (skip.has(obj.id)) continue;
          let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
          for (const c of worldCorners(obj)) {
            c.project(camera);
            const sx = r.left + ((c.x + 1) / 2) * r.width;
            const sy = r.top + ((1 - c.y) / 2) * r.height;
            [x0, y0, x1, y1] = [Math.min(x0, sx), Math.min(y0, sy), Math.max(x1, sx), Math.max(y1, sy)];
          }
          if (x1 >= rect.left && x0 <= rect.right && y1 >= rect.top && y0 <= rect.bottom) out.push(obj.id);
        }
        return out;
      },
      node: (id) => scene.getObjectByName(id),
      ray(x, y) {
        ray.setFromCamera(ndc(x, y), camera);
        return ray.ray.clone();
      },
      plane(x, y, h) {
        ray.setFromCamera(ndc(x, y), camera);
        return planeHit(ray.ray, h);
      },
      handle(x, y) {
        ray.setFromCamera(ndc(x, y), camera);
        for (const hit of ray.intersectObjects(scene.children, true)) {
          const h = hit.object.userData.pipeHandle as { pipe: string; index: number } | undefined;
          if (h) return h;
        }
        return null;
      },
      orbit(enabled) {
        const c = get().controls as { enabled?: boolean } | null;
        if (c) c.enabled = enabled;
      },
      invalidate: () => get().invalidate(),
    };
    return () => {
      pickerRef.current = null;
    };
  }, [camera, scene, gl, get, byId, pickerRef]);
  return null;
}

const round = (v: number, digits = 3) => +v.toFixed(digits) || 0;
const snapTo = (v: number, step: number) => Math.round(v / step) * step;

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

type DragItem = { id: string; node: Object3D; pos: Vector3; rot: Euler; scale: Vector3 };

/**
 * Gizmo cho nhóm đang chọn:
 * - translate: KHÔNG có gizmo trục (kéo thẳng object trên sàn – `startGroundDrag`); chỉ vẽ vòng tròn trên sàn tại tâm nhóm;
 * - rotate: drei TransformControls gắn pivot (1 object → tại object; nhóm → trọng tâm đã snap lưới), chỉ quanh Y,
 *   xoay vị trí quanh pivot + cộng góc (snap 15°);
 * - scale: nhân scale từng object quanh gốc = tâm đáy → đáy giữ tại elevation; nhóm > 1 giãn khoảng cách X/Z tới pivot
 *   (độ cao từng object giữ nguyên) (snap 0.1).
 * Bỏ qua object gắn ống (`attach`), khoá, ẩn. Thả chuột → onTransform (1 lần).
 */
export function EditGizmo({
  edit,
  byId,
  state,
  palette,
}: {
  edit: SceneEditState;
  byId: Map<string, ResolvedObject>;
  /** Ghi trạng thái kéo (dragging-changed) để click vùng trống không bỏ chọn ngay sau khi thả gizmo. */
  state: { current: { dragging: boolean; endedAt: number } };
  palette: ScenePalette;
}) {
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const controls = useRef<ElementRef<typeof TransformControls>>(null);
  const pivot = useMemo(() => new Object3D(), []);
  const drag = useRef<{ pivot: Vector3; items: DragItem[] } | null>(null);
  const locked = new Set(edit.locked);
  const movable = edit.selected
    .map((id) => byId.get(id))
    .filter((o): o is ResolvedObject => !!o && !o.attach && !locked.has(o.id) && !edit.hidden?.includes(o.id));
  const snap = edit.snap !== false;
  // Đặt lại pivot khi nhóm/vị trí đổi (sau mỗi lần commit).
  const key = movable.map((o) => `${o.id}:${o.position.join()}`).join('|');

  useLayoutEffect(() => {
    if (!movable.length) return;
    const c = movable.reduce((acc, o) => acc.add(new Vector3(...o.position)), new Vector3()).divideScalar(movable.length);
    // Nhóm: pivot = trọng tâm đã snap → xoay/scale quanh điểm lưới.
    if (snap && movable.length > 1)
      c.set(Math.round(c.x / EDIT_SNAP.translate) * EDIT_SNAP.translate, c.y, Math.round(c.z / EDIT_SNAP.translate) * EDIT_SNAP.translate);
    pivot.position.copy(c);
    pivot.rotation.set(0, 0, 0);
    pivot.scale.set(1, 1, 1);
    pivot.updateMatrixWorld();
    invalidate();
    // `key` gói danh sách + vị trí.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, snap, pivot, invalidate]);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const onDrag = (e: { value: unknown }) => {
      state.current.dragging = !!e.value;
      if (!e.value) state.current.endedAt = performance.now();
    };
    // three-stdlib khai báo kiểu sự kiện hẹp – ép kiểu listener.
    const add = c.addEventListener.bind(c) as (t: string, l: (e: { value: unknown }) => void) => void;
    const remove = c.removeEventListener.bind(c) as (t: string, l: (e: { value: unknown }) => void) => void;
    add('dragging-changed', onDrag);
    // `state.current` là object trạng thái dùng chung (không đổi tham chiếu) – giữ lại cho cleanup.
    const shared = state.current;
    return () => {
      remove('dragging-changed', onDrag);
      shared.dragging = false;
    };
  }, [key, edit.mode, state]);

  if (!movable.length || edit.mode === 'select' || edit.mode === 'pipe') return <primitive object={pivot} />;
  if (edit.mode === 'translate') {
    const c = movable.reduce((acc, o) => [acc[0] + o.position[0] / movable.length, acc[1] + o.position[2] / movable.length], [0, 0]);
    return (
      <>
        <primitive object={pivot} />
        <MoveHandle x={c[0]!} z={c[1]!} color={palette.primary} />
      </>
    );
  }

  const begin = () => {
    drag.current = {
      pivot: pivot.position.clone(),
      items: movable.flatMap((o) => {
        const node = scene.getObjectByName(o.id);
        return node ? [{ id: o.id, node, pos: node.position.clone(), rot: node.rotation.clone(), scale: node.scale.clone() }] : [];
      }),
    };
  };

  const apply = () => {
    const d = drag.current;
    if (!d) return;
    const angle = pivot.rotation.y;
    const k = pivot.scale;
    const group = d.items.length > 1;
    for (const it of d.items) {
      if (edit.mode === 'rotate') {
        it.node.position.copy(it.pos).sub(d.pivot).applyAxisAngle(new Vector3(0, 1, 0), angle).add(d.pivot);
        it.node.rotation.set(it.rot.x, it.rot.y + angle, it.rot.z);
      } else {
        // Gốc = tâm đáy → scale không làm lún/nổi; nhóm chỉ giãn khoảng cách theo X/Z, y (= elevation) giữ nguyên.
        it.node.scale.copy(it.scale).multiply(k);
        if (group)
          it.node.position.set(d.pivot.x + (it.pos.x - d.pivot.x) * k.x, it.pos.y, d.pivot.z + (it.pos.z - d.pivot.z) * k.z);
      }
    }
    invalidate();
  };

  const commit = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const changed = d.items.some(
      (it) => !it.node.position.equals(it.pos) || !it.node.rotation.equals(it.rot) || !it.node.scale.equals(it.scale),
    );
    if (!changed) return;
    edit.onTransform(
      d.items.map((it) => ({
        id: it.id,
        position: [round(it.node.position.x), it.pos.y, round(it.node.position.z)],
        rotation: [it.node.rotation.x, it.node.rotation.y, it.node.rotation.z].map((v) => round(v, 4)) as Vec3,
        scale: it.node.scale.toArray().map((v) => round(v)) as Vec3,
      })),
    );
  };

  const rotate = edit.mode === 'rotate';
  return (
    <>
      <primitive object={pivot} />
      <TransformControls
        ref={controls}
        object={pivot}
        mode={edit.mode}
        space="world"
        rotationSnap={snap ? EDIT_SNAP.rotate : null}
        scaleSnap={snap ? EDIT_SNAP.scale : null}
        showX={!rotate}
        showZ={!rotate}
        size={0.9}
        onMouseDown={begin}
        onObjectChange={apply}
        onMouseUp={commit}
      />
    </>
  );
}

/** Dấu "kéo trên sàn" ở tâm nhóm (vòng + chữ thập X/Z nằm trên sàn) – chỉ để nhìn, không nhận tia. */
function MoveHandle({ x, z, color }: { x: number; z: number; color: ScenePalette['primary'] }) {
  const y = 0.04;
  return (
    <group position={[x, y, z]}>
      <mesh rotation-x={-Math.PI / 2} raycast={() => null} renderOrder={3} userData={{ noEdges: true, noShadow: true }}>
        <ringGeometry args={[0.85, 1, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.75} depthTest={false} side={DoubleSide} toneMapped={false} />
      </mesh>
      <Line points={[[-1.6, 0, 0], [1.6, 0, 0]]} color={color} lineWidth={1.5} transparent opacity={0.75} depthTest={false} />
      <Line points={[[0, 0, -1.6], [0, 0, 1.6]]} color={color} lineWidth={1.5} transparent opacity={0.75} depthTest={false} />
    </group>
  );
}

/**
 * Vạch chân y = 0 (dev tool, bật/tắt cùng lưới – phím G): đáy hộp bao chiếu xuống sàn (nét đứt), đường đứng từ đáy
 * xuống sàn khi object không nằm trên sàn, nhãn khoảng cách đáy–sàn (đỏ khi lún dưới sàn).
 */
export function SelectionFootprints({ objects, palette }: { objects: ResolvedObject[]; palette: ScenePalette }) {
  return (
    <>
      {objects.slice(0, 12).map((o) => {
        const c = worldCorners(o);
        // worldCorners lặp x → y → z: chỉ số 0, 1, 4, 5 là 4 góc đáy (y = min cục bộ).
        const foot = [c[0]!, c[1]!, c[5]!, c[4]!, c[0]!].map((p) => [p.x, 0.03, p.z] as Vec3);
        const base = worldBaseY(o, o.position[1]);
        const gap = Math.abs(base) > GROUND_EPS;
        const sunk = base < -GROUND_EPS;
        const tone = sunk ? palette.danger : palette.primary;
        return (
          <group key={o.id}>
            <Line points={foot} color={tone} lineWidth={1} dashed dashSize={0.4} gapSize={0.25} transparent opacity={0.8} />
            {gap && (
              <Line
                points={[[o.position[0], base, o.position[2]], [o.position[0], 0.03, o.position[2]]]}
                color={tone}
                lineWidth={1.5}
                dashed
                dashSize={0.15}
                gapSize={0.1}
                depthTest={false}
              />
            )}
            <Html position={[o.position[0], Math.max(base, 0), o.position[2]]} zIndexRange={[15, 0]} pointerEvents="none" style={{ pointerEvents: 'none' }}>
              <span
                data-ground-gap={o.id}
                className={
                  'pointer-events-none -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-sm px-1 py-px text-2xs font-semibold ' +
                  (sunk ? 'bg-danger-strong/85 text-fg' : 'bg-surface-raised/85 text-fg-secondary')
                }
                style={{ display: 'inline-block' }}
              >
                đáy {base >= 0 ? '+' : '−'}
                {Math.abs(base).toFixed(2)} m
              </span>
            </Html>
          </group>
        );
      })}
    </>
  );
}

/** Viền vùng sàn hợp lệ (nét đứt, màu `neutral` mờ). */
export function FloorOutline({ half, palette }: { half: number; palette: ScenePalette }) {
  const pts: Vec3[] = [
    [-half, 0.03, -half],
    [half, 0.03, -half],
    [half, 0.03, half],
    [-half, 0.03, half],
    [-half, 0.03, -half],
  ];
  return <Line points={pts} color={palette.neutral} lineWidth={1} dashed dashSize={1.5} gapSize={1} transparent opacity={0.35} />;
}
