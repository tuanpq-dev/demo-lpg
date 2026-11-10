import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react';

/**
 * Ngăn xếp hộp thoại đang mở (Modal mở TRÊN drawer – vd "Tạo yêu cầu bảo trì" từ drawer cảnh báo): Esc chỉ đóng hộp
 * trên cùng; hộp dưới giữ nguyên tới khi hộp trên đóng.
 */
const dialogStack: symbol[] = [];
const isTop = (id: symbol) => dialogStack[dialogStack.length - 1] === id;

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Hành vi chung cho hộp thoại modal (Drawer, Modal):
 * - Khi mở: lưu phần tử đang focus, focus `initialFocus` (hoặc phần tử focus được đầu tiên), khoá cuộn body.
 * - Esc (lắng nghe ở document) → onClose – vẫn hoạt động khi focus đã rơi khỏi panel. Nhiều hộp chồng nhau: chỉ hộp
 *   trên cùng (mở sau cùng) nhận Esc.
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
  const idRef = useRef(Symbol('dialog'));
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const focusInitial = () => {
    const target = initialFocus?.current ?? panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus();
  };

  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    const id = idRef.current;
    dialogStack.push(id);
    focusInitial();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && isTop(id)) onCloseRef.current();
    };
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('keydown', onEsc);
      dialogStack.splice(dialogStack.indexOf(id), 1);
      document.body.style.overflow = prevOverflow;
      returnFocus.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Chỉ chạy khi mở/đóng; focusInitial đọc ref mới nhất.
  }, [open]);

  useEffect(() => {
    // Hộp khác đang chồng lên trên → focus đang ở hộp đó, không kéo về.
    if (open && isTop(idRef.current) && !panelRef.current?.contains(document.activeElement)) focusInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- focusInitial đọc ref mới nhất; chỉ chạy khi mở hoặc nội dung đổi
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
