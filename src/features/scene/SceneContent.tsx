/** Nội dung cảnh vẽ trong Canvas: ống (kèm chèn điểm gập khi sửa) và nhãn HTML neo theo object. Tách từ SceneViewer.tsx. */
import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import type { CatmullRomCurve3 } from 'three';
import { MapMarker, type MapMarkerData } from '@/components/PlantMap/MapMarker';
import { ASSETS } from './assets/registry';
import type { ScenePalette } from './colors';
import { EDIT_SNAP } from './editConstants';
import type { SceneEditState } from './EditTools';
import { DEFAULT_PIPE_RADIUS, labelAnchor, type ResolvedObject, type ResolvedScene } from './geometry';
import { isCanvasEvent } from './ObjectNode';
import { PipeMesh } from './PipeMesh';
import { nearestOnPath, pathLength } from './pipes';
import { PipeDrawTool, PipeHandles } from './PipeTools';
import type { Pipe, SceneConfig, Vec3 } from './types';

/** Điểm chèn trên đoạn ab: đoạn song song trục → snap toạ độ dọc trục theo lưới (giữ nằm trên đoạn). */
function snapAlongSegment(p: Vec3, a: Vec3, b: Vec3, snap: boolean): Vec3 {
  if (!snap) return p.map((v) => +v.toFixed(3)) as Vec3;
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d) || 1;
  return p.map((v, k) => (Math.abs(d[k]!) / len > 0.999 ? Math.round(v / EDIT_SNAP.translate) * EDIT_SNAP.translate : +v.toFixed(3))) as Vec3;
}

/** Click ống (chế độ sửa): ống chưa chọn → chọn; ống đang chọn → chèn điểm gập vào đoạn gần nhất. */
function pipeClickHandler(edit: SceneEditState, pipe: Pipe, curve: CatmullRomCurve3, isSelected: boolean) {
  return (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 4 || !isCanvasEvent(e.nativeEvent)) return;
    if (!isSelected) return edit.onSelect([pipe.id], 'replace');
    // Tia trúng chấm điểm gập (dù vòng khớp nối nằm trước) → là click chọn điểm, không chèn.
    if (e.intersections.some((i) => i.object.userData.pipeHandle)) return;
    const path = curve.points.map((v) => v.toArray());
    if (pathLength(path) <= 0) return;
    const near = nearestOnPath(path, e.point.toArray());
    const a = path[near.index];
    const b = path[near.index + 1];
    if (!a || !b) return;
    edit.onInsertPipePoint?.(pipe.id, snapAlongSegment(near.point, a, b, edit.snap !== false && !e.nativeEvent.altKey));
  };
}

export type ScenePipesProps = {
  config: SceneConfig;
  scene: ResolvedScene;
  palette: ScenePalette;
  edit?: SceneEditState;
  drawing: boolean;
  selectedPipe?: Pipe;
  activeIndex: number | null;
  /** Lưu lượng tươi của tag (mất tín hiệu → undefined, không chạy vệt sáng). */
  flowOf: (tag?: string) => number | undefined;
  still: boolean;
  bloom: boolean;
};

export function ScenePipes({ config, scene, palette, edit, drawing, selectedPipe, activeIndex, flowOf, still, bloom }: ScenePipesProps) {
  return (
    <>
      {config.pipes.map((p) => {
        const curve = scene.curves.get(p.id);
        if (!curve || curve.points.length < 2) return null;
        const isSel = selectedPipe?.id === p.id;
        return (
          <group key={p.id} userData={{ pipeId: p.id }} onClick={edit && !drawing ? pipeClickHandler(edit, p, curve, isSel) : undefined}>
            <PipeMesh
              curve={curve}
              radius={p.radius ?? DEFAULT_PIPE_RADIUS}
              palette={palette}
              flow={flowOf(p.flowTag)}
              still={still}
              bloom={bloom}
              selected={isSel}
            />
          </group>
        );
      })}
      {edit && selectedPipe && !drawing && edit.onUpdatePipe && <PipeHandles pipe={selectedPipe} palette={palette} active={activeIndex} />}
      {edit && drawing && <PipeDrawTool edit={edit} config={config} palette={palette} />}
    </>
  );
}

export type SceneLabelsProps = {
  labels: readonly { obj: ResolvedObject; marker: MapMarkerData }[];
  edit?: SceneEditState;
  drawing: boolean;
  onSelect?: (objectId: string) => void;
};

/** Nhãn HTML (MapMarker) neo theo object; đang vẽ ống: nhãn mờ + click xuyên qua (không che điểm cần đặt). */
export function SceneLabels({ labels, edit, drawing, onSelect }: SceneLabelsProps) {
  return (
    <>
      {labels.map(({ obj, marker }) => {
        const pick = edit ? (id: string) => edit.onSelect([id], 'replace') : ASSETS[obj.asset].category === 'equipment' ? onSelect : undefined;
        return (
          <Html key={obj.id} position={labelAnchor(obj)} zIndexRange={[20, 0]} style={drawing ? { pointerEvents: 'none', opacity: 0.35 } : undefined}>
            <div className="relative">
              <MapMarker {...marker} translucent onClick={pick && !drawing ? () => pick(obj.id) : undefined} />
            </div>
          </Html>
        );
      })}
    </>
  );
}
