import { useEffect, useRef, type RefObject } from 'react';

/**
 * Đóng lớp nổi (dropdown, menu) khi đang mở: bấm ra ngoài `rootRef` → `onDismiss('outside')`; nếu `escape` bật thì Esc ở
 * document → `onDismiss('escape')` (nơi gọi tự trả focus về nút mở). Handler luôn là bản mới nhất – truyền hàm inline được.
 */
export function useDismiss(
  open: boolean,
  rootRef: RefObject<HTMLElement | null>,
  onDismiss: (reason: 'outside' | 'escape') => void,
  { escape = false }: { escape?: boolean } = {},
) {
  const handler = useRef(onDismiss);
  handler.current = onDismiss;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) handler.current('outside');
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handler.current('escape');
    };
    document.addEventListener('pointerdown', onDown);
    if (escape) document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, rootRef, escape]);
}
