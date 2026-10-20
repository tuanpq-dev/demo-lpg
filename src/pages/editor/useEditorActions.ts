import { useMemo, type RefObject } from 'react';
import type { SceneViewerHandle } from '@/features/scene';
import type { ObjectTransform } from '@/features/scene/EditTools';
import type { AssetType, Pipe, PipeAttachment, SceneConfig, SceneObject, Vec3 } from '@/features/scene/types';
import {
  addObjects,
  addPipe,
  alignObjects,
  applyTransforms,
  attachToPipe,
  detachFromPipe,
  insertPipePoint,
  objectsOnPipes,
  pipesConnectedTo,
  removePipes,
  renamePipe,
  reversePipe,
  updatePipe,
  type PipeDraft,
  cloneObjects,
  createObject,
  objectIds,
  removeObjects,
  renameObject,
  setElevation,
  SNAP,
  type AlignAxis,
  snapVec,
  updateObject,
  OBJECT_ID_PATTERN,
} from '@/features/scene-editor/ops';
import { useEditorUi, useSceneDoc } from '@/features/scene-editor/store';

/** Độ dời khi nhân bản / dán (m). */
const CLONE_OFFSET: Vec3 = [1, 0, 1];

const doc = () => useSceneDoc.getState();
const ui = () => useEditorUi.getState();

/** Ảnh hưởng của lệnh xoá: ống nối vào object bị xoá, object gắn trên ống bị xoá. */
export type DeleteImpact = { objects: string[]; pipes: string[]; connected: string[]; attached: string[] };

/**
 * Thao tác của Editor trên store (mỗi thao tác = 1 lần setScene = 1 bước undo).
 * `viewer` để lấy điểm sàn ở tâm khung (thêm asset bằng click) và khung hình vừa.
 * `confirmDelete`: xoá có ống nối/object gắn ống → hỏi (Giữ ống / Xoá cả ống); không truyền → giữ ống.
 */
export function useEditorActions(
  viewer: RefObject<SceneViewerHandle>,
  confirmDelete?: (impact: DeleteImpact, run: (pipes: 'keep' | 'delete') => void) => void,
) {
  return useMemo(() => {
    const setScene = (fn: (s: SceneConfig) => SceneConfig) => doc().setScene(fn);

    const addAsset = (asset: AssetType, at?: Vec3) => {
      const raw = at ?? viewer.current?.pickGround() ?? [0, 0, 0];
      const pos = ui().snap ? snapVec(raw, SNAP.translate) : raw;
      const obj = createObject(asset, pos, objectIds(doc().scene));
      setScene((s) => addObjects(s, [obj]));
      ui().set({ selection: [obj.id], tool: ui().tool === 'select' ? 'translate' : ui().tool });
      return obj.id;
    };

    const insertClones = (objs: readonly SceneObject[]) => {
      if (!objs.length) return [];
      const clones = cloneObjects(objs, objectIds(doc().scene), CLONE_OFFSET);
      setScene((s) => addObjects(s, clones));
      ui().setSelection(clones.map((c) => c.id));
      return clones;
    };

    const selectedObjects = () => {
      const sel = new Set(ui().selection);
      return doc().scene.objects.filter((o) => sel.has(o.id));
    };

    return {
      addAsset,

      /** Xoá object + ống đang chọn (1 bước undo). Ống nối vào object → hỏi giữ (đầu thành điểm tự do) hay xoá. */
      deleteSelection() {
        const ids = ui().selection;
        if (!ids.length) return;
        const scene = doc().scene;
        const objs = ids.filter((id) => scene.objects.some((o) => o.id === id));
        const pipes = ids.filter((id) => scene.pipes.some((p) => p.id === id));
        const connected = pipesConnectedTo(scene, objs)
          .map((p) => p.id)
          .filter((id) => !pipes.includes(id));
        const attached = objectsOnPipes(scene, pipes)
          .map((o) => o.id)
          .filter((id) => !objs.includes(id));
        const run = (mode: 'keep' | 'delete') => {
          setScene((s) => {
            const n = pipes.length ? removePipes(s, pipes) : s;
            return objs.length ? removeObjects(n, objs, mode) : n;
          });
          const { hidden, locked } = ui();
          ui().set({ selection: [], hidden: hidden.filter((h) => !ids.includes(h)), locked: locked.filter((l) => !ids.includes(l)) });
        };
        if ((connected.length || attached.length) && confirmDelete) confirmDelete({ objects: objs, pipes, connected, attached }, run);
        else run('keep');
      },

      duplicateSelection() {
        return insertClones(selectedObjects());
      },

      /** Copy vào clipboard của Editor (+ clipboard hệ thống dạng JSON, nếu được phép). */
      copySelection() {
        const objs = selectedObjects();
        if (!objs.length) return 0;
        ui().set({ clipboard: structuredClone(objs) });
        void navigator.clipboard?.writeText(JSON.stringify(objs, null, 2)).catch(() => undefined);
        return objs.length;
      },

      /** Dán bản sao (id mới, dời 1 m); clipboard trỏ sang bản vừa dán → dán tiếp sẽ dời thêm. */
      paste() {
        const clip = ui().clipboard;
        if (!clip?.length) return [];
        const clones = insertClones(clip);
        ui().set({ clipboard: clones });
        return clones;
      },

      transform(changes: ObjectTransform[]) {
        setScene((s) => applyTransforms(s, changes));
      },

      /** Độ cao đáy (m) cho object đang chọn (hoặc `ids`); 0 = Đặt xuống sàn. */
      setElevation(elevation: number, ids: readonly string[] = ui().selection) {
        setScene((s) => setElevation(s, ids, elevation));
      },

      /** Căn hàng nhóm đang chọn theo trục X hoặc Z (cùng elevation, phân bố đều). */
      align(axis: AlignAxis) {
        setScene((s) => alignObjects(s, ui().selection, axis, ui().snap));
      },

      updateObject(id: string, fn: (o: SceneObject) => SceneObject) {
        setScene((s) => updateObject(s, id, fn));
      },

      // ----- Ống (3D-4) -----
      /** Kết thúc vẽ ống → thêm ống, chọn ống mới. */
      createPipe(draft: PipeDraft) {
        let id = '';
        setScene((s) => {
          const r = addPipe(s, draft);
          id = r.id;
          return r.scene;
        });
        ui().setSelection([id]);
        return id;
      },

      updatePipe(id: string, fn: (p: Pipe) => Pipe) {
        setScene((s) => updatePipe(s, id, fn));
      },

      insertPipePoint(id: string, at: Vec3) {
        setScene((s) => insertPipePoint(s, id, at));
      },

      reversePipe(id: string) {
        setScene((s) => reversePipe(s, id));
      },

      /** Kéo object gắn ống dọc ống (đổi t). */
      setAttach(id: string, attach: PipeAttachment) {
        setScene((s) => updateObject(s, id, (o) => ({ ...o, attach })));
      },

      attachToPipe(id: string, pipeId: string) {
        setScene((s) => attachToPipe(s, id, pipeId));
      },

      detachFromPipe(id: string) {
        setScene((s) => detachFromPipe(s, id));
      },

      /** Đổi id object hoặc ống (cập nhật view/ống/attach trỏ tới) – trả về lỗi nếu không hợp lệ. */
      rename(id: string, next: string): string | undefined {
        if (next === id) return undefined;
        if (!OBJECT_ID_PATTERN.test(next)) return 'Chỉ dùng chữ, số, "-" và "_" (không khoảng trắng, không dấu chấm)';
        const isPipe = doc().scene.pipes.some((p) => p.id === id);
        const renamed = isPipe ? renamePipe(doc().scene, id, next) : renameObject(doc().scene, id, next);
        if (!renamed) return `id "${next}" đã tồn tại`;
        doc().setScene(renamed);
        const swap = (list: string[]) => list.map((x) => (x === id ? next : x));
        const { selection, hidden, locked } = ui();
        ui().set({ selection: swap(selection), hidden: swap(hidden), locked: swap(locked) });
        return undefined;
      },

      selectAll() {
        const skip = new Set([...ui().hidden, ...ui().locked]);
        ui().setSelection(doc().scene.objects.map((o) => o.id).filter((id) => !skip.has(id)));
      },

      fit() {
        viewer.current?.fit(ui().selection);
      },
    };
  }, [viewer, confirmDelete]);
}

export type EditorActions = ReturnType<typeof useEditorActions>;
