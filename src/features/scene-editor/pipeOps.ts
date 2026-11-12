import { ASSET_SPECS } from '@/features/scene/assets/specs';
import {
  canonicalPortRef,
  nearestOnPath,
  nextPipeId,
  objectsById,
  pathLength,
  pipePath,
  pointAtT,
  portWorld,
  roundVec,
} from '@/features/scene/pipes';
import { type Pipe, type SceneConfig, type Vec3 } from '@/features/scene/types';

import { OBJECT_ID_PATTERN, cleanObject, objectIds, objectsOnPipes, removeObjects } from './ops';

/* Phép biến đổi THUẦN trên ống của SceneConfig cho Editor: thêm / sửa / xoá / đổi tên ống, gắn – tháo object khỏi ống. */

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
