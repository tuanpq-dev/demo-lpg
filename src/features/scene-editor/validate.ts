import { ASSET_SPECS, assetLayout } from '@/features/scene/assets/specs';
import { FLOOR_HALF_SIZE } from '@/features/scene/editConstants';
import { GROUND_EPS, mayFloat, worldBaseY } from '@/features/scene/ground';
import { validateSceneConfig } from '@/features/scene/parse';
import { ASSET_TYPES, type SceneConfig, type SceneObject } from '@/features/scene/types';

export type EditorIssue = {
  severity: 'error' | 'warning';
  /** Object liên quan (bấm vào dòng → chọn object). */
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
    const idx = i.path[0] === 'objects' && typeof i.path[1] === 'number' ? i.path[1] : -1;
    return { severity: 'error', objectId: scene.objects[idx]?.id, where: i.where, message: i.message };
  });

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
