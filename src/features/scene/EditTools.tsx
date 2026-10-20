import { Line, TransformControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, type ElementRef, type MutableRefObject } from 'react';
import { Euler, Object3D, Plane, Raycaster, Vector2, Vector3 } from 'three';
import type { ScenePalette } from './colors';
import { EDIT_SNAP } from './editConstants';
import { worldCorners, type ResolvedObject } from './geometry';
import type { AssetType, Vec3 } from './types';

/*
 * Công cụ của chế độ sửa (Editor /editor và `?edit=1`): gizmo nhiều object, chọn bằng tia/vùng, viền vùng sàn.
 * Chỉ thao tác trực tiếp lên object three khi đang kéo; thả chuột mới báo `onTransform` (1 bước undo).
 */

export type EditTool = 'select' | 'translate' | 'rotate' | 'scale';
export type ObjectTransform = { id: string; position: Vec3; rotation: Vec3; scale: Vec3 };
export type SelectHow = 'replace' | 'toggle' | 'add';

export { EDIT_SNAP, SCENE_ASSET_MIME } from './editConstants';

export type SceneEditState = {
  selected: readonly string[];
  /** select: chỉ chọn (không gizmo) · translate/rotate (quanh Y)/scale: gizmo trên nhóm đang chọn. */
  mode: EditTool;
  /** Snap theo EDIT_SNAP (mặc định bật). */
  snap?: boolean;
  /** Hiện lưới sàn (mặc định bật). */
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

/** Hàm chọn bằng tia gắn vào ref (SceneViewer dùng cho handle, kéo vùng, thả asset). */
export type ScenePicker = {
  /** Điểm trên mặt sàn y = 0 dưới toạ độ màn hình (client px). */
  ground(clientX: number, clientY: number): Vector3 | null;
  /** Object (id) đầu tiên trúng tia, bỏ qua `skip`. */
  object(clientX: number, clientY: number, skip: ReadonlySet<string>): string | null;
  /** Toạ độ màn hình (client px) của một điểm thế giới. */
  screen(p: Vec3): { x: number; y: number };
  /** Object có hộp bao (chiếu lên màn hình) giao với hình chữ nhật client px. */
  inRect(rect: { left: number; top: number; right: number; bottom: number }, skip: ReadonlySet<string>): string[];
};

/** Đăng ký ScenePicker vào ref (cần camera/scene của R3F). */
export function PickerBridge({ pickerRef, byId }: { pickerRef: MutableRefObject<ScenePicker | null>; byId: Map<string, ResolvedObject> }) {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const ray = new Raycaster();
    const floor = new Plane(new Vector3(0, 1, 0), 0);
    const ndc = (x: number, y: number) => {
      const r = gl.domElement.getBoundingClientRect();
      return new Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    };
    pickerRef.current = {
      ground(x, y) {
        ray.setFromCamera(ndc(x, y), camera);
        return ray.ray.intersectPlane(floor, new Vector3());
      },
      object(x, y, skip) {
        ray.setFromCamera(ndc(x, y), camera);
        for (const hit of ray.intersectObjects(scene.children, true)) {
          for (let o: Object3D | null = hit.object; o; o = o.parent) {
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
    };
    return () => {
      pickerRef.current = null;
    };
  }, [camera, scene, gl, byId, pickerRef]);
  return null;
}

const round = (v: number, digits = 3) => +v.toFixed(digits) || 0;

type DragItem = { id: string; node: Object3D; pos: Vector3; rot: Euler; scale: Vector3 };

/**
 * Gizmo cho nhóm đang chọn (drei TransformControls gắn vào một pivot: 1 object → tại object; nhóm → trọng tâm đã snap lưới):
 * - translate: dời cả nhóm theo độ dời của pivot (snap 0.5 m – 1 object bám lưới tuyệt đối);
 * - rotate: chỉ quanh Y, xoay vị trí quanh pivot + cộng góc (snap 15°);
 * - scale: nhân scale từng object, nhóm > 1 thì giãn cả khoảng cách tới pivot (snap 0.1).
 * Bỏ qua object gắn ống (`attach`) và object khoá. Thả chuột → onTransform (1 lần).
 */
export function EditGizmo({
  edit,
  byId,
  state,
}: {
  edit: SceneEditState;
  byId: Map<string, ResolvedObject>;
  /** Ghi trạng thái kéo (dragging-changed) để click vùng trống không bỏ chọn ngay sau khi thả gizmo. */
  state: { current: { dragging: boolean; endedAt: number } };
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
    // 1 object: pivot = đúng vị trí object → TransformControls snap toạ độ tuyệt đối (bám lưới) theo trục đang kéo.
    // Nhóm: pivot = trọng tâm đã snap → độ dời là bội số 0.5 m, các object giữ khoảng cách tương đối.
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
    return () => {
      remove('dragging-changed', onDrag);
      state.current.dragging = false;
    };
  }, [key, edit.mode, state]);

  if (!movable.length || edit.mode === 'select') return <primitive object={pivot} />;

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
    const delta = pivot.position.clone().sub(d.pivot);
    const angle = pivot.rotation.y;
    const k = pivot.scale;
    const group = d.items.length > 1;
    for (const it of d.items) {
      if (edit.mode === 'translate') it.node.position.copy(it.pos).add(delta);
      else if (edit.mode === 'rotate') {
        it.node.position.copy(it.pos).sub(d.pivot).applyAxisAngle(new Vector3(0, 1, 0), angle).add(d.pivot);
        it.node.rotation.set(it.rot.x, it.rot.y + angle, it.rot.z);
      } else {
        it.node.scale.copy(it.scale).multiply(k);
        if (group) it.node.position.copy(it.pos).sub(d.pivot).multiply(k).add(d.pivot);
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
        position: it.node.position.toArray().map((v) => round(v)) as Vec3,
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
        translationSnap={snap ? EDIT_SNAP.translate : null}
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
