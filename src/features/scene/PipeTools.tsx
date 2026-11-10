import { Html, Line } from '@react-three/drei';
import { isTyping } from '@/lib/isTyping';
import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Raycaster, SphereGeometry, Vector2, Vector3, type Group } from 'three';
import type { ScenePalette } from './colors';
import { EDIT_SNAP, snapTo } from './editConstants';
import { planeHit, type SceneEditState, type ScenePicker } from './EditTools';
import type { ScenePreview } from './geometry';
import { allPorts, orthoSegment, PORT_SNAP_RADIUS, same3, type WorldPort } from './pipes';
import type { Pipe, SceneConfig, Vec3 } from './types';

/*
 * Công cụ ống của chế độ sửa (3D-4): vẽ ống (P), đánh dấu cổng, tay nắm điểm gập của ống đang chọn.
 * Dùng chung pipes.ts (thuần) với Editor; ghi dữ liệu qua callback của SceneEditState (1 lần = 1 bước undo).
 */

/** Cao độ mặt phẳng vẽ mặc định (m) – bằng tâm cổng bơm/van thường gặp. */
export const DEFAULT_PIPE_HEIGHT = 1.2;
/** Bước đổi cao độ bằng PageUp/PageDown (m). */
const HEIGHT_STEP = 0.5;
/** Click (không kéo) nếu chuột đi < 4 px giữa down và up – kéo thì để OrbitControls xoay camera. */
const CLICK_PX = 4;

const DOT = new SphereGeometry(1, 12, 8);

/** Chấm cổng (toạ độ thế giới); cổng đang bắt to hơn, màu primary. */
export function PortMarkers({ ports, active, palette }: { ports: WorldPort[]; active?: string; palette: ScenePalette }) {
  return (
    <>
      {ports.map((p) => {
        const on = p.ref === active;
        return (
          <mesh
            key={p.ref}
            geometry={DOT}
            position={p.at}
            scale={on ? 0.28 : 0.13}
            raycast={() => null}
            renderOrder={5}
            userData={{ noEdges: true, noShadow: true, portRef: p.ref }}
          >
            <meshBasicMaterial
              color={on ? palette.primary : palette.neutral}
              depthTest={false}
              transparent
              opacity={on ? 1 : 0.8}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </>
  );
}

type DrawNode = { at: Vec3; port?: string };

/** Nối các nút vẽ thành đường đi; chế độ vuông góc chèn điểm gập X → Z → Y giữa 2 nút. */
function expand(nodes: readonly DrawNode[], ortho: boolean): Vec3[] {
  const out: Vec3[] = [];
  for (const n of nodes) {
    const prev = out.at(-1);
    if (!prev) out.push(n.at);
    else if (ortho) out.push(...orthoSegment(prev, n.at));
    else if (!same3(prev, n.at)) out.push(n.at);
  }
  return out;
}

/**
 * Vẽ ống (công cụ P):
 * - click (không kéo) = đặt điểm trên mặt phẳng ngang y = `pipeHeight` (snap lưới 0.5 m; giữ Alt = đặt tự do: tắt snap
 *   lưới và bắt cổng);
 *   tia chuột cách tâm cổng ≤ 0.5 m → bắt vào cổng (chấm sáng), điểm = đúng toạ độ cổng;
 * - điểm đầu là cổng → mặt phẳng vẽ lấy cao độ cổng; kết thúc tại cổng → tự hoàn tất;
 * - Enter / double-click = hoàn tất · Esc = huỷ · Backspace = xoá điểm cuối · PageUp/PageDown = cao độ ±0.5 m;
 * - O (ở Editor) = vuông góc: tự chèn điểm gập theo trục.
 * Bắt đầu/kết thúc tại cổng → from/to = "objectId.port"; điểm còn lại → `points`.
 */
export function PipeDrawTool({ edit, config, palette }: { edit: SceneEditState; config: SceneConfig; palette: ScenePalette }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const [nodes, setNodes] = useState<DrawNode[]>([]);
  const [hover, setHover] = useState<DrawNode | null>(null);
  const hiddenKey = (edit.hidden ?? []).join('|');
  const ports = useMemo(
    () => allPorts(config.objects, new Set(edit.hidden)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.objects, hiddenKey],
  );
  const height = edit.pipeHeight ?? DEFAULT_PIPE_HEIGHT;
  const ortho = !!edit.ortho;

  // Listener DOM đọc state mới nhất qua ref.
  const live = useRef({ nodes, height, ortho, ports, edit });
  live.current = { nodes, height, ortho, ports, edit };

  useEffect(() => {
    const el = gl.domElement;
    const rc = new Raycaster();
    const tmp = new Vector3();
    const candidate = (e: { clientX: number; clientY: number; altKey: boolean }): DrawNode | null => {
      const r = el.getBoundingClientRect();
      rc.setFromCamera(new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const { ports, height, edit, nodes } = live.current;
      let best: WorldPort | null = null;
      let bestD = PORT_SNAP_RADIUS;
      // Alt = đặt tự do (không snap lưới, không bắt cổng); không bắt lại cổng của điểm vừa đặt.
      const lastPort = nodes.at(-1)?.port;
      for (const p of e.altKey ? [] : ports) {
        if (p.ref === lastPort) continue;
        const d = rc.ray.distanceToPoint(tmp.set(...p.at));
        if (d <= bestD) [best, bestD] = [p, d];
      }
      if (best) return { at: best.at, port: best.ref };
      const hit = planeHit(rc.ray, height);
      if (!hit) return null;
      const snap = edit.snap !== false && !e.altKey;
      return {
        at: snap ? [snapTo(hit.x, EDIT_SNAP.translate), height, snapTo(hit.z, EDIT_SNAP.translate)] : [+hit.x.toFixed(3), height, +hit.z.toFixed(3)],
      };
    };
    const reset = () => {
      setNodes([]);
      live.current.nodes = [];
    };
    const finish = (list = live.current.nodes) => {
      const { ortho, edit } = live.current;
      reset();
      if (list.length < 2) return;
      const path = expand(list, ortho);
      if (path.length < 2) return;
      const from = list[0]!.port;
      const to = list.at(-1)!.port;
      edit.onCreatePipe?.({ from, to, points: path.slice(from ? 1 : 0, to ? -1 : undefined) });
    };
    const add = (c: DrawNode | null) => {
      if (!c) return;
      const list = live.current.nodes;
      const last = list.at(-1);
      if (last && same3(last.at, c.at)) return;
      if (!list.length && c.port) live.current.edit.onPipeHeight?.(+c.at[1].toFixed(3));
      const next = [...list, c];
      if (c.port && list.length) return finish(next);
      live.current.nodes = next;
      setNodes(next);
    };

    let down: { x: number; y: number } | null = null;
    const onMove = (e: PointerEvent) => {
      setHover(candidate(e));
      invalidate();
    };
    const onDown = (e: PointerEvent) => {
      down = e.button === 0 ? { x: e.clientX, y: e.clientY } : null;
    };
    const onUp = (e: PointerEvent) => {
      if (e.button !== 0 || !down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved < CLICK_PX) add(candidate(e));
    };
    const onDbl = () => finish();
    // Nhãn HTML (drei Html) phủ lên canvas cũng làm canvas nhận pointerleave → chỉ xoá ghost khi rời hẳn khung chứa.
    const onLeave = (e: PointerEvent) => {
      const box = el.parentElement?.parentElement;
      if (!(e.relatedTarget instanceof Node && box?.contains(e.relatedTarget))) setHover(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || document.querySelector('[role="dialog"]')) return;
      const drawing = live.current.nodes.length > 0;
      const stop = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      if (e.key === 'Enter' && drawing) {
        stop();
        finish();
      } else if (e.key === 'Escape' && drawing) {
        stop();
        reset();
      } else if (e.key === 'Backspace' && drawing) {
        stop();
        const next = live.current.nodes.slice(0, -1);
        live.current.nodes = next;
        setNodes(next);
      } else if (e.key === 'PageUp' || e.key === 'PageDown') {
        stop();
        live.current.edit.onPipeHeight?.(+(live.current.height + (e.key === 'PageUp' ? HEIGHT_STEP : -HEIGHT_STEP)).toFixed(3));
      }
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('dblclick', onDbl);
    el.addEventListener('pointerleave', onLeave);
    window.addEventListener('keydown', onKey, true);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('dblclick', onDbl);
      el.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [gl, camera, invalidate]);

  const path = nodes.length ? expand(hover ? [...nodes, hover] : nodes, ortho) : [];
  return (
    <>
      <PortMarkers ports={ports} active={hover?.port} palette={palette} />
      {path.length > 1 && <Line points={path} color={palette.primary} lineWidth={2.5} transparent opacity={0.9} depthTest={false} renderOrder={6} />}
      {path.length > 0 && (
        <group userData={{ drawPoints: path.length }}>
          {path.map((p, i) => (
            <mesh key={i} geometry={DOT} position={p} scale={0.12} raycast={() => null} renderOrder={6}>
              <meshBasicMaterial color={palette.primary} depthTest={false} toneMapped={false} />
            </mesh>
          ))}
        </group>
      )}
      {hover && (
        <>
          <mesh geometry={DOT} position={hover.at} scale={hover.port ? 0.3 : 0.18} raycast={() => null} renderOrder={7}>
            <meshBasicMaterial color={palette.primary} depthTest={false} transparent opacity={0.85} toneMapped={false} />
          </mesh>
          {hover.at[1] > 0.05 && (
            <Line
              points={[hover.at, [hover.at[0], 0.02, hover.at[2]]]}
              color={palette.primary}
              lineWidth={1}
              dashed
              dashSize={0.15}
              gapSize={0.1}
              transparent
              opacity={0.6}
            />
          )}
          <Html position={hover.at} zIndexRange={[16, 0]} pointerEvents="none" style={{ pointerEvents: 'none' }}>
            <span
              data-pipe-cursor
              className="pointer-events-none ml-3 inline-block -translate-y-1/2 whitespace-nowrap rounded-sm bg-surface-raised/85 px-1 py-px text-2xs font-semibold text-fg-secondary"
            >
              {hover.port ? `cổng ${hover.port}` : `y ${hover.at[1].toFixed(2)} m`}
              {ortho ? ' · vuông góc' : ''}
            </span>
          </Html>
        </>
      )}
    </>
  );
}

/** Tay nắm điểm gập (`points`) của ống đang chọn – kéo được (SceneViewer bắt qua picker.handle), click = chọn điểm. */
export function PipeHandles({
  pipe,
  palette,
  active,
}: {
  pipe: Pipe;
  palette: ScenePalette;
  /** Chỉ số điểm đang chọn (Delete xoá). */
  active: number | null;
}) {
  // Canvas render theo yêu cầu: cập nhật ma trận ngay khi điểm đổi để tia chọn (R3F, picker) trúng chấm ở vị trí mới
  // cả khi click trước frame kế tiếp.
  const group = useRef<Group>(null);
  useLayoutEffect(() => group.current?.updateMatrixWorld(true));
  return (
    <group ref={group}>
      {pipe.points.map((p, i) => (
        <mesh
          key={i}
          geometry={DOT}
          position={p}
          scale={i === active ? 0.34 : 0.26}
          renderOrder={8}
          userData={{ noEdges: true, noShadow: true, pipeHandle: { pipe: pipe.id, index: i } }}
          // Chặn click lọt xuống ống bên dưới (click ống đang chọn = thêm điểm).
          onClick={(e) => e.stopPropagation()}
        >
          <meshBasicMaterial color={i === active ? palette.primary : palette.sky} depthTest={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Kéo điểm gập `index` của ống trên mặt phẳng ngang qua chính điểm đó (giữ Y; đổi Y ở Thuộc tính): X/Z snap 0.5 m
 * (Alt = tắt). Xem trước qua `onPreview` (chỉ ống này dựng lại), thả → onUpdatePipe 1 lần (= 1 bước undo); Esc huỷ.
 */
export function startPointDrag({
  picker,
  edit,
  pipe,
  index,
  clientX,
  clientY,
  onPreview,
  onState,
}: {
  picker: ScenePicker;
  edit: SceneEditState;
  pipe: Pipe;
  index: number;
  clientX: number;
  clientY: number;
  onPreview: (p: ScenePreview | null) => void;
  onState?: (dragging: boolean, moved: boolean) => void;
}): boolean {
  const base = pipe.points[index];
  if (!base || !edit.onUpdatePipe) return false;
  const start = picker.plane(clientX, clientY, base[1]);
  if (!start) return false;
  const offset = { x: start.x - base[0], z: start.z - base[2] };
  let moved = false;
  let next: Vec3 = base;
  picker.orbit(false);
  const move = (ev: PointerEvent) => {
    if (!moved && Math.hypot(ev.clientX - clientX, ev.clientY - clientY) < 3) return;
    const hit = picker.plane(ev.clientX, ev.clientY, base[1]);
    if (!hit) return;
    if (!moved) {
      moved = true;
      onState?.(true, false);
    }
    const snap = edit.snap !== false && !ev.altKey;
    const x = hit.x - offset.x;
    const z = hit.z - offset.z;
    next = snap ? [snapTo(x, EDIT_SNAP.translate), base[1], snapTo(z, EDIT_SNAP.translate)] : [+x.toFixed(3), base[1], +z.toFixed(3)];
    onPreview({ pipePoints: { [pipe.id]: pipe.points.map((p, i) => (i === index ? next : p)) } });
    picker.invalidate();
  };
  const finish = (commit: boolean) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('keydown', key, true);
    picker.orbit(true);
    onPreview(null);
    if (commit && moved && !same3(next, base))
      edit.onUpdatePipe!(pipe.id, (p) => ({ ...p, points: p.points.map((q, i) => (i === index ? next : q)) }));
    onState?.(false, moved);
  };
  const up = () => finish(true);
  const key = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    finish(false);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('keydown', key, true);
  return true;
}
