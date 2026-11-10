/** Một object của cảnh (asset + viền mực, khung chọn, quầng nguy hiểm). Tách từ SceneViewer.tsx. */
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Matrix4,
  CanvasTexture,
  EdgesGeometry,
  LineSegments,
  type Color,
  type Group,
  type InstancedMesh,
  type LineBasicMaterial,
  type Mesh,
  type MeshBasicMaterial,
} from 'three';
import { ObjectStateProvider, useEdgeMaterials, type EdgeTone } from './assets/materials';
import { ASSETS } from './assets/registry';
import { resolveParams } from './assets/specs';
import type { ScenePalette } from './colors';
import { objectBounds, type ResolvedObject } from './geometry';
import { LOOK } from './look';
import { prefersReducedMotion } from '@/lib/reducedMotion';
import { pulse } from './pulse';
import type { ObjectStatus } from './types';

/** Sự kiện có đích là chính canvas (không phải nhãn/tooltip HTML phủ lên). */
export const isCanvasEvent = (e: Event) => e.target instanceof HTMLCanvasElement;

export function ObjectNode({
  obj,
  status,
  hovered,
  selected,
  palette,
  onHover,
  onSelect,
  editing,
}: {
  obj: ResolvedObject;
  status: ObjectStatus;
  hovered: boolean;
  selected: boolean;
  palette: ScenePalette;
  onHover: (fn: (cur: string | null) => string | null) => void;
  /** `toggle` = Ctrl/Shift/⌘ khi click (chế độ sửa: đảo chọn). */
  onSelect?: (id: string, toggle: boolean) => void;
  /** Chế độ sửa: mọi object (kể cả environment) đều chọn được; object khoá không có onSelect. */
  editing: boolean;
}) {
  const def = ASSETS[obj.asset];
  const Asset = def.component;
  const params = useMemo(() => resolveParams(obj), [obj]);
  const group = useRef<Group>(null);
  const state = useMemo(() => ({ status, hovered: hovered || selected }), [status, hovered, selected]);
  const edgeTone: EdgeTone = selected ? 'selected' : hovered ? 'hover' : status === 'normal' ? 'normal' : status;
  // Dựng lại bóng/nét viền khi hình dạng có thể đổi (asset, params, path).
  const shapeKey = `${obj.asset}|${JSON.stringify(params)}|${JSON.stringify(obj.path ?? null)}`;
  useInkEdges(group, useEdgeMaterials()[edgeTone], shapeKey);

  useLayoutEffect(() => {
    group.current?.traverse((o) => {
      if ((o as Mesh).isMesh && !o.userData.noShadow) {
        o.castShadow = !o.userData.noCastShadow;
        o.receiveShadow = true;
      }
    });
  }, [shapeKey]);

  // Environment: không hover/click (cũng không chặn tia chọn – R3F chỉ raycast object có handler).
  const handlers =
    (editing && onSelect) || (!editing && def.category === 'equipment')
      ? {
          onPointerOver: (e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            onHover(() => obj.id);
          },
          onPointerOut: () => onHover((cur) => (cur === obj.id ? null : cur)),
          onClick: (e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            // Bỏ qua click sau khi kéo xoay/pan, và click lên nhãn HTML nằm trên object khác.
            const n = e.nativeEvent;
            if (e.delta <= 4 && isCanvasEvent(n)) onSelect?.(obj.id, n.ctrlKey || n.metaKey || n.shiftKey);
          },
        }
      : {};

  return (
    // name = id: EditGizmo tìm group để gắn TransformControls.
    <group ref={group} name={obj.id} position={obj.position} rotation={obj.rotation} scale={obj.scale} {...handlers}>
      <ObjectStateProvider value={state}>
        <Asset params={params} path={obj.path} />
      </ObjectStateProvider>
      {selected && <BoundsOutline obj={obj} color={palette.primary} />}
      {status === 'danger' && <DangerGlow obj={obj} color={palette.danger} />}
    </group>
  );
}

/**
 * Nét viền mực (Figma vẽ kiểu minh hoạ có nét): EdgesGeometry (góc ≥ LOOK.edges.angle) của mọi mesh thường trong object,
 * gộp thành MỘT LineSegments theo toạ độ của group → 1 draw call mỗi object. Bỏ qua InstancedMesh và mesh có
 * `userData.noEdges`. Đổi tone → chỉ thay material dùng chung. Nét không nhận raycast (không nới vùng hover).
 */
function useInkEdges(group: RefObject<Group>, material: LineBasicMaterial, shapeKey: string) {
  const line = useRef<LineSegments | null>(null);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    const g = group.current;
    if (!g) return;
    g.updateWorldMatrix(true, true);
    const toGroup = new Matrix4().copy(g.matrixWorld).invert();
    const rel = new Matrix4();
    const parts: Float32Array[] = [];
    g.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh || (mesh as InstancedMesh).isInstancedMesh || mesh.userData.noEdges) return;
      const edges = new EdgesGeometry(mesh.geometry, LOOK.edges.angle);
      edges.applyMatrix4(rel.multiplyMatrices(toGroup, mesh.matrixWorld));
      parts.push(edges.getAttribute('position').array as Float32Array);
      edges.dispose();
    });
    const merged = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
    parts.reduce((at, p) => (merged.set(p, at), at + p.length), 0);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(merged, 3));
    const l = new LineSegments(geometry, material);
    l.raycast = () => {};
    g.add(l);
    line.current = l;
    invalidate();
    return () => {
      l.removeFromParent();
      geometry.dispose();
      line.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- material đổi được xử lý ở effect dưới.
  }, [group, shapeKey, invalidate]);
  useLayoutEffect(() => {
    if (line.current) line.current.material = material;
    invalidate();
  }, [material, shapeKey, invalidate]);
}

/** Mesh phụ trợ (vòng sáng sàn…): không nét viền, không đổ bóng. */
const HELPER = { noEdges: true, noShadow: true };

/** Viền hộp bao của object đang chọn (chế độ sửa) – rõ hơn hover. */
function BoundsOutline({ obj, color }: { obj: ResolvedObject; color: Color }) {
  const { min, max } = objectBounds(obj);
  const key = [...min, ...max].join();
  const geometry = useMemo(() => {
    const box = new BoxGeometry(max[0] - min[0] + 0.3, max[1] - min[1] + 0.2, max[2] - min[2] + 0.3);
    const edges = new EdgesGeometry(box);
    box.dispose();
    return edges;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` gói min/max (mảng mới mỗi render).
  }, [key]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments geometry={geometry} position={[(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]}>
      <lineBasicMaterial color={color} transparent opacity={0.9} />
    </lineSegments>
  );
}

/**
 * Mặt nạ độ sáng tròn mờ dần (không phải màu – nhân với màu token; blending cộng nên phần tối = trong suốt).
 */
/** Mức xám từ tâm ra mép của quầng nguy hiểm (sáng → tối = trong suốt khi blending cộng). */
const GLOW_STOPS: readonly [offset: number, gray: number][] = [
  [0, 255],
  [0.6, 150],
  [1, 0],
];

function createGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [offset, gray] of GLOW_STOPS) grad.addColorStop(offset, `rgb(${gray} ${gray} ${gray})`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}

/** Vòng sáng đỏ mờ dưới sàn quanh object danger, pulse cùng nhịp với viền. */
function DangerGlow({ obj, color }: { obj: ResolvedObject; color: Color }) {
  const { min, max } = objectBounds(obj);
  const size = Math.max(max[0] - min[0], max[2] - min[2]) * 1.9 + 3;
  const texture = useMemo(createGlowTexture, []);
  useEffect(() => () => texture.dispose(), [texture]);
  const material = useRef<MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (material.current) material.current.opacity = 0.2 + 0.35 * pulse(clock.elapsedTime, prefersReducedMotion());
  });
  return (
    // Đặt ở mặt đất (y thế giới ≈ 0) dù object nằm trên cao.
    <mesh
      rotation-x={-Math.PI / 2}
      position={[(min[0] + max[0]) / 2, 0.03 - obj.position[1], (min[2] + max[2]) / 2]}
      renderOrder={-1}
      userData={HELPER}
    >
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial ref={material} color={color} map={texture} transparent opacity={0.4} blending={AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}
