import { CatmullRomCurve3, Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { assetLayout, type Box } from './assets/specs';
import type { Pipe, SceneConfig, SceneObject, Vec3 } from './types';

export const DEFAULT_PIPE_RADIUS = 0.18;
export { FLOOR_HALF_SIZE } from './editConstants';

/** Object đã đặt vị trí (kể cả object gắn ống). */
export type ResolvedObject = SceneObject & { position: Vec3; rotation: Vec3 };

export type ResolvedScene = {
  objects: ResolvedObject[];
  byId: Map<string, ResolvedObject>;
  /** Đường cong tâm ống theo id – dùng chung cho TubeGeometry và object gắn ống. */
  curves: Map<string, CatmullRomCurve3>;
};

export function objectMatrix(obj: ResolvedObject): Matrix4 {
  const q = new Quaternion().setFromEuler(new Euler(...obj.rotation));
  return new Matrix4().compose(new Vector3(...obj.position), q, new Vector3(...(obj.scale ?? [1, 1, 1])));
}

/** Hộp bao cục bộ theo tham số (asset theo đoạn → tính từ `path`). */
export function objectBounds(obj: SceneObject): Box {
  return assetLayout(obj).bounds;
}

export function labelAnchor(obj: ResolvedObject): Vector3 {
  const { bounds, labelAnchor: anchor } = assetLayout(obj);
  const { min, max } = bounds;
  const local = anchor ?? [(min[0] + max[0]) / 2, max[1] + 0.3, (min[2] + max[2]) / 2];
  return new Vector3(...local).applyMatrix4(objectMatrix(obj));
}

/** 8 góc hộp bao trong toạ độ thế giới. */
export function worldCorners(obj: ResolvedObject): Vector3[] {
  const { min, max } = objectBounds(obj);
  const m = objectMatrix(obj);
  const out: Vector3[] = [];
  for (const x of [min[0], max[0]])
    for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) out.push(new Vector3(x, y, z).applyMatrix4(m));
  return out;
}

/** "objectId.port" → toạ độ thế giới. */
function resolvePort(ref: string | undefined, byId: Map<string, ResolvedObject>): Vector3 | undefined {
  if (!ref) return undefined;
  const dot = ref.lastIndexOf('.');
  const obj = byId.get(ref.slice(0, dot));
  const port = obj && assetLayout(obj).ports[ref.slice(dot + 1)];
  if (!obj || !port) {
    if (import.meta.env.DEV) console.warn(`[scene] Không tìm thấy cổng "${ref}"`);
    return undefined;
  }
  return new Vector3(...port).applyMatrix4(objectMatrix(obj));
}

/** Đường đi đầy đủ của ống: cổng from + points + cổng to. */
function pipePath(pipe: Pipe, byId: Map<string, ResolvedObject>): Vector3[] {
  const pts = pipe.points.map((p) => new Vector3(...p));
  const a = resolvePort(pipe.from, byId);
  const b = resolvePort(pipe.to, byId);
  if (a) pts.unshift(a);
  if (b) pts.push(b);
  return pts;
}

/**
 * Chèn 2 điểm sát mỗi góc (cách góc `bend`) để Catmull-Rom chỉ bo một cung nhỏ → ống giữ dáng góc vuông.
 */
function sharpenCorners(points: Vector3[], bend: number): Vector3[] {
  if (points.length < 3) return points;
  const out = [points[0]!];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!;
    const p = points[i]!;
    const next = points[i + 1]!;
    const dIn = p.clone().sub(prev);
    const dOut = next.clone().sub(p);
    const b = Math.min(bend, dIn.length() / 2, dOut.length() / 2);
    out.push(p.clone().addScaledVector(dIn.normalize(), -b), p, p.clone().addScaledVector(dOut.normalize(), b));
  }
  out.push(points[points.length - 1]!);
  return out;
}

/** Catmull-Rom tension thấp + góc bo 2.5×bán kính. */
export function pipeCurve(path: Vector3[], radius: number) {
  return new CatmullRomCurve3(sharpenCorners(path, radius * 2.5), false, 'catmullrom', 0.1);
}

/**
 * Đặt vị trí mọi object: object thường theo `position`; ống nối theo cổng; object `attach`
 * nằm trên tâm ống tại tỉ lệ chiều dài `t`, trục X cục bộ theo tiếp tuyến (chỉ xoay quanh Y).
 */
export function resolveScene(config: SceneConfig): ResolvedScene {
  const byId = new Map<string, ResolvedObject>();
  for (const o of config.objects) {
    if (!o.attach) byId.set(o.id, { ...o, position: o.position ?? [0, 0, 0], rotation: o.rotation ?? [0, 0, 0] });
  }
  const curves = new Map<string, CatmullRomCurve3>();
  for (const p of config.pipes) curves.set(p.id, pipeCurve(pipePath(p, byId), p.radius ?? DEFAULT_PIPE_RADIUS));

  for (const o of config.objects) {
    if (!o.attach) continue;
    const curve = curves.get(o.attach.pipe);
    const t = Math.min(1, Math.max(0, o.attach.t));
    const pos = curve?.getPointAt(t) ?? new Vector3();
    const tan = curve?.getTangentAt(t) ?? new Vector3(1, 0, 0);
    byId.set(o.id, { ...o, position: pos.toArray(), rotation: [0, Math.atan2(-tan.z, tan.x), 0] });
  }
  return { objects: config.objects.map((o) => byId.get(o.id)!), byId, curves };
}
