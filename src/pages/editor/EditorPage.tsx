import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useBlocker, useSearchParams } from 'react-router-dom';
import { useStore } from 'zustand';
import {
  Button,
  Card,
  ExportIcon,
  FilePlusIcon,
  FolderIcon,
  ImportIcon,
  RedoIcon,
  SaveIcon,
  Tabs,
  UndoIcon,
} from '@/components';
import { Page } from '@/app/Page';
import { fetchScene, isSampleScene, SENSOR_TAGS } from '@/data/scene';
import { sceneRepository } from '@/data/sceneRepository';
import type { SceneViewerHandle } from '@/features/scene';
import { migrateScene } from '@/features/scene/migrate';
import { validateSceneConfig } from '@/features/scene/parse';
import type { SceneConfig } from '@/features/scene/types';
import { AUTOSAVE_MS, clearDraft, readDraft, writeDraft, type EditorDraft } from '@/features/scene-editor/draft';
import { addView, newScene, normalizeScene, uniqueId } from '@/features/scene-editor/ops';
import { loadScene, redo, setSceneSilently, undo, useDirty, useEditorUi, useSceneDoc, type SceneSource } from '@/features/scene-editor/store';
import { checkScene } from '@/features/scene-editor/validate';
import { AssetLibrary } from './AssetLibrary';
import { ConfirmDialog, ImportErrorDialog, NameDialog, OpenSceneDialog, RestoreDraftDialog, SaveAsDialog } from './dialogs';
import { EditorViewport } from './EditorViewport';
import { Outliner } from './Outliner';
import { PropertiesPanel } from './PropertiesPanel';
import { useEditorActions } from './useEditorActions';
import { ValidationPanel } from './ValidationPanel';
import { ViewsPanel } from './ViewsPanel';

type Dialog =
  | { kind: 'open' }
  | { kind: 'save-as' }
  | { kind: 'view-name' }
  | { kind: 'restore'; draft: EditorDraft }
  | { kind: 'confirm'; title: string; message: string; confirmLabel: string; run: () => void }
  | { kind: 'import-error'; file: string; errors: string[] };

type PanelId = 'props' | 'views' | 'issues';

/** Đang gõ trong ô nhập → không bắt phím tắt. */
const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

const ui = () => useEditorUi.getState();

/**
 * Scene Editor (/editor, chỉ bật khi ?edit=1 hoặc VITE_SCENE_EDITOR=true – xem app/editorAccess).
 * Trái: thư viện asset + cây object · giữa: canvas (SceneViewer dùng chung) + thanh trạng thái ·
 * phải: Thuộc tính / Góc nhìn / Kiểm tra. Lưu qua `sceneRepository` (localStorage), tự lưu nháp mỗi 3 giây.
 */
export default function EditorPage() {
  const viewer = useRef<SceneViewerHandle>(null);
  const actions = useEditorActions(viewer);
  const scene = useSceneDoc((s) => s.scene);
  const source = useEditorUi((s) => s.source);
  const selection = useEditorUi((s) => s.selection);
  const dirty = useDirty();
  const canUndo = useStore(useSceneDoc.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useSceneDoc.temporal, (s) => s.futureStates.length > 0);
  const [params, setParams] = useSearchParams();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [panel, setPanel] = useState<PanelId>('props');
  const [notice, setNotice] = useState<string>('');
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const issues = useMemo(() => checkScene(scene, SENSOR_TAGS), [scene]);
  const errorCount = issues.filter((i) => i.severity === 'error').length;

  const flash = useCallback((msg: string) => setNotice(msg), []);
  // Dev: test tương tác đọc state/chiếu toạ độ (playwright). Không có ở bản build.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    Object.assign(window, { __sceneEditor: { doc: useSceneDoc, ui: useEditorUi, viewer } });
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  /** Ghi ?scene= (giữ ?edit=1) để tải lại trang mở lại đúng cảnh. */
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
        flash(e instanceof Error ? e.message : String(e));
        await startNew();
      }
    },
    [begin, setSceneParam, flash, startNew],
  );

  /** Hỏi trước khi bỏ thay đổi chưa lưu. */
  const guard = (title: string, run: () => void) =>
    isDirtyNow() ? setDialog({ kind: 'confirm', title, message: 'Cảnh đang sửa có thay đổi chưa lưu. Bỏ các thay đổi đó?', confirmLabel: 'Bỏ thay đổi', run }) : run();

  // Lần đầu: có bản nháp → hỏi khôi phục; không thì mở ?scene= hoặc cảnh mới.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const draft = readDraft();
    if (draft) setDialog({ kind: 'restore', draft });
    else {
      const id = params.get('scene');
      void (id ? openScene(id) : startNew());
    }
    // Chỉ chạy một lần khi vào trang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    [setSceneParam, flash],
  );

  const openSaveAs = useCallback(() => {
    void sceneRepository.list().then((l) => setSavedIds(l.map((s) => s.id)));
    setDialog({ kind: 'save-as' });
  }, []);

  const save = useCallback(() => {
    const cur = useSceneDoc.getState().scene;
    if (ui().source.kind === 'sample' || isSampleScene(cur.id)) return openSaveAs();
    void doSave(cur.id, cur.name);
  }, [doSave, openSaveAs]);

  // ----- Import / Export -----
  const exportJson = () => {
    const s = normalizeScene(useSceneDoc.getState().scene);
    const url = URL.createObjectURL(new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${s.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
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

  // ----- Views -----
  const addCurrentView = (label: string) => {
    const camera = viewer.current?.getCamera();
    if (!camera) return;
    const { scene: next, id } = addView(useSceneDoc.getState().scene, label, camera);
    useSceneDoc.getState().setScene(next);
    setDialog(null);
    flash(`Đã thêm view "${label}" (${id})`);
  };

  // ----- Phím tắt (không chạy khi đang gõ / có hộp thoại) -----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (document.querySelector('[role="dialog"]')) return;
      // Ctrl+S chạy cả khi đang ở ô nhập: rời ô trước (ô số/chữ chốt giá trị khi blur) rồi mới lưu.
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (isTyping(e.target)) (e.target as HTMLElement).blur();
        window.setTimeout(save, 0);
        return;
      }
      if (isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      let handled = true;
      if (mod && k === 'z' && e.shiftKey) redo();
      else if (mod && k === 'z') undo();
      else if (mod && k === 'y') redo();
      else if (mod && k === 'd') actions.duplicateSelection();
      else if (mod && k === 'c') {
        const n = actions.copySelection();
        if (n) flash(`Đã copy ${n} object`);
      } else if (mod && k === 'v') actions.paste();
      else if (mod && k === 'a') actions.selectAll();
      else if (mod || e.altKey) handled = false;
      else if (k === 'q') ui().setTool('select');
      else if (k === 'w') ui().setTool('translate');
      else if (k === 'e') ui().setTool('rotate');
      else if (k === 'r') ui().setTool('scale');
      else if (k === 'g') ui().toggle('grid');
      else if (k === 'f') actions.fit();
      else if (e.key === 'Delete' || e.key === 'Backspace') actions.deleteSelection();
      else if (e.key === 'Escape') ui().setSelection([]);
      else handled = false;
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actions, save, flash]);

  // Bỏ id không còn tồn tại khỏi selection (sau undo/xoá).
  useEffect(() => {
    const ids = new Set(scene.objects.map((o) => o.id));
    const sel = ui().selection;
    if (sel.some((id) => !ids.has(id))) ui().setSelection(sel.filter((id) => ids.has(id)));
  }, [scene]);

  // ----- Tự lưu nháp (không ghi khi đang hỏi khôi phục bản nháp cũ) -----
  const dialogOpenRef = useRef<string | null>(null);
  dialogOpenRef.current = dialog?.kind ?? null;
  const lastDraft = useRef<SceneConfig | null>(null);
  useEffect(() => {
    const t = window.setInterval(() => {
      const cur = useSceneDoc.getState().scene;
      const st = ui();
      if (dialogOpenRef.current === 'restore') return;
      if (cur === st.saved) return clearDraft();
      if (cur !== lastDraft.current) {
        writeDraft(cur, st.source);
        lastDraft.current = cur;
      }
    }, AUTOSAVE_MS);
    return () => window.clearInterval(t);
  }, []);

  // ----- Rời trang khi chưa lưu -----
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty]);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);

  const restoreDraft = (d: EditorDraft) => {
    // Bản nháp chưa lưu: `saved` = null (Chưa lưu) để Lưu/autosave tiếp tục đúng.
    begin(d.scene, d.source, null);
    setSceneParam(d.source.kind === 'new' ? null : d.source.id);
    setDialog(null);
    flash(`Đã khôi phục bản nháp "${d.scene.name}"`);
  };

  const sourceLabel =
    source.kind === 'sample' ? 'cảnh mẫu (chỉ đọc)' : source.kind === 'saved' ? 'đã lưu trong trình duyệt' : 'chưa có trong kho';

  const fileBar = (
    <div role="toolbar" aria-label="Tệp cảnh" className="flex flex-wrap items-center gap-2">
      <h1 className="mr-2 text-lg font-semibold text-fg">Scene Editor</h1>
      <Button variant="ghost" size="sm" icon={<FilePlusIcon />} onClick={() => guard('Tạo cảnh mới?', () => void startNew())}>
        Cảnh mới
      </Button>
      <Button variant="ghost" size="sm" icon={<FolderIcon />} onClick={() => setDialog({ kind: 'open' })}>
        Mở…
      </Button>
      <Button size="sm" icon={<SaveIcon />} onClick={save} title="Lưu (Ctrl+S)">
        Lưu
      </Button>
      <Button variant="ghost" size="sm" onClick={openSaveAs}>
        Lưu thành bản mới…
      </Button>
      <span aria-hidden="true" className="mx-1 h-6 w-px bg-line/60" />
      <Button variant="ghost" size="sm" icon={<ImportIcon />} onClick={() => fileInput.current?.click()}>
        Import JSON
      </Button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-label="Chọn tệp JSON để import"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) guard('Import cảnh?', () => void importFile(f));
        }}
      />
      <Button variant="ghost" size="sm" icon={<ExportIcon />} onClick={exportJson}>
        Export JSON
      </Button>
      <span aria-hidden="true" className="mx-1 h-6 w-px bg-line/60" />
      <Button variant="toolbar" size="sm" aria-label="Hoàn tác (Ctrl+Z)" title="Hoàn tác (Ctrl+Z)" disabled={!canUndo} onClick={undo} icon={<UndoIcon />} />
      <Button
        variant="toolbar"
        size="sm"
        aria-label="Làm lại (Ctrl+Shift+Z)"
        title="Làm lại (Ctrl+Shift+Z)"
        disabled={!canRedo}
        onClick={redo}
        icon={<RedoIcon />}
      />
      {source.kind === 'saved' && !errorCount && (
        <Link to={`/overview?scene=${source.id}`} className="ml-auto text-sm text-accent hover:underline">
          Xem ở Tổng quan →
        </Link>
      )}
    </div>
  );

  return (
    <Page variant="workspace" pageHeader={fileBar}>
      <div className="grid min-h-0 flex-1 grid-cols-[264px_minmax(0,1fr)_340px] gap-3">
        <aside className="flex min-h-0 flex-col gap-3" aria-label="Thư viện và cây object">
          <Card title="Thư viện asset" className="min-h-0 flex-[1.2]" bodyClassName="min-h-0 p-3">
            <AssetLibrary onAdd={(a) => actions.addAsset(a)} />
          </Card>
          <Card title="Cây object" className="min-h-0 flex-1" bodyClassName="min-h-0 overflow-y-auto p-1.5">
            <Outliner onRename={actions.rename} />
          </Card>
        </aside>

        <div className="flex min-h-0 flex-col gap-2">
          <div className="min-h-0 flex-1">
            <EditorViewport viewer={viewer} actions={actions} />
          </div>
          <footer
            aria-label="Trạng thái"
            className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-line/30 bg-surface px-3 py-1.5 text-sm text-fg-secondary"
          >
            <span className="font-semibold text-fg">{scene.name}</span>
            <span className="font-mono text-xs">{scene.id}</span>
            <span>v{scene.version}</span>
            <span className={dirty ? 'text-warning' : 'text-success'}>{dirty ? '● Chưa lưu' : '✓ Đã lưu'}</span>
            <span>{scene.objects.length} object</span>
            {selection.length > 0 && <span>{selection.length} đang chọn</span>}
            <button type="button" className="hover:underline" onClick={() => setPanel('issues')}>
              {errorCount} lỗi · {issues.length - errorCount} cảnh báo
            </button>
            <span className="text-fg-muted">{sourceLabel}</span>
            <span role="status" aria-live="polite" className="ml-auto text-accent">
              {notice}
            </span>
          </footer>
        </div>

        <aside className="flex min-h-0 flex-col" aria-label="Thuộc tính">
          <Card className="min-h-0 flex-1" padding="none" bodyClassName="min-h-0">
            <Tabs
              label="Bảng bên phải"
              panelId="editor-panel"
              items={[
                { id: 'props', label: 'Thuộc tính' },
                { id: 'views', label: 'Góc nhìn', count: scene.views?.length ?? 0 },
                { id: 'issues', label: 'Kiểm tra', count: issues.length, countTone: errorCount ? 'danger' : 'neutral' },
              ]}
              value={panel}
              onChange={(id) => setPanel(id as PanelId)}
              className="px-3"
            />
            <div id="editor-panel" role="tabpanel" className="min-h-0 flex-1 overflow-y-auto p-3">
              {panel === 'props' && (
                <PropertiesPanel
                  actions={actions}
                  onUseCurrentCamera={() => {
                    const camera = viewer.current?.getCamera();
                    if (camera) useSceneDoc.getState().setScene((s) => ({ ...s, camera }));
                  }}
                />
              )}
              {panel === 'views' && (
                <ViewsPanel getCamera={() => viewer.current?.getCamera() ?? null} onAddView={() => setDialog({ kind: 'view-name' })} />
              )}
              {panel === 'issues' && (
                <ValidationPanel
                  issues={issues}
                  onPick={(id) => {
                    ui().setSelection([id]);
                    viewer.current?.fit([id]);
                  }}
                />
              )}
            </div>
          </Card>
        </aside>
      </div>

      <OpenSceneDialog
        open={dialog?.kind === 'open'}
        dirty={dirty}
        onClose={() => setDialog(null)}
        onOpen={(id) => {
          setDialog(null);
          void openScene(id);
        }}
        onRemove={async (id) => {
          await sceneRepository.remove(id);
          flash(`Đã xoá cảnh "${id}" khỏi trình duyệt`);
        }}
      />
      <SaveAsDialog
        open={dialog?.kind === 'save-as'}
        initialId={isSampleScene(scene.id) ? `${scene.id}-ban-sao` : scene.id}
        initialName={scene.name}
        existingIds={savedIds}
        onClose={() => setDialog(null)}
        onSave={(id, name) => void doSave(id, name)}
      />
      <NameDialog
        open={dialog?.kind === 'view-name'}
        title="Lưu góc nhìn hiện tại thành view"
        label="Tên view (hiện trên nút ở Viewer)"
        initial={`Góc nhìn ${(scene.views?.length ?? 0) + 1}`}
        submitLabel="Thêm view"
        onClose={() => setDialog(null)}
        onSubmit={addCurrentView}
      />
      <RestoreDraftDialog
        draft={dialog?.kind === 'restore' ? dialog.draft : null}
        onRestore={() => dialog?.kind === 'restore' && restoreDraft(dialog.draft)}
        onDiscard={() => {
          clearDraft();
          setDialog(null);
          const id = params.get('scene');
          void (id ? openScene(id) : startNew());
        }}
      />
      <ImportErrorDialog
        file={dialog?.kind === 'import-error' ? dialog.file : ''}
        errors={dialog?.kind === 'import-error' ? dialog.errors : null}
        onClose={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog?.kind === 'confirm'}
        title={dialog?.kind === 'confirm' ? dialog.title : ''}
        confirmLabel={dialog?.kind === 'confirm' ? dialog.confirmLabel : ''}
        danger
        onClose={() => setDialog(null)}
        onConfirm={() => {
          if (dialog?.kind !== 'confirm') return;
          setDialog(null);
          dialog.run();
        }}
      >
        {dialog?.kind === 'confirm' ? dialog.message : ''}
      </ConfirmDialog>
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="Rời Scene Editor?"
        confirmLabel="Rời trang"
        danger
        onClose={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      >
        Có thay đổi chưa lưu (bản nháp tự lưu vẫn còn để khôi phục lần sau). Rời trang?
      </ConfirmDialog>
    </Page>
  );
}

/** Đọc trạng thái "chưa lưu" ngay lúc gọi (ngoài render). */
function isDirtyNow() {
  return useSceneDoc.getState().scene !== useEditorUi.getState().saved;
}
