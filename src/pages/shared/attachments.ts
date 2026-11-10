import { mockAttachmentFile } from '@/data/maintenanceDetail';
import type { MaintenanceAttachment } from '@/data/maintenance';
import { announce } from '@/lib/announce';

/**
 * "Tải xuống" tệp mẫu khi chưa có backend: Blob `<tên>-mau.txt` ghi rõ là dữ liệu mẫu, thu hồi URL ngay sau khi bấm.
 * TODO(backend): tải tệp thật qua API (URL ký sẵn).
 */
export function downloadSampleAttachment(a: Pick<MaintenanceAttachment, 'name' | 'size'>, code: string) {
  const f = mockAttachmentFile(a, code);
  const url = URL.createObjectURL(new Blob([f.content], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = f.fileName;
  link.click();
  URL.revokeObjectURL(url);
  announce(`Đã tải ${f.fileName} (dữ liệu mẫu).`);
}
