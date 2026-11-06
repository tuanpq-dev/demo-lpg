import { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import type { SceneConfig } from '@/features/scene/types';
import { AUTOSAVE_MS, clearDraft, writeDraft } from '@/features/scene-editor/draft';
import { useEditorUi, useSceneDoc } from '@/features/scene-editor/store';

/** Thông báo ngắn ở thanh trạng thái – tự xoá sau 4 giây. */
export function useNotice() {
  const [notice, setNotice] = useState('');
  const flash = useCallback((msg: string) => setNotice(msg), []);
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);
  return { notice, flash };
}

/**
 * Tự lưu nháp mỗi `AUTOSAVE_MS` khi cảnh khác bản đã lưu (khớp bản đã lưu → xoá nháp). `paused()` = true (đang hỏi
 * khôi phục bản nháp cũ) → không ghi.
 */
export function useDraftAutosave(paused: () => boolean) {
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const lastDraft = useRef<SceneConfig | null>(null);
  useEffect(() => {
    const t = window.setInterval(() => {
      const cur = useSceneDoc.getState().scene;
      const st = useEditorUi.getState();
      if (pausedRef.current()) return;
      if (cur === st.saved) return clearDraft();
      if (cur !== lastDraft.current) {
        writeDraft(cur, st.source);
        lastDraft.current = cur;
      }
    }, AUTOSAVE_MS);
    return () => window.clearInterval(t);
  }, []);
}

/** Rời trang khi chưa lưu: hỏi của trình duyệt (đóng tab / tải lại) + `useBlocker` khi đổi route (trang hiện hộp thoại). */
export function useLeaveGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty]);
  return useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);
}

/** Bỏ id không còn tồn tại khỏi selection (sau undo / xoá). Selection gồm id object hoặc id ống. */
export function usePruneSelection(scene: SceneConfig) {
  useEffect(() => {
    const ids = new Set([...scene.objects.map((o) => o.id), ...scene.pipes.map((p) => p.id)]);
    const sel = useEditorUi.getState().selection;
    if (sel.some((id) => !ids.has(id))) useEditorUi.getState().setSelection(sel.filter((id) => ids.has(id)));
  }, [scene]);
}
