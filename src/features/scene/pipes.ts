import { ASSET_SPECS, assetLayout, findPort, objectElevation, resolvePortName } from './assets/specs';
import type { Pipe, SceneConfig, SceneObject, Vec3 } from './types';

/*
 * Hình học ống THUẦN (không three/React) – dùng chung cho Editor (vẽ/sửa ống, ops, validate) và Viewer.
 * Cổng ống trong dữ liệu: "objectId.port" (dấu chấm cuối cùng tách id và tên cổng; id object không chứa dấu chấm).
 * Object gắn ống (`attach`) không có toạ độ thuần (phụ thuộc đường cong) → không làm đầu nối ống.
 */

export const DEFAULT_PIPE_RADIUS = 0.18;
/** Khoảng cách coi như trùng điểm (m). */
export const POINT_EPS = 1e-3;
/** Bán kính bắt cổng khi vẽ/kéo (m, đo từ tia chuột tới tâm cổng). */
export const PORT_SNAP_RADIUS = 0.5;

export type PortRef = { objectId: string; port: string };

export function parsePortRef(ref: string | undefined): PortRef | null {
  if (!ref) return null;
  const dot = ref.lastIndexOf('.');
  return dot > 0 ? { objectId: ref.slice(0, dot), port: ref.slice(dot + 1) } : null;
}

export const portRef = (objectId: string, port: string) => `${objectId}.${port}`;

/** Ma trận Euler XYZ (giống three) áp lên vector. */
function rotate([x, y, z]: Vec3, [rx, ry, rz]: Vec3): Vec3 {
  const [a, b, c, d, e, f] = [Math.cos(rx), Math.sin(rx), Math.cos(ry), Math.sin(ry), Math.cos(rz), Math.sin(rz)];
  const [ae, af, be, bf] = [a * e, a * f, b * e, b * f];
  return [c * e * x - c * f * y + d * z, (af + be * d) * x + (ae - bf * d) * y - b * c * z, (bf - ae * d) * x + (be + af * d) * y + a * c * z];
}

/** Điểm cục bộ → thế giới của object đặt tự do (position X/Z + elevation, rotation, scale). */
export function localToWorld(o: SceneObject, p: Vec3): Vec3 {
  const s = o.scale ?? [1, 1, 1];
  const r = rotate([p[0] * s[0], p[1] * s[1], p[2] * s[2]], o.rotation ?? [0, 0, 0]);
  const [x, , z] = o.position ?? [0, 0, 0];
  return [x + r[0], objectElevation(o) + r[1], z + r[2]];
}

/** Điểm thế giới → cục bộ (ngược localToWorld). */
export function worldToLocal(o: SceneObject, p: Vec3): Vec3 {
  const [x, , z] = o.position ?? [0, 0, 0];
  const d: Vec3 = [p[0] - x, p[1] - objectElevation(o), p[2] - z];
  const [rx, ry, rz] = o.rotation ?? [0, 0, 0];
  // Euler XYZ nghịch đảo = quay −Z, −Y, −X lần lượt.
  const q = rotate(rotate(rotate(d, [0, 0, -rz]), [0, -ry, 0]), [-rx, 0, 0]);
  const s = o.scale ?? [1, 1, 1];
  return [q[0] / (s[0] || 1), q[1] / (s[1] || 1), q[2] / (s[2] || 1)];
}

/** Toạ độ thế giới của "objectId.port" (chấp nhận bí danh); undefined nếu không có / object gắn ống. */
export function portWorld(byId: ReadonlyMap<string, SceneObject>, ref: string | undefined): Vec3 | undefined {
  const r = parsePortRef(ref);
  const obj = r && byId.get(r.objectId);
  if (!obj || obj.attach || !ASSET_SPECS[obj.asset]) return undefined;
  const local = findPort(obj, r.port);
  return local ? localToWorld(obj, local) : undefined;
}

export type WorldPort = { ref: string; objectId: string; port: string; at: Vec3 };

/** Mọi cổng (tên thật) của các object đặt tự do, toạ độ thế giới. */
export function allPorts(objects: readonly SceneObject[], skip?: ReadonlySet<string>): WorldPort[] {
  const out: WorldPort[] = [];
  for (const o of objects) {
    if (o.attach || skip?.has(o.id) || !ASSET_SPECS[o.asset]) continue;
    for (const [port, p] of Object.entries(assetLayout(o).ports))
      out.push({ ref: portRef(o.id, port), objectId: o.id, port, at: localToWorld(o, p) });
  }
  return out;
}

/** Tên cổng thật cho ref (bí danh → tên thật) – Editor lưu tên thật. */
export function canonicalPortRef(byId: ReadonlyMap<string, SceneObject>, ref: string): string {
  const r = parsePortRef(ref);
  const obj = r && byId.get(r.objectId);
  const real = obj && resolvePortName(obj, r.port);
  return r && real ? portRef(r.objectId, real) : ref;
}

/** Đường đi đầy đủ của ống (cổng from + points + cổng to), toạ độ thế giới. Cổng không giải được → bỏ. */
export function pipePath(pipe: Pipe, byId: ReadonlyMap<string, SceneObject>): Vec3[] {
  const a = portWorld(byId, pipe.from);
  const b = portWorld(byId, pipe.to);
  return [...(a ? [a] : []), ...pipe.points, ...(b ? [b] : [])];
}

export const objectsById = (scene: Pick<SceneConfig, 'objects'>) => new Map(scene.objects.map((o) => [o.id, o]));

// ---------------------------------------------------------------------------
// Vector nhỏ

export const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale3 = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot3 = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const dist3 = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const same3 = (a: Vec3, b: Vec3, eps = POINT_EPS) => dist3(a, b) < eps;
const round3 = (v: number) => +v.toFixed(3) || 0;
export const roundVec = (p: Vec3): Vec3 => [round3(p[0]), round3(p[1]), round3(p[2])];

/** Hình chiếu điểm lên đoạn ab: tham số u ∈ [0, 1], điểm, khoảng cách. */
export function projectOnSegment(p: Vec3, a: Vec3, b: Vec3) {
  const ab = sub3(b, a);
  const len2 = dot3(ab, ab);
  const u = len2 ? Math.min(1, Math.max(0, dot3(sub3(p, a), ab) / len2)) : 0;
  const q = add3(a, scale3(ab, u));
  return { u, point: q, dist: dist3(p, q) };
}

/** Đoạn gần điểm nhất trên polyline: chỉ số đoạn (i → i+1), điểm chiếu, khoảng cách, độ dài tích luỹ tới điểm chiếu. */
export function nearestOnPath(path: readonly Vec3[], p: Vec3) {
  let best = { index: -1, point: p, dist: Infinity, along: 0 };
  let acc = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const pr = projectOnSegment(p, a, b);
    const len = dist3(a, b);
    if (pr.dist < best.dist) best = { index: i, point: pr.point, dist: pr.dist, along: acc + pr.u * len };
    acc += len;
  }
  return best;
}

export const pathLength = (path: readonly Vec3[]) => path.slice(1).reduce((s, p, i) => s + dist3(path[i]!, p), 0);

/** Điểm + hướng (đã chuẩn hoá) tại tỉ lệ chiều dài t của polyline (xấp xỉ đường cong ống – góc bo nhỏ). */
export function pointAtT(path: readonly Vec3[], t: number): { point: Vec3; dir: Vec3 } {
  const total = pathLength(path);
  let left = Math.min(1, Math.max(0, t)) * total;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const len = dist3(a, b);
    if (left <= len || i + 2 === path.length) {
      const u = len ? Math.min(1, left / len) : 0;
      return { point: add3(a, scale3(sub3(b, a), u)), dir: len ? scale3(sub3(b, a), 1 / len) : [1, 0, 0] };
    }
    left -= len;
  }
  return { point: path[0] ?? [0, 0, 0], dir: [1, 0, 0] };
}

// ---------------------------------------------------------------------------
// Vẽ ống

/**
 * Chế độ vuông góc: đi từ a tới b chỉ theo trục X → Z → Y, chèn điểm gập (bỏ đoạn rỗng).
 * Trả về các điểm SAU a (gồm b).
 */
export function orthoSegment(a: Vec3, b: Vec3): Vec3[] {
  const out: Vec3[] = [];
  const push = (p: Vec3) => {
    if (!same3(p, out.at(-1) ?? a)) out.push(p);
  };
  push([b[0], a[1], a[2]]);
  push([b[0], a[1], b[2]]);
  push(b);
  return out;
}

/** id ống kế tiếp: PL-01, PL-02… (số nhỏ nhất chưa dùng, không trùng id object). */
export function nextPipeId(scene: Pick<SceneConfig, 'objects' | 'pipes'>) {
  const taken = new Set([...scene.objects.map((o) => o.id), ...scene.pipes.map((p) => p.id)]);
  for (let n = 1; ; n++) {
    const id = `PL-${String(n).padStart(2, '0')}`;
    if (!taken.has(id)) return id;
  }
}

// ---------------------------------------------------------------------------
// Kiểm tra

/** Đoạn ab (toạ độ thế giới) có cắt hộp bao cục bộ (đã thu nhỏ `inset` m mỗi phía) của object không (slab test). */
export function segmentHitsObject(o: SceneObject, a: Vec3, b: Vec3, inset = 0.15): boolean {
  const { min, max } = assetLayout(o).bounds;
  const la = worldToLocal(o, a);
  const lb = worldToLocal(o, b);
  let t0 = 0;
  let t1 = 1;
  for (let k = 0; k < 3; k++) {
    const lo = min[k]! + inset;
    const hi = max[k]! - inset;
    if (lo >= hi) return false;
    const d = lb[k]! - la[k]!;
    if (Math.abs(d) < 1e-9) {
      if (la[k]! < lo || la[k]! > hi) return false;
      continue;
    }
    let u0 = (lo - la[k]!) / d;
    let u1 = (hi - la[k]!) / d;
    if (u0 > u1) [u0, u1] = [u1, u0];
    t0 = Math.max(t0, u0);
    t1 = Math.min(t1, u1);
    if (t0 > t1) return false;
  }
  return true;
}
