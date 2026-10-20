import { Suspense, lazy, type ReactNode, type RefObject } from 'react';
import {
  Button,
  CursorIcon,
  FitIcon,
  GridIcon,
  Icon,
  MagnetIcon,
  MoveIcon,
  NumberField,
  OrthoIcon,
  PipeIcon,
  RotateIcon,
  ScaleIcon,
} from '@/components';
import { useLiveData } from '@/data/live';
import type { SceneEditState, SceneViewerHandle } from '@/features/scene';
import { FLOOR_HALF_SIZE } from '@/features/scene/editConstants';
import type { AssetType, Vec3 } from '@/features/scene/types';
import { useEditorUi, useSceneDoc, type EditorTool } from '@/features/scene-editor/store';
import type { EditorActions } from './useEditorActions';

// Dùng lại SceneViewer của Viewer (chunk lazy three/drei) – không viết renderer riêng.
const SceneViewer = lazy(() => import('@/features/scene/SceneViewer'));

const TOOLS: { id: EditorTool; label: string; key: string; icon: ReactNode }[] = [
  { id: 'select', label: 'Chọn', key: 'Q', icon: <CursorIcon /> },
  { id: 'translate', label: 'Di chuyển trên sàn', key: 'W', icon: <MoveIcon /> },
  { id: 'rotate', label: 'Xoay (quanh trục đứng)', key: 'E', icon: <RotateIcon /> },
  { id: 'scale', label: 'Scale', key: 'R', icon: <ScaleIcon /> },
  { id: 'pipe', label: 'Vẽ ống', key: 'P', icon: <PipeIcon /> },
];

const HINTS: Record<EditorTool, string> = {
  select: 'Click chọn object/ống · Ctrl+click thêm/bớt · Shift+kéo chọn vùng · ống đang chọn: kéo điểm, click đoạn = thêm điểm, Delete = xoá điểm',
  translate: 'Kéo object trên sàn (Alt = tắt snap) · van/đồng hồ gắn ống: kéo dọc ống · Esc huỷ',
  rotate: 'Kéo vòng gizmo để xoay quanh trục đứng (15°)',
  scale: 'Kéo gizmo để scale (đáy giữ nguyên)',
  pipe: 'Click đặt điểm (bắt cổng ≤ 0,5 m; Alt = tự do) · Enter/double-click xong · Backspace xoá điểm cuối · Esc huỷ · PageUp/PageDown cao độ · O vuông góc',
};

/**
 * Canvas 3D của Editor: SceneViewer nhận cảnh từ store (không tự nạp dữ liệu) + state sửa (chọn, công cụ, ẩn/khoá…)
 * + thanh công cụ nổi (Q W E R, snap, lưới, khung hình vừa).
 */
export function EditorViewport({ viewer, actions }: { viewer: RefObject<SceneViewerHandle>; actions: EditorActions }) {
  const scene = useSceneDoc((s) => s.scene);
  const ui = useEditorUi();
  const liveData = useLiveData();
  const view = scene.views?.find((v) => v.id === ui.previewView);

  const edit: SceneEditState = {
    selected: ui.selection,
    mode: ui.tool,
    snap: ui.snap,
    grid: ui.grid,
    hidden: ui.hidden,
    locked: ui.locked,
    floor: FLOOR_HALF_SIZE,
    onSelect: ui.select,
    onTransform: actions.transform,
    onDropAsset: (asset: AssetType, at: Vec3) => actions.addAsset(asset, at),
    ortho: ui.ortho,
    pipeHeight: ui.pipeHeight,
    onPipeHeight: (y) => ui.set({ pipeHeight: y }),
    onCreatePipe: actions.createPipe,
    onUpdatePipe: actions.updatePipe,
    onInsertPipePoint: actions.insertPipePoint,
    onAttach: actions.setAttach,
  };

  return (
    <div className="relative h-full min-h-0 overflow-hidden rounded-xl border border-line/30 bg-bg-canvas">
      <Suspense fallback={<div className="grid h-full place-items-center text-base text-fg-muted">Đang tải cảnh 3D…</div>}>
        <SceneViewer ref={viewer} config={scene} liveData={liveData} view={view} edit={edit} quality="medium" />
      </Suspense>

      <div
        role="toolbar"
        aria-label="Công cụ canvas"
        className="absolute left-3 top-3 z-30 flex items-center gap-1 rounded-lg border border-line/30 bg-surface-raised/90 p-1 shadow-card backdrop-blur-[4px]"
      >
        {TOOLS.map((t) => (
          <Button
            key={t.id}
            variant="toolbar"
            size="sm"
            aria-label={`${t.label} (${t.key})`}
            title={`${t.label} (${t.key})`}
            pressed={ui.tool === t.id}
            onClick={() => ui.setTool(t.id)}
            icon={t.icon}
          />
        ))}
        <span aria-hidden="true" className="mx-1 h-5 w-px bg-line/60" />
        <Button
          variant="toolbar"
          size="sm"
          aria-label="Snap lưới 0,5 m / 15° (giữ Alt khi kéo để tắt)"
          title="Snap lưới 0,5 m / 15° / 0,1 · độ cao 0,25 m (giữ Alt khi kéo = tắt)"
          pressed={ui.snap}
          onClick={() => ui.toggle('snap')}
          icon={<MagnetIcon />}
        />
        <Button
          variant="toolbar"
          size="sm"
          aria-label="Hiện lưới và vạch chân (G)"
          title="Hiện lưới + vạch chân y = 0 và khoảng cách đáy–sàn (G)"
          pressed={ui.grid}
          onClick={() => ui.toggle('grid')}
          icon={<GridIcon />}
        />
        {ui.tool === 'pipe' && (
          <>
            <span aria-hidden="true" className="mx-1 h-5 w-px bg-line/60" />
            <Button
              variant="toolbar"
              size="sm"
              aria-label="Vẽ vuông góc (O)"
              title="Vuông góc (O): tự chèn điểm gập theo trục X → Z → Y"
              pressed={ui.ortho}
              onClick={() => ui.toggle('ortho')}
              icon={<OrthoIcon />}
            />
            <NumberField
              label="Cao độ vẽ"
              hideLabel
              size="sm"
              prefix="Y"
              unit="m"
              step={0.5}
              className="w-[104px]"
              value={ui.pipeHeight}
              onChange={(y) => ui.set({ pipeHeight: y })}
            />
          </>
        )}
        <Button variant="toolbar" size="sm" aria-label="Khung hình vừa (F)" title="Khung hình vừa (F)" onClick={actions.fit} icon={<FitIcon />} />
        <span aria-hidden="true" className="mx-1 h-5 w-px bg-line/60" />
        <Button variant="toolbar" size="sm" aria-label="Phóng to" onClick={() => viewer.current?.zoomIn()} icon={<Icon name="mapZoomIn" box={16} />} />
        <Button variant="toolbar" size="sm" aria-label="Thu nhỏ" onClick={() => viewer.current?.zoomOut()} icon={<Icon name="mapZoomOut" box={16} />} />
      </div>

      {view && (
        <p className="absolute right-3 top-3 z-30 rounded-sm bg-surface-raised/85 px-2 py-1 text-xs text-fg-muted backdrop-blur-[3px]">
          Đang xem view “{view.label}”
        </p>
      )}
      <p className="pointer-events-none absolute bottom-3 right-3 z-30 rounded-sm bg-surface-raised/80 px-2 py-0.5 text-xs text-fg-muted">
        {HINTS[ui.tool]}
      </p>
    </div>
  );
}
