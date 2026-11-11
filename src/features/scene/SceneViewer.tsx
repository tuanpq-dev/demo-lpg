import { OrthographicCamera } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import {
  forwardRef,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type RefObject,
} from 'react';
import { SceneLoading } from '@/components/SceneLoading';
import { cn } from '@/lib/cn';
import { MaterialsProvider } from './assets/materials';
import { ASSETS } from './assets/registry';
import { CameraRig } from './CameraRig';
import { inverseToneMap, readScenePalette, type ScenePalette } from './colors';
import { EDIT_SNAP, SCENE_ASSET_MIME } from './editConstants';
import { EditGizmo } from './EditGizmo';
import { FloorOutline, PickerBridge, SelectionFootprints, type SceneEditState, type ScenePicker } from './EditTools';
import type { ResolvedObject, ResolvedScene } from './geometry';
import { SCENE_EXPOSURE } from './look';
import { ObjectNode } from './ObjectNode';
import { isWebGLAvailable, QUALITY_PRESETS, SCENE_QUALITIES, type SceneQuality } from './quality';
import { SceneLabels, ScenePipes } from './SceneContent';
import { Ground, RendererLook, SceneLights, ShadowUpdates, WebGLErrorBoundary } from './SceneEnvironment';
import { DeviceList, ObjectTooltip } from './SceneOverlays';
import type { AssetType, LiveData, ObjectStatus, SceneCamera, SceneConfig, SceneView, Vec3 } from './types';
import { QualityMonitor, ReadySignal, useSceneReady } from './sceneReady';
import { useEditPointer, type Marquee } from './useEditPointer';
import { useSceneLive, useSceneSelection } from './useSceneModel';

export type { EditTool, ObjectTransform, SceneEditState, SelectHow } from './EditTools';

// Hậu kỳ (postprocessing) ở chunk riêng – chỉ tải khi preset bật.
const PostEffects = lazy(() => import('./PostEffects'));

export type SceneViewerHandle = {
  zoomIn(): void;
  zoomOut(): void;
  /** Bay về khung của view hiện tại. */
  reset(): void;
  /** Bay vừa khít các object (trống → mọi object; cảnh rỗng → camera mặc định). */
  fit(ids?: readonly string[]): void;
  /** Camera hiện tại dạng SceneCamera (zoom quy về khung 1146px) – lưu thành view/camera mặc định. */
  getCamera(): SceneCamera | null;
  /** Điểm trên sàn (y = 0) dưới toạ độ màn hình; không truyền → tâm khung. */
  pickGround(clientX?: number, clientY?: number): Vec3 | null;
  /** Toạ độ màn hình (client px) của điểm thế giới – chỉ có ở chế độ sửa. */
  toScreen(p: Vec3): { x: number; y: number } | null;
};

/** API nội bộ của CameraRig (SceneViewerHandle ghép thêm phần chọn bằng tia). */
export type RigApi = Pick<SceneViewerHandle, 'zoomIn' | 'zoomOut' | 'reset' | 'fit' | 'getCamera'>;

export type ZoomLimits = { canZoomIn: boolean; canZoomOut: boolean };

export type SceneViewerProps = {
  config: SceneConfig;
  liveData?: LiveData;
  /** Chế độ xem đang chọn (thuộc `config.views`) → bay camera; undefined → camera mặc định. */
  view?: SceneView;
  onSelect?: (objectId: string) => void;
  onZoomLimits?: (limits: ZoomLimits) => void;
  /** Có → chế độ sửa (chọn nhiều, gizmo di chuyển/xoay/scale, Shift+kéo chọn vùng, thả asset). Xem EditTools. */
  edit?: SceneEditState;
  /**
   * Preset chất lượng (bloom/outline, bóng đổ, dpr). 'auto' (mặc định): bắt đầu 'high', drei PerformanceMonitor
   * hạ/nâng theo FPS đo được; dao động quá 3 lần → chốt ở mức thấp hơn.
   */
  quality?: SceneQuality | 'auto';
  /** WebGL không khả dụng / tạo context lỗi / mất context → báo để trang rơi về ảnh 2.5D. */
  onWebGLError?: (message: string) => void;
  className?: string;
};

const DEFAULT_CAMERA: SceneCamera = { position: [58, 50, 64], target: [0, 0, 0], zoom: 20 };

/** Lỗi WebGL (không hỗ trợ / tạo context lỗi / mất context) – chỉ giữ lỗi đầu tiên, báo lên trang một lần. */
function useGlError(onWebGLError?: (message: string) => void) {
  const [webgl] = useState(isWebGLAvailable);
  const [glError, setGlError] = useState<string | null>(webgl ? null : 'Trình duyệt không hỗ trợ WebGL.');
  const reportGlError = useCallback((message: string) => setGlError((cur) => cur ?? message), []);
  useEffect(() => {
    if (glError) onWebGLError?.(glError);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Chỉ báo một lần cho mỗi lỗi.
  }, [glError]);
  return { glError, reportGlError };
}

/** Thả asset từ thư viện Editor lên sàn: cùng mặt phẳng + snap như khi kéo (Alt = tắt snap); đáy asset ở y = 0. */
function useAssetDrop(edit: SceneEditState | undefined, picker: RefObject<ScenePicker | null>) {
  const accepts = (e: DragEvent) => !!edit?.onDropAsset && e.dataTransfer.types.includes(SCENE_ASSET_MIME);
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!accepts(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    if (!edit?.onDropAsset || !accepts(e)) return;
    e.preventDefault();
    const asset = e.dataTransfer.getData(SCENE_ASSET_MIME) as AssetType;
    const p = picker.current?.ground(e.clientX, e.clientY);
    if (!asset || !p) return;
    const step = edit.snap !== false && !e.altKey ? EDIT_SNAP.translate : 0.001;
    edit.onDropAsset(asset, [Math.round(p.x / step) * step, 0, Math.round(p.z / step) * step]);
  };
  return { onDragOver, onDrop };
}

/** Chọn thiết bị từ danh sách (bàn phím / trình đọc màn hình) → chọn + bay camera tới. */
function devicePickHandler(edit: SceneEditState | undefined, onSelect: ((id: string) => void) | undefined, rig: RefObject<RigApi | null>) {
  const select = edit ? (id: string) => edit.onSelect([id], 'replace') : onSelect;
  if (!select) return undefined;
  return (id: string) => {
    select(id);
    rig.current?.fit([id]);
  };
}

/** Chất lượng 'auto': bắt đầu 'high', PerformanceMonitor hạ/nâng theo FPS; cố định khi truyền preset. */
function useQualityLevel(quality: SceneQuality | 'auto') {
  const [autoLevel, setAutoLevel] = useState<SceneQuality>('high');
  const stepLevel = (d: 1 | -1) => setAutoLevel((l) => SCENE_QUALITIES[Math.min(2, Math.max(0, SCENE_QUALITIES.indexOf(l) + d))]!);
  // Dao động lên xuống → chốt ở mức thấp hơn của cặp đang dao động.
  const fallback = () => setAutoLevel((l) => (l === 'high' ? 'medium' : l));
  return { level: quality === 'auto' ? autoLevel : quality, stepLevel, fallback };
}

/** Khung chọn vùng (Shift+kéo) vẽ trên màn hình. */
function MarqueeBox({ marquee }: { marquee: Marquee | null }) {
  if (!marquee) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-40 border border-primary bg-primary/10"
      style={{
        left: Math.min(marquee.x0, marquee.x1),
        top: Math.min(marquee.y0, marquee.y1),
        width: Math.abs(marquee.x1 - marquee.x0),
        height: Math.abs(marquee.y1 - marquee.y0),
      }}
    />
  );
}

type ObjectsProps = {
  objects: readonly ResolvedObject[];
  statuses: ReadonlyMap<string, ObjectStatus>;
  hovered: string | null;
  selected: ReadonlySet<string>;
  locked: ReadonlySet<string>;
  palette: ScenePalette;
  edit?: SceneEditState;
  drawing: boolean;
  /** setState kiểu hàm (ObjectNode chỉ đổi khi hover đang trỏ đúng object). */
  onHover: (fn: (cur: string | null) => string | null) => void;
  onSelect?: (objectId: string) => void;
};

/** Object của cảnh; chế độ sửa: click = chọn (Ctrl/Shift = đảo), object khoá / đang vẽ ống thì không chọn được. */
function SceneObjects({ objects, statuses, hovered, selected, locked, palette, edit, drawing, onHover, onSelect }: ObjectsProps) {
  const selectOf = (id: string) => {
    if (!edit) return onSelect;
    if (locked.has(id) || drawing) return undefined;
    return (objectId: string, toggle?: boolean) => edit.onSelect([objectId], toggle ? 'toggle' : 'replace');
  };
  return (
    <MaterialsProvider palette={palette}>
      {objects.map((obj) => (
        <ObjectNode
          key={obj.id}
          obj={obj}
          status={statuses.get(obj.id) ?? 'normal'}
          hovered={hovered === obj.id}
          selected={selected.has(obj.id)}
          palette={palette}
          onHover={onHover}
          onSelect={selectOf(obj.id)}
          editing={!!edit}
        />
      ))}
    </MaterialsProvider>
  );
}

/** Lớp hỗ trợ chế độ sửa trong Canvas: chọn bằng tia, khung sàn, dấu chân object đang chọn. */
function EditLayers({
  edit,
  byId,
  palette,
  picker,
}: {
  edit?: SceneEditState;
  byId: ResolvedScene['byId'];
  palette: ScenePalette;
  picker: RefObject<ScenePicker | null>;
}) {
  if (!edit) return null;
  return (
    <>
      <PickerBridge pickerRef={picker} byId={byId} />
      {edit.floor && <FloorOutline half={edit.floor} palette={palette} />}
      {edit.grid !== false && <SelectionFootprints objects={edit.selected.flatMap((id) => byId.get(id) ?? [])} palette={palette} />}
    </>
  );
}

/**
 * Viewer 3D đọc SceneConfig: camera trực giao góc isometric, OrbitControls giới hạn góc,
 * asset theo registry, ống phát sáng có dòng chảy, nhãn HTML (MapMarker) neo theo object.
 * Equipment: hover → viền + emissive, click → onSelect(objectId); environment chỉ là bối cảnh.
 * liveData → nhãn/màu theo bindings và ngưỡng (binding > config.thresholds).
 * Danger: viền + pulse chậm + vòng sáng đỏ dưới sàn + ⚠ ở nhãn.
 */
const SceneViewer = forwardRef<SceneViewerHandle, SceneViewerProps>(function SceneViewer(
  { config, liveData, view, onSelect, onZoomLimits, edit, quality = 'auto', onWebGLError, className },
  ref,
) {
  const { glError, reportGlError } = useGlError(onWebGLError);
  const { level, stepLevel, fallback } = useQualityLevel(quality);
  const { ready, monitor, markReady } = useSceneReady();
  const palette = useMemo(readScenePalette, []);
  const preset = QUALITY_PRESETS[level];
  const groundBehindToneMap = useMemo(() => inverseToneMap(palette.ground, SCENE_EXPOSURE), [palette]);
  const [composerOn, setComposerOn] = useState(false);
  const sel = useSceneSelection(config, edit);
  const { scene, selectedPipe, activeIndex, selected, visible } = sel;
  const drawing = edit?.mode === 'pipe';
  const { byId } = scene;
  const thresholds = config.thresholds;
  const [hovered, setHovered] = useState<string | null>(null);
  const rig = useRef<RigApi | null>(null);
  const picker = useRef<ScenePicker | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const pointer = useEditPointer({
    edit,
    picker,
    config,
    scene,
    drawing,
    selected,
    skipPick: sel.skipPick,
    selectedPipe,
    activeIndex,
    setActivePoint: sel.setActivePoint,
    setPreview: sel.setPreview,
    setHovered,
  });
  const drop = useAssetDrop(edit, picker);

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => rig.current?.zoomIn(),
      zoomOut: () => rig.current?.zoomOut(),
      reset: () => rig.current?.reset(),
      fit: (ids) => rig.current?.fit(ids),
      getCamera: () => rig.current?.getCamera() ?? null,
      pickGround: (x, y) => {
        const el = wrapper.current?.getBoundingClientRect();
        if (!el) return null;
        const p = picker.current?.ground(x ?? el.left + el.width / 2, y ?? el.top + el.height / 2);
        return p ? [p.x, 0, p.z] : null;
      },
      toScreen: (p) => picker.current?.screen(p) ?? null,
    }),
    [],
  );

  const { labels, markedIds, statuses, flowOf, reducedMotion, animated } = useSceneLive(config, visible, liveData);
  const cam = config.camera ?? DEFAULT_CAMERA;
  const hoveredObj = hovered ? byId.get(hovered) : undefined;
  const background = composerOn ? groundBehindToneMap : palette.ground;

  if (glError) {
    return (
      <div role="status" className={cn('grid h-full w-full place-items-center text-base text-fg-muted', className)}>
        Không hiển thị được cảnh 3D: {glError}
      </div>
    );
  }

  return (
    <div
      ref={wrapper}
      className={cn(
        'relative h-full w-full',
        drawing ? 'cursor-crosshair' : hovered && (edit?.mode === 'translate' ? 'cursor-move' : 'cursor-pointer'),
        className,
      )}
      data-scene-quality={level}
      onPointerDownCapture={pointer.onPointerDownCapture}
      onDragOver={drop.onDragOver}
      onDrop={drop.onDrop}
    >
      <WebGLErrorBoundary onError={reportGlError}>
        <Canvas
          dpr={preset.dpr}
          // PCF (không phải PCFSoft) để dùng được shadow.radius → bóng mềm.
          shadows="percentage"
          frameloop={animated ? 'always' : 'demand'}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              reportGlError('Mất ngữ cảnh WebGL (GPU bị đặt lại hoặc hết bộ nhớ).');
            });
          }}
          onPointerMissed={pointer.onMissed}
        >
          <QualityMonitor auto={quality === 'auto'} armed={monitor} onStep={stepLevel} onFallback={fallback} />
          <RendererLook exposure={SCENE_EXPOSURE} />
          {/* Có composer: ToneMapping effect áp cả lên màu nền → dùng màu đã bù để nền vẫn đúng token. */}
          <color attach="background" args={[background]} />
          <OrthographicCamera makeDefault position={cam.position} zoom={cam.zoom} near={0.1} far={600} />
          <CameraRig rigRef={rig} cam={cam} autoHome={!config.camera} sceneId={config.id} view={view} byId={byId} onZoomLimits={onZoomLimits} />
          <SceneLights palette={palette} preset={preset} />
          <Ground palette={palette} grid={edit?.grid !== false} color={background} />
          <EditLayers edit={edit} byId={byId} palette={palette} picker={picker} />

          <SceneObjects
            objects={visible}
            statuses={statuses}
            hovered={hovered}
            selected={selected}
            locked={sel.locked}
            palette={palette}
            edit={edit}
            drawing={drawing}
            onHover={setHovered}
            onSelect={onSelect}
          />

          {/* Sau các object: effect chạy khi mesh đã gắn castShadow. */}
          <ShadowUpdates live={!!edit} version={config} level={level} />

          <ScenePipes
            config={sel.effective}
            scene={scene}
            palette={palette}
            edit={edit}
            drawing={drawing}
            selectedPipe={selectedPipe}
            activeIndex={activeIndex}
            flowOf={flowOf}
            still={reducedMotion}
            bloom={preset.postprocessing}
          />
          <SceneLabels labels={labels} edit={edit} drawing={drawing} onSelect={onSelect} />

          {edit && <EditGizmo edit={edit} byId={byId} state={pointer.gizmo} palette={palette} />}

          {hoveredObj && !markedIds.has(hoveredObj.id) && <ObjectTooltip obj={hoveredObj} liveData={liveData} thresholds={thresholds} />}

          {preset.postprocessing && (
            <Suspense fallback={null}>
              <PostEffects
                preset={preset}
                palette={palette}
                hovered={hovered}
                selected={edit?.selected ?? []}
                shapeKey={config}
                onActive={setComposerOn}
              />
            </Suspense>
          )}
          <ReadySignal onReady={markReady} />
        </Canvas>
      </WebGLErrorBoundary>
      <div aria-hidden className="scene-vignette pointer-events-none absolute inset-0" />
      <SceneLoading hidden={ready} />
      <DeviceList
        sceneName={config.name}
        objects={visible.filter((o) => ASSETS[o.asset].category === 'equipment')}
        statuses={statuses}
        liveData={liveData}
        thresholds={thresholds}
        selected={selected}
        onPick={devicePickHandler(edit, onSelect, rig)}
      />
      <MarqueeBox marquee={pointer.marquee} />
    </div>
  );
});

export default SceneViewer;
