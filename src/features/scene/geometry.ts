import { CatmullRomCurve3, Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { ASSET_SPECS, assetLayout, findPort, objectElevation, type Box } from './assets/specs';
import { DEFAULT_PIPE_RADIUS } from './pipes';
import type { Pipe, SceneConfig, SceneObject, Vec3 } from './types';

export { DEFAULT_PIPE_RADIUS } from './pipes';

/** Object đã đặt vị trí (kể cả object gắn ống); position[1] = độ cao đáy (elevation). */
export type ResolvedObject = SceneObject & { position: Vec3; rotation: Vec3 };

export type ResolvedScene = {
  objects: ResolvedObject[];
  byId: Map<string, ResolvedObject>;
  /** Đường cong tâm ống theo id – dùng chung cho TubeGeometry và object gắn ống. */
  curves: Map<string, CatmullRomCurve3>;
};

function objectMatrix(obj: ResolvedObject): Matrix4 {
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
  const port = obj && findPort(obj, ref.slice(dot + 1));
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
  // Bỏ điểm trùng liên tiếp (đoạn dài 0 làm hướng góc bo = NaN) – Editor vẫn báo lỗi để người dùng sửa.
  return pts.filter((p, i) => i === 0 || p.distanceTo(pts[i - 1]!) > 1e-4);
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
function pipeCurve(path: Vector3[], radius: number) {
  return new CatmullRomCurve3(sharpenCorners(path, radius * 2.5), false, 'catmullrom', 0.1);
}

/**
 * Đặt vị trí mọi object: object thường theo `position` X/Z + `elevation` (đáy); ống nối theo cổng (toạ độ thế giới,
 * gồm elevation); object `attach` có trục ống trùng tâm ống tại tỉ lệ chiều dài `t`, trục X theo tiếp tuyến (chỉ xoay quanh Y).
 */
/**
 * Cache đường cong theo id ống: chỉ dựng lại khi đường đi (điểm + cổng đã giải) hoặc bán kính đổi → PipeMesh nhận
 * cùng đối tượng curve, không tính lại TubeGeometry cho ống không đổi (kéo object/điểm chỉ dựng lại ống liên quan).
 */
export type CurveCache = Map<string, { key: string; curve: CatmullRomCurve3 }>;

/**
 * Bản xem trước khi đang kéo (chưa commit): vị trí object, t của object gắn ống, điểm của ống.
 * SceneViewer áp lên config trước `resolveScene` → ống nối/object gắn ống đi theo ngay trong lúc kéo.
 */
export type ScenePreview = {
  positions?: Record<string, Vec3>;
  attachT?: Record<string, number>;
  pipePoints?: Record<string, Vec3[]>;
};

export function applyPreview(config: SceneConfig, preview: ScenePreview | null): SceneConfig {
  if (!preview) return config;
  const { positions = {}, attachT = {}, pipePoints = {} } = preview;
  return {
    ...config,
    objects: config.objects.map((o) =>
      positions[o.id]
        ? { ...o, position: positions[o.id] }
        : attachT[o.id] !== undefined && o.attach
          ? { ...o, attach: { ...o.attach, t: attachT[o.id]! } }
          : o,
    ),
    pipes: config.pipes.map((p) => (pipePoints[p.id] ? { ...p, points: pipePoints[p.id]! } : p)),
  };
}

/** Object đặt trên sàn: độ cao lấy từ elevation (position[1] luôn bằng nó sau migrate) → đáy đúng mặt sàn khi elevation = 0. */
function placeOnGround(o: SceneObject): ResolvedObject {
  const [x, , z] = o.position ?? [0, 0, 0];
  return { ...o, position: [x, objectElevation(o), z], rotation: o.rotation ?? [0, 0, 0] };
}

/** Đường cong ống, dùng lại từ cache nếu đường đi + bán kính không đổi (tránh dựng lại TubeGeometry). */
function curveOf(p: Pipe, byId: Map<string, ResolvedObject>, cache?: CurveCache): CatmullRomCurve3 {
  const path = pipePath(p, byId);
  const radius = p.radius ?? DEFAULT_PIPE_RADIUS;
  const key = `${radius}|${path.map((v) => `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`).join(';')}`;
  const hit = cache?.get(p.id);
  const curve = hit && hit.key === key ? hit.curve : pipeCurve(path, radius);
  cache?.set(p.id, { key, curve });
  return curve;
}

/** Object gắn ống: vị trí theo t trên đường cong, xoay theo tiếp tuyến; gốc asset ở tâm đáy → hạ để trục khớp tâm ống. */
function placeOnPipe(o: SceneObject & { attach: NonNullable<SceneObject['attach']> }, curve: CatmullRomCurve3 | undefined): ResolvedObject {
  const t = Math.min(1, Math.max(0, o.attach.t));
  const pos = curve?.getPointAt(t) ?? new Vector3();
  const tan = curve?.getTangentAt(t) ?? new Vector3(1, 0, 0);
  pos.y -= ASSET_SPECS[o.asset].inline?.axisY ?? 0;
  return { ...o, position: pos.toArray(), rotation: [0, Math.atan2(-tan.z, tan.x), 0] };
}

export function resolveScene(config: SceneConfig, cache?: CurveCache): ResolvedScene {
  const byId = new Map<string, ResolvedObject>();
  for (const o of config.objects) if (!o.attach) byId.set(o.id, placeOnGround(o));
  const curves = new Map<string, CatmullRomCurve3>();
  for (const p of config.pipes) curves.set(p.id, curveOf(p, byId, cache));
  if (cache) for (const id of [...cache.keys()]) if (!curves.has(id)) cache.delete(id);
  for (const o of config.objects) if (o.attach) byId.set(o.id, placeOnPipe({ ...o, attach: o.attach }, curves.get(o.attach.pipe)));
  return { objects: config.objects.map((o) => byId.get(o.id)!), byId, curves };
}
