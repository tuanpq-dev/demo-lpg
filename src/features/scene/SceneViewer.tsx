import { Grid, Html, OrbitControls, OrthographicCamera, PerformanceMonitor, TransformControls } from '@react-three/drei';
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
  type ElementRef,
  type ReactNode,
  type Ref,
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
import { inverseToneMap, readScenePalette, type ScenePalette } from './colors';
import { objectReadings, objectStatus } from './fields';
import {
  DEFAULT_PIPE_RADIUS,
  labelAnchor,
  objectBounds,
  resolveScene,
  worldCorners,
  type ResolvedObject,
} from './geometry';
import { LOOK, SCENE_EXPOSURE } from './look';
import { objectMarker } from './markers';
import { PipeMesh } from './PipeMesh';
import { pulse } from './pulse';
import { isWebGLAvailable, QUALITY_PRESETS, SCENE_QUALITIES, type QualityPreset, type SceneQuality } from './quality';
import type { LiveData, ObjectStatus, SceneCamera, SceneConfig, SceneView, Thresholds, Vec3 } from './types';

// Hậu kỳ (postprocessing) ở chunk riêng – chỉ tải khi preset bật.
const PostEffects = lazy(() => import('./PostEffects'));

export type SceneViewerHandle = {
  zoomIn(): void;
  zoomOut(): void;
  /** Bay về khung của view hiện tại. */
  reset(): void;
};

export type ZoomLimits = { canZoomIn: boolean; canZoomOut: boolean };

/** Chế độ sửa (dev): chọn object (cả environment) → TransformControls; thả chuột → onTransform. */
export type SceneEditState = {
  selected: string | null;
  mode: 'translate' | 'rotate';
  /** null = bỏ chọn (Esc ở PlantMap, hoặc click vùng trống). */
  onSelect: (id: string | null) => void;
  onTransform: (id: string, t: { position: Vec3; rotation: Vec3 }) => void;
};

/** Bước snap khi kéo (m) và khi xoay (rad). */
export const EDIT_SNAP = { translate: 0.5, rotate: Math.PI / 12 } as const;

export type SceneViewerProps = {
  config: SceneConfig;
  liveData?: LiveData;
  /** Chế độ xem đang chọn (thuộc `config.views`) → bay camera; undefined → camera mặc định. */
  view?: SceneView;
  onSelect?: (objectId: string) => void;
  onZoomLimits?: (limits: ZoomLimits) => void;
  /** Có → chế độ sửa (click chọn mọi object, kéo/xoay bằng gizmo). */
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
  const scene = useMemo(() => resolveScene(config), [config]);
  const { byId } = scene;
  const thresholds = config.thresholds;
  const [hovered, setHovered] = useState<string | null>(null);
  // Nhãn tự sinh từ object.marker + label + bindings + liveData.
  const labels = scene.objects.flatMap((o) => {
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
    const g = gizmo.current;
    if (g.dragging || performance.now() - g.endedAt < 300) return;
    const d = downAt.current;
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return;
    edit.onSelect(null);
  };
  const statuses = new Map(
    scene.objects.map((o) => [
      o.id,
      ASSETS[o.asset].category === 'equipment' ? objectStatus(o, liveData, thresholds) : ('normal' as ObjectStatus),
    ]),
  );

  const flowOf = (tag?: string) => {
    const v = tag ? liveData?.[tag] : undefined;
    return typeof v === 'number' ? v : undefined;
  };
  // Render liên tục khi có ống đang chảy hoặc object danger (pulse); còn lại render theo yêu cầu.
  const animated =
    config.pipes.some((p) => (flowOf(p.flowTag) ?? 0) > 0) || [...statuses.values()].includes('danger');
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
      className={cn('relative h-full w-full', hovered && 'cursor-pointer', className)}
      data-scene-quality={level}
      onPointerDownCapture={(e) => (downAt.current = { x: e.clientX, y: e.clientY })}
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
            // Dev: số draw call/tam giác mỗi frame cho đo hiệu năng (`__sceneGl.info.render`).
            if (import.meta.env.DEV) Object.assign(window, { __sceneGl: gl });
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
          <CameraRig handleRef={ref} cam={cam} view={view} byId={byId} onZoomLimits={onZoomLimits} />

          <SceneLights palette={palette} preset={preset} />
          <Ground palette={palette} />

          <MaterialsProvider palette={palette}>
            {scene.objects.map((obj) => (
              <ObjectNode
                key={obj.id}
                obj={obj}
                status={statuses.get(obj.id) ?? 'normal'}
                hovered={hovered === obj.id}
                selected={edit?.selected === obj.id}
                palette={palette}
                onHover={setHovered}
                onSelect={edit ? edit.onSelect : onSelect}
                editing={!!edit}
              />
            ))}
          </MaterialsProvider>

          {/* Sau các object: effect chạy khi mesh đã gắn castShadow. */}
          <ShadowUpdates live={!!edit} version={config} level={level} />

          {config.pipes.map((p) => (
            <PipeMesh
              key={p.id}
              curve={scene.curves.get(p.id)!}
              radius={p.radius ?? DEFAULT_PIPE_RADIUS}
              palette={palette}
              flow={flowOf(p.flowTag)}
              bloom={preset.postprocessing}
            />
          ))}

          {labels.map(({ obj, marker }) => {
            const pick = edit ? edit.onSelect : ASSETS[obj.asset].category === 'equipment' ? onSelect : undefined;
            return (
              <Html key={obj.id} position={labelAnchor(obj)} zIndexRange={[20, 0]}>
                <div className="relative">
                  <MapMarker {...marker} translucent onClick={pick ? () => pick(obj.id) : undefined} />
                </div>
              </Html>
            );
          })}

          {edit && <EditGizmo edit={edit} byId={byId} state={gizmo} />}

          {hoveredObj && !markedIds.has(hoveredObj.id) && (
            <ObjectTooltip obj={hoveredObj} liveData={liveData} thresholds={thresholds} />
          )}

          {preset.postprocessing && (
            <Suspense fallback={null}>
              <PostEffects
                preset={preset}
                palette={palette}
                hovered={hovered}
                selected={edit?.selected ?? null}
                shapeKey={config}
                onActive={setComposerOn}
              />
            </Suspense>
          )}
        </Canvas>
      </WebGLErrorBoundary>
      <div aria-hidden className="scene-vignette pointer-events-none absolute inset-0" />
    </div>
  );
});

export default SceneViewer;

// ---------------------------------------------------------------------------
// Renderer, ánh sáng, sàn

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
function Ground({ palette }: { palette: ScenePalette }) {
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
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <shadowMaterial transparent opacity={LOOK.shadowOpacity} color={palette.shade} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.03, 0]} renderOrder={-2}>
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
      <Grid
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
    </>
  );
}

// ---------------------------------------------------------------------------

type Goal = { target: Vector3; zoom: number; offset: Vector3 };

function CameraRig({
  handleRef,
  cam,
  view,
  byId,
  onZoomLimits,
}: {
  handleRef: Ref<SceneViewerHandle>;
  cam: SceneCamera;
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

  /** Khung cho view hiện tại: camera của view, vừa khít `objectIds`, hoặc camera mặc định của cảnh. */
  const viewGoal = useCallback((): Goal => {
    if (view?.camera) {
      const c = view.camera;
      return {
        target: new Vector3(...c.target),
        zoom: clampZoom(c.zoom * (size.width / REF_WIDTH)),
        offset: new Vector3(...c.position).sub(new Vector3(...c.target)),
      };
    }
    const objs = (view?.objectIds ?? []).map((id) => byId.get(id)).filter((o): o is ResolvedObject => !!o);
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
    // viewKey thay cho object view (tham chiếu có thể đổi mỗi render).
  }, [viewKey, byId, cam, homeZoom, homeOffset, clampZoom, size.width, size.height]);

  const reportLimits = useCallback(() => {
    const l = { canZoomIn: camera.zoom < maxZoom * 0.999, canZoomOut: camera.zoom > minZoom * 1.001 };
    const key = `${l.canZoomIn}${l.canZoomOut}`;
    if (key !== lastLimits.current) {
      lastLimits.current = key;
      onZoomLimits?.(l);
    }
  }, [camera, minZoom, maxZoom, onZoomLimits]);

  // Đổi view/kích thước → bay tới khung mới (lần đầu đặt ngay, không bay).
  useEffect(() => {
    const g = viewGoal();
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
  }, [viewGoal, camera, invalidate, reportLimits]);

  useImperativeHandle(
    handleRef,
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
      };
    },
    [camera, clampZoom, invalidate, viewGoal],
  );

  useFrame((_, dt) => {
    const g = goal.current;
    const c = controls.current;
    if (!g || !c) return;
    const k = 1 - Math.exp(-dt * FLY_RATE);
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
  onSelect?: (id: string) => void;
  /** Chế độ sửa: mọi object (kể cả environment) đều chọn được. */
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
    editing || def.category === 'equipment'
      ? {
          onPointerOver: (e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            onHover(() => obj.id);
          },
          onPointerOut: () => onHover((cur) => (cur === obj.id ? null : cur)),
          onClick: (e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            // Bỏ qua click sau khi kéo xoay/pan, và click lên nhãn HTML nằm trên object khác.
            if (e.delta <= 4 && isCanvasEvent(e.nativeEvent)) onSelect?.(obj.id);
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
    // `key` gói min/max.
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
    if (material.current) material.current.opacity = 0.2 + 0.35 * pulse(clock.elapsedTime);
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

/** Làm tròn cho JSON gọn (toFixed tránh nhiễu kiểu 0.5236000000000001). */
const round = (v: number, digits = 3) => +v.toFixed(digits) || 0;

/**
 * Gizmo kéo/xoay object đang chọn (drei TransformControls; OrbitControls tự tắt khi kéo gizmo).
 * Kéo: snap 0.5 m theo trục đang kéo; xoay: chỉ quanh Y, snap 15°. Thả chuột → onTransform.
 * Object gắn ống (`attach`) không kéo được – vị trí theo ống.
 */
function EditGizmo({
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
  const controls = useRef<ElementRef<typeof TransformControls>>(null);
  const obj = edit.selected ? byId.get(edit.selected) : undefined;
  const target = obj && !obj.attach ? scene.getObjectByName(obj.id) : undefined;

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
  }, [target, state]);

  if (!obj || !target) return null;
  const rotate = edit.mode === 'rotate';
  return (
    <TransformControls
      ref={controls}
      object={target}
      mode={edit.mode}
      translationSnap={EDIT_SNAP.translate}
      rotationSnap={EDIT_SNAP.rotate}
      showX={!rotate}
      showZ={!rotate}
      size={0.9}
      onMouseUp={() =>
        edit.onTransform(obj.id, {
          position: target.position.toArray().map((v) => round(v)) as Vec3,
          rotation: [target.rotation.x, target.rotation.y, target.rotation.z].map((v) => round(v, 4)) as Vec3,
        })
      }
    />
  );
}

const readingTone: Record<ObjectStatus, string> = {
  normal: 'text-fg',
  warning: 'text-warning',
  danger: 'text-danger-strong',
  offline: 'text-neutral',
};

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
            <span className={cn('font-semibold', readingTone[r.status])}>{r.text}</span>
          </div>
        ))}
      </div>
    </Html>
  );
}
