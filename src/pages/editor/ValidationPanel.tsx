import type { EditorIssue } from '@/features/scene-editor/validate';
import { cn } from '@/lib/cn';

/** Bảng lỗi/cảnh báo của cảnh (không chặn lưu nháp). Bấm dòng có object → chọn + bay tới object đó. */
export function ValidationPanel({ issues, onPick }: { issues: EditorIssue[]; onPick: (objectId: string) => void }) {
  if (!issues.length) return <p className="text-sm text-success">Không có lỗi hay cảnh báo.</p>;
  const errors = issues.filter((i) => i.severity === 'error').length;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-fg-muted">
        {errors} lỗi · {issues.length - errors} cảnh báo. Lỗi phải sửa trước khi Viewer mở được cảnh; vẫn lưu nháp được.
      </p>
      <table className="w-full table-fixed border-collapse text-sm">
        <caption className="sr-only">Lỗi và cảnh báo của cảnh</caption>
        <thead>
          <tr className="text-left text-xs text-fg-muted">
            <th scope="col" className="w-16 pb-1 font-semibold">
              Mức
            </th>
            <th scope="col" className="pb-1 font-semibold">
              Nội dung
            </th>
          </tr>
        </thead>
        <tbody>
          {issues.map((i, k) => (
            <tr key={k} className="border-t border-line/30 align-top">
              <td className="py-1.5 pr-2">
                <span
                  className={cn(
                    'inline-block rounded-xs px-1.5 py-0.5 text-2xs font-semibold',
                    i.severity === 'error' ? 'bg-danger/15 text-danger-text' : 'bg-warning/15 text-warning',
                  )}
                >
                  {i.severity === 'error' ? 'Lỗi' : 'Cảnh báo'}
                </span>
              </td>
              <td className="py-1.5">
                {i.objectId ? (
                  <button type="button" className="text-left text-fg hover:underline" onClick={() => onPick(i.objectId!)}>
                    {i.message}
                  </button>
                ) : (
                  <span className="text-fg">{i.message}</span>
                )}
                <div className="font-mono text-2xs text-fg-muted">{i.where}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
