import type { SceneConfig } from '@/features/scene/types';
import type { SceneSource } from '@/features/scene-editor/store';

export type EditorStatusBarProps = {
  scene: SceneConfig;
  dirty: boolean;
  selectionCount: number;
  errorCount: number;
  warningCount: number;
  source: SceneSource;
  /** Thông báo ngắn (vd "Đã lưu …") – vùng `role="status"`. */
  notice: string;
  onShowIssues: () => void;
};

const SOURCE_LABEL: Record<SceneSource['kind'], string> = {
  sample: 'cảnh mẫu (chỉ đọc)',
  saved: 'đã lưu trong trình duyệt',
  new: 'chưa có trong kho',
};

/** Thanh trạng thái dưới canvas: tên / id / phiên bản, đã lưu chưa, số object, đang chọn, lỗi · cảnh báo, nguồn, thông báo. */
export function EditorStatusBar({ scene, dirty, selectionCount, errorCount, warningCount, source, notice, onShowIssues }: EditorStatusBarProps) {
  return (
    <footer
      aria-label="Trạng thái"
      className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-line/30 bg-surface px-3 py-1.5 text-sm text-fg-secondary"
    >
      <span className="font-semibold text-fg">{scene.name}</span>
      <span className="font-mono text-xs">{scene.id}</span>
      <span>v{scene.version}</span>
      <span className={dirty ? 'text-warning' : 'text-success'}>{dirty ? '● Chưa lưu' : '✓ Đã lưu'}</span>
      <span>{scene.objects.length} object</span>
      {selectionCount > 0 && <span>{selectionCount} đang chọn</span>}
      <button type="button" className="hover:underline" onClick={onShowIssues}>
        {errorCount} lỗi · {warningCount} cảnh báo
      </button>
      <span className="text-fg-muted">{SOURCE_LABEL[source.kind]}</span>
      <span role="status" aria-live="polite" className="ml-auto text-accent">
        {notice}
      </span>
    </footer>
  );
}
