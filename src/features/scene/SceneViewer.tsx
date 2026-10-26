import { Grid, Html, OrbitControls, OrthographicCamera, PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import {
  Component,
  forwardRef,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ElementRef,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Matrix4,
  CanvasTexture,
  EdgesGeometry,
  LineSegments,
  SRGBColorSpace,
  Vector3,
  type Color,
  type Group,
  type InstancedMesh,
  type LineBasicMaterial,
  type Mesh,
  type MeshBasicMaterial,
} from 'three';
import { MapMarker } from '@/components/PlantMap/MapMarker';
import { cn } from '@/lib/cn';
import { MaterialsProvider, ObjectStateProvider, useEdgeMaterials, type EdgeTone } from './assets/materials';
import { ASSETS } from './assets/registry';
import { resolveParams } from './assets/specs';
import {
  EditGizmo,
  EDIT_SNAP,
  FloorOutline,
  PickerBridge,
  SCENE_ASSET_MIME,
  SelectionFootprints,
  startAttachDrag,
  startGroundDrag,
  type ScenePicker,
  type SceneEditState,
} from './EditTools';
import { inverseToneMap, readScenePalette, type ScenePalette } from './colors';
import { freshNumber } from '@/features/live/signal';
import { SignalLostIcon } from '@/components/Icon';
import { objectReadings, objectStatus } from './fields';
import {
  DEFAULT_PIPE_RADIUS,
  applyPreview,
  labelAnchor,
  objectBounds,
  resolveScene,
  type CurveCache,
  type ScenePreview,
  worldCorners,
  type ResolvedObject,
} from './geometry';
import { LOOK, SCENE_EXPOSURE } from './look';
import { objectMarker } from './markers';
import { PipeMesh } from './PipeMesh';
import { nearestOnPath, pathLength } from './pipes';
import { PipeDrawTool, PipeHandles, startPointDrag } from './PipeTools';
import { isTyping } from '@/lib/isTyping';
import { prefersReducedMotion, useReducedMotion } from '@/lib/reducedMotion';
import { pulse } from './pulse';
import { isWebGLAvailable, QUALITY_PRESETS, SCENE_QUALITIES, type QualityPreset, type SceneQuality } from './quality';
import type { AssetType, LiveData, ObjectStatus, SceneCamera, SceneConfig, SceneView, Thresholds, Vec3 } from './types';

export { EDIT_SNAP, SCENE_ASSET_MIME } from './EditTools';
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
type RigApi = Pick<SceneViewerHandle, 'zoomIn' | 'zoomOut' | 'reset' | 'fit' | 'getCamera'>;

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

/** Chiều rộng khung tham chiếu của `camera.zoom` (bản đồ Figma 53:242). */
const REF_WIDTH = 1146;
const ZOOM_STEP = 1.3;
/** Giới hạn zoom so với zoom toàn cảnh. */
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 4;
/** Bay tới view: không zoom quá mức này (so với toàn cảnh) để vẫn thấy ngữ cảnh xung quanh. */
const FOCUS_ZOOM_MAX = 2;
/** Chừa chỗ cho nhãn phía trên object khi bay tới (m). */
const LABEL_HEADROOM = 3.5;
const FLY_RATE = 5;
const DEFAULT_CAMERA: SceneCamera = { position: [58, 50, 64], target: [0, 0, 0], zoom: 20 };

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
  const [webgl] = useState(isWebGLAvailable);
  const [glError, setGlError] = useState<string | null>(webgl ? null : 'Trình duyệt không hỗ trợ WebGL.');
  const reportGlError = useCallback((message: string) => setGlError((cur) => cur ?? message), []);
  useEffect(() => {
    if (glError) onWebGLError?.(glError);
    // Chỉ báo một lần cho mỗi lỗi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glError]);

  const [autoLevel, setAutoLevel] = useState<SceneQuality>('high');
  const level = quality === 'auto' ? autoLevel : quality;
  const stepLevel = (d: 1 | -1) =>
    setAutoLevel((l) => SCENE_QUALITIES[Math.min(2, Math.max(0, SCENE_QUALITIES.indexOf(l) + d))]!);
  const palette = useMemo(readScenePalette, []);
  const preset = QUALITY_PRESETS[level];
  const groundBehindToneMap = useMemo(() => inverseToneMap(palette.ground, SCENE_EXPOSURE), [palette]);
  const [composerOn, setComposerOn] = useState(false);
  // Chế độ sửa: bản xem trước khi đang kéo (object/điểm ống/t) – ống nối đi theo ngay; cache đường cong theo ống
  // → chỉ ống có đường đi đổi mới dựng lại TubeGeometry.
  const [preview, setPreview] = useState<ScenePreview | null>(null);
  const curveCache = useRef<CurveCache>(new Map());
  const effective = useMemo(() => applyPreview(config, preview), [config, preview]);
  const scene = useMemo(() => resolveScene(effective, curveCache.current), [effective]);
  const selectedPipe = edit ? effective.pipes.find((p) => edit.selected.includes(p.id)) : undefined;
  const [activePoint, setActivePoint] = useState<{ pipe: string; index: number } | null>(null);
  const activeIndex = activePoint && activePoint.pipe === selectedPipe?.id ? activePoint.index : null;
  const drawing = edit?.mode === 'pipe';
  const { byId } = scene;
  const thresholds = config.thresholds;
  const [hovered, setHovered] = useState<string | null>(null);
  const hidden = useMemo(() => new Set(edit?.hidden), [edit?.hidden]);
  const locked = useMemo(() => new Set(edit?.locked), [edit?.locked]);
  const visible = hidden.size ? scene.objects.filter((o) => !hidden.has(o.id)) : scene.objects;
  const selected = useMemo(() => new Set(edit?.selected), [edit?.selected]);
  const rig = useRef<RigApi | null>(null);
  const picker = useRef<ScenePicker | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  // Nhãn tự sinh từ object.marker + label + bindings + liveData.
  const labels = visible.flatMap((o) => {
    const m = objectMarker(o, liveData, thresholds);
    return m ? [{ obj: o, marker: m }] : [];
  });
  const markedIds = new Set(labels.map((l) => l.obj.id));

  // Bỏ chọn khi click vùng trống (chế độ sửa) – bỏ qua nếu vừa kéo gizmo hoặc chuột đã di chuyển > 4px (xoay/pan).
  const downAt = useRef<{ x: number; y: number } | null>(null);
  const gizmo = useRef({ dragging: false, endedAt: 0 });
  const onMissed = (e: MouseEvent) => {
    setHovered(null);
    // R3F nghe sự kiện ở div bọc canvas → click lên nhãn HTML cũng tới đây; chỉ tính click trên canvas.
    if (!edit || !isCanvasEvent(e)) return;
    // Vẽ ống: click = đặt điểm, không bỏ chọn.
    if (edit.mode === 'pipe') return;
    const g = gizmo.current;
    if (g.dragging || performance.now() - g.endedAt < 300) return;
    const d = downAt.current;
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return;
    edit.onSelect([], 'replace');
  };

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

  // Delete/Backspace khi đang chọn một điểm gập → xoá điểm (đường đi còn ≥ 2 điểm); chặn phím tắt xoá cả ống.
  useEffect(() => {
    if (activeIndex === null || !selectedPipe || !edit?.onUpdatePipe) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        setActivePoint(null);
        return;
      }
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      e.preventDefault();
      e.stopPropagation();
      const pathLen = scene.curves.get(selectedPipe.id) ? selectedPipe.points.length + (selectedPipe.from ? 1 : 0) + (selectedPipe.to ? 1 : 0) : 0;
      if (pathLen <= 2) return;
      edit.onUpdatePipe!(selectedPipe.id, (p) => ({ ...p, points: p.points.filter((_, i) => i !== activeIndex) }));
      setActivePoint(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [activeIndex, selectedPipe, edit, scene]);

  // ----- Chế độ sửa: Shift+kéo = chọn vùng (Shift+click = đảo chọn), thả asset từ thư viện -----
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const skipPick = useMemo(() => new Set([...hidden, ...locked]), [hidden, locked]);
  const onPointerDownCapture = (e: ReactPointerEvent<HTMLDivElement>) => {
    downAt.current = { x: e.clientX, y: e.clientY };
    if (!edit || e.button !== 0 || !(e.target instanceof HTMLCanvasElement)) return;
    // Vẽ ống: PipeDrawTool tự nghe sự kiện trên canvas (click đặt điểm, kéo = xoay camera).
    if (drawing || !picker.current) return;
    const dragState = (dragging: boolean) => {
      gizmo.current.dragging = dragging;
      if (!dragging) gizmo.current.endedAt = performance.now();
    };
    // Tay nắm điểm gập của ống đang chọn → kéo điểm (mọi công cụ trừ vẽ ống).
    const handle = !e.shiftKey && picker.current.handle(e.clientX, e.clientY);
    if (handle && selectedPipe?.id === handle.pipe) {
      setActivePoint(handle);
      const pipe = config.pipes.find((p) => p.id === handle.pipe)!;
      startPointDrag({ picker: picker.current, edit, pipe, index: handle.index, clientX: e.clientX, clientY: e.clientY, onPreview: setPreview, onState: dragState });
      return;
    }
    // Di chuyển: nắm object (không phím bổ trợ) → kéo trên mặt sàn. Không chặn sự kiện (R3F vẫn ghi pointerdown cho click);
    // OrbitControls bị tắt trước khi sự kiện tới canvas nên không xoay camera.
    if (edit.mode === 'translate' && !e.shiftKey && !e.ctrlKey && !e.metaKey && picker.current) {
      const id = picker.current.object(e.clientX, e.clientY, skipPick);
      if (!id) return;
      // Object gắn ống: kéo dọc ống (đổi t).
      const grabbed = byId.get(id);
      const curve = grabbed?.attach && scene.curves.get(grabbed.attach.pipe);
      if (grabbed?.attach) {
        const ok =
          !!curve &&
          startAttachDrag({ picker: picker.current, edit, obj: grabbed, curve, clientX: e.clientX, clientY: e.clientY, onPreview: setPreview, onState: dragState });
        if (ok && !selected.has(id)) edit.onSelect([id], 'replace');
        return;
      }
      const group = selected.has(id) ? edit.selected : [id];
      const ok = startGroundDrag({
        picker: picker.current,
        edit,
        byId,
        grabbed: id,
        ids: group,
        clientX: e.clientX,
        clientY: e.clientY,
        onState: dragState,
        onPreview: setPreview,
      });
      if (ok && !selected.has(id)) edit.onSelect([id], 'replace');
      return;
    }
    if (!e.shiftKey) return;
    // Chặn OrbitControls/R3F: Shift+kéo thuộc về chọn vùng.
    e.stopPropagation();
    const start = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY };
    setMarquee(start);
    const move = (ev: PointerEvent) => setMarquee({ ...start, x1: ev.clientX, y1: ev.clientY });
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setMarquee(null);
      const rect = {
        left: Math.min(start.x0, ev.clientX),
        right: Math.max(start.x0, ev.clientX),
        top: Math.min(start.y0, ev.clientY),
        bottom: Math.max(start.y0, ev.clientY),
      };
      if (rect.right - rect.left < 4 && rect.bottom - rect.top < 4) {
        const id = picker.current?.object(ev.clientX, ev.clientY, skipPick);
        if (id) edit.onSelect([id], 'toggle');
      } else edit.onSelect(picker.current?.inRect(rect, skipPick) ?? [], 'add');
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const acceptsAsset = (e: DragEvent) => !!edit?.onDropAsset && e.dataTransfer.types.includes(SCENE_ASSET_MIME);
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    if (!edit?.onDropAsset || !acceptsAsset(e)) return;
    e.preventDefault();
    const asset = e.dataTransfer.getData(SCENE_ASSET_MIME) as AssetType;
    const p = picker.current?.ground(e.clientX, e.clientY);
    if (!asset || !p) return;
    // Cùng mặt phẳng sàn + snap như khi kéo (Alt = tắt snap); đáy asset luôn ở y = 0.
    const step = edit.snap !== false && !e.altKey ? EDIT_SNAP.translate : 0.001;
    edit.onDropAsset(asset, [Math.round(p.x / step) * step, 0, Math.round(p.z / step) * step]);
  };
  const statuses = new Map(
    visible.map((o) => [
      o.id,
      ASSETS[o.asset].category === 'equipment' ? objectStatus(o, liveData, thresholds) : ('normal' as ObjectStatus),
    ]),
  );

  // Lưu lượng tươi (mất tín hiệu → không chạy vệt sáng, không giữ số cũ).
  const flowOf = (tag?: string) => (tag ? freshNumber(liveData?.[tag]) : undefined);
  // Render liên tục khi có ống đang chảy hoặc object danger (pulse); còn lại render theo yêu cầu.
  // prefers-reduced-motion: không vệt chảy/không pulse → không cần vẽ liên tục.
  const reducedMotion = useReducedMotion();
  const animated =
    !reducedMotion && (config.pipes.some((p) => (flowOf(p.flowTag) ?? 0) > 0) || [...statuses.values()].includes('danger'));
  const cam = config.camera ?? DEFAULT_CAMERA;
  const hoveredObj = hovered ? byId.get(hovered) : undefined;

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
      onPointerDownCapture={onPointerDownCapture}
      onDragOver={(e) => {
        if (!acceptsAsset(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={onDrop}
    >
      <WebGLErrorBoundary onError={reportGlError}>
        <Canvas
          dpr={preset.dpr}
          // PCF (không phải PCFSoft) để dùng được shadow.radius → bóng mềm.
          shadows="percentage"
          frameloop={animated ? 'always' : 'demand'}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          onCreated={({ gl, scene: three, get }) => {
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              reportGlError('Mất ngữ cảnh WebGL (GPU bị đặt lại hoặc hết bộ nhớ).');
            });
            // Dev: số draw call/tam giác mỗi frame (`__sceneGl.info.render`), scene three (đo hình học) và store R3F
            // (`__sceneR3f()` → camera/controls: test đặt góc nhìn) cho test tương tác.
            if (import.meta.env.DEV) Object.assign(window, { __sceneGl: gl, __sceneThree: three, __sceneR3f: get });
          }}
          onPointerMissed={onMissed}
        >
          {quality === 'auto' && (
            <PerformanceMonitor
              // Hạ khi < 48 FPS, nâng khi > 58 FPS (mục tiêu ≥ 50 FPS) – không phụ thuộc tần số quét màn hình.
              bounds={() => [48, 58]}
              onDecline={() => stepLevel(-1)}
              onIncline={() => stepLevel(1)}
              flipflops={3}
              // Dao động lên xuống → chốt ở mức thấp hơn của cặp đang dao động.
              onFallback={() => setAutoLevel((l) => (l === 'high' ? 'medium' : l))}
            />
          )}
          <RendererLook exposure={SCENE_EXPOSURE} />
          {/* Có composer: ToneMapping effect áp cả lên màu nền → dùng màu đã bù để nền vẫn đúng token. */}
          <color attach="background" args={[composerOn ? groundBehindToneMap : palette.ground]} />
          <OrthographicCamera makeDefault position={cam.position} zoom={cam.zoom} near={0.1} far={600} />
          <CameraRig
            rigRef={rig}
            cam={cam}
            autoHome={!config.camera}
            sceneId={config.id}
            view={view}
            byId={byId}
            onZoomLimits={onZoomLimits}
          />
          {edit && <PickerBridge pickerRef={picker} byId={byId} />}

          <SceneLights palette={palette} preset={preset} />
          <Ground palette={palette} grid={edit?.grid !== false} color={composerOn ? groundBehindToneMap : palette.ground} />
          {edit?.floor && <FloorOutline half={edit.floor} palette={palette} />}
          {edit && edit.grid !== false && (
            <SelectionFootprints objects={edit.selected.flatMap((id) => byId.get(id) ?? [])} palette={palette} />
          )}

          <MaterialsProvider palette={palette}>
            {visible.map((obj) => (
              <ObjectNode
                key={obj.id}
                obj={obj}
                status={statuses.get(obj.id) ?? 'normal'}
                hovered={hovered === obj.id}
                selected={selected.has(obj.id)}
                palette={palette}
                onHover={setHovered}
                onSelect={
                  edit
                    ? locked.has(obj.id) || drawing
                      ? undefined
                      : (id, toggle) => edit.onSelect([id], toggle ? 'toggle' : 'replace')
                    : onSelect
                }
                editing={!!edit}
              />
            ))}
          </MaterialsProvider>

          {/* Sau các object: effect chạy khi mesh đã gắn castShadow. */}
          <ShadowUpdates live={!!edit} version={config} level={level} />

          {effective.pipes.map((p) => {
            const curve = scene.curves.get(p.id);
            if (!curve || curve.points.length < 2) return null;
            const isSel = selectedPipe?.id === p.id;
            // Chế độ sửa: click ống = chọn ống; click ống đang chọn = thêm điểm gập vào đoạn gần nhất.
            const onClick =
              edit && !drawing
                ? (e: ThreeEvent<MouseEvent>) => {
                    e.stopPropagation();
                    if (e.delta > 4 || !isCanvasEvent(e.nativeEvent)) return;
                    if (!isSel) return edit.onSelect([p.id], 'replace');
                    // Tia trúng chấm điểm gập (dù vòng khớp nối nằm trước) → là click chọn điểm, không chèn.
                    if (e.intersections.some((i) => i.object.userData.pipeHandle)) return;
                    const path = curve.points.map((v) => v.toArray() as Vec3);
                    if (pathLength(path) <= 0) return;
                    const near = nearestOnPath(path, e.point.toArray() as Vec3);
                    const at = snapAlongSegment(near.point, path[near.index]!, path[near.index + 1]!, edit.snap !== false && !e.nativeEvent.altKey);
                    edit.onInsertPipePoint?.(p.id, at);
                  }
                : undefined;
            return (
              <group key={p.id} userData={{ pipeId: p.id }} onClick={onClick}>
                <PipeMesh
                  curve={curve}
                  radius={p.radius ?? DEFAULT_PIPE_RADIUS}
                  palette={palette}
                  flow={flowOf(p.flowTag)}
                  still={reducedMotion}
                  bloom={preset.postprocessing}
                  selected={isSel}
                />
              </group>
            );
          })}
          {edit && selectedPipe && !drawing && edit.onUpdatePipe && <PipeHandles pipe={selectedPipe} palette={palette} active={activeIndex} />}
          {edit && drawing && <PipeDrawTool edit={edit} config={effective} palette={palette} />}

          {labels.map(({ obj, marker }) => {
            const pick = edit
              ? (id: string) => edit.onSelect([id], 'replace')
              : ASSETS[obj.asset].category === 'equipment'
                ? onSelect
                : undefined;
            return (
              // Đang vẽ ống: nhãn mờ + click xuyên qua (không che điểm cần đặt).
              <Html
                key={obj.id}
                position={labelAnchor(obj)}
                zIndexRange={[20, 0]}
                style={drawing ? { pointerEvents: 'none', opacity: 0.35 } : undefined}
              >
                <div className="relative">
                  <MapMarker {...marker} translucent onClick={pick && !drawing ? () => pick(obj.id) : undefined} />
                </div>
              </Html>
            );
          })}

          {edit && <EditGizmo edit={edit} byId={byId} state={gizmo} palette={palette} />}

          {hoveredObj && !markedIds.has(hoveredObj.id) && (
            <ObjectTooltip obj={hoveredObj} liveData={liveData} thresholds={thresholds} />
          )}

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
        </Canvas>
      </WebGLErrorBoundary>
      <div aria-hidden className="scene-vignette pointer-events-none absolute inset-0" />
      <DeviceList
        sceneName={config.name}
        objects={visible.filter((o) => ASSETS[o.asset].category === 'equipment')}
        statuses={statuses}
        liveData={liveData}
        thresholds={thresholds}
        selected={selected}
        onPick={
          edit
            ? (id) => {
                edit.onSelect([id], 'replace');
                rig.current?.fit([id]);
              }
            : onSelect
              ? (id) => {
                  onSelect(id);
                  rig.current?.fit([id]);
                }
              : undefined
        }
      />
      {marquee && (
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
      )}
    </div>
  );
});

export default SceneViewer;

// ---------------------------------------------------------------------------
// Renderer, ánh sáng, sàn

const noRaycast = () => null;

/** Điểm chèn trên đoạn ab: đoạn song song trục → snap toạ độ dọc trục theo lưới (giữ nằm trên đoạn). */
function snapAlongSegment(p: Vec3, a: Vec3, b: Vec3, snap: boolean): Vec3 {
  if (!snap) return p.map((v) => +v.toFixed(3)) as Vec3;
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d) || 1;
  return p.map((v, k) => (Math.abs(d[k]!) / len > 0.999 ? Math.round(v / EDIT_SNAP.translate) * EDIT_SNAP.translate : +v.toFixed(3))) as Vec3;
}

/** Bắt lỗi khi dựng Canvas/WebGLRenderer (vd. GPU bị chặn) → báo lên để rơi về ảnh 2.5D. */
class WebGLErrorBoundary extends Component<{ onError: (message: string) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onError(error instanceof Error ? error.message : String(error));
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** ACESFilmic + sRGB + exposure (một biến: SCENE_EXPOSURE). EffectComposer tự tắt tone mapping renderer và dùng ToneMapping effect. */
function RendererLook({ exposure }: { exposure: number }) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    gl.toneMapping = ACESFilmicToneMapping;
    gl.outputColorSpace = SRGBColorSpace;
    gl.toneMappingExposure = exposure;
    invalidate();
  }, [gl, exposure, invalidate]);
  return null;
}

/**
 * Hemisphere (trời lạnh / đất xanh đậm) + key light trắng trung tính (không nhuộm màu asset) chéo từ trên cao phía camera, đổ bóng PCF có bán kính blur.
 * Đổi kích thước shadow map → remount đèn (three không tự tạo lại shadow map).
 */
function SceneLights({ palette, preset }: { palette: ScenePalette; preset: QualityPreset }) {
  const { direction, distance, intensity, shadowRadius, shadowBias } = LOOK.key;
  const e = LOOK.shadowExtent;
  const size = preset.shadowMapSize;
  return (
    <>
      <hemisphereLight args={[palette.sky, palette.shade, LOOK.hemi.intensity]} />
      <directionalLight
        key={size}
        position={[direction[0] * distance, direction[1] * distance, direction[2] * distance]}
        intensity={intensity}
        castShadow={preset.shadows}
        shadow-mapSize={[size, size]}
        shadow-radius={shadowRadius}
        shadow-camera-left={-e}
        shadow-camera-right={e}
        shadow-camera-top={e}
        shadow-camera-bottom={-e}
        shadow-camera-near={1}
        shadow-camera-far={distance * 2.5}
        shadow-bias={shadowBias}
        shadow-normalBias={0.02}
      />
    </>
  );
}

/**
 * Cảnh tĩnh → không render lại shadow map mỗi frame (frameloop 'always' chỉ vì ống chảy/pulse).
 * Cập nhật một lần khi cảnh/preset đổi; chế độ sửa (`live`) cập nhật liên tục để bóng theo gizmo khi kéo.
 */
function ShadowUpdates({ live, version, level }: { live: boolean; version: unknown; level: SceneQuality }) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    gl.shadowMap.autoUpdate = live;
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [gl, live, version, level, invalidate]);
  useEffect(
    () => () => {
      gl.shadowMap.autoUpdate = true;
    },
    [gl],
  );
  return null;
}

/** Mặt nạ độ sáng tròn mờ dần cho "đèn nền" giữa sàn (nhân với màu token, blending cộng). */
function createFalloffTexture(stops: [number, number][]) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  for (const [at, v] of stops) grad.addColorStop(at, `rgb(${v} ${v} ${v})`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new CanvasTexture(c);
}

/** Sàn: nhận bóng + vùng sáng nhẹ ở giữa (Figma: giữa #0A1827, rìa #081323) + lưới token. */
/**
 * Sàn CHỈ ĐỂ NHÌN (không nhận tia – kéo/thả tính bằng GROUND_PLANE trong EditTools): mặt sàn lớn màu `scene-ground`
 * (cùng màu nền, đã bù tone mapping khi có composer), lớp nhận bóng, vùng sáng giữa sàn, lưới `scene-grid`.
 */
function Ground({ palette, grid = true, color }: { palette: ScenePalette; grid?: boolean; color: Color }) {
  const falloff = useMemo(
    () =>
      createFalloffTexture([
        [0, 255],
        [0.45, 150],
        [1, 0],
      ]),
    [],
  );
  useEffect(() => () => falloff.dispose(), [falloff]);
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.05} renderOrder={-3} raycast={noRaycast}>
        <planeGeometry args={[800, 800]} />
        <meshBasicMaterial color={color} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02} receiveShadow raycast={noRaycast}>
        <planeGeometry args={[400, 400]} />
        <shadowMaterial transparent opacity={LOOK.shadowOpacity} color={palette.shade} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.03, 0]} renderOrder={-2} raycast={noRaycast}>
        <planeGeometry args={[150, 150]} />
        <meshBasicMaterial
          color={palette.grid}
          map={falloff}
          transparent
          opacity={0.22}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {grid && (
        <Grid
          raycast={noRaycast}
          position-y={-0.01}
          infiniteGrid
          cellSize={2}
          cellThickness={0.5}
          cellColor={palette.grid}
          sectionSize={10}
          sectionThickness={1}
          sectionColor={palette.grid}
          fadeDistance={220}
          fadeStrength={2.5}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

type Goal = { target: Vector3; zoom: number; offset: Vector3 };

function CameraRig({
  rigRef,
  cam,
  autoHome,
  sceneId,
  view,
  byId,
  onZoomLimits,
}: {
  rigRef: MutableRefObject<RigApi | null>;
  cam: SceneCamera;
  /** Cảnh không khai báo camera → "Toàn cảnh" = khung vừa mọi object (hướng nhìn theo camera mặc định). */
  autoHome: boolean;
  /** Đổi cảnh → đặt lại khung. */
  sceneId: string;
  view?: SceneView;
  byId: Map<string, ResolvedObject>;
  onZoomLimits?: (l: ZoomLimits) => void;
}) {
  const controls = useRef<ElementRef<typeof OrbitControls>>(null);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const goal = useRef<Goal | null>(null);
  const placed = useRef(false);
  const lastLimits = useRef('');

  const homeZoom = cam.zoom * (size.width / REF_WIDTH);
  const minZoom = homeZoom * ZOOM_MIN;
  const maxZoom = homeZoom * ZOOM_MAX;
  const clampZoom = useCallback((z: number) => Math.min(maxZoom, Math.max(minZoom, z)), [minZoom, maxZoom]);
  const homeOffset = useMemo(() => new Vector3(...cam.position).sub(new Vector3(...cam.target)), [cam]);
  const viewKey = view ? JSON.stringify([view.objectIds, view.camera]) : '';

  /** Khung vừa khít các object (chừa chỗ nhãn); rỗng → camera mặc định của cảnh. */
  const fitGoal = useCallback(
    (objs: ResolvedObject[]): Goal => {
      if (!objs.length) return { target: new Vector3(...cam.target), zoom: homeZoom, offset: homeOffset.clone() };

    const back = homeOffset.clone().normalize();
    const right = new Vector3(0, 1, 0).cross(back).normalize();
    const up = back.clone().cross(right);
    let [u0, u1, v0, v1, dSum, n] = [Infinity, -Infinity, Infinity, -Infinity, 0, 0];
    for (const c of objs.flatMap(worldCorners)) {
      const u = c.dot(right);
      const v = c.dot(up);
      [u0, u1, v0, v1] = [Math.min(u0, u), Math.max(u1, u), Math.min(v0, v), Math.max(v1, v)];
      dSum += c.dot(back);
      n++;
    }
    v1 += LABEL_HEADROOM;
    const target = right
      .clone()
      .multiplyScalar((u0 + u1) / 2)
      .addScaledVector(up, (v0 + v1) / 2)
      .addScaledVector(back, dSum / n);
    const fit = Math.min(size.width / ((u1 - u0) * 1.15), size.height / ((v1 - v0) * 1.15));
    const zoom = clampZoom(Math.min(fit, homeZoom * FOCUS_ZOOM_MAX));
    return { target, zoom, offset: homeOffset.clone() };
    },
    [cam, homeZoom, homeOffset, clampZoom, size.width, size.height],
  );

  /** Khung cho view hiện tại: camera của view, vừa khít `objectIds`, camera của cảnh – hoặc vừa mọi object nếu cảnh chưa có camera. */
  const viewGoal = useCallback((): Goal => {
    if (view?.camera) {
      const c = view.camera;
      return {
        target: new Vector3(...c.target),
        zoom: clampZoom(c.zoom * (size.width / REF_WIDTH)),
        offset: new Vector3(...c.position).sub(new Vector3(...c.target)),
      };
    }
    if (!view?.objectIds?.length && autoHome) return fitGoal([...byId.values()]);
    return fitGoal((view?.objectIds ?? []).map((id) => byId.get(id)).filter((o): o is ResolvedObject => !!o));
    // viewKey thay cho object view (tham chiếu có thể đổi mỗi render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey, byId, fitGoal, clampZoom, size.width, autoHome]);
  const latestGoal = useRef(viewGoal);
  latestGoal.current = viewGoal;

  const reportLimits = useCallback(() => {
    const l = { canZoomIn: camera.zoom < maxZoom * 0.999, canZoomOut: camera.zoom > minZoom * 1.001 };
    const key = `${l.canZoomIn}${l.canZoomOut}`;
    if (key !== lastLimits.current) {
      lastLimits.current = key;
      onZoomLimits?.(l);
    }
  }, [camera, minZoom, maxZoom, onZoomLimits]);

  // Chỉ bay khi đổi view / kích thước khung / camera của cảnh / cảnh (lần đầu đặt ngay, không bay).
  // KHÔNG theo `byId`: sửa object (Editor) không được kéo camera về khung cũ.
  const frameKey = `${sceneId}|${viewKey}|${size.width}x${size.height}|${JSON.stringify(cam)}|${autoHome}`;
  useEffect(() => {
    const g = latestGoal.current();
    const c = controls.current;
    if (!placed.current && c) {
      placed.current = true;
      c.target.copy(g.target);
      camera.position.copy(g.target).add(g.offset);
      camera.zoom = g.zoom;
      camera.updateProjectionMatrix();
      c.update();
      reportLimits();
    } else {
      goal.current = g;
    }
    invalidate();
  }, [frameKey, camera, invalidate, reportLimits]);

  useImperativeHandle(
    rigRef,
    () => {
      const zoomBy = (f: number) => {
        const c = controls.current;
        if (!c) return;
        goal.current = {
          target: c.target.clone(),
          offset: camera.position.clone().sub(c.target),
          zoom: clampZoom(camera.zoom * f),
        };
        invalidate();
      };
      return {
        zoomIn: () => zoomBy(ZOOM_STEP),
        zoomOut: () => zoomBy(1 / ZOOM_STEP),
        reset: () => {
          goal.current = viewGoal();
          invalidate();
        },
        fit: (ids) => {
          const objs = ids?.length ? ids.map((id) => byId.get(id)).filter((o): o is ResolvedObject => !!o) : [...byId.values()];
          goal.current = fitGoal(objs);
          invalidate();
        },
        getCamera: () => {
          const c = controls.current;
          if (!c) return null;
          const r = (v: number) => +v.toFixed(2);
          return {
            position: camera.position.toArray().map(r) as Vec3,
            target: c.target.toArray().map(r) as Vec3,
            zoom: r(camera.zoom / (size.width / REF_WIDTH)),
          };
        },
      };
    },
    [camera, clampZoom, invalidate, viewGoal, fitGoal, byId, size.width],
  );

  useFrame((_, dt) => {
    const g = goal.current;
    const c = controls.current;
    if (!g || !c) return;
    // Giảm chuyển động → nhảy thẳng tới khung (không bay).
    const k = prefersReducedMotion() ? 1 : 1 - Math.exp(-dt * FLY_RATE);
    const offset = camera.position.clone().sub(c.target).lerp(g.offset, k);
    c.target.lerp(g.target, k);
    camera.zoom += (g.zoom - camera.zoom) * k;
    const done =
      c.target.distanceTo(g.target) < 0.01 && Math.abs(camera.zoom - g.zoom) < g.zoom * 0.002 && offset.distanceTo(g.offset) < 0.05;
    if (done) {
      c.target.copy(g.target);
      camera.zoom = g.zoom;
      offset.copy(g.offset);
      goal.current = null;
    }
    camera.position.copy(c.target).add(offset);
    camera.updateProjectionMatrix();
    c.update();
    reportLimits();
    invalidate();
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.12}
      // Không lật xuống dưới mặt đất, không nhìn thẳng từ đỉnh.
      minPolarAngle={0.35}
      maxPolarAngle={1.2}
      minZoom={minZoom}
      maxZoom={maxZoom}
      zoomToCursor
      onStart={() => {
        goal.current = null;
      }}
      onChange={reportLimits}
    />
  );
}

// ---------------------------------------------------------------------------

/** Sự kiện có đích là chính canvas (không phải nhãn/tooltip HTML phủ lên). */
const isCanvasEvent = (e: Event) => e.target instanceof HTMLCanvasElement;

function ObjectNode({
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
  const edgeTone: EdgeTone = selected
    ? 'selected'
    : hovered
      ? 'hover'
      : status === 'normal'
        ? 'normal'
        : status;
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
    // material đổi được xử lý ở effect dưới.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // `key` gói min/max (mảng mới mỗi render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
function createGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgb(255 255 255)');
  grad.addColorStop(0.6, 'rgb(150 150 150)');
  grad.addColorStop(1, 'rgb(0 0 0)');
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
      <meshBasicMaterial
        ref={material}
        color={color}
        map={texture}
        transparent
        opacity={0.4}
        blending={AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

const readingTone: Record<ObjectStatus, string> = {
  normal: 'text-fg',
  warning: 'text-warning',
  danger: 'text-danger-text',
  offline: 'text-neutral',
};

const STATUS_TEXT: Record<ObjectStatus, string> = {
  normal: 'bình thường',
  warning: 'cảnh báo',
  danger: 'sự cố',
  offline: 'mất tín hiệu',
};

/**
 * Văn bản thay thế cho canvas 3D (trình đọc màn hình + bàn phím): tóm tắt số thiết bị theo trạng thái và danh sách
 * thiết bị (tên, trạng thái, số đo). Ẩn với mắt thường; Tab vào thì hiện thành bảng nhỏ góc trên trái. Có `onPick` →
 * mỗi thiết bị là nút: Enter/Space = chọn thiết bị + đưa camera tới.
 */
function DeviceList({
  sceneName,
  objects,
  statuses,
  liveData,
  thresholds,
  selected,
  onPick,
}: {
  sceneName: string;
  objects: ResolvedObject[];
  statuses: Map<string, ObjectStatus>;
  liveData?: LiveData;
  thresholds?: Record<string, Thresholds>;
  selected: ReadonlySet<string>;
  onPick?: (id: string) => void;
}) {
  const count = (s: ObjectStatus) => objects.filter((o) => statuses.get(o.id) === s).length;
  const summary = `${objects.length} thiết bị: ${count('danger')} sự cố, ${count('warning')} cảnh báo, ${count('offline')} mất tín hiệu.`;
  return (
    <section
      aria-label={`Thiết bị trong cảnh ${sceneName}`}
      data-scene-devices
      className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:left-3 focus-within:top-16 focus-within:z-30 focus-within:max-h-[60%] focus-within:w-72 focus-within:overflow-auto focus-within:rounded-lg focus-within:border focus-within:border-line/30 focus-within:bg-surface-raised/95 focus-within:p-2 focus-within:text-sm focus-within:shadow-card"
    >
      <p className="mb-1 text-fg-secondary">{summary}</p>
      <ul className="flex flex-col gap-0.5">
        {objects.map((o) => {
          const st = statuses.get(o.id) ?? 'normal';
          const readings = objectReadings(o, liveData, thresholds)
            .map((r) => `${r.label} ${r.text}`)
            .join(', ');
          const text = `${o.label ?? o.id} (${o.id}) – ${STATUS_TEXT[st]}${readings ? `. ${readings}` : ''}`;
          return (
            <li key={o.id}>
              {onPick ? (
                <button
                  type="button"
                  aria-pressed={selected.has(o.id)}
                  onClick={() => onPick(o.id)}
                  className={cn('w-full rounded-sm px-2 py-1 text-left hover:bg-surface-muted', readingTone[st])}
                >
                  {text}
                </button>
              ) : (
                <span className={readingTone[st]}>{text}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Tooltip khi hover object không có marker: tên + loại + số liệu theo bindings. */
function ObjectTooltip({
  obj,
  liveData,
  thresholds,
}: {
  obj: ResolvedObject;
  liveData?: LiveData;
  thresholds?: Record<string, Thresholds>;
}) {
  const readings = objectReadings(obj, liveData, thresholds);
  return (
    <Html position={labelAnchor(obj)} zIndexRange={[21, 0]} pointerEvents="none">
      <div className="pointer-events-none -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-sm border border-accent/50 bg-surface-raised px-2.5 py-1.5 text-sm text-fg shadow-glow-accent">
        <div className="font-semibold">{obj.label ?? obj.id}</div>
        <div className="text-xs text-fg-muted">
          {ASSETS[obj.asset].label} · {obj.id}
        </div>
        {readings.map((r) => (
          <div key={r.field} className="mt-0.5 flex justify-between gap-4">
            <span className="text-fg-muted">
              {r.label} <span className="text-2xs">({r.tag})</span>
            </span>
            <span className={cn('flex items-center gap-1 font-semibold', readingTone[r.status])}>
              {r.lost && <SignalLostIcon size={13} />}
              {r.text}
            </span>
          </div>
        ))}
      </div>
    </Html>
  );
}
