import { ASSET_SPECS } from '@/features/scene/assets/specs';
import { EDIT_SNAP } from '@/features/scene/editConstants';
import type { ObjectTransform } from '@/features/scene/EditTools';
import type { AssetType, SceneCamera, SceneConfig, SceneObject, SceneView, Vec3 } from '@/features/scene/types';

/*
 * Phép biến đổi THUẦN trên SceneConfig cho Editor (không React/three) – mọi thao tác trả về cảnh mới,
 * giữ nguyên tham chiếu phần không đổi (undo/redo so sánh theo tham chiếu).
 */

/** Bước snap lưới khi thêm/kéo (m), xoay (rad), scale – dùng chung với gizmo của Viewer. */
export const SNAP = EDIT_SNAP;

const round = (v: number, digits = 3) => +v.toFixed(digits) || 0;
export const snapTo = (v: number, step: number) => round(Math.round(v / step) * step);
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
export function nextObjectId(asset: AssetType, taken: ReadonlySet<string>) {
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

/** Object mới của `asset` tại `at` (đã snap), id theo quy ước, nhãn = id. */
export function createObject(asset: AssetType, at: Vec3, taken: ReadonlySet<string>): SceneObject {
  const id = nextObjectId(asset, taken);
  return {
    id,
    asset,
    position: [round(at[0]), round(at[1]), round(at[2])],
    label: id,
    ...(asset === 'fence' ? { path: DEFAULT_FENCE_PATH.map((p) => [...p] as Vec3) } : {}),
  };
}

export function newScene(id: string, name: string): SceneConfig {
  return {
    id,
    name,
    version: 1,
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

/** Xoá object + dọn tham chiếu: view.objectIds, pipe.from/to trỏ tới object đó (điểm gấp giữ nguyên). */
export function removeObjects(scene: SceneConfig, ids: readonly string[]): SceneConfig {
  const gone = new Set(ids);
  const refGone = (ref?: string) => !!ref && gone.has(ref.slice(0, ref.lastIndexOf('.')));
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
    pipes: scene.pipes.map((p) => {
      if (!refGone(p.from) && !refGone(p.to)) return p;
      const next = { ...p };
      if (refGone(p.from)) delete next.from;
      if (refGone(p.to)) delete next.to;
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
    views: scene.views?.map((v) =>
      v.objectIds?.includes(from) ? { ...v, objectIds: v.objectIds.map((id) => (id === from ? to : id)) } : v,
    ),
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

/** Kết quả kéo gizmo (1 lần thả = 1 bước undo). Làm tròn 3 số lẻ vị trí/scale, 4 số lẻ góc; bỏ rotation 0 và scale 1. */
export function applyTransforms(scene: SceneConfig, changes: readonly ObjectTransform[]): SceneConfig {
  const byId = new Map(changes.map((c) => [c.id, c]));
  return {
    ...scene,
    objects: scene.objects.map((o) => {
      const c = byId.get(o.id);
      if (!c) return o;
      return cleanObject({
        ...o,
        position: c.position.map((v) => round(v)) as Vec3,
        rotation: c.rotation.map((v) => round(v, 4)) as Vec3,
        scale: c.scale.map((v) => round(v)) as Vec3,
      });
    }),
  };
}

/** Bỏ trường rỗng/mặc định: rotation toàn 0, scale toàn 1, params/bindings rỗng, label rỗng (`marker: {}` hợp lệ = nhãn mặc định). */
export function cleanObject(o: SceneObject): SceneObject {
  const out: SceneObject = { ...o };
  if (out.rotation?.every((v) => v === 0)) delete out.rotation;
  if (out.scale?.every((v) => v === 1)) delete out.scale;
  if (out.params && !Object.keys(out.params).length) delete out.params;
  if (out.bindings && !Object.keys(out.bindings).length) delete out.bindings;
  if (!out.label) delete out.label;
  return out;
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
