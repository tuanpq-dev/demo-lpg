import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from 'zustand';
import { Button, ExportIcon, FilePlusIcon, FolderIcon, ImportIcon, RedoIcon, SaveIcon, UndoIcon } from '@/components';
import { redo, undo, useSceneDoc, type SceneSource } from '@/features/scene-editor/store';

export type EditorFileBarProps = {
  source: SceneSource;
  /** Số lỗi kiểm tra – còn lỗi thì ẩn link "Xem ở Tổng quan". */
  errorCount: number;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onImport: (file: File) => void;
  onExport: () => void;
};

/** Thanh tệp (tiêu đề trang): Cảnh mới · Mở · Lưu · Lưu bản mới · Import / Export JSON · Hoàn tác / Làm lại · link Tổng quan. */
export function EditorFileBar({ source, errorCount, onNew, onOpen, onSave, onSaveAs, onImport, onExport }: EditorFileBarProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const canUndo = useStore(useSceneDoc.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useSceneDoc.temporal, (s) => s.futureStates.length > 0);
  return (
    <div role="toolbar" aria-label="Tệp cảnh" className="flex flex-wrap items-center gap-2">
      <h1 className="mr-2 text-lg font-semibold text-fg">Scene Editor</h1>
      <Button variant="ghost" size="sm" icon={<FilePlusIcon />} onClick={onNew}>
        Cảnh mới
      </Button>
      <Button variant="ghost" size="sm" icon={<FolderIcon />} onClick={onOpen}>
        Mở…
      </Button>
      <Button size="sm" icon={<SaveIcon />} onClick={onSave} title="Lưu (Ctrl+S)">
        Lưu
      </Button>
      <Button variant="ghost" size="sm" onClick={onSaveAs}>
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
          if (f) onImport(f);
        }}
      />
      <Button variant="ghost" size="sm" icon={<ExportIcon />} onClick={onExport}>
        Export JSON
      </Button>
      <span aria-hidden="true" className="mx-1 h-6 w-px bg-line/60" />
      <Button
        variant="toolbar"
        size="sm"
        aria-label="Hoàn tác (Ctrl+Z)"
        title="Hoàn tác (Ctrl+Z)"
        disabled={!canUndo}
        onClick={undo}
        icon={<UndoIcon />}
      />
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
}
