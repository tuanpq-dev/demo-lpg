import { useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { useDialog } from '@/hooks/useDialog';
import { CloseIcon } from '../Icon';

export type DrawerProps = {
  open: boolean;
  onClose: () => void;
  /** id của tiêu đề trong `header` (aria-labelledby). */
  labelledBy: string;
  describedBy?: string;
  /** Phần đầu cố định (không cuộn). Nút × đặt góc phải trên → hàng đầu của `header` tự chừa ~40px bên phải (`pr-10`). */
  header: ReactNode;
  children: ReactNode;
  /** Chân cố định đáy (nút thao tác). */
  footer?: ReactNode;
  /** Đổi khi nội dung đổi – nút đang focus biến mất thì focus về nút ×. */
  contentKey?: unknown;
  /** Vạch nhấn mép trái `primary/40` (ảnh drawer cảnh báo). */
  accent?: boolean;
  /** Bề rộng từ `sm` (mặc định 440px); dưới `sm` drawer luôn toàn màn hình. */
  widthClass?: string;
  className?: string;
};

/**
 * Khung drawer bên phải dùng chung (DetailDrawer, drawer chi tiết cảnh báo): dialog modal qua portal – focus nút × khi mở,
 * Tab xoay vòng, Esc / click nền đóng, trả focus khi đóng (`useDialog`; có modal chồng lên trên thì Esc đóng modal trước).
 * Header cố định + thân cuộn + chân cố định. Dưới `sm` (640px) chiếm toàn màn hình.
 */
export function Drawer({
  open,
  onClose,
  labelledBy,
  describedBy,
  header,
  children,
  footer,
  contentKey,
  accent,
  widthClass = 'sm:w-[440px]',
  className,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { onKeyDown } = useDialog({ open, onClose, panelRef, initialFocus: closeRef, contentKey });
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation" onKeyDown={onKeyDown}>
      {/* Nền mờ: click để đóng (chuột); bàn phím đóng bằng Esc (useDialog). */}
      <div aria-hidden="true" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={cn(
          'relative flex h-full w-full max-w-full flex-col bg-surface shadow-card sm:border-l',
          accent ? 'sm:border-l-2 sm:border-l-primary/40' : 'sm:border-line/30',
          widthClass,
          className,
        )}
      >
        <header className="relative shrink-0 border-b border-line/30 px-5 py-5">
          {header}
          <button
            ref={closeRef}
            type="button"
            aria-label="Đóng"
            onClick={onClose}
            className="absolute right-3 top-3.5 inline-flex size-9 items-center justify-center rounded-md text-fg-secondary hover:bg-surface-muted hover:text-fg"
          >
            <CloseIcon size={18} />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
        {footer && <footer className="shrink-0 border-t border-line/30 px-5 py-4">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
