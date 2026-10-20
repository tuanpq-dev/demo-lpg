import { useCallback, useEffect, useState } from 'react';
import type { SceneConfig } from '@/features/scene/types';
import type { QueryState } from './overview';
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

/** Cảnh mẫu + cảnh đã lưu (cho hộp thoại "Mở" của Editor); `refetch` sau khi lưu/xoá. */
export function useSceneList() {
  const [items, setItems] = useState<SceneListItem[] | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void sceneRepository.list().then((saved) => {
      if (cancelled) return;
      const samples = SCENE_IDS.map(
        (id): SceneListItem => ({ id, name: id, version: 0, objectCount: 0, updatedAt: '', sample: true }),
      );
      setItems([...saved.map((s) => ({ ...s, sample: false })), ...samples]);
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);
  const refetch = useCallback(() => setAttempt((n) => n + 1), []);
  return { items, refetch };
}

/** Danh sách tag cảm biến hợp lệ (binding trong Editor + kiểm tra) – xem src/data/live. */
export { SENSOR_TAGS } from './live';

/** Hook cảnh 3D: `{ status, data, error, refetch }`; đổi sceneId → tải lại. */
export function useSceneConfig(sceneId: string) {
  const [state, setState] = useState<QueryState<SceneConfig>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    fetchScene(sceneId)
      .then((data) => !cancelled && setState({ status: 'success', data }))
      .catch((error: unknown) =>
        !cancelled && setState({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) }),
      );
    return () => {
      cancelled = true;
    };
  }, [sceneId, attempt]);

  const refetch = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, refetch };
}

// ---------------- Số liệu trực tiếp ----------------
// Đã chuyển sang src/data/live (LiveDataSource + useLiveData/useLiveStatus); giữ export để import cũ vẫn chạy.
export { useLiveData, useLiveStatus } from './live';
