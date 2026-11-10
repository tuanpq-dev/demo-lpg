/** Gizmo dịch/xoay/co giãn object đang chọn (Editor 3D). Tách từ EditTools.tsx. */
import { Line, TransformControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, type ElementRef } from 'react';
import { DoubleSide, type Euler, Object3D, Vector3 } from 'three';
import type { ScenePalette } from './colors';
import { EDIT_SNAP } from './editConstants';
import type { ResolvedObject } from './geometry';
import type { Vec3 } from './types';
import { type SceneEditState } from './EditTools';
import { round } from './editDrag';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` gói danh sách + vị trí.
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
    const c = movable.reduce<[number, number]>(
      (acc, o) => [acc[0] + o.position[0] / movable.length, acc[1] + o.position[2] / movable.length],
      [0, 0],
    );
    return (
      <>
        <primitive object={pivot} />
        <MoveHandle x={c[0]} z={c[1]} color={palette.primary} />
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
        it.node.position
          .copy(it.pos)
          .sub(d.pivot)
          .applyAxisAngle(new Vector3(0, 1, 0), angle)
          .add(d.pivot);
        it.node.rotation.set(it.rot.x, it.rot.y + angle, it.rot.z);
      } else {
        // Gốc = tâm đáy → scale không làm lún/nổi; nhóm chỉ giãn khoảng cách theo X/Z, y (= elevation) giữ nguyên.
        it.node.scale.copy(it.scale).multiply(k);
        if (group) it.node.position.set(d.pivot.x + (it.pos.x - d.pivot.x) * k.x, it.pos.y, d.pivot.z + (it.pos.z - d.pivot.z) * k.z);
      }
    }
    invalidate();
  };

  const commit = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const changed = d.items.some((it) => !it.node.position.equals(it.pos) || !it.node.rotation.equals(it.rot) || !it.node.scale.equals(it.scale));
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
      <Line
        points={[
          [-1.6, 0, 0],
          [1.6, 0, 0],
        ]}
        color={color}
        lineWidth={1.5}
        transparent
        opacity={0.75}
        depthTest={false}
      />
      <Line
        points={[
          [0, 0, -1.6],
          [0, 0, 1.6],
        ]}
        color={color}
        lineWidth={1.5}
        transparent
        opacity={0.75}
        depthTest={false}
      />
    </group>
  );
}
