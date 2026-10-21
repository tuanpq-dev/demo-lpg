import { useId, useRef, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { useDialog } from '@/lib/useDialog';

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Nút ở chân modal. */
  footer?: ReactNode;
  /** Bọc nội dung trong <form> – submit bằng Enter/nút type="submit". */
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  /** md 560 · lg 760 · xl 1072 (form "Tạo yêu cầu bảo trì"). */
  size?: 'md' | 'lg' | 'xl';
  /** Ô icon 40px đầu header (giống logo AppHeader). */
  icon?: ReactNode;
  /** Nội dung bên trái footer (ví dụ nút "Hủy" dạng link). */
  footerStart?: ReactNode;
  /** Không đóng khi click nền (form đang nhập dở). */
  dismissOnBackdrop?: boolean;
};

/**
 * Hộp thoại giữa màn hình.
 * ⚠ Figma CHƯA có thiết kế – dựng theo token, cùng ngôn ngữ với DetailDrawer
 * (nền surface, header/footer surface-raised, viền line/30, bo 12px).
 * Dialog modal: focus phần tử đầu, Tab xoay vòng, Esc đóng, trả focus khi đóng.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  onSubmit,
  size = 'md',
  dismissOnBackdrop = true,
  icon,
  footerStart,
}: ModalProps) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const { onKeyDown } = useDialog({ open, onClose, panelRef });

  if (!open) return null;

  const body = (
    <>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">{children}</div>
      {(footer || footerStart) && (
        <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-line/30 bg-surface-raised px-5 py-4">
          {footerStart && <div className="mr-auto flex items-center gap-3">{footerStart}</div>}
          {footer}
        </footer>
      )}
    </>
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation" onKeyDown={onKeyDown}>
      {/* Nền mờ: click để đóng (chuột); bàn phím đóng bằng Esc (useDialog). */}
      <div aria-hidden="true" className="absolute inset-0 bg-black/60" onClick={dismissOnBackdrop ? onClose : undefined} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={cn(
          'relative flex max-h-[calc(100vh-32px)] w-full flex-col overflow-hidden rounded-xl border border-line/30 bg-surface shadow-card',
          size === 'md' && 'max-w-[560px]',
          size === 'lg' && 'max-w-[760px]',
          size === 'xl' && 'max-w-[1072px]',
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line/30 bg-surface-raised px-5 py-4">
          <div className="flex items-center gap-3">
          {icon && (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-line/30 bg-surface-muted text-primary">
              {icon}
            </span>
          )}
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="text-xl font-semibold text-fg">
              {title}
            </h2>
            {description && (
              <p id={descId} className="text-sm text-fg-secondary">
                {description}
              </p>
            )}
          </div>
          </div>
          <button
            type="button"
            aria-label="Đóng"
            onClick={onClose}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-fg-secondary hover:bg-surface-muted hover:text-fg"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        {onSubmit ? (
          <form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            {body}
          </form>
        ) : (
          body
        )}
      </div>
    </div>,
    document.body,
  );
}
