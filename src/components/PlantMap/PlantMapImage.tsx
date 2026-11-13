/** Bản đồ ảnh 2.5D: zoom/pan bằng CSS transform, marker + góc nhìn do trang truyền. */
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { SceneConfig, Vec3 } from '@/features/scene';
import { cn } from '@/lib/cn';
import { useElementSize } from '@/hooks/useElementSize';
import { useFullscreen } from '@/hooks/useFullscreen';
import { ResponsiveImage } from '../ResponsiveImage';
import { MapMarker } from './MapMarker';
import { MapShell } from './MapShell';
import { type PlantMapImageProps } from './types';

const isZero = (v?: Vec3) => !v || v.every((n) => n === 0);

/** Áp kết quả kéo/xoay vào bản nháp; bỏ `rotation` toàn 0 để JSON xuất gọn. */
export function applyTransform(c: SceneConfig, id: string, t: { position: Vec3; rotation: Vec3 }): SceneConfig {
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

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;
const PAN_STEP = 60;

type Transform = { z: number; tx: number; ty: number };

/** Zoom/pan bằng CSS transform. Bàn phím khi focus bản đồ: mũi tên = pan, +/- = zoom, 0 = về toàn cảnh. */
export function PlantMapImage({
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Chỉ chạy khi đổi view hoặc kích thước khung; không phụ thuộc transform hiện tại.
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
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- vùng bản đồ nhận phím +/−/0 nên phải focus được (WCAG 2.1.1) */}
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
            <ResponsiveImage
              image={image}
              alt=""
              priority
              sizes="(min-width: 1280px) 75vw, 100vw"
              draggable={false}
              className="absolute inset-0 h-full w-full opacity-90"
            />
            {markers.map((m) => (
              <MapMarker key={m.id} {...m} zoom={t.z} onClick={onSelect} />
            ))}
          </div>
        )}
      </div>
    </MapShell>
  );
}
