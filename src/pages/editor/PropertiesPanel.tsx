import { Button, DuplicateIcon, TrashIcon } from '@/components';
import { useEditorUi, useSceneDoc } from '@/features/scene-editor/store';
import type { EditorActions } from './useEditorActions';
import { GroupPlacement } from './properties/GroupPlacement';
import { ObjectProperties } from './properties/ObjectProperties';
import { PipeProperties } from './properties/PipeProperties';
import { SceneProperties } from './properties/SceneProperties';

export type PropertiesPanelProps = {
  actions: EditorActions;
  /** Lấy góc nhìn hiện tại của canvas làm camera mặc định của cảnh. */
  onUseCurrentCamera: () => void;
};

/** Cột phải: thuộc tính object đang chọn (1 · nhiều) hoặc thuộc tính cảnh khi không chọn gì. */
export function PropertiesPanel({ actions, onUseCurrentCamera }: PropertiesPanelProps) {
  const objects = useSceneDoc((s) => s.scene.objects);
  const pipes = useSceneDoc((s) => s.scene.pipes);
  const selection = useEditorUi((s) => s.selection);
  const picked = objects.filter((o) => selection.includes(o.id));
  const pickedPipe = selection.length === 1 ? pipes.find((p) => p.id === selection[0]) : undefined;

  if (pickedPipe) return <PipeProperties key={pickedPipe.id} pipe={pickedPipe} actions={actions} />;
  if (picked.length === 1) return <ObjectProperties key={picked[0]!.id} obj={picked[0]!} actions={actions} />;
  if (picked.length > 1)
    return (
      <div className="flex flex-col gap-3">
        <p className="text-base font-semibold text-fg">{picked.length} object đang chọn</p>
        <p className="text-sm text-fg-muted">{picked.map((o) => o.id).join(', ')}</p>
        <p className="text-sm text-fg-muted">Di chuyển (W): kéo một object trong nhóm – cả nhóm trượt trên sàn. Xoay/scale: gizmo quanh trọng tâm.</p>
        <GroupPlacement picked={picked} actions={actions} />
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" icon={<DuplicateIcon />} onClick={actions.duplicateSelection}>
            Nhân bản
          </Button>
          <Button variant="ghost" size="sm" icon={<TrashIcon />} onClick={actions.deleteSelection}>
            Xoá
          </Button>
        </div>
      </div>
    );
  return <SceneProperties onUseCurrentCamera={onUseCurrentCamera} />;
}
