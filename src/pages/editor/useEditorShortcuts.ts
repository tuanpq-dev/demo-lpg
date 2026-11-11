import { useEffect } from 'react';
import { redo, undo, useEditorUi } from '@/features/scene-editor/store';
import { isTyping } from '@/lib/isTyping';
import type { EditorActions } from './useEditorActions';

const ui = () => useEditorUi.getState();

type ShortcutCtx = { actions: EditorActions; flash: (msg: string) => void };
type Shortcut = (c: ShortcutCtx, e: KeyboardEvent) => void;

/** Ctrl/⌘ + phím (khoá theo `key` chữ thường). */
const MOD_KEYS: Partial<Record<string, Shortcut>> = {
  z: (_, e) => (e.shiftKey ? redo() : undo()),
  y: () => redo(),
  d: ({ actions }) => actions.duplicateSelection(),
  c: ({ actions, flash }) => {
    const n = actions.copySelection();
    if (n) flash(`Đã copy ${n} object`);
  },
  v: ({ actions }) => actions.paste(),
  a: ({ actions }) => actions.selectAll(),
};

/** Phím đơn: công cụ Q W E R P, O trực giao, G lưới, F căn khung, Delete/Backspace xoá, Esc bỏ chọn. */
const PLAIN_KEYS: Partial<Record<string, Shortcut>> = {
  q: () => ui().setTool('select'),
  w: () => ui().setTool('translate'),
  e: () => ui().setTool('rotate'),
  r: () => ui().setTool('scale'),
  p: () => ui().setTool('pipe'),
  o: () => ui().toggle('ortho'),
  g: () => ui().toggle('grid'),
  f: ({ actions }) => actions.fit(),
  delete: ({ actions }) => actions.deleteSelection(),
  backspace: ({ actions }) => actions.deleteSelection(),
  escape: () => ui().setSelection([]),
};

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
      // Alt + phím: để trình duyệt / hệ điều hành xử lý.
      const run = mod ? MOD_KEYS[k] : e.altKey ? undefined : PLAIN_KEYS[k];
      const handled = !!run;
      run?.({ actions, flash }, e);
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actions, save, flash]);
}
