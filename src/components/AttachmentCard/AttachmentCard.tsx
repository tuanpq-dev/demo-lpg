import { cn } from '@/lib/cn';
import { Badge } from '../Badge';
import { BookIcon, FileIcon, ImageIcon } from '../Icon';

export type AttachmentKind = 'image' | 'document' | 'manual';

export type AttachmentCardProps = {
  id: string;
  name: string;
  /** Không truyền → đoán theo đuôi tệp (ảnh → image, còn lại → document). */
  kind?: AttachmentKind;
  /** Dòng phụ tuỳ chọn, vd "2,4 MB". */
  meta?: string;
  /** Nhãn cảnh báo nhỏ dưới tên, vd "Chưa tải lên máy chủ" (tệp tạm khi chưa có backend). */
  notice?: string;
  /** Giãn hết ô lưới chứa (modal "Cập nhật tiến độ": 4 cột đều) thay vì rộng cố định `--attachment-card-width`. */
  fluid?: boolean;
  onView?: (id: string) => void;
  onDownload?: (id: string) => void;
  className?: string;
};

export const attachmentKind = (name: string, kind?: AttachmentKind): AttachmentKind =>
  kind ?? (/\.(png|jpe?g|gif|webp|avif|bmp|heic)$/i.test(name) ? 'image' : 'document');

const ICONS = { image: ImageIcon, document: FileIcon, manual: BookIcon } as const;

/** Nút nhỏ "Xem"/"Tải xuống" trong thẻ tệp (ảnh: chữ 10px, viền line, cao ~20px – ước lượng). */
function MiniButton({ label, onClick, children }: { label: string; onClick?: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={label}
      className="h-[26px] min-w-[60px] flex-1 rounded-sm border border-line px-2 text-xs text-fg-secondary transition-colors hover:border-accent/60 hover:text-fg disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/**
 * Thẻ tệp đính kèm – "Ảnh và tài liệu" ảnh MT-00128 (kích thước `--attachment-card-width/height` – ước lượng; viền line/30, bo 4px): icon loại tệp
 * ở giữa trên, tên tệp, hai nút "Xem" / "Tải xuống" (tên truy cập kèm tên tệp).
 */
export function AttachmentCard({ id, name, kind, meta, notice, fluid, onView, onDownload, className }: AttachmentCardProps) {
  const Icon = ICONS[attachmentKind(name, kind)];
  return (
    <article
      aria-label={name}
      className={cn(
        'flex min-h-[var(--attachment-card-height)] max-w-full flex-col items-center gap-2 rounded-sm border border-line/30 bg-surface-sunken/30 px-3 pb-3 pt-3.5',
        fluid ? 'w-full min-w-0' : 'w-[var(--attachment-card-width)]',
        className,
      )}
    >
      <Icon size={24} className="text-fg-secondary" />
      <p className="w-full truncate text-center text-md text-fg-secondary" title={name}>
        {name}
      </p>
      {meta && <p className="-mt-1.5 text-xs text-fg-secondary/70">{meta}</p>}
      {notice && (
        <Badge variant="tag" tone="warning" className="-mt-1">
          {notice}
        </Badge>
      )}
      <div className="flex w-full max-w-[176px] gap-2">
        <MiniButton label={`Xem ${name}`} onClick={onView ? () => onView(id) : undefined}>
          Xem
        </MiniButton>
        <MiniButton label={`Tải xuống ${name}`} onClick={onDownload ? () => onDownload(id) : undefined}>
          Tải xuống
        </MiniButton>
      </div>
    </article>
  );
}
