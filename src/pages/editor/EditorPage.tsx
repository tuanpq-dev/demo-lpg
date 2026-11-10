import { useCallback, useMemo, useRef, useState } from 'react';
import { Card } from '@/components';
import { Page } from '@/app/Page';
import { SENSOR_TAGS } from '@/data/scene';
import type { SceneViewerHandle } from '@/features/scene';
import { addView } from '@/features/scene-editor/ops';
import { useDirty, useEditorUi, useSceneDoc } from '@/features/scene-editor/store';
import { checkScene } from '@/features/scene-editor/validate';
import { useNotice } from '@/lib/useNotice';
import { AssetLibrary } from './AssetLibrary';
import { EditorDialogs, type EditorDialog } from './EditorDialogs';
import { EditorFileBar } from './EditorFileBar';
import { EditorSidePanel, type EditorPanelId } from './EditorSidePanel';
import { EditorStatusBar } from './EditorStatusBar';
import { EditorViewport } from './EditorViewport';
import { Outliner } from './Outliner';
import { useEditorActions, type DeleteImpact } from './useEditorActions';
import { useDraftAutosave, useLeaveGuard, usePruneSelection } from './useEditorSession';
import { useEditorShortcuts } from './useEditorShortcuts';
import { useSceneFile } from './useSceneFile';

/**
 * Scene Editor (/editor, chỉ bật khi ?edit=1 hoặc VITE_SCENE_EDITOR=true – xem app/editorAccess).
 * Trên: thanh tệp (EditorFileBar) · trái: thư viện asset + cây object · giữa: canvas (SceneViewer dùng chung) + thanh trạng
 * thái (EditorStatusBar) · phải: Thuộc tính / Góc nhìn / Kiểm tra (EditorSidePanel) · hộp thoại: EditorDialogs.
 * Lưu qua `sceneRepository` (localStorage, `useSceneFile`), tự lưu nháp mỗi 3 giây, phím tắt `useEditorShortcuts`.
 */
export default function EditorPage() {
  const viewer = useRef<SceneViewerHandle>(null);
  const [dialog, setDialog] = useState<EditorDialog | null>(null);
  // Xoá object có ống nối / ống có object gắn → hỏi giữ hay xoá ống.
  const confirmDelete = useCallback(
    (impact: DeleteImpact, run: (pipes: 'keep' | 'delete') => void) => setDialog({ kind: 'delete', impact, run }),
    [],
  );
  const actions = useEditorActions(viewer, confirmDelete);
  const scene = useSceneDoc((s) => s.scene);
  const source = useEditorUi((s) => s.source);
  const selection = useEditorUi((s) => s.selection);
  const dirty = useDirty();
  const [panel, setPanel] = useState<EditorPanelId>('props');
  const issues = useMemo(() => checkScene(scene, SENSOR_TAGS), [scene]);
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const { notice, flash } = useNotice();
  const file = useSceneFile({ setDialog, flash });

  useEditorShortcuts({ actions, save: file.save, flash });
  usePruneSelection(scene);
  // Không ghi nháp khi đang hỏi khôi phục bản nháp cũ.
  const dialogKind = dialog?.kind ?? null;
  useDraftAutosave(() => dialogKind === 'restore');
  const blocker = useLeaveGuard(dirty);

  const addCurrentView = (label: string) => {
    const camera = viewer.current?.getCamera();
    if (!camera) return;
    const { scene: next, id } = addView(useSceneDoc.getState().scene, label, camera);
    useSceneDoc.getState().setScene(next);
    setDialog(null);
    flash(`Đã thêm view "${label}" (${id})`);
  };

  return (
    <Page
      variant="workspace"
      pageHeader={
        <EditorFileBar
          source={source}
          errorCount={errorCount}
          onNew={file.newScene}
          onOpen={() => setDialog({ kind: 'open' })}
          onSave={file.save}
          onSaveAs={file.openSaveAs}
          onImport={file.importJson}
          onExport={file.exportJson}
        />
      }
    >
      {/* < xl: 2 cột bên hẹp lại để canvas còn chỗ; ≥ xl như thiết kế 264 | canvas | 340. */}
      <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)_288px] gap-3 xl:grid-cols-[264px_minmax(0,1fr)_340px]">
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
          <EditorStatusBar
            scene={scene}
            dirty={dirty}
            selectionCount={selection.length}
            errorCount={errorCount}
            warningCount={issues.length - errorCount}
            source={source}
            notice={notice}
            onShowIssues={() => setPanel('issues')}
          />
        </div>

        <EditorSidePanel
          panel={panel}
          onPanelChange={setPanel}
          viewer={viewer}
          actions={actions}
          issues={issues}
          errorCount={errorCount}
          onAddView={() => setDialog({ kind: 'view-name' })}
        />
      </div>

      <EditorDialogs
        dialog={dialog}
        scene={scene}
        dirty={dirty}
        savedIds={file.savedIds}
        blocker={blocker}
        onClose={() => setDialog(null)}
        onOpen={file.open}
        onRemove={file.remove}
        onSaveAs={file.saveAs}
        onAddView={addCurrentView}
        onRestore={file.restoreDraft}
        onDiscardDraft={file.discardDraft}
      />
    </Page>
  );
}
