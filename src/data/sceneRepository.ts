import type { SceneConfig } from '@/features/scene/types';

/**
 * Kho cảnh 3D cho Editor/Viewer. Hôm nay lưu trong localStorage (LocalStorageRepository);
 * khi có API: viết `HttpSceneRepository` cùng interface (GET/PUT/DELETE /api/scenes/:id) và đổi `sceneRepository`.
 */
export type SceneSummary = {
  id: string;
  name: string;
  version: number;
  objectCount: number;
  /** ISO time lần lưu cuối. */
  updatedAt: string;
};

export interface SceneRepository {
  list(): Promise<SceneSummary[]>;
  /** Nạp + validate (zod); không có → lỗi. */
  load(id: string): Promise<SceneConfig>;
  has(id: string): Promise<boolean>;
  save(scene: SceneConfig): Promise<SceneSummary>;
  remove(id: string): Promise<void>;
}

const PREFIX = 'demo-lpg:scene:';
const INDEX = 'demo-lpg:scenes';

type Stored = { scene: SceneConfig; updatedAt: string };

function readIndex(storage: Storage): string[] {
  try {
    const raw = JSON.parse(storage.getItem(INDEX) ?? '[]') as unknown;
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function summary({ scene, updatedAt }: Stored): SceneSummary {
  return { id: scene.id, name: scene.name, version: scene.version, objectCount: scene.objects.length, updatedAt };
}

export class LocalStorageRepository implements SceneRepository {
  constructor(private readonly storage: Storage = window.localStorage) {}

  private read(id: string): Stored | null {
    const raw = this.storage.getItem(PREFIX + id);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Stored;
    } catch {
      return null;
    }
  }

  async list() {
    return readIndex(this.storage)
      .map((id) => this.read(id))
      .filter((s): s is Stored => !!s)
      .map(summary)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async has(id: string) {
    return this.read(id) !== null;
  }

  async load(id: string) {
    const stored = this.read(id);
    if (!stored) throw new Error(`Không có cảnh "${id}" trong bộ nhớ trình duyệt`);
    const { parseSceneConfig } = await import('@/features/scene/parse');
    return parseSceneConfig(stored.scene, id);
  }

  async save(scene: SceneConfig) {
    const stored: Stored = { scene, updatedAt: new Date().toISOString() };
    this.storage.setItem(PREFIX + scene.id, JSON.stringify(stored));
    const ids = readIndex(this.storage);
    if (!ids.includes(scene.id)) this.storage.setItem(INDEX, JSON.stringify([...ids, scene.id]));
    return summary(stored);
  }

  async remove(id: string) {
    this.storage.removeItem(PREFIX + id);
    this.storage.setItem(INDEX, JSON.stringify(readIndex(this.storage).filter((x) => x !== id)));
  }
}

/** Kho dùng chung của app (thay bằng bản HTTP khi có backend). */
export const sceneRepository: SceneRepository = new LocalStorageRepository();
