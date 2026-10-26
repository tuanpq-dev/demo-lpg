import { useRef } from 'react';
import { cn } from '@/lib/cn';
import { UploadTrayIcon } from '../Icon';

export type UploadTileProps = {
  /** Chữ trên ô (mặc định "Tải tệp lên"). */
  label?: string;
  /** Thuộc tính `accept` của input file, vd ".jpg,.png,.pdf". */
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  /** Mô tả thêm cho trình đọc màn hình (loại tệp / dung lượng tối đa). */
  hint?: string;
  /** Tệp người dùng chọn (nơi gọi kiểm tra loại/dung lượng). */
  onFiles: (files: File[]) => void;
  className?: string;
};

/**
 * Ô "Tải tệp lên" cuối hàng "Ảnh và tài liệu" – modal "Cập nhật tiến độ bảo trì" (ảnh thiết kế): cùng khung với
 * AttachmentCard, viền primary/70, icon khay + mũi tên, chữ 16px. Nút thật bọc `<input type="file">` ẩn.
 */
export function UploadTile({ label = 'Tải tệp lên', accept, multiple = true, disabled, hint, onFiles, className }: UploadTileProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex min-h-[var(--attachment-card-height)] w-full min-w-0 flex-col items-center justify-center gap-2.5 rounded-sm border border-primary/70 bg-surface-sunken/30 px-3 py-3 text-md text-fg transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      >
        <UploadTrayIcon size={24} className="text-fg-secondary" />
        <span>{label}</span>
        {hint && <span className="sr-only">. {hint}</span>}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = ''; // chọn lại cùng tệp vẫn kích hoạt onChange
          if (files.length) onFiles(files);
        }}
      />
    </>
  );
}
