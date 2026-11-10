import type { SceneConfig } from '@/features/scene/types';
import { useQuery } from '@/lib/useQuery';
import { sceneRepository, type SceneSummary } from './sceneRepository';

// ---------------- Cảnh 3D ----------------

/** Mọi file src/mocks/scenes/{sceneId}.json – mỗi file một chunk, chỉ tải khi cần. */
const SCENE_FILES = import.meta.glob<unknown>('../mocks/scenes/*.json', { import: 'default' });
const idOf = (path: string) => path.slice(path.lastIndexOf('/') + 1, -'.json'.length);

/** Cảnh mẫu (chỉ đọc) – Editor mở được nhưng phải "Lưu thành bản mới". */
export const SCENE_IDS = Object.keys(SCENE_FILES).map(idOf);
export const isSampleScene = (id: string) => SCENE_IDS.includes(id);

/**
 * Nạp + validate cảnh theo id: cảnh mẫu src/mocks/scenes/{sceneId}.json, không có thì tìm trong `sceneRepository`
 * (cảnh lưu từ Editor). Sau thay bằng `fetch(`/api/scenes/${sceneId}`)` – vẫn qua parseSceneConfig (zod, import động).
 */
export async function fetchScene(sceneId: string): Promise<SceneConfig> {
  const load = SCENE_FILES[`../mocks/scenes/${sceneId}.json`];
  if (!load) {
    if (await sceneRepository.has(sceneId)) return sceneRepository.load(sceneId);
    const saved = (await sceneRepository.list()).map((s) => s.id);
    throw new Error(`Không có cảnh "${sceneId}" (có: ${[...SCENE_IDS, ...saved].join(', ')})`);
  }
  const [raw, { parseSceneConfig }] = await Promise.all([load(), import('@/features/scene/parse')]);
  return parseSceneConfig(raw, sceneId);
}

export type SceneListItem = SceneSummary & { sample: boolean };

async function fetchSceneList(): Promise<SceneListItem[]> {
  const saved = await sceneRepository.list();
  const samples = SCENE_IDS.map((id): SceneListItem => ({ id, name: id, version: 0, objectCount: 0, updatedAt: '', sample: true }));
  return [...saved.map((s) => ({ ...s, sample: false })), ...samples];
}

/**
 * Cảnh mẫu + cảnh đã lưu (cho hộp thoại "Mở" của Editor); `refetch` sau khi lưu/xoá (về "Đang tải…").
 * `items` = null khi đang tải hoặc lỗi; lỗi đọc kho (localStorage hỏng/bị chặn) → `error`.
 */
export function useSceneList() {
  const q = useQuery('scene-list', fetchSceneList);
  return { items: q.status === 'success' ? q.data : null, error: q.error, refetch: q.refetch };
}

/** Danh sách tag cảm biến hợp lệ (binding trong Editor + kiểm tra) – xem src/data/live. */
export { SENSOR_TAGS } from './live';

/** Hook cảnh 3D: `{ status, data, error, refetch }`; đổi sceneId → tải lại. */
export function useSceneConfig(sceneId: string) {
  return useQuery<SceneConfig>(sceneId, () => fetchScene(sceneId));
}
