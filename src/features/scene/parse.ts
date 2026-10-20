import { z } from 'zod';
import { ASSET_SPECS, assetLayout } from './assets/specs';
import { ASSET_TYPES, type SceneConfig } from './types';

/*
 * Validate SceneConfig bằng zod. Module này chỉ được import động (data/scene.ts) để zod nằm ở chunk riêng.
 * Bước 1: cấu trúc (kiểu, trường lạ). Bước 2 (superRefine): tham chiếu – asset, id trùng, cổng/ống, params.
 */

const vec3 = z.tuple([z.number(), z.number(), z.number()]);
const thresholds = z
  .object({ warn: z.number(), danger: z.number(), lowWarn: z.number(), lowDanger: z.number() })
  .partial()
  .strict();
const binding = z.union([z.string().min(1), thresholds.extend({ tag: z.string().min(1) }).strict()]);
const camera = z.object({ position: vec3, zoom: z.number().positive(), target: vec3 }).strict();
const marker = z
  .object({
    variant: z.enum(['callout', 'side', 'tag']),
    tone: z.enum(['accent', 'success', 'warning']),
    title: z.string().min(1),
    field: z.string().min(1),
  })
  .partial()
  .strict();
const view = z
  .object({ id: z.string().min(1), label: z.string().min(1), objectIds: z.array(z.string()).min(1).optional(), camera: camera.optional() })
  .strict();

const objectSchema = z
  .object({
    id: z.string().min(1),
    asset: z.string(),
    position: vec3.optional(),
    rotation: vec3.optional(),
    scale: vec3.optional(),
    attach: z.object({ pipe: z.string().min(1), t: z.number().min(0).max(1) }).strict().optional(),
    path: z.array(vec3).optional(),
    params: z.record(z.number()).optional(),
    label: z.string().optional(),
    marker: marker.optional(),
    bindings: z.record(binding).optional(),
  })
  .strict();

const pipeSchema = z
  .object({
    id: z.string().min(1),
    from: z.string().optional(),
    to: z.string().optional(),
    points: z.array(vec3),
    radius: z.number().positive().optional(),
    flowTag: z.string().optional(),
  })
  .strict();

const sceneSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    version: z.number().int(),
    camera: camera.optional(),
    views: z.array(view).optional(),
    thresholds: z.record(thresholds).optional(),
    objects: z.array(objectSchema),
    pipes: z.array(pipeSchema),
  })
  .strict()
  .superRefine((c, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    const known = new Set<string>(ASSET_TYPES);
    const objects = new Map<string, (typeof c.objects)[number]>();

    c.objects.forEach((o, i) => {
      if (objects.has(o.id)) issue(['objects', i, 'id'], `id "${o.id}" bị trùng`);
      objects.set(o.id, o);
      if (!known.has(o.asset)) {
        issue(['objects', i, 'asset'], `asset "${o.asset}" không tồn tại (có: ${ASSET_TYPES.join(', ')})`);
        return;
      }
      const spec = ASSET_SPECS[o.asset as keyof typeof ASSET_SPECS];
      if (!o.attach && !o.position) issue(['objects', i], `"${o.id}" cần position hoặc attach`);
      if (o.attach && !c.pipes.some((p) => p.id === o.attach!.pipe))
        issue(['objects', i, 'attach', 'pipe'], `"${o.id}" gắn vào ống "${o.attach.pipe}" không tồn tại`);
      if (o.asset === 'fence' && (o.path?.length ?? 0) < 2) issue(['objects', i, 'path'], 'hàng rào cần path ≥ 2 điểm');
      if (spec.category === 'environment' && o.bindings && Object.keys(o.bindings).length)
        issue(['objects', i, 'bindings'], `"${o.asset}" là environment – không gắn bindings`);
      if (o.marker?.field && !o.bindings?.[o.marker.field])
        issue(['objects', i, 'marker', 'field'], `"${o.id}" không có binding "${o.marker.field}" để làm giá trị nhãn`);
      for (const [k, v] of Object.entries(o.params ?? {})) {
        const def = spec.paramsSchema[k];
        const names = Object.keys(spec.paramsSchema);
        if (!def) {
          issue(['objects', i, 'params', k], `"${o.asset}" không có tham số "${k}" (có: ${names.join(', ') || 'không có'})`);
          continue;
        }
        if ((def.min !== undefined && v < def.min) || (def.max !== undefined && v > def.max))
          issue(['objects', i, 'params', k], `${k} = ${v} ngoài khoảng ${def.min ?? '−∞'}–${def.max ?? '∞'}`);
        if (def.integer && !Number.isInteger(v)) issue(['objects', i, 'params', k], `${k} phải là số nguyên`);
      }
    });

    const viewIds = new Set<string>();
    c.views?.forEach((v, i) => {
      if (viewIds.has(v.id)) issue(['views', i, 'id'], `id view "${v.id}" bị trùng`);
      viewIds.add(v.id);
      if (v.objectIds && v.camera) issue(['views', i], `view "${v.id}": chỉ dùng objectIds hoặc camera`);
      v.objectIds?.forEach((id, k) => {
        if (!objects.has(id)) issue(['views', i, 'objectIds', k], `view "${v.id}" trỏ tới object "${id}" không tồn tại`);
      });
    });

    const pipeIds = new Set<string>();
    c.pipes.forEach((p, i) => {
      if (pipeIds.has(p.id)) issue(['pipes', i, 'id'], `id ống "${p.id}" bị trùng`);
      pipeIds.add(p.id);
      if (objects.has(p.id)) issue(['pipes', i, 'id'], `id ống "${p.id}" trùng id object`);
      (['from', 'to'] as const).forEach((end) => {
        const ref = p[end];
        if (!ref) return;
        const dot = ref.lastIndexOf('.');
        if (dot <= 0) return issue(['pipes', i, end], `"${ref}" cần dạng "objectId.port"`);
        const [objId, port] = [ref.slice(0, dot), ref.slice(dot + 1)];
        const obj = objects.get(objId);
        if (!obj) return issue(['pipes', i, end], `ống "${p.id}" nối tới object "${objId}" không tồn tại`);
        if (!known.has(obj.asset)) return;
        const ports = Object.keys(assetLayout(obj as SceneConfig['objects'][number]).ports);
        if (!ports.includes(port))
          issue(['pipes', i, end], `ống "${p.id}": "${objId}" (${obj.asset}) không có cổng "${port}" (có: ${ports.join(', ') || 'không có'})`);
      });
      if (p.points.length + (p.from ? 1 : 0) + (p.to ? 1 : 0) < 2) issue(['pipes', i, 'points'], `ống "${p.id}" cần ≥ 2 điểm`);
    });
  });

/** Lỗi validate – `issues` là từng dòng "đường dẫn: thông báo". */
export class SceneConfigError extends Error {
  constructor(
    sceneId: string,
    readonly issues: string[],
  ) {
    super(`Cảnh "${sceneId}" không hợp lệ (${issues.length} lỗi):\n${issues.map((s) => `• ${s}`).join('\n')}`);
    this.name = 'SceneConfigError';
  }
}

const fmtPath = (path: (string | number)[]) =>
  path.reduce<string>((acc, k) => (typeof k === 'number' ? `${acc}[${k}]` : acc ? `${acc}.${k}` : k), '') || '$';

export type SceneIssue = {
  /** Đường dẫn dạng mảng (objects, 3, id) – Editor dùng để trỏ tới object. */
  path: (string | number)[];
  /** Đường dẫn dạng chữ "objects[3].id". */
  where: string;
  message: string;
};

/** Validate không ném lỗi (Editor: bảng kiểm tra, Import JSON). Rỗng = hợp lệ. */
export function validateSceneConfig(raw: unknown): SceneIssue[] {
  const r = sceneSchema.safeParse(raw);
  return r.success ? [] : r.error.issues.map((i) => ({ path: i.path, where: fmtPath(i.path), message: i.message }));
}

/** JSON (file mock hoặc API) → SceneConfig; sai → ném SceneConfigError liệt kê đủ lỗi. */
export function parseSceneConfig(raw: unknown, sceneId = (raw as { id?: string } | null)?.id ?? '?'): SceneConfig {
  const r = sceneSchema.safeParse(raw);
  if (!r.success) throw new SceneConfigError(sceneId, r.error.issues.map((i) => `${fmtPath(i.path)}: ${i.message}`));
  return r.data as SceneConfig;
}
