/** Điều khiển camera trực giao của SceneViewer: zoom/pan/fit, bay tới góc nhìn / object. Tách từ SceneViewer.tsx. */
import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, type ElementRef, type MutableRefObject } from 'react';
import { Vector3 } from 'three';
import { worldCorners, type ResolvedObject } from './geometry';
import { prefersReducedMotion } from '@/lib/reducedMotion';
import type { SceneCamera, SceneView, Vec3 } from './types';
import type { RigApi, ZoomLimits } from './SceneViewer';

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
type Goal = { target: Vector3; zoom: number; offset: Vector3 };

export function CameraRig({
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- viewKey thay cho object view (tham chiếu có thể đổi mỗi render).
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

  useImperativeHandle(rigRef, () => {
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
  }, [camera, clampZoom, invalidate, viewGoal, fitGoal, byId, size.width]);

  useFrame((_, dt) => {
    const g = goal.current;
    const c = controls.current;
    if (!g || !c) return;
    // Giảm chuyển động → nhảy thẳng tới khung (không bay).
    const k = prefersReducedMotion() ? 1 : 1 - Math.exp(-dt * FLY_RATE);
    const offset = camera.position.clone().sub(c.target).lerp(g.offset, k);
    c.target.lerp(g.target, k);
    camera.zoom += (g.zoom - camera.zoom) * k;
    const done = c.target.distanceTo(g.target) < 0.01 && Math.abs(camera.zoom - g.zoom) < g.zoom * 0.002 && offset.distanceTo(g.offset) < 0.05;
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
