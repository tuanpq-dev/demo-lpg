import type { SceneConfig } from '@/features/scene/types';
import type { SceneSource } from './store';

/** Bản nháp tự lưu của Editor (key riêng, tách khỏi kho cảnh) – hỏi khôi phục khi mở lại /editor. */
export type EditorDraft = { scene: SceneConfig; source: SceneSource; savedAt: string };

const KEY = 'demo-lpg:editor-draft';

/** Chu kỳ tự lưu nháp (ms). */
export const AUTOSAVE_MS = 3000;

export function readDraft(): EditorDraft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as EditorDraft;
    return d && typeof d === 'object' && d.scene && Array.isArray(d.scene.objects) ? d : null;
  } catch {
    return null;
  }
}

export function writeDraft(scene: SceneConfig, source: SceneSource) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ scene, source, savedAt: new Date().toISOString() } satisfies EditorDraft));
  } catch {
    // Hết dung lượng/bị chặn – bỏ qua, không làm hỏng phiên sửa.
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
