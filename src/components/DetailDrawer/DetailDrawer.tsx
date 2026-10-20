import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useDialog } from '@/lib/useDialog';
import { Divider } from '../Divider';

export type DetailField = {
  label: string;
  value: ReactNode;
};

export type DetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  /** Dòng nhỏ phía trên tiêu đề, ví dụ "Chi tiết cảnh báo". */
  eyebrow?: string;
  /** Tiêu đề chính (mã bản ghi). */
  title: ReactNode;
  /** Badge cạnh tiêu đề. */
  badges?: ReactNode;
  /** Đoạn mô tả đầu thân drawer. */
  description?: ReactNode;
  /** Nội dung chèn sau mô tả (badge trạng thái, tiến độ…). */
  summary?: ReactNode;
  fields: readonly DetailField[];
  /** Nút ở chân drawer. */
  actions?: ReactNode;
  /** Đổi khi nội dung thay đổi – để đưa focus về nút Đóng nếu nút đang focus bị ẩn. */
  contentKey?: unknown;
};

/**
 * Panel chi tiết bên phải, dùng chung cho Cảnh báo và Bảo trì.
 * ⚠ Figma CHƯA có thiết kế – dựng tối giản bằng token sẵn có, chờ designer bổ sung.
 * Dialog modal qua portal: focus nút Đóng khi mở, Tab xoay vòng, Esc/click nền để đóng, trả focus khi đóng.
 */
export function DetailDrawer({
  open,
  onClose,
  eyebrow,
  title,
  badges,
  description,
  summary,
  fields,
  actions,
  contentKey,
}: DetailDrawerProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { onKeyDown } = useDialog({ open, onClose, panelRef, initialFocus: closeRef, contentKey });

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end" onKeyDown={onKeyDown}>
      <div aria-hidden="true" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-full w-[420px] max-w-full flex-col border-l border-line/30 bg-surface shadow-card"
      >
        <header className="flex items-start justify-between gap-3 border-b border-line/30 bg-surface-raised px-5 py-4">
          <div className="flex min-w-0 flex-col gap-2">
            {eyebrow && <span className="text-sm text-fg-secondary">{eyebrow}</span>}
            <div className="flex flex-wrap items-center gap-2">
              <h2 id={titleId} className="text-xl font-semibold text-fg">
                {title}
              </h2>
              {badges}
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Đóng"
            onClick={onClose}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-fg-secondary hover:bg-surface-muted hover:text-fg"
          >
            {/* Figma không có icon đóng – dấu × theo currentColor (giống nút xoá SearchInput). */}
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          {description && <p className="text-md text-fg">{description}</p>}
          {summary}
          <Divider />
          <dl className="flex flex-col divide-y divide-line/10">
            {fields.map((f) => (
              <div key={f.label} className="flex items-start justify-between gap-4 py-2">
                <dt className="shrink-0 text-sm text-fg-muted">{f.label}</dt>
                <dd className="text-right text-base text-fg">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {actions && (
          <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-line/30 bg-surface-raised px-5 py-4">
            {actions}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
