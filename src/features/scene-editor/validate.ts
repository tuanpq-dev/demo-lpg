import { ASSET_SPECS, assetLayout } from '@/features/scene/assets/specs';
import { FLOOR_HALF_SIZE } from '@/features/scene/editConstants';
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
 * - warning: binding trỏ tag không có trong danh sách tag, object nằm ngoài vùng sàn ±FLOOR_HALF_SIZE m.
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

/** Hộp bao (theo vị trí + scale, bỏ qua xoay – đủ cho cảnh báo) vượt ra ngoài vùng sàn. Object gắn ống: bỏ qua. */
function outsideFloor(o: SceneObject) {
  if (!o.position || !knownAssets.has(o.asset) || !ASSET_SPECS[o.asset]) return false;
  const { min, max } = assetLayout(o).bounds;
  const s = o.scale ?? [1, 1, 1];
  const r = Math.max(Math.abs(min[0] * s[0]), Math.abs(max[0] * s[0]), Math.abs(min[2] * s[2]), Math.abs(max[2] * s[2]));
  const [x, , z] = o.position;
  return Math.abs(x) + r > FLOOR_HALF_SIZE || Math.abs(z) + r > FLOOR_HALF_SIZE;
}
