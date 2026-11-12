import { ASSET_SPECS, assetLayout } from '@/features/scene/assets/specs';
import { FLOOR_HALF_SIZE } from '@/features/scene/editConstants';
import { GROUND_EPS, mayFloat, worldBaseY } from '@/features/scene/ground';
import {
  DEFAULT_PIPE_RADIUS,
  dist3,
  nearestOnPath,
  objectsById,
  parsePortRef,
  pipePath,
  portWorld,
  same3,
  segmentHitsObject,
} from '@/features/scene/pipes';
import { validateSceneConfig } from '@/features/scene/parse';
import { ASSET_TYPES, type SceneConfig, type SceneObject, type Vec3 } from '@/features/scene/types';

export type EditorIssue = {
  severity: 'error' | 'warning';
  /** Object hoặc ống liên quan (bấm vào dòng → chọn + bay tới). */
  objectId?: string;
  where: string;
  message: string;
};

const knownAssets = new Set<string>(ASSET_TYPES);

/**
 * Kiểm tra cảnh trong Editor (không chặn lưu nháp):
 * - error: mọi lỗi của schema zod dùng chung với Viewer (id trùng, asset không tồn tại, cổng ống, params…);
 * - warning: binding trỏ tag không có trong danh sách tag, object nằm ngoài vùng sàn ±FLOOR_HALF_SIZE m,
 *   mặt sàn (`groundIssues`): lún dưới sàn, đáy thế giới khác elevation, lơ lửng không phải asset lắp trên ống.
 */
export function checkScene(scene: SceneConfig, tags: readonly string[]): EditorIssue[] {
  const issues: EditorIssue[] = validateSceneConfig(scene).map((i) => {
    const idx = typeof i.path[1] === 'number' ? i.path[1] : -1;
    const ref = i.path[0] === 'objects' ? scene.objects[idx]?.id : i.path[0] === 'pipes' ? scene.pipes[idx]?.id : undefined;
    return { severity: 'error', objectId: ref, where: i.where, message: i.message };
  });
  issues.push(...pipeIssues(scene));

  const tagSet = new Set(tags);
  scene.objects.forEach((o, i) => {
    for (const [field, b] of Object.entries(o.bindings ?? {})) {
      const tag = typeof b === 'string' ? b : b.tag;
      if (tag && !tagSet.has(tag))
        issues.push({
          severity: 'warning',
          objectId: o.id,
          where: `objects[${i}].bindings.${field}`,
          message: `"${o.id}": tag "${tag}" không có trong danh sách tag cảm biến`,
        });
    }
    issues.push(...groundIssues(o, i));
    if (outsideFloor(o))
      issues.push({
        severity: 'warning',
        objectId: o.id,
        where: `objects[${i}].position`,
        message: `"${o.id}" nằm ngoài vùng sàn (±${FLOOR_HALF_SIZE} m)`,
      });
  });
  return issues;
}

/** Đầu ống không nối cổng và không nằm trên đường đi của ống khác (≤ 1.5 × bán kính lớn hơn). */
function openEnds(scene: SceneConfig, p: SceneConfig['pipes'][number], path: readonly Vec3[], paths: Map<string, Vec3[]>): ('from' | 'to')[] {
  return (['from', 'to'] as const).filter((end) => {
    if (p[end]) return false;
    const tip = end === 'from' ? path[0]! : path.at(-1)!;
    const r = p.radius ?? DEFAULT_PIPE_RADIUS;
    return !scene.pipes.some((q) => q.id !== p.id && nearestOnPath(paths.get(q.id)!, tip).dist <= Math.max(r, q.radius ?? DEFAULT_PIPE_RADIUS) * 1.5);
  });
}

/** Thiết bị (equipment) mà đường ống đi xuyên – bỏ 2 object ở 2 đầu và object gắn trên ống. */
function crossedEquipment(scene: SceneConfig, p: SceneConfig['pipes'][number], path: readonly Vec3[]): Set<string> {
  const ends = new Set([parsePortRef(p.from)?.objectId, parsePortRef(p.to)?.objectId]);
  const hits = new Set<string>();
  for (const o of scene.objects) {
    if (o.attach || ends.has(o.id) || ASSET_SPECS[o.asset]?.category !== 'equipment') continue;
    for (let k = 0; k + 1 < path.length; k++) {
      if (dist3(path[k]!, path[k + 1]!) > 1e-3 && segmentHitsObject(o, path[k]!, path[k + 1]!)) {
        hits.add(o.id);
        break;
      }
    }
  }
  return hits;
}

/**
 * Kiểm tra ống, ngoài zod:
 * - error: hai đầu đường đi trùng nhau (ống khép vòng/độ dài 0);
 * - warning: cổng trùng điểm kề (điểm trùng liên tiếp), đầu hở (không nối cổng và không nằm trên ống khác – nhánh
 *   chữ T hợp lệ), ống xuyên thiết bị (đoạn cắt hộp bao thu nhỏ 0.15 m của equipment không phải 2 đầu nối – cảnh báo nhẹ).
 */
function pipeIssues(scene: SceneConfig): EditorIssue[] {
  const out: EditorIssue[] = [];
  const byId = objectsById(scene);
  const paths = new Map(scene.pipes.map((p) => [p.id, pipePath(p, byId)]));
  scene.pipes.forEach((p, i) => {
    const path = paths.get(p.id)!;
    const at = (where: string, message: string, severity: EditorIssue['severity'] = 'warning'): EditorIssue => ({
      severity,
      objectId: p.id,
      where: `pipes[${i}]${where}`,
      message,
    });
    if (path.length < 2) return;
    if (same3(path[0]!, path.at(-1)!) && path.length === 2) out.push(at('', `ống "${p.id}": hai đầu trùng nhau (độ dài 0)`, 'error'));
    else if (same3(path[0]!, path.at(-1)!)) out.push(at('', `ống "${p.id}": hai đầu trùng nhau (ống khép vòng)`, 'error'));
    const a = portWorld(byId, p.from);
    const b = portWorld(byId, p.to);
    if (a && p.points[0] && same3(a, p.points[0])) out.push(at('.points[0]', `ống "${p.id}": điểm 0 trùng cổng ${p.from}`));
    if (b && p.points.at(-1) && same3(b, p.points.at(-1)!))
      out.push(at(`.points[${p.points.length - 1}]`, `ống "${p.id}": điểm cuối trùng cổng ${p.to}`));
    // Đầu hở: không cổng, không nằm trên đường đi của ống khác (≤ bán kính lớn hơn).
    for (const end of openEnds(scene, p, path, paths))
      out.push(at(`.${end}`, `ống "${p.id}": đầu ${end === 'from' ? 'đầu' : 'cuối'} hở (không nối cổng/ống khác)`));
    const hits = crossedEquipment(scene, p, path);
    if (hits.size) out.push(at('.points', `ống "${p.id}" đi xuyên thiết bị: ${[...hits].join(', ')}`));
  });
  return out;
}

const fmt = (v: number) => `${+v.toFixed(2)} m`;

/**
 * Kiểm tra mặt sàn của object đặt tự do (bỏ qua gắn ống – độ cao theo ống). Đáy = min.y hộp bao sau xoay + scale.
 * - đáy < 0: lún dưới sàn;
 * - đáy ≠ elevation: xoay X/Z hoặc scale âm làm đáy lệch khỏi elevation;
 * - elevation > 0 với asset không lắp trên ống (`inline`): lơ lửng không có lý do.
 */
function groundIssues(o: SceneObject, i: number): EditorIssue[] {
  if (o.attach || !o.position || !knownAssets.has(o.asset)) return [];
  const elevation = o.elevation ?? 0;
  const base = worldBaseY(o, elevation);
  const at = (where: string, message: string): EditorIssue => ({ severity: 'warning', objectId: o.id, where: `objects[${i}].${where}`, message });
  const out: EditorIssue[] = [];
  if (base < -GROUND_EPS) out.push(at('elevation', `"${o.id}" lún dưới sàn ${fmt(-base)} (đáy y = ${fmt(base)})`));
  if (Math.abs(base - elevation) > GROUND_EPS)
    out.push(at('rotation', `"${o.id}": đáy y = ${fmt(base)} khác elevation ${fmt(elevation)} (xoay X/Z hoặc scale âm)`));
  if (elevation > GROUND_EPS && !mayFloat(o))
    out.push(at('elevation', `"${o.id}" lơ lửng ${fmt(elevation)} trên sàn – chỉ van/đồng hồ lắp trên ống mới nên nâng ("Đặt xuống sàn" để hạ)`));
  return out;
}

/** Hộp bao (theo vị trí + scale, bỏ qua xoay – đủ cho cảnh báo) vượt ra ngoài vùng sàn. Object gắn ống: bỏ qua. */
function outsideFloor(o: SceneObject) {
  if (!o.position || !knownAssets.has(o.asset) || !ASSET_SPECS[o.asset]) return false;
  const { min, max } = assetLayout(o).bounds;
  const s = o.scale ?? [1, 1, 1];
  const r = Math.max(Math.abs(min[0] * s[0]), Math.abs(max[0] * s[0]), Math.abs(min[2] * s[2]), Math.abs(max[2] * s[2]));
  const [x, , z] = o.position;
  return Math.abs(x) + r > FLOOR_HALF_SIZE || Math.abs(z) + r > FLOOR_HALF_SIZE;
}
