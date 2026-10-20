import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Hành vi chung cho hộp thoại modal (Drawer, Modal):
 * - Khi mở: lưu phần tử đang focus, focus `initialFocus` (hoặc phần tử focus được đầu tiên), khoá cuộn body.
 * - Esc (lắng nghe ở document) → onClose – vẫn hoạt động khi focus đã rơi khỏi panel.
 * - Tab / Shift+Tab xoay vòng trong panel (gắn `onKeyDown` trả về lên phần tử bọc).
 * - Nếu phần tử đang focus biến mất (nút vừa bấm bị ẩn) → focus lại `initialFocus`.
 * - Khi đóng: trả focus về phần tử cũ.
 */
export function useDialog({
  open,
  onClose,
  panelRef,
  initialFocus,
  /** Giá trị thay đổi khi nội dung panel thay đổi (để kiểm tra focus bị rơi). */
  contentKey,
}: {
  open: boolean;
  onClose: () => void;
  panelRef: RefObject<HTMLElement>;
  initialFocus?: RefObject<HTMLElement>;
  contentKey?: unknown;
}) {
  const returnFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const focusInitial = () => {
    const target = initialFocus?.current ?? panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus();
  };

  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    focusInitial();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('keydown', onEsc);
      document.body.style.overflow = prevOverflow;
      returnFocus.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (open && !panelRef.current?.contains(document.activeElement)) focusInitial();
  }, [open, contentKey]);

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const items = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  };

  return { onKeyDown };
}
