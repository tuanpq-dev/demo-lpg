import { Html, Line } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, type MutableRefObject } from 'react';
import { type Object3D, Raycaster, Vector2, Vector3, type Ray } from 'three';
import type { ScenePalette } from './colors';
import { worldCorners, type ResolvedObject } from './geometry';
import { GROUND_EPS, worldBaseY } from './ground';
import type { AssetType, Pipe, PipeAttachment, Vec3 } from './types';
import { groundHit, planeHit } from './editDrag';

/*
 * Công cụ của chế độ sửa (Editor /editor và `?edit=1`): kéo object trên mặt sàn, gizmo xoay/scale nhiều object,
 * chọn bằng tia/vùng, viền vùng sàn, vạch chân + khoảng cách đáy–sàn.
 * Chỉ thao tác trực tiếp lên object three khi đang kéo; thả chuột mới báo `onTransform` (1 bước undo).
 */

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
                points={[
                  [o.position[0], base, o.position[2]],
                  [o.position[0], 0.03, o.position[2]],
                ]}
                color={tone}
                lineWidth={1.5}
                dashed
                dashSize={0.15}
                gapSize={0.1}
                depthTest={false}
              />
            )}
            <Html
              position={[o.position[0], Math.max(base, 0), o.position[2]]}
              zIndexRange={[15, 0]}
              pointerEvents="none"
              style={{ pointerEvents: 'none' }}
            >
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
