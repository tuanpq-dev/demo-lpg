import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import type {
  LiveData,
  SceneConfig,
  SceneEditState,
  SceneQuality,
  SceneView,
  SceneViewerHandle,
  Vec3,
  ZoomLimits,
} from '@/features/scene';
import { cn } from '@/lib/cn';
import { useElementSize } from '@/lib/useElementSize';
import { useFullscreen } from '@/lib/useFullscreen';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { SegmentedControl } from '../SegmentedControl';
import { MapMarker, type MapMarkerData } from './MapMarker';

// three + drei (~700KB) chỉ tải khi dùng renderer 3D.
const SceneViewer = lazy(() => import('@/features/scene/SceneViewer'));

/** Chế độ xem của renderer ảnh: điểm cần căn giữa (phân số của ảnh) và mức zoom; bỏ trống = toàn cảnh. */
export type MapView = {
  id: string;
  label: string;
  focus?: { x: number; y: number; zoom: number };
};

type CommonProps = {
  alt: string;
  /** Ảnh: id marker · 3D: id object (click object hoặc nhãn của nó). */
  onSelect?: (id: string) => void;
  /** Có → hiện nút chuyển 2.5D/3D nhỏ ở góc dưới trái; trang tự đổi renderer (vd. qua `?map=3d`). */
  onRendererChange?: (renderer: PlantMapRenderer) => void;
  /** Chiều cao khung (px). Figma 591 (gồm viền). */
  height?: number;
  /** Thông báo nhỏ ở góc dưới trái (vd. "3D không khả dụng – đang hiện 2.5D"). */
  notice?: ReactNode;
  className?: string;
};

export type PlantMapRenderer = 'image' | 'three';

const RENDERER_OPTIONS = [
  { id: 'image', label: '2.5D' },
  { id: 'three', label: '3D' },
] as const;

export type PlantMapImageProps = CommonProps & {
  renderer?: 'image';
  image: string;
  /** Marker đặt theo toạ độ % trên ảnh. */
  markers: readonly MapMarkerData[];
  views: readonly MapView[];
  view: string;
  onViewChange: (id: string) => void;
  /** Tỉ lệ rộng/cao của ảnh gốc (mặc định 2730/1536). */
  imageAspect?: number;
  /**
   * Khung ảnh như Figma 53:244: ảnh rộng 112.3% khung, căn giữa ngang,
   * tâm dọc ở 45% chiều cao ảnh.
   */
  framing?: { widthScale: number; centerY: number };
};

export type PlantMapThreeProps = CommonProps & {
  renderer: 'three';
  /** Cảnh đã nạp + validate (trang dùng `useSceneConfig` hoặc `ConnectedPlantMap`). Views + nhãn lấy từ cảnh. */
  scene: SceneConfig;
  /** Số liệu theo tag – nhãn/màu cập nhật theo `bindings` của object. */
  liveData?: LiveData;
  /** Chế độ sửa (dev, vd `?edit=1`): click chọn → kéo/xoay (snap 0.5 m / 15°), nút "Copy JSON". Chưa lưu. */
  editable?: boolean;
  /** Preset chất lượng 3D; mặc định 'auto' (PerformanceMonitor). Trang có thể ghi đè (vd. `?quality=low`). */
  quality?: SceneQuality | 'auto';
  /**
   * WebGL không khả dụng/lỗi → gọi kèm lý do; trang chuyển sang ảnh 2.5D (+ `notice`).
   * Không truyền → hiện thông báo ngay trong khung bản đồ.
   */
  onFallback?: (reason: string) => void;
  /**
   * Id object cần nhắm khi mở (vd `?focus=V-101` ở Tổng quan): thêm chế độ xem "<nhãn object>" (bay vừa khít object)
   * và chọn sẵn. Id không có trong cảnh → bỏ qua.
   */
  focus?: string;
};

export type PlantMapProps = PlantMapImageProps | PlantMapThreeProps;

/**
 * Bản đồ nhà máy (Figma 53:242): SegmentedControl (trái trên) + zoom/fullscreen (phải trên) + nhãn. Component thuần.
 * - renderer="image" (mặc định): ảnh 2.5D, zoom/pan bằng CSS transform, marker + view do trang truyền.
 * - renderer="three": SceneViewer 3D (lazy) dựng từ `scene`; view (`scene.views`) và nhãn (object.marker) lấy từ cảnh.
 */
export function PlantMap(props: PlantMapProps) {
  return props.renderer === 'three' ? <PlantMapThree {...props} /> : <PlantMapImage {...props} />;
}

// ---------------------------------------------------------------------------
// Khung + điều khiển dùng chung


type MapShellProps = Pick<CommonProps, 'onRendererChange' | 'height' | 'notice' | 'className'> & {
  views: readonly { id: string; label: string }[];
  view: string;
  onViewChange: (id: string) => void;
  renderer: PlantMapRenderer;
  rootRef: RefObject<HTMLDivElement>;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
  children: ReactNode;
};

function MapShell({
  rootRef,
  isFullscreen,
  onToggleFullscreen,
  onZoomIn,
  onZoomOut,
  canZoomIn,
  canZoomOut,
  views,
  view,
  onViewChange,
  renderer,
  onRendererChange,
  height = 589,
  notice,
  className,
  children,
}: MapShellProps) {
  return (
    <div
      ref={rootRef}
      className={cn(
        'relative overflow-clip rounded-xl border border-line/30 bg-surface p-px shadow-card',
        isFullscreen && 'rounded-none',
        className,
      )}
      style={{ height: isFullscreen ? '100vh' : height + 2 }}
    >
      {children}

      {/* Controls – Figma 53:301 (cách mép 16px). z-30: nằm trên nhãn 3D (zIndexRange 0–21). */}
      <div className="pointer-events-none absolute inset-x-[17px] top-[17px] z-30 flex items-start justify-between gap-3">
        <SegmentedControl
          label="Chế độ xem bản đồ"
          options={views}
          value={view}
          onChange={onViewChange}
          className="pointer-events-auto"
        />
        <div className="pointer-events-auto flex gap-2">
          <Button
            variant="overlay"
            aria-label="Phóng to"
            disabled={!canZoomIn}
            onClick={onZoomIn}
            icon={<Icon name="mapZoomIn" box={16} />}
          />
          <Button
            variant="overlay"
            aria-label="Thu nhỏ"
            disabled={!canZoomOut}
            onClick={onZoomOut}
            icon={<Icon name="mapZoomOut" box={16} />}
          />
          <Button
            variant="overlay"
            aria-label={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
            pressed={isFullscreen}
            onClick={onToggleFullscreen}
            icon={<Icon name="mapFullscreen" box={16} />}
          />
        </div>
      </div>

      {(onRendererChange || notice) && (
        <div className="absolute bottom-[17px] left-[17px] z-30 flex items-center gap-2">
          {onRendererChange && (
            <SegmentedControl
              label="Kiểu bản đồ"
              size="sm"
              options={RENDERER_OPTIONS}
              value={renderer}
              onChange={(id) => onRendererChange(id as PlantMapRenderer)}
            />
          )}
          {notice && (
            <p role="status" className="rounded-sm bg-surface-raised/85 px-2 py-1 text-xs text-fg-muted backdrop-blur-[3px]">
              {notice}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Renderer 3D

const EDIT_TOOLS = [
  { id: 'translate', label: 'Di chuyển' },
  { id: 'rotate', label: 'Xoay' },
] as const;

const isZero = (v?: Vec3) => !v || v.every((n) => n === 0);

/** Áp kết quả kéo/xoay vào bản nháp; bỏ `rotation` toàn 0 để JSON xuất gọn. */
function applyTransform(c: SceneConfig, id: string, t: { position: Vec3; rotation: Vec3 }): SceneConfig {
  return {
    ...c,
    objects: c.objects.map((o) => {
      if (o.id !== id) return o;
      const { rotation: _old, ...rest } = o;
      void _old;
      return isZero(t.rotation) ? { ...rest, position: t.position } : { ...rest, position: t.position, rotation: t.rotation };
    }),
  };
}

const ALL_VIEW: SceneView[] = [{ id: 'all', label: 'Toàn cảnh' }];

/** Chế độ xem của cảnh + view "nhắm object" (prop `focus`) ở cuối. */
function viewsWithFocus(scene: SceneConfig, focus?: string): { views: SceneView[]; focusView?: SceneView } {
  const base = scene.views?.length ? scene.views : ALL_VIEW;
  const obj = focus ? scene.objects.find((o) => o.id === focus) : undefined;
  if (!obj) return { views: base };
  const focusView: SceneView = { id: `focus:${obj.id}`, label: obj.label ?? obj.id, objectIds: [obj.id] };
  return { views: [...base, focusView], focusView };
}

function PlantMapThree({
  scene,
  liveData,
  editable,
  quality,
  onFallback,
  focus,
  alt,
  onSelect,
  onRendererChange,
  height,
  notice,
  className,
}: PlantMapThreeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const viewer = useRef<SceneViewerHandle>(null);
  const hintId = useId();
  const { isFullscreen, toggle } = useFullscreen(rootRef);
  const [limits, setLimits] = useState<ZoomLimits>({ canZoomIn: true, canZoomOut: true });

  // ----- Chế độ xem (từ scene.views), quản lý nội bộ -----
  const { views, focusView } = viewsWithFocus(scene, focus);
  const [viewId, setViewId] = useState((focusView ?? views[0]!).id);

  // ----- Chế độ sửa: bản nháp + object đang chọn + công cụ -----
  const [draft, setDraft] = useState<SceneConfig>(scene);
  const [selected, setSelected] = useState<string | null>(null);
  const [tool, setTool] = useState<SceneEditState['mode']>('translate');
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'failed'>('idle');
  // Đổi cảnh → về view đầu, bản nháp mới, bỏ chọn.
  useEffect(() => {
    setDraft(scene);
    setSelected(null);
    const v = viewsWithFocus(scene, focus);
    setViewId((v.focusView ?? v.views[0]!).id);
  }, [scene, focus]);
  useEffect(() => {
    if (!editable) return;
    const onEsc = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setSelected(null);
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [editable]);

  const config = editable ? draft : scene;
  const view = focusView && viewId === focusView.id ? focusView : config.views?.find((v) => v.id === viewId);
  const selectedObj = selected ? config.objects.find((o) => o.id === selected) : undefined;
  const edit: SceneEditState | undefined = editable
    ? {
        // Chế độ sửa nhanh của PlantMap: chọn một object (Editor đầy đủ ở /editor).
        selected: selected ? [selected] : [],
        mode: tool,
        onSelect: (ids) => setSelected(ids[0] ?? null),
        onTransform: (changes) => setDraft((d) => changes.reduce((acc, c) => applyTransform(acc, c.id, c), d)),
      }
    : undefined;

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
      setCopyState('done');
    } catch {
      setCopyState('failed');
    }
    window.setTimeout(() => setCopyState('idle'), 2000);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === '+' || e.key === '=') viewer.current?.zoomIn();
    else if (e.key === '-') viewer.current?.zoomOut();
    else if (e.key === '0') viewer.current?.reset();
    else return;
    e.preventDefault();
  };

  const loading = <div className="grid h-full place-items-center text-base text-fg-muted">Đang tải cảnh 3D…</div>;

  return (
    <MapShell
      rootRef={rootRef}
      isFullscreen={isFullscreen}
      onToggleFullscreen={toggle}
      onZoomIn={() => viewer.current?.zoomIn()}
      onZoomOut={() => viewer.current?.zoomOut()}
      canZoomIn={limits.canZoomIn}
      canZoomOut={limits.canZoomOut}
      views={views}
      view={viewId}
      onViewChange={setViewId}
      renderer="three"
      onRendererChange={onRendererChange}
      height={height}
      notice={notice}
      className={className}
    >
      {/* Vùng bản đồ nhận phím +/−/0 nên phải focus được (WCAG 2.1.1); region có tên + hướng dẫn trong hint. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        role="region"
        aria-label={alt}
        aria-describedby={hintId}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative h-full w-full overflow-hidden bg-bg-canvas focus-visible:outline-offset-[-2px]"
      >
        <span id={hintId} className="sr-only">
          Kéo để xoay, chuột phải để di chuyển, cuộn để phóng to. Phím cộng/trừ để phóng to/thu nhỏ, phím 0 để về khung
          của chế độ xem.
        </span>
        <Suspense fallback={loading}>
          <SceneViewer
            ref={viewer}
            config={config}
            liveData={liveData}
            view={view}
            onSelect={onSelect}
            onZoomLimits={setLimits}
            edit={edit}
            quality={quality}
            onWebGLError={onFallback}
          />
        </Suspense>
      </div>

      {editable && (
        <div className="absolute bottom-[17px] right-[17px] z-30 flex flex-col items-end gap-1.5">
          <p className="rounded-sm bg-surface-raised/80 px-2 py-0.5 text-xs text-fg-muted">
            Click chọn · kéo gizmo · Esc hoặc click vùng trống để bỏ chọn
          </p>
          <div
            role="toolbar"
            aria-label="Chế độ sửa cảnh"
            className="flex items-center gap-2 rounded-lg border border-accent/50 bg-surface-raised/90 p-[5px] pl-3 text-sm shadow-card backdrop-blur-[4px]"
          >
            <span className="text-fg-muted">
              Sửa: <output className="font-mono text-fg">{selected ?? 'bấm chọn object'}</output>
              {selectedObj?.attach && ` · gắn ống ${selectedObj.attach.pipe}, không kéo được`}
            </span>
            <SegmentedControl
              label="Công cụ sửa"
              size="sm"
              options={EDIT_TOOLS}
              value={tool}
              onChange={(id) => setTool(id as SceneEditState['mode'])}
            />
            <Button variant="primary" size="sm" onClick={copyJson}>
              {copyState === 'done' ? 'Đã copy' : copyState === 'failed' ? 'Không copy được' : 'Copy JSON'}
            </Button>
          </div>
        </div>
      )}
    </MapShell>
  );
}

// ---------------------------------------------------------------------------
// Renderer ảnh 2.5D

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;
const PAN_STEP = 60;

type Transform = { z: number; tx: number; ty: number };

/** Zoom/pan bằng CSS transform. Bàn phím khi focus bản đồ: mũi tên = pan, +/- = zoom, 0 = về toàn cảnh. */
function PlantMapImage({
  image,
  imageAspect = 2730 / 1536,
  alt,
  markers,
  views,
  view,
  onViewChange,
  onSelect,
  onRendererChange,
  height,
  notice,
  framing = { widthScale: 1287 / 1146, centerY: 0.45 },
  className,
}: PlantMapImageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const { width: cw, height: ch } = useElementSize(viewportRef);
  const hintId = useId();
  const { isFullscreen, toggle } = useFullscreen(rootRef);
  const [t, setT] = useState<Transform>({ z: 1, tx: 0, ty: 0 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  // Khung cơ sở (zoom = 1): ảnh giữ đúng tỉ lệ, rộng widthScale × khung.
  const W = cw * framing.widthScale;
  const H = W / imageAspect;
  const baseLeft = (cw - W) / 2;
  const baseTop = ch / 2 - framing.centerY * H;

  const clamp = useCallback(
    ({ z, tx, ty }: Transform): Transform => {
      // Ảnh (đã zoom) phải luôn phủ kín khung theo chiều nào đủ lớn.
      const sw = W * z;
      const sh = H * z;
      const cx = (lo: number, hi: number, v: number) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
      return {
        z,
        tx: cx(cw - sw - baseLeft, -baseLeft, tx),
        ty: cx(ch - sh - baseTop, -baseTop, ty),
      };
    },
    [W, H, cw, ch, baseLeft, baseTop],
  );

  /** Zoom quanh tâm khung. */
  const zoomTo = useCallback(
    (nextZ: number) =>
      setT((cur) => {
        const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZ));
        const k = z / cur.z;
        const px = cw / 2 - baseLeft;
        const py = ch / 2 - baseTop;
        return clamp({ z, tx: px - (px - cur.tx) * k, ty: py - (py - cur.ty) * k });
      }),
    [clamp, cw, ch, baseLeft, baseTop],
  );

  // Đổi view → căn giữa điểm focus.
  useEffect(() => {
    if (!cw) return;
    const f = views.find((v) => v.id === view)?.focus;
    if (!f) {
      setT({ z: 1, tx: 0, ty: 0 });
      return;
    }
    setT(clamp({ z: f.zoom, tx: cw / 2 - baseLeft - f.zoom * f.x * W, ty: ch / 2 - baseTop - f.zoom * f.y * H }));
    // Chỉ chạy khi đổi view hoặc kích thước khung; không phụ thuộc transform hiện tại.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, cw, ch]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    drag.current = { x: e.clientX, y: e.clientY, tx: t.tx, ty: t.ty };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    setT((cur) => clamp({ ...cur, tx: d.tx + e.clientX - d.x, ty: d.ty + e.clientY - d.y }));
  };
  const onPointerUp = () => {
    drag.current = null;
    setDragging(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const pan = (dx: number, dy: number) => setT((cur) => clamp({ ...cur, tx: cur.tx + dx, ty: cur.ty + dy }));
    switch (e.key) {
      case 'ArrowLeft':
        pan(PAN_STEP, 0);
        break;
      case 'ArrowRight':
        pan(-PAN_STEP, 0);
        break;
      case 'ArrowUp':
        pan(0, PAN_STEP);
        break;
      case 'ArrowDown':
        pan(0, -PAN_STEP);
        break;
      case '+':
      case '=':
        zoomTo(t.z + ZOOM_STEP);
        break;
      case '-':
        zoomTo(t.z - ZOOM_STEP);
        break;
      case '0':
        setT({ z: 1, tx: 0, ty: 0 });
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  return (
    <MapShell
      rootRef={rootRef}
      isFullscreen={isFullscreen}
      onToggleFullscreen={toggle}
      onZoomIn={() => zoomTo(t.z + ZOOM_STEP)}
      onZoomOut={() => zoomTo(t.z - ZOOM_STEP)}
      canZoomIn={t.z < MAX_ZOOM}
      canZoomOut={t.z > MIN_ZOOM}
      views={views}
      view={view}
      onViewChange={onViewChange}
      renderer="image"
      onRendererChange={onRendererChange}
      height={height}
      notice={notice}
      className={className}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={viewportRef}
        role="region"
        aria-label={alt}
        aria-describedby={hintId}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className={cn(
          'relative h-full w-full touch-none select-none overflow-hidden bg-bg-canvas',
          t.z > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
          'focus-visible:outline-offset-[-2px]',
        )}
      >
        <span id={hintId} className="sr-only">
          Mũi tên để di chuyển, dấu cộng/trừ để phóng to/thu nhỏ, phím 0 để về toàn cảnh.
        </span>
        {cw > 0 && (
          <div
            className="absolute left-0 top-0 transition-transform duration-300 ease-out will-change-transform"
            style={{
              width: W,
              height: H,
              transform: `translate(${baseLeft + t.tx}px, ${baseTop + t.ty}px) scale(${t.z})`,
              transformOrigin: '0 0',
              transitionDuration: dragging ? '0ms' : undefined,
            }}
          >
            <img src={image} alt="" draggable={false} className="absolute inset-0 h-full w-full opacity-90" />
            {markers.map((m) => (
              <MapMarker key={m.id} {...m} zoom={t.z} onClick={onSelect} />
            ))}
          </div>
        )}
      </div>
    </MapShell>
  );
}
