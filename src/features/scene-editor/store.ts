import { temporal } from 'zundo';
import { create } from 'zustand';
import type { SceneConfig, SceneObject } from '@/features/scene/types';
import { newScene } from './ops';

/*
 * Hai store tách biệt:
 * - useSceneDoc: TÀI LIỆU (SceneConfig) – có undo/redo (zundo). Mỗi lần `setScene` = 1 bước;
 *   kéo gizmo chỉ commit lúc thả chuột nên cả lần kéo = 1 bước. Nạp cảnh mới → `resetHistory`.
 * - useEditorUi: state giao diện (chọn, công cụ, snap, lưới, ẩn/khoá, clipboard, nguồn cảnh) – không undo.
 * Viewer/Editor dùng chung SceneConfig; mọi state riêng của Editor nằm ngoài cảnh.
 */

type DocState = {
  scene: SceneConfig;
  setScene: (next: SceneConfig | ((cur: SceneConfig) => SceneConfig)) => void;
};

export const useSceneDoc = create<DocState>()(
  temporal(
    (set) => ({
      scene: newScene('canh-moi', 'Cảnh mới'),
      setScene: (next) => set((st) => ({ scene: typeof next === 'function' ? next(st.scene) : next })),
    }),
    {
      partialize: (s) => ({ scene: s.scene }),
      // Không ghi bước khi cảnh không đổi tham chiếu (vd thao tác bị từ chối).
      equality: (a, b) => a.scene === b.scene,
      limit: 200,
    },
  ),
);

export const undo = () => useSceneDoc.temporal.getState().undo();
export const redo = () => useSceneDoc.temporal.getState().redo();

/** Thay cảnh KHÔNG ghi lịch sử (nạp/lưu: tăng version). */
export function setSceneSilently(scene: SceneConfig) {
  const t = useSceneDoc.temporal.getState();
  t.pause();
  useSceneDoc.getState().setScene(scene);
  t.resume();
}

/** Nạp cảnh mới vào editor: thay cảnh + xoá lịch sử undo. */
export function loadScene(scene: SceneConfig) {
  setSceneSilently(scene);
  useSceneDoc.temporal.getState().clear();
}

export type EditorTool = 'select' | 'translate' | 'rotate' | 'scale';

/** Nguồn cảnh đang sửa: mới · đã lưu trong kho (id) · cảnh mẫu (chỉ đọc → phải "Lưu thành bản mới"). */
export type SceneSource = { kind: 'new' } | { kind: 'saved'; id: string } | { kind: 'sample'; id: string };

type UiState = {
  selection: string[];
  tool: EditorTool;
  snap: boolean;
  grid: boolean;
  hidden: string[];
  locked: string[];
  clipboard: SceneObject[] | null;
  source: SceneSource;
  /** Cảnh ở lần lưu/nạp cuối – so tham chiếu với cảnh hiện tại để biết "Chưa lưu". */
  saved: SceneConfig | null;
  /** View đang xem thử trong canvas (bay camera). */
  previewView: string | null;
  setSelection: (ids: string[]) => void;
  /** replace: thay · toggle: thêm/bớt từng id (Ctrl/Shift+click) · add: hợp (kéo vùng chọn). */
  select: (ids: string[], how?: 'replace' | 'toggle' | 'add') => void;
  setTool: (tool: EditorTool) => void;
  toggle: (key: 'snap' | 'grid') => void;
  toggleHidden: (id: string) => void;
  toggleLocked: (id: string) => void;
  set: (patch: Partial<UiState>) => void;
};

const flip = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

export const useEditorUi = create<UiState>()((set) => ({
  selection: [],
  tool: 'translate',
  snap: true,
  grid: true,
  hidden: [],
  locked: [],
  clipboard: null,
  source: { kind: 'new' },
  saved: null,
  previewView: null,
  setSelection: (ids) => set({ selection: ids }),
  select: (ids, how = 'replace') =>
    set((st) => {
      if (how === 'replace') return { selection: ids };
      if (how === 'add') return { selection: [...st.selection, ...ids.filter((id) => !st.selection.includes(id))] };
      return { selection: ids.reduce(flip, st.selection) };
    }),
  setTool: (tool) => set({ tool }),
  toggle: (key) => set((st) => ({ [key]: !st[key] }) as Pick<UiState, typeof key>),
  toggleHidden: (id) =>
    set((st) => ({ hidden: flip(st.hidden, id), selection: st.selection.filter((x) => x !== id || st.hidden.includes(id)) })),
  toggleLocked: (id) => set((st) => ({ locked: flip(st.locked, id) })),
  set: (patch) => set(patch),
}));

/** Có thay đổi chưa lưu (so tham chiếu cảnh với lần lưu/nạp cuối). */
export const useDirty = () => {
  const scene = useSceneDoc((s) => s.scene);
  const saved = useEditorUi((s) => s.saved);
  return scene !== saved;
};
