import type { RefObject } from 'react';
import { Card, Tabs } from '@/components';
import type { SceneViewerHandle } from '@/features/scene';
import type { EditorIssue } from '@/features/scene-editor/validate';
import { useEditorUi, useSceneDoc } from '@/features/scene-editor/store';
import { PropertiesPanel } from './PropertiesPanel';
import type { EditorActions } from './useEditorActions';
import { ValidationPanel } from './ValidationPanel';
import { ViewsPanel } from './ViewsPanel';

export type EditorPanelId = 'props' | 'views' | 'issues';

export type EditorSidePanelProps = {
  panel: EditorPanelId;
  onPanelChange: (id: EditorPanelId) => void;
  viewer: RefObject<SceneViewerHandle>;
  actions: EditorActions;
  issues: EditorIssue[];
  errorCount: number;
  /** Mở hộp thoại đặt tên view mới. */
  onAddView: () => void;
};

/** Cột phải: tab Thuộc tính / Góc nhìn / Kiểm tra (bấm lỗi → chọn + căn khung object). */
export function EditorSidePanel({ panel, onPanelChange, viewer, actions, issues, errorCount, onAddView }: EditorSidePanelProps) {
  const viewCount = useSceneDoc((s) => s.scene.views?.length ?? 0);
  return (
    <aside className="flex min-h-0 flex-col" aria-label="Thuộc tính">
      <Card className="min-h-0 flex-1" padding="none" bodyClassName="min-h-0">
        <Tabs
          label="Bảng bên phải"
          panelId="editor-panel"
          items={[
            { id: 'props', label: 'Thuộc tính' },
            { id: 'views', label: 'Góc nhìn', count: viewCount },
            { id: 'issues', label: 'Kiểm tra', count: issues.length, countTone: errorCount ? 'danger' : 'neutral' },
          ]}
          value={panel}
          onChange={(id) => onPanelChange(id as EditorPanelId)}
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
          {panel === 'views' && <ViewsPanel getCamera={() => viewer.current?.getCamera() ?? null} onAddView={onAddView} />}
          {panel === 'issues' && (
            <ValidationPanel
              issues={issues}
              onPick={(id) => {
                useEditorUi.getState().setSelection([id]);
                viewer.current?.fit([id]);
              }}
            />
          )}
        </div>
      </Card>
    </aside>
  );
}
