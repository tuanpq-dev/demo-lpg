import { ASSET_SPECS, assetLayout } from '@/features/scene/assets/specs';
import { EDIT_SNAP, snapTo } from '@/features/scene/editConstants';
import type { ObjectTransform } from '@/features/scene/EditTools';
import {
  canonicalPortRef,
  nearestOnPath,
  nextPipeId,
  objectsById,
  parsePortRef,
  pathLength,
  pipePath,
  pointAtT,
  portWorld,
  roundVec,
} from '@/features/scene/pipes';
import {
  SCENE_SCHEMA_VERSION,
  type AssetType,
  type Pipe,
  type SceneCamera,
  type SceneConfig,
  type SceneObject,
  type SceneView,
  type Vec3,
} from '@/features/scene/types';

/*
 * Phép biến đổi THUẦN trên SceneConfig cho Editor (không React/three) – mọi thao tác trả về cảnh mới,
 * giữ nguyên tham chiếu phần không đổi (undo/redo so sánh theo tham chiếu).
 */

/** Bước snap lưới khi thêm/kéo (m), xoay (rad), scale – dùng chung với gizmo của Viewer. */
export const SNAP = EDIT_SNAP;

const round = (v: number, digits = 3) => +v.toFixed(digits) || 0;
export { snapTo };
export const snapVec = (v: Vec3, step = SNAP.translate): Vec3 => [snapTo(v[0], step), round(v[1]), snapTo(v[2], step)];

/** "Bơm & Lọc" → "bom-loc" (bỏ dấu tiếng Việt). */
export function slugify(text: string) {
  return (
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'muc'
  );
}

/** id duy nhất: base, base-2, base-3… */
export function uniqueId(base: string, taken: ReadonlySet<string>) {
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

/** Ký tự hợp lệ của id object (không khoảng trắng, không dấu chấm – dấu chấm tách "id.cổng" trong ống). */
export const OBJECT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * id kế tiếp theo quy ước của asset (`idPrefix`): equipment `V-101, V-102…`, environment `FN-01, FN-02…`.
 * Lấy số nhỏ nhất chưa dùng (bỏ qua id có hậu tố như P-101A).
 */
function nextObjectId(asset: AssetType, taken: ReadonlySet<string>) {
  const spec = ASSET_SPECS[asset];
  const equipment = spec.category === 'equipment';
  for (let n = equipment ? 101 : 1; ; n++) {
    const id = `${spec.idPrefix}-${String(n).padStart(equipment ? 3 : 2, '0')}`;
    if (!taken.has(id)) return id;
  }
}

export const objectIds = (scene: SceneConfig) => new Set(scene.objects.map((o) => o.id));

/** Hàng rào mới: khung chữ nhật 6×4 m khép kín quanh gốc object. */
const DEFAULT_FENCE_PATH: Vec3[] = [
  [-3, 0, -2],
  [3, 0, -2],
  [3, 0, 2],
  [-3, 0, 2],
  [-3, 0, -2],
];

/** Object mới của `asset` tại `at` (X/Z, đã snap) – luôn đặt trên sàn (y = 0, không elevation), id theo quy ước, nhãn = id. */
export function createObject(asset: AssetType, at: Vec3, taken: ReadonlySet<string>): SceneObject {
  const id = nextObjectId(asset, taken);
  return {
    id,
    asset,
    position: [round(at[0]), 0, round(at[2])],
    label: id,
    ...(asset === 'fence' ? { path: DEFAULT_FENCE_PATH.map((p) => [...p] as Vec3) } : {}),
  };
}

export function newScene(id: string, name: string): SceneConfig {
  return {
    id,
    name,
    version: 1,
    schemaVersion: SCENE_SCHEMA_VERSION,
    // Không đặt camera: Viewer tự khung vừa mọi object cho "Toàn cảnh" (đặt sau ở Thuộc tính cảnh).
    views: [{ id: 'all', label: 'Toàn cảnh' }],
    thresholds: {},
    objects: [],
    pipes: [],
  };
}

// ---------------------------------------------------------------------------
// Object

export function addObjects(scene: SceneConfig, objs: SceneObject[]): SceneConfig {
  return { ...scene, objects: [...scene.objects, ...objs] };
}

export function updateObject(scene: SceneConfig, id: string, fn: (o: SceneObject) => SceneObject): SceneConfig {
  return { ...scene, objects: scene.objects.map((o) => (o.id === id ? cleanObject(fn(o)) : o)) };
}

/** Ống nối vào (from/to) các object `ids`. */
export function pipesConnectedTo(scene: SceneConfig, ids: readonly string[]): Pipe[] {
  const set = new Set(ids);
  const hit = (ref?: string) => !!ref && set.has(parsePortRef(ref)?.objectId ?? '');
  return scene.pipes.filter((p) => hit(p.from) || hit(p.to));
}

/** Object gắn (attach) trên các ống `pipeIds`. */
export const objectsOnPipes = (scene: SceneConfig, pipeIds: readonly string[]) =>
  scene.objects.filter((o) => o.attach && pipeIds.includes(o.attach.pipe));

/**
 * Xoá object + dọn tham chiếu (view.objectIds). Ống nối vào object bị xoá:
 * - `keep` (mặc định): giữ ống, đầu nối đổi thành điểm tự do đúng vị trí cổng cũ → hình ống không đổi;
 * - `delete`: xoá cả ống đó (và object gắn trên ống).
 */
export function removeObjects(scene: SceneConfig, ids: readonly string[], pipes: 'keep' | 'delete' = 'keep'): SceneConfig {
  let gone = new Set(ids);
  const byId = objectsById(scene);
  const refGone = (ref?: string) => !!ref && gone.has(parsePortRef(ref)?.objectId ?? '');
  const dropPipes = new Set(pipes === 'delete' ? pipesConnectedTo(scene, ids).map((p) => p.id) : []);
  if (dropPipes.size) gone = new Set([...gone, ...objectsOnPipes(scene, [...dropPipes]).map((o) => o.id)]);
  return {
    ...scene,
    objects: scene.objects.filter((o) => !gone.has(o.id)),
    views: scene.views?.map((v) => {
      if (!v.objectIds?.some((id) => gone.has(id))) return v;
      const left = v.objectIds.filter((id) => !gone.has(id));
      const { objectIds: _drop, ...rest } = v;
      void _drop;
      return left.length ? { ...rest, objectIds: left } : rest;
    }),
    pipes: scene.pipes
      .filter((p) => !dropPipes.has(p.id))
      .map((p) => {
        if (!refGone(p.from) && !refGone(p.to)) return p;
        const next: Pipe = { ...p, points: [...p.points] };
        const a = refGone(p.from) ? portWorld(byId, p.from) : undefined;
        const b = refGone(p.to) ? portWorld(byId, p.to) : undefined;
        if (refGone(p.from)) delete next.from;
        if (refGone(p.to)) delete next.to;
        if (a) next.points.unshift(roundVec(a));
        if (b) next.points.push(roundVec(b));
        return next;
      }),
  };
}

/** Đổi id + cập nhật mọi tham chiếu (views, pipe.from/to "id.cổng"). Trả về null nếu id mới trùng/không hợp lệ. */
export function renameObject(scene: SceneConfig, from: string, to: string): SceneConfig | null {
  if (from === to) return scene;
  if (!OBJECT_ID_PATTERN.test(to) || objectIds(scene).has(to) || scene.pipes.some((p) => p.id === to)) return null;
  const ref = (r?: string) => (r && r.slice(0, r.lastIndexOf('.')) === from ? `${to}${r.slice(r.lastIndexOf('.'))}` : r);
  return {
    ...scene,
    objects: scene.objects.map((o) => (o.id === from ? { ...o, id: to } : o)),
    views: scene.views?.map((v) => (v.objectIds?.includes(from) ? { ...v, objectIds: v.objectIds.map((id) => (id === from ? to : id)) } : v)),
    pipes: scene.pipes.map((p) => {
      const [f, t] = [ref(p.from), ref(p.to)];
      return f === p.from && t === p.to ? p : { ...p, ...(f ? { from: f } : {}), ...(t ? { to: t } : {}) };
    }),
  };
}

/**
 * Bản sao của `objs` với id mới theo quy ước, dời `offset` (object gắn ống: dời t thêm 0.05).
 * Dùng cho nhân bản (Ctrl+D) và dán (Ctrl+V).
 */
export function cloneObjects(objs: readonly SceneObject[], taken: ReadonlySet<string>, offset: Vec3): SceneObject[] {
  const used = new Set(taken);
  return objs.map((o) => {
    const id = nextObjectId(o.asset, used);
    used.add(id);
    const copy: SceneObject = structuredClone(o);
    copy.id = id;
    if (copy.label === o.id) copy.label = id;
    if (copy.position) copy.position = copy.position.map((v, i) => round(v + offset[i]!)) as Vec3;
    if (copy.attach) copy.attach = { ...copy.attach, t: round(Math.min(1, copy.attach.t + 0.05), 3) };
    return copy;
  });
}

/**
 * Kết quả kéo (1 lần thả = 1 bước undo). Làm tròn 3 số lẻ vị trí/scale, 4 số lẻ góc; bỏ rotation 0 và scale 1.
 * Kéo không đổi độ cao: position[1] lấy lại từ elevation của object (bỏ qua y trong `changes`).
 */
export function applyTransforms(scene: SceneConfig, changes: readonly ObjectTransform[]): SceneConfig {
  const byId = new Map(changes.map((c) => [c.id, c]));
  return {
    ...scene,
    objects: scene.objects.map((o) => {
      const c = byId.get(o.id);
      if (!c) return o;
      return cleanObject({
        ...o,
        position: [round(c.position[0]), o.elevation ?? 0, round(c.position[2])],
        rotation: c.rotation.map((v) => round(v, 4)) as Vec3,
        scale: c.scale.map((v) => round(v)) as Vec3,
      });
    }),
  };
}

/**
 * Bỏ trường rỗng/mặc định: rotation toàn 0, scale toàn 1, elevation 0, params/bindings rỗng, label rỗng
 * (`marker: {}` hợp lệ = nhãn mặc định). Đồng bộ position[1] = elevation (bất biến của định dạng v2).
 */
function cleanObject(o: SceneObject): SceneObject {
  const out: SceneObject = { ...o };
  if (out.attach) delete out.elevation;
  else if (out.position) {
    const h = round(out.elevation ?? 0);
    if (out.position[1] !== h) out.position = [out.position[0], h, out.position[2]];
    if (h) out.elevation = h;
    else delete out.elevation;
  }
  if (out.rotation?.every((v) => v === 0)) delete out.rotation;
  if (out.scale?.every((v) => v === 1)) delete out.scale;
  if (out.params && !Object.keys(out.params).length) delete out.params;
  if (out.bindings && !Object.keys(out.bindings).length) delete out.bindings;
  if (!out.label) delete out.label;
  return out;
}

// ---------------------------------------------------------------------------
// Độ cao, căn hàng

/** Bước snap của ô Elevation (m). */
export const ELEVATION_STEP = EDIT_SNAP.elevation;

/** Đặt độ cao đáy (m) cho các object (bỏ qua object gắn ống). `0` = "Đặt xuống sàn". */
export function setElevation(scene: SceneConfig, ids: readonly string[], elevation: number): SceneConfig {
  const set = new Set(ids);
  const h = round(elevation);
  let changed = false;
  const objects = scene.objects.map((o) => {
    if (!set.has(o.id) || o.attach || !o.position || (o.elevation ?? 0) === h) return o;
    changed = true;
    return cleanObject({ ...o, elevation: h });
  });
  return changed ? { ...scene, objects } : scene;
}

export type AlignAxis = 'x' | 'z';

/**
 * Căn hàng (≥ 2 object, bỏ qua gắn ống): xếp thành một hàng dọc theo trục `axis`.
 * - Toạ độ trục kia và elevation = của object chọn đầu tiên (mốc).
 * - Phân bố đều tâm giữa object đầu và cuối theo `axis` (giữ thứ tự hiện có); trùng toạ độ → cách nhau
 *   bề rộng lớn nhất + 1 m. Kết quả snap lưới nếu `snap`.
 */
export function alignObjects(scene: SceneConfig, ids: readonly string[], axis: AlignAxis, snap = true): SceneConfig {
  const objs = ids
    .map((id) => scene.objects.find((o) => o.id === id))
    .filter((o): o is SceneObject & { position: Vec3 } => !!o && !o.attach && !!o.position);
  if (objs.length < 2) return scene;
  const a = axis === 'x' ? 0 : 2;
  const b = axis === 'x' ? 2 : 0;
  const anchor = objs[0]!;
  const sorted = [...objs].sort((p, q) => p.position[a] - q.position[a]);
  const lo = sorted[0]!.position[a];
  const hi = sorted[sorted.length - 1]!.position[a];
  const width = Math.max(
    ...objs.map((o) => {
      const { min, max } = assetLayout(o).bounds;
      return (max[a] - min[a]) * (o.scale?.[a] ?? 1);
    }),
  );
  const step = hi - lo > 1e-3 ? (hi - lo) / (sorted.length - 1) : width + 1;
  const s = (v: number) => (snap ? snapTo(v, SNAP.translate) : round(v));
  const next = new Map(
    sorted.map((o, i) => {
      const p: Vec3 = [0, anchor.elevation ?? 0, 0];
      p[a] = s(lo + i * step);
      p[b] = s(anchor.position[b]);
      return [o.id, p] as const;
    }),
  );
  return {
    ...scene,
    objects: scene.objects.map((o) => {
      const p = next.get(o.id);
      return p ? cleanObject({ ...o, position: p, elevation: anchor.elevation }) : o;
    }),
  };
}

// ---------------------------------------------------------------------------
// Ống (3D-4)

export type PipeDraft = { from?: string; to?: string; points: Vec3[] };

/** Thêm ống mới (id PL-xx, cổng lưu tên thật, toạ độ làm tròn 3 số lẻ). */
export function addPipe(scene: SceneConfig, draft: PipeDraft): { scene: SceneConfig; id: string } {
  const id = nextPipeId(scene);
  const byId = objectsById(scene);
  const pipe: Pipe = {
    id,
    ...(draft.from ? { from: canonicalPortRef(byId, draft.from) } : {}),
    ...(draft.to ? { to: canonicalPortRef(byId, draft.to) } : {}),
    points: draft.points.map(roundVec),
  };
  return { scene: { ...scene, pipes: [...scene.pipes, pipe] }, id };
}

/** Sửa một ống; bỏ trường rỗng (from/to/flowTag trống, radius = mặc định không ghi). */
export function updatePipe(scene: SceneConfig, id: string, fn: (p: Pipe) => Pipe): SceneConfig {
  return {
    ...scene,
    pipes: scene.pipes.map((p) => {
      if (p.id !== id) return p;
      const n: Pipe = { ...fn(p) };
      if (!n.from) delete n.from;
      if (!n.to) delete n.to;
      if (!n.flowTag) delete n.flowTag;
      if (n.radius === undefined) delete n.radius;
      n.points = n.points.map(roundVec);
      return n;
    }),
  };
}

/** Xoá ống + object gắn trên ống (object gắn không tồn tại được khi mất ống). */
export function removePipes(scene: SceneConfig, ids: readonly string[]): SceneConfig {
  const set = new Set(ids);
  const attached = new Set(objectsOnPipes(scene, ids).map((o) => o.id));
  const s = attached.size ? removeObjects(scene, [...attached]) : scene;
  return { ...s, pipes: s.pipes.filter((p) => !set.has(p.id)) };
}

/** Đổi id ống + cập nhật attach.pipe. null nếu trùng/không hợp lệ. */
export function renamePipe(scene: SceneConfig, from: string, to: string): SceneConfig | null {
  if (from === to) return scene;
  if (!OBJECT_ID_PATTERN.test(to) || objectIds(scene).has(to) || scene.pipes.some((p) => p.id === to)) return null;
  return {
    ...scene,
    pipes: scene.pipes.map((p) => (p.id === from ? { ...p, id: to } : p)),
    objects: scene.objects.map((o) => (o.attach?.pipe === from ? { ...o, attach: { ...o.attach, pipe: to } } : o)),
  };
}

/** Chèn điểm gập vào ống tại điểm `at` (toạ độ thế giới) – vào đoạn gần nhất của đường đi đầy đủ. */
export function insertPipePoint(scene: SceneConfig, id: string, at: Vec3): SceneConfig {
  const pipe = scene.pipes.find((p) => p.id === id);
  if (!pipe) return scene;
  const byId = objectsById(scene);
  const path = pipePath(pipe, byId);
  const near = nearestOnPath(path, at);
  if (near.index < 0) return scene;
  const offset = pipe.from && portWorld(byId, pipe.from) ? 1 : 0;
  const index = Math.min(pipe.points.length, Math.max(0, near.index + 1 - offset));
  return updatePipe(scene, id, (p) => ({ ...p, points: [...p.points.slice(0, index), at, ...p.points.slice(index)] }));
}

/** Đảo chiều ống (from ↔ to, đảo thứ tự điểm; object gắn: t → 1 − t). */
export function reversePipe(scene: SceneConfig, id: string): SceneConfig {
  const s = updatePipe(scene, id, (p) => ({ ...p, from: p.to, to: p.from, points: [...p.points].reverse() }));
  return {
    ...s,
    objects: s.objects.map((o) => (o.attach?.pipe === id ? { ...o, attach: { ...o.attach, t: +(1 - o.attach.t).toFixed(3) } } : o)),
  };
}

/**
 * Gắn object (van/đồng hồ) lên ống tại điểm gần vị trí hiện tại nhất (t theo chiều dài đường gấp khúc ≈ đường cong).
 * Bỏ position/rotation/elevation (lấy từ ống).
 */
export function attachToPipe(scene: SceneConfig, id: string, pipeId: string): SceneConfig {
  const pipe = scene.pipes.find((p) => p.id === pipeId);
  const obj = scene.objects.find((o) => o.id === id);
  if (!pipe || !obj) return scene;
  const path = pipePath(pipe, objectsById(scene));
  const total = pathLength(path);
  const here: Vec3 = obj.position ?? path[0] ?? [0, 0, 0];
  const t = total ? +(nearestOnPath(path, here).along / total).toFixed(3) : 0.5;
  return {
    ...scene,
    objects: scene.objects.map((o) => {
      if (o.id !== id) return o;
      const { position: _p, rotation: _r, elevation: _e, ...rest } = o;
      return { ...rest, attach: { pipe: pipeId, t } };
    }),
  };
}

/** Tháo object khỏi ống: đứng riêng tại vị trí/hướng hiện tại trên ống (đáy = tâm ống − axisY). */
export function detachFromPipe(scene: SceneConfig, id: string): SceneConfig {
  const obj = scene.objects.find((o) => o.id === id);
  const pipe = obj?.attach && scene.pipes.find((p) => p.id === obj.attach!.pipe);
  if (!obj?.attach) return scene;
  const path = pipe ? pipePath(pipe, objectsById(scene)) : [];
  const { point, dir } = path.length > 1 ? pointAtT(path, obj.attach.t) : { point: [0, 0, 0] as Vec3, dir: [1, 0, 0] as Vec3 };
  const h = +(point[1] - (ASSET_SPECS[obj.asset].inline?.axisY ?? 0)).toFixed(3);
  const ry = +Math.atan2(-dir[2], dir[0]).toFixed(4);
  return {
    ...scene,
    objects: scene.objects.map((o) => {
      if (o.id !== id) return o;
      const { attach: _a, ...rest } = o;
      void _a;
      return cleanObject({ ...rest, position: [+point[0].toFixed(3), h, +point[2].toFixed(3)], elevation: h, rotation: [0, ry, 0] });
    }),
  };
}

// ---------------------------------------------------------------------------
// Views

export function addView(scene: SceneConfig, label: string, camera: SceneCamera): { scene: SceneConfig; id: string } {
  const id = uniqueId(slugify(label), new Set(scene.views?.map((v) => v.id)));
  return { scene: { ...scene, views: [...(scene.views ?? []), { id, label, camera }] }, id };
}

export function updateView(scene: SceneConfig, id: string, fn: (v: SceneView) => SceneView): SceneConfig {
  return { ...scene, views: scene.views?.map((v) => (v.id === id ? fn(v) : v)) };
}

export function removeView(scene: SceneConfig, id: string): SceneConfig {
  return { ...scene, views: scene.views?.filter((v) => v.id !== id) };
}

// ---------------------------------------------------------------------------
// Xuất

/** Thứ tự khoá khi xuất JSON – giống file mock (id, asset, vị trí…, nhãn, marker, bindings). */
const OBJECT_KEYS: (keyof SceneObject)[] = [
  'id',
  'asset',
  'position',
  'elevation',
  'rotation',
  'scale',
  'attach',
  'path',
  'params',
  'label',
  'marker',
  'bindings',
];

/** Cảnh gọn để lưu/xuất: thứ tự khoá cố định, bỏ trường rỗng. */
export function normalizeScene(scene: SceneConfig): SceneConfig {
  return {
    id: scene.id,
    name: scene.name,
    version: scene.version,
    schemaVersion: SCENE_SCHEMA_VERSION,
    ...(scene.camera ? { camera: scene.camera } : {}),
    ...(scene.views?.length ? { views: scene.views } : {}),
    ...(scene.thresholds && Object.keys(scene.thresholds).length ? { thresholds: scene.thresholds } : {}),
    objects: scene.objects.map((o) => {
      const c = cleanObject(o);
      const out: Record<string, unknown> = {};
      for (const k of OBJECT_KEYS) if (c[k] !== undefined) out[k] = c[k];
      return out as unknown as SceneObject;
    }),
    pipes: scene.pipes,
  };
}
