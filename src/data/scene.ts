import { useCallback, useEffect, useState } from 'react';
import type { LiveData, SceneConfig } from '@/features/scene/types';
import { liveBase, liveJitter } from '@/mocks/scenes/live';
import type { QueryState } from './overview';

// ---------------- Cảnh 3D ----------------

/** Mọi file src/mocks/scenes/{sceneId}.json – mỗi file một chunk, chỉ tải khi cần. */
const SCENE_FILES = import.meta.glob<unknown>('../mocks/scenes/*.json', { import: 'default' });
const idOf = (path: string) => path.slice(path.lastIndexOf('/') + 1, -'.json'.length);

export const SCENE_IDS = Object.keys(SCENE_FILES).map(idOf);

/**
 * Nạp + validate cảnh theo id. Hôm nay đọc src/mocks/scenes/{sceneId}.json;
 * sau thay bằng `fetch(`/api/scenes/${sceneId}`)` – vẫn qua parseSceneConfig (zod, import động).
 */
export async function fetchScene(sceneId: string): Promise<SceneConfig> {
  const load = SCENE_FILES[`../mocks/scenes/${sceneId}.json`];
  if (!load) throw new Error(`Không có cảnh "${sceneId}" (có: ${SCENE_IDS.join(', ')})`);
  const [raw, { parseSceneConfig }] = await Promise.all([load(), import('@/features/scene/parse')]);
  return parseSceneConfig(raw, sceneId);
}

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

/** Một bước mô phỏng: dao động quanh giá trị nền (mean-reverting), làm tròn 2 chữ số. */
function step(prev: LiveData): LiveData {
  const next: LiveData = { ...prev };
  for (const [tag, amp] of Object.entries(liveJitter)) {
    const base = liveBase[tag];
    const cur = prev[tag];
    if (typeof base !== 'number' || typeof cur !== 'number') continue;
    const v = cur + (base - cur) * 0.3 + (Math.random() * 2 - 1) * amp * 0.6;
    next[tag] = Math.round(Math.min(base + amp, Math.max(base - amp, v)) * 100) / 100;
  }
  return next;
}

/**
 * Số liệu trực tiếp theo tag cảm biến. Hiện giả lập: đổi mỗi `intervalMs` (mặc định 2 giây).
 * Thay bằng WebSocket/SSE khi có API – giữ nguyên kiểu trả về `LiveData`.
 * `enabled = false` → không chạy timer, trả về undefined.
 */
export function useLiveData({ enabled = true, intervalMs = 2000 }: { enabled?: boolean; intervalMs?: number } = {}) {
  const [data, setData] = useState<LiveData>(liveBase);

  useEffect(() => {
    if (!enabled) return;
    const t = window.setInterval(() => setData(step), intervalMs);
    return () => window.clearInterval(t);
  }, [enabled, intervalMs]);

  return enabled ? data : undefined;
}
