import { useId, useRef, useState, type DragEvent } from 'react';
import { cn } from '@/lib/cn';
import { CloseIcon, FileIcon, UploadIcon } from '../Icon';

export type AttachedFile = {
  id: string;
  name: string;
  /** byte */
  size: number;
  /** File thật (khi người dùng chọn trong phiên) – để upload sau này. */
  file?: File;
};

export type FileDropzoneProps = {
  files: readonly AttachedFile[];
  onChange: (files: AttachedFile[]) => void;
  /** Ví dụ ".pdf,.jpg,.png" */
  accept?: string;
  maxSizeMB?: number;
  /** aria-label của vùng thả. */
  label?: string;
  className?: string;
};

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Vùng "Kéo thả hoặc chọn tệp để tải lên" + danh sách tệp (tên · dung lượng · xoá).
 * ⚠ Theo ảnh thiết kế modal (chưa có node Figma). Chưa upload thật – chỉ giữ metadata/File trong state.
 */
export function FileDropzone({ files, onChange, accept, maxSizeMB = 20, label = 'Tệp đính kèm', className }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const errId = useId();
  const [over, setOver] = useState(false);
  const [error, setError] = useState('');

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const ok: AttachedFile[] = [];
    const tooBig: string[] = [];
    Array.from(list).forEach((f) => {
      if (f.size > maxSizeMB * 1024 * 1024) tooBig.push(f.name);
      else ok.push({ id: `${f.name}-${f.size}-${f.lastModified}`, name: f.name, size: f.size, file: f });
    });
    const known = new Set(files.map((f) => f.id));
    onChange([...files, ...ok.filter((f) => !known.has(f.id))]);
    setError(tooBig.length ? `Vượt quá ${maxSizeMB} MB: ${tooBig.join(', ')}` : '');
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(false);
    addFiles(e.dataTransfer.files);
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div
        role="group"
        aria-label={label}
        aria-describedby={error ? errId : undefined}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 py-5 text-center transition-colors',
          over ? 'border-accent bg-accent/10' : 'border-line/50 bg-surface-sunken/40',
        )}
      >
        <UploadIcon className="text-fg-secondary" />
        <p className="text-sm text-fg-muted/70">
          Kéo thả hoặc{' '}
          <button type="button" onClick={() => inputRef.current?.click()} className="rounded-sm text-accent underline hover:text-info">
            chọn tệp
          </button>{' '}
          để tải lên
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {error && (
        <p id={errId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {files.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Tệp đã đính kèm">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 rounded-lg border border-line/30 bg-surface-raised/40 px-3 py-2">
              <FileIcon className={/\.pdf$/i.test(f.name) ? 'text-danger' : 'text-accent'} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm text-fg">{f.name}</span>
                <span className="text-2xs text-fg-muted/60">{formatFileSize(f.size)}</span>
              </span>
              <button
                type="button"
                aria-label={`Xoá tệp ${f.name}`}
                onClick={() => onChange(files.filter((x) => x.id !== f.id))}
                className="inline-flex size-6 items-center justify-center rounded-sm text-fg-secondary hover:bg-surface-muted hover:text-fg"
              >
                <CloseIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
