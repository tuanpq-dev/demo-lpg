import { AttachmentCard, Badge, Button, UploadTile } from '@/components';
import type { MaintenanceRecord } from '@/data/maintenance';
import { formatFileSize } from '@/data/maintenanceDetail';
import { UPLOAD_ACCEPT, UPLOAD_HINT } from '@/features/maintenance/progress';
import { downloadSampleAttachment } from '../attachments';
import type { ProgressUpdateForm } from './useProgressUpdateForm';

/** "Ảnh và tài liệu": tệp có sẵn (xem / tải bản mẫu) + tệp tạm (xem / bỏ) + "Tải tệp lên" + lỗi tệp + khung xem trước. */
export function ProgressFilesSection({ f, record: r }: { f: ProgressUpdateForm; record: MaintenanceRecord }) {
  const { preview } = f;
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold text-fg-secondary">Ảnh và tài liệu</h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-6">
        {(r.attachments ?? []).map((a) => (
          <AttachmentCard
            key={a.id}
            fluid
            id={a.id}
            name={a.name}
            kind={a.kind}
            notice={a.isTemp ? 'Chưa tải lên máy chủ' : undefined}
            onView={() => f.setPreview({ kind: 'sample', file: a })}
            onDownload={a.isTemp ? undefined : () => downloadSampleAttachment(a, r.code)}
          />
        ))}
        {f.files.map((t) => (
          <div key={t.id} className="relative flex min-w-0">
            <AttachmentCard
              fluid
              id={t.id}
              name={t.name}
              kind={t.kind}
              meta={formatFileSize(t.size)}
              notice="Chưa tải lên máy chủ"
              onView={() => f.setPreview({ kind: 'temp', file: t })}
            />
            <button
              type="button"
              aria-label={`Bỏ tệp ${t.name}`}
              onClick={() => f.removeFile(t)}
              className="absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded-sm text-fg-secondary hover:bg-surface-muted hover:text-fg"
            >
              <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
        <UploadTile accept={UPLOAD_ACCEPT} hint={UPLOAD_HINT} onFiles={f.addFiles} />
      </div>
      {f.uploadError && (
        <p role="alert" className="text-sm text-danger-text">
          Không thêm được: {f.uploadError}.
        </p>
      )}
      {preview && (
        <div className="flex flex-col gap-2 rounded-md border border-line/30 bg-surface-sunken/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="flex min-w-0 items-center gap-2 text-base text-fg">
              <span className="truncate">{preview.file.name}</span>
              <Badge variant="tag" tone={preview.kind === 'temp' || preview.file.isTemp ? 'warning' : 'neutral'}>
                {preview.kind === 'temp' || preview.file.isTemp ? 'Chưa tải lên máy chủ' : 'Dữ liệu mẫu'}
              </Badge>
            </p>
            <Button variant="plain" size="sm" onClick={() => f.setPreview(null)}>
              Đóng xem trước
            </Button>
          </div>
          {preview.kind === 'temp' && preview.file.kind === 'image' ? (
            <img src={preview.file.url} alt={`Xem trước ${preview.file.name}`} className="max-h-60 self-start rounded-sm object-contain" />
          ) : preview.kind === 'temp' ? (
            <a href={preview.file.url} target="_blank" rel="noreferrer" className="self-start rounded-sm text-sm text-accent hover:underline">
              Mở {preview.file.name} trong thẻ mới
            </a>
          ) : (
            <p className="text-sm text-fg-secondary">Chưa có tệp thật – bản demo chưa nối kho lưu trữ. Xem trước sẽ hiện ở đây khi có backend.</p>
          )}
        </div>
      )}
    </section>
  );
}
