import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchScene, isSampleScene } from '@/data/scene';
import { sceneRepository } from '@/data/sceneRepository';
import { migrateScene } from '@/features/scene/migrate';
import { validateSceneConfig } from '@/features/scene/parse';
import type { SceneConfig } from '@/features/scene/types';
import { clearDraft, readDraft, type EditorDraft } from '@/features/scene-editor/draft';
import { newScene, normalizeScene, uniqueId } from '@/features/scene-editor/ops';
import { loadScene, setSceneSilently, useEditorUi, useSceneDoc, type SceneSource } from '@/features/scene-editor/store';
import { runAction, errorMessage } from '@/lib/actionError';
import type { EditorDialog } from './EditorDialogs';
import { downloadFile } from '@/lib/download';

const ui = () => useEditorUi.getState();

/** Đọc trạng thái "chưa lưu" ngay lúc gọi (ngoài render). */
function isDirtyNow() {
  return useSceneDoc.getState().scene !== useEditorUi.getState().saved;
}

/**
 * Thao tác tệp cảnh của Scene Editor: mở lần đầu (nháp → hỏi khôi phục, không thì `?scene=` hoặc cảnh mới), cảnh mới, mở,
 * lưu / lưu bản mới (cảnh mẫu luôn hỏi id mới), import / export JSON, khôi phục / bỏ nháp. `?scene=` (giữ `?edit=1`) ghi
 * theo cảnh đang mở để tải lại trang mở lại đúng cảnh. Lỗi đi vào `flash`.
 */
export function useSceneFile({ setDialog, flash }: { setDialog: (d: EditorDialog | null) => void; flash: (msg: string) => void }) {
  const [params, setParams] = useSearchParams();
  const [savedIds, setSavedIds] = useState<string[]>([]);

  const setSceneParam = useCallback(
    (id: string | null) =>
      setParams(
        (p) => {
          if (id) p.set('scene', id);
          else p.delete('scene');
          return p;
        },
        { replace: true },
      ),
    [setParams],
  );

  // ----- Nạp / mới / mở -----
  const begin = useCallback((next: SceneConfig, src: SceneSource, saved: SceneConfig | null) => {
    loadScene(next);
    ui().set({ selection: [], hidden: [], locked: [], previewView: null, source: src, saved: saved ?? null });
  }, []);

  const startNew = useCallback(async () => {
    const taken = new Set((await sceneRepository.list()).map((s) => s.id));
    const s = newScene(uniqueId('canh-moi', taken), 'Cảnh mới');
    begin(s, { kind: 'new' }, s);
    setSceneParam(null);
  }, [begin, setSceneParam]);

  const openScene = useCallback(
    async (id: string) => {
      try {
        const s = await fetchScene(id);
        begin(s, isSampleScene(id) ? { kind: 'sample', id } : { kind: 'saved', id }, s);
        setSceneParam(id);
        flash(`Đã mở "${s.name}"`);
      } catch (e) {
        flash(errorMessage(e, String(e)));
        await startNew();
      }
    },
    [begin, setSceneParam, flash, startNew],
  );

  /** Mở `?scene=` hoặc cảnh mới. */
  const openFromUrl = () => {
    const id = params.get('scene');
    void runAction(() => (id ? openScene(id) : startNew()), flash);
  };

  /** Hỏi trước khi bỏ thay đổi chưa lưu. */
  const guard = (title: string, run: () => void) =>
    isDirtyNow()
      ? setDialog({ kind: 'confirm', title, message: 'Cảnh đang sửa có thay đổi chưa lưu. Bỏ các thay đổi đó?', confirmLabel: 'Bỏ thay đổi', run })
      : run();

  // Lần đầu: có bản nháp → hỏi khôi phục; không thì mở ?scene= hoặc cảnh mới. Chạy đúng một lần khi vào trang:
  // `started` chặn chạy lại (vẽ lại, StrictMode chạy effect 2 lần); `openFromUrl` đọc qua ref để luôn là bản mới nhất.
  const started = useRef(false);
  const openFromUrlRef = useRef(openFromUrl);
  openFromUrlRef.current = openFromUrl;
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const draft = readDraft();
    if (draft) setDialog({ kind: 'restore', draft });
    else openFromUrlRef.current();
  }, [setDialog]);

  // ----- Lưu -----
  const doSave = useCallback(
    async (id: string, name: string) => {
      const prev = (await sceneRepository.list()).find((s) => s.id === id);
      const cur = useSceneDoc.getState().scene;
      const next = normalizeScene({ ...cur, id, name, version: prev ? prev.version + 1 : 1 });
      await sceneRepository.save(next);
      setSceneSilently(next);
      ui().set({ saved: next, source: { kind: 'saved', id } });
      clearDraft();
      setSceneParam(id);
      setDialog(null);
      flash(`Đã lưu "${name}" (v${next.version})${validateSceneConfig(next).length ? ' – còn lỗi, Viewer chưa mở được' : ''}`);
    },
    [setSceneParam, setDialog, flash],
  );

  const openSaveAs = useCallback(() => {
    void runAction(async () => setSavedIds((await sceneRepository.list()).map((s) => s.id)), flash);
    setDialog({ kind: 'save-as' });
  }, [setDialog, flash]);

  const save = useCallback(() => {
    const cur = useSceneDoc.getState().scene;
    if (ui().source.kind === 'sample' || isSampleScene(cur.id)) return openSaveAs();
    void runAction(() => doSave(cur.id, cur.name), flash);
  }, [doSave, openSaveAs, flash]);

  // ----- Import / Export -----
  const exportJson = () => {
    const s = normalizeScene(useSceneDoc.getState().scene);
    downloadFile(JSON.stringify(s, null, 2), `${s.id}.json`, 'application/json');
    flash(`Đã xuất ${s.id}.json`);
  };

  const importFile = async (file: File) => {
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch (e) {
      return setDialog({ kind: 'import-error', file: file.name, errors: [`JSON không hợp lệ: ${e instanceof Error ? e.message : e}`] });
    }
    const errs = validateSceneConfig(raw);
    if (errs.length) return setDialog({ kind: 'import-error', file: file.name, errors: errs.map((i) => `${i.where}: ${i.message}`) });
    // Định dạng cũ (không schemaVersion) → migrate như khi nạp từ kho/mock.
    const s = migrateScene(raw as SceneConfig);
    // Cảnh import = chưa lưu (Lưu → kho với id trong file, hoặc hỏi id mới nếu trùng cảnh mẫu).
    begin(s, { kind: 'new' }, null);
    setSceneParam(null);
    flash(`Đã import "${s.name}" (${s.objects.length} object) – chưa lưu`);
  };

  // ----- Bản nháp -----
  const restoreDraft = (d: EditorDraft) => {
    // Bản nháp chưa lưu: `saved` = null (Chưa lưu) để Lưu/autosave tiếp tục đúng.
    begin(d.scene, d.source, null);
    setSceneParam(d.source.kind === 'new' ? null : d.source.id);
    setDialog(null);
    flash(`Đã khôi phục bản nháp "${d.scene.name}"`);
  };
  const discardDraft = () => {
    clearDraft();
    setDialog(null);
    openFromUrl();
  };

  return {
    savedIds,
    /** Cảnh mới (hỏi nếu chưa lưu). */
    newScene: () => guard('Tạo cảnh mới?', () => void runAction(startNew, flash)),
    /** Mở cảnh theo id (từ hộp thoại Mở). */
    open: (id: string) => {
      setDialog(null);
      void runAction(() => openScene(id), flash);
    },
    remove: (id: string) =>
      runAction(async () => {
        await sceneRepository.remove(id);
        flash(`Đã xoá cảnh "${id}" khỏi trình duyệt`);
      }, flash),
    save,
    openSaveAs,
    saveAs: (id: string, name: string) => void runAction(() => doSave(id, name), flash),
    /** Import tệp JSON (hỏi nếu chưa lưu). */
    importJson: (f: File) => guard('Import cảnh?', () => void runAction(() => importFile(f), flash)),
    exportJson,
    restoreDraft,
    discardDraft,
  };
}
