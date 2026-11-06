import { useId, useState } from 'react';
import { AttachmentCard, Modal, UploadTile, formatFileSize } from '@/components';
import type { AlertRecord } from '@/data/alerts';
import { UPLOAD_ACCEPT, UPLOAD_HINT } from '@/features/maintenance/progress';
import { downloadSampleAttachment } from '../../maintenance/attachments';
import type { TempFile } from './useAlertUpdateForm';

export type UpdateFilesSectionProps = {
  code: string;
  /** Tệp mẫu đi kèm cảnh báo. */
  attachments: AlertRecord['attachments'];
  /** Tệp tạm vừa chọn (chưa tải lên máy chủ). */
  files: readonly TempFile[];
  uploadError: string;
  onAdd: (files: File[]) => void;
  onRemove: (file: TempFile) => void;
};

/** Khối "Ảnh và tài liệu": tệp mẫu (xem = modal dữ liệu mẫu, tải), tệp tạm (bỏ được), ô tải lên + lỗi tệp bị từ chối. */
export function UpdateFilesSection({ code, attachments, files, uploadError, onAdd, onRemove }: UpdateFilesSectionProps) {
  const uid = useId();
  const [preview, setPreview] = useState<string | null>(null);
  const sample = (attachments ?? []).find((f) => f.name === preview);
  return (
    <section className="flex flex-col gap-3" aria-labelledby={`${uid}-h`}>
      <h3 id={`${uid}-h`} className="text-lg font-semibold text-fg-secondary">
        Ảnh và tài liệu
      </h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-6">
        {(attachments ?? []).map((f) => (
          <AttachmentCard
            key={f.name}
            fluid
            id={f.name}
            name={f.name}
            kind={f.kind}
            notice={f.isTemp ? 'Chưa tải lên máy chủ' : undefined}
            onView={() => setPreview(f.name)}
            onDownload={f.isTemp ? undefined : () => downloadSampleAttachment(f, code)}
          />
        ))}
        {files.map((f) => (
          <div key={f.id} className="relative flex min-w-0">
            <AttachmentCard fluid id={f.id} name={f.name} kind={f.kind} meta={formatFileSize(f.size)} notice="Chưa tải lên máy chủ" />
            <button
              type="button"
              aria-label={`Bỏ tệp ${f.name}`}
              onClick={() => onRemove(f)}
              className="absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded-sm text-fg-secondary hover:bg-surface-muted hover:text-fg"
            >
              <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
        <UploadTile accept={UPLOAD_ACCEPT} hint={UPLOAD_HINT} onFiles={onAdd} />
      </div>
      {uploadError && (
        <p role="alert" className="text-sm text-danger-text">
          {uploadError}
        </p>
      )}
      {sample && (
        <Modal open onClose={() => setPreview(null)} size="md" title={sample.name} description="Dữ liệu mẫu – chưa có tệp thật (chờ backend lưu trữ).">
          <p className="text-base text-fg-secondary">Tệp mẫu đi kèm cảnh báo {code}. Xem/tải tệp thật khi có API lưu trữ.</p>
        </Modal>
      )}
    </section>
  );
}
