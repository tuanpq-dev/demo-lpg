import { Suspense, lazy, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { SceneConfig, SceneEditState, SceneView, SceneViewerHandle, ZoomLimits } from '@/features/scene';
import { useFullscreen } from '@/lib/useFullscreen';
import { Button } from '../Button';
import { SegmentedControl } from '../SegmentedControl';
import { MapShell } from './MapShell';
import { PlantMapImage, applyTransform } from './PlantMapImage';
import { type PlantMapProps, type PlantMapThreeProps } from './types';

// three + drei (~700KB) chỉ tải khi dùng renderer 3D.
// `/* @__PURE__ */`: lời gọi lazy() ở top-level bị Rollup coi là side effect → cả module bị giữ trong chunk chính qua barrel.
const SceneViewer = /* @__PURE__ */ lazy(() => import('@/features/scene/SceneViewer'));

/**
 * Bản đồ nhà máy (Figma 53:242): SegmentedControl (trái trên) + zoom/fullscreen (phải trên) + nhãn. Component thuần.
 * - renderer="image" (mặc định): ảnh 2.5D, zoom/pan bằng CSS transform, marker + view do trang truyền.
 * - renderer="three": SceneViewer 3D (lazy) dựng từ `scene`; view (`scene.views`) và nhãn (object.marker) lấy từ cảnh.
 */
export function PlantMap(props: PlantMapProps) {
  return props.renderer === 'three' ? <PlantMapThree {...props} /> : <PlantMapImage {...props} />;
}

const EDIT_TOOLS = [
  { id: 'translate', label: 'Di chuyển' },
  { id: 'rotate', label: 'Xoay' },
] as const;

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
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Vùng bản đồ nhận phím +/−/0 nên phải focus được (WCAG 2.1.1); region có tên + hướng dẫn trong hint. */}
      <div
        role="region"
        aria-label={alt}
        aria-describedby={hintId}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative h-full w-full overflow-hidden bg-bg-canvas focus-visible:outline-offset-[-2px]"
      >
        <span id={hintId} className="sr-only">
          Kéo để xoay, chuột phải để di chuyển, cuộn để phóng to. Phím cộng/trừ để phóng to/thu nhỏ, phím 0 để về khung của chế độ xem.
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
            className="flex items-center gap-2 rounded-lg border border-accent/50 bg-surface-raised/90 p-[5px] pl-3 text-sm shadow-card backdrop-blur-sm"
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
            <Button variant="primary" size="sm" onClick={() => void copyJson()}>
              {copyState === 'done' ? 'Đã copy' : copyState === 'failed' ? 'Không copy được' : 'Copy JSON'}
            </Button>
          </div>
        </div>
      )}
    </MapShell>
  );
}
