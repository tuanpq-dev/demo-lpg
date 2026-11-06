import { useEffect } from 'react';
import { redo, undo, useEditorUi } from '@/features/scene-editor/store';
import { isTyping } from '@/lib/isTyping';
import type { EditorActions } from './useEditorActions';

const ui = () => useEditorUi.getState();

/**
 * Phím tắt Scene Editor (không chạy khi đang gõ / có hộp thoại): Ctrl+S lưu (cả khi đang ở ô nhập – rời ô trước để chốt
 * giá trị), Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, Ctrl+D / C / V / A, Q W E R P công cụ, O trực giao, G lưới, F căn khung,
 * Delete / Backspace xoá, Esc bỏ chọn.
 */
export function useEditorShortcuts({ actions, save, flash }: { actions: EditorActions; save: () => void; flash: (msg: string) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (document.querySelector('[role="dialog"]')) return;
      // Ctrl+S chạy cả khi đang ở ô nhập: rời ô trước (ô số/chữ chốt giá trị khi blur) rồi mới lưu.
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (isTyping(e.target)) (e.target as HTMLElement).blur();
        window.setTimeout(save, 0);
        return;
      }
      if (isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      let handled = true;
      if (mod && k === 'z' && e.shiftKey) redo();
      else if (mod && k === 'z') undo();
      else if (mod && k === 'y') redo();
      else if (mod && k === 'd') actions.duplicateSelection();
      else if (mod && k === 'c') {
        const n = actions.copySelection();
        if (n) flash(`Đã copy ${n} object`);
      } else if (mod && k === 'v') actions.paste();
      else if (mod && k === 'a') actions.selectAll();
      else if (mod || e.altKey) handled = false;
      else if (k === 'q') ui().setTool('select');
      else if (k === 'w') ui().setTool('translate');
      else if (k === 'e') ui().setTool('rotate');
      else if (k === 'r') ui().setTool('scale');
      else if (k === 'p') ui().setTool('pipe');
      else if (k === 'o') ui().toggle('ortho');
      else if (k === 'g') ui().toggle('grid');
      else if (k === 'f') actions.fit();
      else if (e.key === 'Delete' || e.key === 'Backspace') actions.deleteSelection();
      else if (e.key === 'Escape') ui().setSelection([]);
      else handled = false;
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actions, save, flash]);
}
