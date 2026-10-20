import { useEffect, useState } from 'react';
import { Button, CameraIcon, TrashIcon } from '@/components';
import type { SceneCamera, SceneView } from '@/features/scene/types';
import { removeView, updateView } from '@/features/scene-editor/ops';
import { useEditorUi, useSceneDoc } from '@/features/scene-editor/store';
import { cn } from '@/lib/cn';

function describe(v: SceneView) {
  if (v.camera) return `Góc nhìn cố định · zoom ${v.camera.zoom}`;
  if (v.objectIds?.length) return `Vừa khít ${v.objectIds.length} object: ${v.objectIds.join(', ')}`;
  return 'Camera mặc định của cảnh';
}

/**
 * Quản lý `scene.views` (nút Toàn cảnh / Bồn chứa… ở Viewer): lưu góc nhìn hiện tại thành view mới,
 * đổi tên, xem thử, gán object đang chọn (bay vừa khít) hoặc góc nhìn hiện tại, xoá.
 */
export function ViewsPanel({ getCamera, onAddView }: { getCamera: () => SceneCamera | null; onAddView: () => void }) {
  const views = useSceneDoc((s) => s.scene.views ?? []);
  const setScene = useSceneDoc((s) => s.setScene);
  const { selection, previewView, set } = useEditorUi();

  return (
    <div className="flex flex-col gap-3">
      <Button variant="ghost" size="sm" icon={<CameraIcon />} onClick={onAddView}>
        Lưu góc nhìn hiện tại thành view…
      </Button>
      {!views.length && <p className="text-sm text-fg-muted">Chưa có view – Viewer chỉ có “Toàn cảnh”.</p>}
      <ul className="flex flex-col gap-2">
        {views.map((v) => (
          <li
            key={v.id}
            className={cn('flex flex-col gap-2 rounded-md border p-2', previewView === v.id ? 'border-accent/60' : 'border-line/30')}
          >
            <div className="flex items-center gap-2">
              <InlineInput
                label={`Tên view ${v.id}`}
                value={v.label}
                className="font-semibold"
                onCommit={(label) => setScene((s) => updateView(s, v.id, (x) => ({ ...x, label })))}
              />
              <InlineInput
                label={`id view ${v.label}`}
                value={v.id}
                className="w-24 flex-none font-mono text-xs"
                onCommit={(id) => {
                  if (!/^[a-z0-9-]+$/.test(id)) return 'id chỉ gồm chữ thường không dấu, số và "-"';
                  if (views.some((x) => x.id === id)) return `id "${id}" đã có`;
                  setScene((s) => updateView(s, v.id, (x) => ({ ...x, id })));
                  if (previewView === v.id) set({ previewView: id });
                }}
              />
              <Button
                variant="icon"
                size="sm"
                aria-label={`Xoá view ${v.label}`}
                icon={<TrashIcon />}
                onClick={() => {
                  setScene((s) => removeView(s, v.id));
                  if (previewView === v.id) set({ previewView: null });
                }}
              />
            </div>
            <p className="text-xs text-fg-muted">{describe(v)}</p>
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                aria-pressed={previewView === v.id}
                className={cn(previewView === v.id && 'border-accent/60 bg-accent/15')}
                onClick={() => set({ previewView: previewView === v.id ? null : v.id })}
              >
                Xem
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!selection.length}
                title={selection.length ? undefined : 'Chọn object trước'}
                onClick={() =>
                  setScene((s) =>
                    updateView(s, v.id, ({ camera: _c, ...rest }) => {
                      void _c;
                      return { ...rest, objectIds: [...selection] };
                    }),
                  )
                }
              >
                Gán {selection.length || ''} object đang chọn
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const camera = getCamera();
                  if (camera)
                    setScene((s) =>
                      updateView(s, v.id, ({ objectIds: _o, ...rest }) => {
                        void _o;
                        return { ...rest, camera };
                      }),
                    );
                }}
              >
                Gán góc nhìn hiện tại
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Ô sửa tại chỗ (chốt khi Enter/rời ô); `onCommit` trả lỗi → viền đỏ + giữ chữ. */
function InlineInput({
  label,
  value,
  onCommit,
  className,
}: {
  label: string;
  value: string;
  onCommit: (next: string) => string | void;
  className?: string;
}) {
  const [text, setText] = useState(value);
  const [error, setError] = useState<string>();
  useEffect(() => {
    setText(value);
    setError(undefined);
  }, [value]);
  const commit = () => {
    const t = text.trim();
    if (!t || t === value) {
      setText(value);
      return setError(undefined);
    }
    setError(onCommit(t) || undefined);
  };
  return (
    <input
      aria-label={label}
      aria-invalid={!!error || undefined}
      title={error}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      className={cn(
        'h-7 min-w-0 flex-1 rounded-sm border bg-surface-sunken px-2 text-sm text-fg focus-visible:outline-none',
        error ? 'border-danger' : 'border-line hover:border-accent/40 focus-visible:border-accent/60',
        className,
      )}
    />
  );
}
