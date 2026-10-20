import { useMemo, type RefObject } from 'react';
import type { SceneViewerHandle } from '@/features/scene';
import type { ObjectTransform } from '@/features/scene/EditTools';
import type { AssetType, SceneConfig, SceneObject, Vec3 } from '@/features/scene/types';
import {
  addObjects,
  applyTransforms,
  cloneObjects,
  createObject,
  objectIds,
  removeObjects,
  renameObject,
  SNAP,
  snapVec,
  updateObject,
  OBJECT_ID_PATTERN,
} from '@/features/scene-editor/ops';
import { useEditorUi, useSceneDoc } from '@/features/scene-editor/store';

/** Độ dời khi nhân bản / dán (m). */
const CLONE_OFFSET: Vec3 = [1, 0, 1];

const doc = () => useSceneDoc.getState();
const ui = () => useEditorUi.getState();

/**
 * Thao tác của Editor trên store (mỗi thao tác = 1 lần setScene = 1 bước undo).
 * `viewer` để lấy điểm sàn ở tâm khung (thêm asset bằng click) và khung hình vừa.
 */
export function useEditorActions(viewer: RefObject<SceneViewerHandle>) {
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

      deleteSelection() {
        const ids = ui().selection;
        if (!ids.length) return;
        setScene((s) => removeObjects(s, ids));
        const { hidden, locked } = ui();
        ui().set({ selection: [], hidden: hidden.filter((h) => !ids.includes(h)), locked: locked.filter((l) => !ids.includes(l)) });
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

      updateObject(id: string, fn: (o: SceneObject) => SceneObject) {
        setScene((s) => updateObject(s, id, fn));
      },

      /** Đổi id (cập nhật view/ống trỏ tới) – trả về lỗi nếu không hợp lệ. */
      rename(id: string, next: string): string | undefined {
        if (next === id) return undefined;
        if (!OBJECT_ID_PATTERN.test(next)) return 'Chỉ dùng chữ, số, "-" và "_" (không khoảng trắng, không dấu chấm)';
        const renamed = renameObject(doc().scene, id, next);
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
  }, [viewer]);
}

export type EditorActions = ReturnType<typeof useEditorActions>;
