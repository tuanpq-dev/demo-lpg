import type { Blocker } from 'react-router-dom';
import type { EditorDraft } from '@/features/scene-editor/draft';
import { isSampleScene } from '@/data/scene';
import type { SceneConfig } from '@/features/scene/types';
import { ConfirmDialog, ImportErrorDialog, NameDialog, OpenSceneDialog, RestoreDraftDialog, SaveAsDialog } from './dialogs';
import type { DeleteImpact } from './useEditorActions';

/** Hộp thoại đang mở của Scene Editor (một lúc một cái). */
export type EditorDialog =
  | { kind: 'open' }
  | { kind: 'save-as' }
  | { kind: 'view-name' }
  | { kind: 'restore'; draft: EditorDraft }
  | { kind: 'confirm'; title: string; message: string; confirmLabel: string; run: () => void }
  | { kind: 'import-error'; file: string; errors: string[] }
  | { kind: 'delete'; impact: DeleteImpact; run: (pipes: 'keep' | 'delete') => void };

export type EditorDialogsProps = {
  dialog: EditorDialog | null;
  scene: SceneConfig;
  dirty: boolean;
  /** Id cảnh đã lưu (kiểm trùng ở "Lưu thành bản mới"). */
  savedIds: string[];
  /** Chặn rời trang khi chưa lưu (`useBlocker`). */
  blocker: Blocker;
  onClose: () => void;
  onOpen: (id: string) => void;
  onRemove: (id: string) => Promise<unknown>;
  onSaveAs: (id: string, name: string) => void;
  onAddView: (label: string) => void;
  onRestore: (draft: EditorDraft) => void;
  onDiscardDraft: () => void;
};

/**
 * Mọi hộp thoại của Scene Editor: mở cảnh, lưu bản mới, đặt tên view, khôi phục nháp, lỗi import, xác nhận bỏ thay đổi,
 * xoá còn ống liên quan (giữ / xoá ống), rời trang khi chưa lưu.
 */
export function EditorDialogs({ dialog, scene, dirty, savedIds, blocker, onClose, onOpen, onRemove, onSaveAs, onAddView, onRestore, onDiscardDraft }: EditorDialogsProps) {
  return (
    <>
      <OpenSceneDialog open={dialog?.kind === 'open'} dirty={dirty} onClose={onClose} onOpen={onOpen} onRemove={onRemove} />
      <SaveAsDialog
        open={dialog?.kind === 'save-as'}
        initialId={isSampleScene(scene.id) ? `${scene.id}-ban-sao` : scene.id}
        initialName={scene.name}
        existingIds={savedIds}
        onClose={onClose}
        onSave={onSaveAs}
      />
      <NameDialog
        open={dialog?.kind === 'view-name'}
        title="Lưu góc nhìn hiện tại thành view"
        label="Tên view (hiện trên nút ở Viewer)"
        initial={`Góc nhìn ${(scene.views?.length ?? 0) + 1}`}
        submitLabel="Thêm view"
        onClose={onClose}
        onSubmit={onAddView}
      />
      <RestoreDraftDialog
        draft={dialog?.kind === 'restore' ? dialog.draft : null}
        onRestore={() => dialog?.kind === 'restore' && onRestore(dialog.draft)}
        onDiscard={onDiscardDraft}
      />
      <ImportErrorDialog
        file={dialog?.kind === 'import-error' ? dialog.file : ''}
        errors={dialog?.kind === 'import-error' ? dialog.errors : null}
        onClose={onClose}
      />
      <ConfirmDialog
        open={dialog?.kind === 'confirm'}
        title={dialog?.kind === 'confirm' ? dialog.title : ''}
        confirmLabel={dialog?.kind === 'confirm' ? dialog.confirmLabel : ''}
        danger
        onClose={onClose}
        onConfirm={() => {
          if (dialog?.kind !== 'confirm') return;
          onClose();
          dialog.run();
        }}
      >
        {dialog?.kind === 'confirm' ? dialog.message : ''}
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog?.kind === 'delete'}
        title="Xoá – còn ống liên quan"
        confirmLabel="Xoá cả ống"
        danger
        altLabel={dialog?.kind === 'delete' && dialog.impact.connected.length ? 'Giữ ống' : undefined}
        onAlt={() => {
          if (dialog?.kind !== 'delete') return;
          onClose();
          dialog.run('keep');
        }}
        onClose={onClose}
        onConfirm={() => {
          if (dialog?.kind !== 'delete') return;
          onClose();
          dialog.run('delete');
        }}
      >
        {dialog?.kind === 'delete' && (
          <div className="flex flex-col gap-2">
            {dialog.impact.connected.length > 0 && (
              <p>
                Ống nối vào {dialog.impact.objects.join(', ')}: <b className="text-fg">{dialog.impact.connected.join(', ')}</b>. Giữ ống (đầu
                nối thành điểm tự do, hình ống không đổi) hay xoá cả ống (kèm object gắn trên ống)?
              </p>
            )}
            {dialog.impact.attached.length > 0 && (
              <p>
                Object gắn trên ống bị xoá cũng bị xoá: <b className="text-fg">{dialog.impact.attached.join(', ')}</b>.
              </p>
            )}
            <p className="text-sm text-fg-muted">Hoàn tác được bằng Ctrl+Z.</p>
          </div>
        )}
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
    </>
  );
}
