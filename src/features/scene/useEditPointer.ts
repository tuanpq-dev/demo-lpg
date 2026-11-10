/**
 * Chế độ sửa của SceneViewer: xử lý con trỏ trên canvas – kéo điểm gập ống, kéo object (trên sàn / dọc ống), Shift+kéo
 * chọn vùng (Shift+click = đảo chọn), click vùng trống bỏ chọn, Delete xoá điểm gập đang chọn. Tách từ SceneViewer.tsx.
 */
import { useEffect, useRef, useState, type Dispatch, type PointerEvent as ReactPointerEvent, type RefObject, type SetStateAction } from 'react';
import { isTyping } from '@/lib/isTyping';
import { startAttachDrag, startGroundDrag } from './editDrag';
import type { SceneEditState, ScenePicker } from './EditTools';
import type { ResolvedScene, ScenePreview } from './geometry';
import { isCanvasEvent } from './ObjectNode';
import { startPointDrag } from './PipeTools';
import type { Pipe, SceneConfig } from './types';

export type ActivePoint = { pipe: string; index: number };
export type Marquee = { x0: number; y0: number; x1: number; y1: number };
/** Gizmo đang kéo / vừa kéo xong (bỏ qua click "bỏ chọn" ngay sau khi thả). */
export type GizmoState = { dragging: boolean; endedAt: number };

export type EditPointerOptions = {
  edit?: SceneEditState;
  picker: RefObject<ScenePicker | null>;
  config: SceneConfig;
  scene: ResolvedScene;
  drawing: boolean;
  selected: ReadonlySet<string>;
  /** Object không chọn được bằng tia (ẩn / khoá). */
  skipPick: ReadonlySet<string>;
  selectedPipe?: Pipe;
  activeIndex: number | null;
  setActivePoint: Dispatch<SetStateAction<ActivePoint | null>>;
  setPreview: (p: ScenePreview | null) => void;
  setHovered: (id: string | null) => void;
};

/** Số điểm của đường đi ống (điểm gập + đầu nối). */
const pathPointCount = (pipe: Pipe) => pipe.points.length + (pipe.from ? 1 : 0) + (pipe.to ? 1 : 0);

/** Delete/Backspace khi đang chọn một điểm gập → xoá điểm (đường đi còn ≥ 2 điểm); Esc bỏ chọn điểm. */
function useDeletePipePoint({ edit, scene, selectedPipe, activeIndex, setActivePoint }: EditPointerOptions) {
  useEffect(() => {
    const update = edit?.onUpdatePipe;
    if (activeIndex === null || !selectedPipe || !update) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        setActivePoint(null);
        return;
      }
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      e.preventDefault();
      e.stopPropagation();
      const pathLen = scene.curves.get(selectedPipe.id) ? pathPointCount(selectedPipe) : 0;
      if (pathLen <= 2) return;
      update(selectedPipe.id, (p) => ({ ...p, points: p.points.filter((_, i) => i !== activeIndex) }));
      setActivePoint(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [activeIndex, selectedPipe, edit, scene, setActivePoint]);
}

export function useEditPointer(o: EditPointerOptions) {
  const { edit, picker, config, scene, drawing, selected, skipPick, selectedPipe } = o;
  const downAt = useRef<{ x: number; y: number } | null>(null);
  const gizmo = useRef<GizmoState>({ dragging: false, endedAt: 0 });
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  useDeletePipePoint(o);

  const dragState = (dragging: boolean) => {
    gizmo.current.dragging = dragging;
    if (!dragging) gizmo.current.endedAt = performance.now();
  };

  /** Bỏ chọn khi click vùng trống – bỏ qua nếu vừa kéo gizmo hoặc chuột đã di chuyển > 4px (xoay/pan). */
  const onMissed = (e: MouseEvent) => {
    o.setHovered(null);
    // R3F nghe sự kiện ở div bọc canvas → click lên nhãn HTML cũng tới đây; chỉ tính click trên canvas. Vẽ ống: click = đặt điểm.
    if (!edit || !isCanvasEvent(e) || edit.mode === 'pipe') return;
    const g = gizmo.current;
    if (g.dragging || performance.now() - g.endedAt < 300) return;
    const d = downAt.current;
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return;
    edit.onSelect([], 'replace');
  };

  /** Tay nắm điểm gập của ống đang chọn → kéo điểm. true = đã nhận sự kiện. */
  const tryPointDrag = (e: ReactPointerEvent, ed: SceneEditState, pk: ScenePicker) => {
    const handle = !e.shiftKey && pk.handle(e.clientX, e.clientY);
    if (!handle || selectedPipe?.id !== handle.pipe) return false;
    const pipe = config.pipes.find((p) => p.id === handle.pipe);
    if (!pipe) return false;
    o.setActivePoint(handle);
    startPointDrag({
      picker: pk,
      edit: ed,
      pipe,
      index: handle.index,
      clientX: e.clientX,
      clientY: e.clientY,
      onPreview: o.setPreview,
      onState: dragState,
    });
    return true;
  };

  /**
   * Di chuyển: nắm object (không phím bổ trợ) → kéo trên sàn, object gắn ống → kéo dọc ống (đổi t). Không chặn sự kiện
   * (R3F vẫn ghi pointerdown cho click); OrbitControls bị tắt trước khi sự kiện tới canvas nên không xoay camera.
   */
  const tryObjectDrag = (e: ReactPointerEvent, ed: SceneEditState, pk: ScenePicker) => {
    if (ed.mode !== 'translate' || e.shiftKey || e.ctrlKey || e.metaKey) return false;
    const id = pk.object(e.clientX, e.clientY, skipPick);
    if (!id) return true;
    const grabbed = scene.byId.get(id);
    const common = { picker: pk, edit: ed, clientX: e.clientX, clientY: e.clientY, onPreview: o.setPreview, onState: dragState };
    let ok: boolean;
    if (grabbed?.attach) {
      const curve = scene.curves.get(grabbed.attach.pipe);
      ok = !!curve && startAttachDrag({ ...common, obj: grabbed, curve });
    } else {
      ok = startGroundDrag({ ...common, byId: scene.byId, grabbed: id, ids: selected.has(id) ? ed.selected : [id] });
    }
    if (ok && !selected.has(id)) ed.onSelect([id], 'replace');
    return true;
  };

  /** Shift+kéo = chọn vùng; kéo < 4px = Shift+click đảo chọn object dưới con trỏ. */
  const startMarquee = (e: ReactPointerEvent, ed: SceneEditState) => {
    // Chặn OrbitControls/R3F: Shift+kéo thuộc về chọn vùng.
    e.stopPropagation();
    const start = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY };
    setMarquee(start);
    const move = (ev: PointerEvent) => setMarquee({ ...start, x1: ev.clientX, y1: ev.clientY });
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setMarquee(null);
      const rect = {
        left: Math.min(start.x0, ev.clientX),
        right: Math.max(start.x0, ev.clientX),
        top: Math.min(start.y0, ev.clientY),
        bottom: Math.max(start.y0, ev.clientY),
      };
      if (rect.right - rect.left < 4 && rect.bottom - rect.top < 4) {
        const id = picker.current?.object(ev.clientX, ev.clientY, skipPick);
        if (id) ed.onSelect([id], 'toggle');
      } else ed.onSelect(picker.current?.inRect(rect, skipPick) ?? [], 'add');
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onPointerDownCapture = (e: ReactPointerEvent<HTMLDivElement>) => {
    downAt.current = { x: e.clientX, y: e.clientY };
    const pk = picker.current;
    // Vẽ ống: PipeDrawTool tự nghe sự kiện trên canvas (click đặt điểm, kéo = xoay camera).
    if (!edit || !pk || drawing || e.button !== 0 || !(e.target instanceof HTMLCanvasElement)) return;
    if (tryPointDrag(e, edit, pk) || tryObjectDrag(e, edit, pk)) return;
    if (e.shiftKey) startMarquee(e, edit);
  };

  return { gizmo, marquee, onMissed, onPointerDownCapture };
}
