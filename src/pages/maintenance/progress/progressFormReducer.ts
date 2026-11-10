import type { MaintenanceAttachment } from '@/data/maintenance';
import type { ProgressUpdateErrors, WorkState } from '@/features/maintenance/progress';

/** Tệp thêm trong phiên: object URL CHỈ để xem trước trong modal – revoke khi xoá tệp / đóng modal, không lưu vào bản ghi. */
export type TempFile = { id: string; name: string; size: number; kind: 'image' | 'document'; url: string; type: string };
export type Preview = { kind: 'sample'; file: MaintenanceAttachment } | { kind: 'temp'; file: TempFile } | null;

export type ProgressFormState = {
  state: WorkState;
  progress: number;
  text: string;
  files: TempFile[];
  errors: ProgressUpdateErrors;
  /** Tệp bị từ chối lúc thêm (sai loại, quá lớn, quá số lượng). */
  uploadError: string;
  preview: Preview;
};

export type ProgressFormAction =
  | { type: 'choose-state'; state: WorkState }
  | { type: 'progress'; value: number }
  | { type: 'text'; value: string }
  | { type: 'upload'; rejected: string; added: TempFile[] }
  | { type: 'remove-file'; id: string }
  | { type: 'preview'; preview: Preview }
  /** Thay toàn bộ lỗi (kết quả kiểm tra, lỗi gửi, lỗi lưu nháp). */
  | { type: 'errors'; errors: ProgressUpdateErrors };

/**
 * - Chọn trạng thái → bỏ lỗi trạng thái / nội dung / lỗi chung; "Hoàn thành" → tiến độ mặc định 100 % (vẫn sửa được).
 * - Sửa nội dung → bỏ lỗi nội dung + lỗi chung. Thêm được tệp → bỏ lỗi chung. Kéo tiến độ không đổi lỗi.
 * - Bỏ tệp đang xem trước → đóng xem trước.
 */
export function progressFormReducer(s: ProgressFormState, a: ProgressFormAction): ProgressFormState {
  switch (a.type) {
    case 'choose-state':
      return {
        ...s,
        state: a.state,
        progress: a.state === 'completed' ? 100 : s.progress,
        errors: { ...s.errors, state: undefined, text: undefined, form: undefined },
      };
    case 'progress':
      return { ...s, progress: a.value };
    case 'text':
      return { ...s, text: a.value, errors: s.errors.text || s.errors.form ? { ...s.errors, text: undefined, form: undefined } : s.errors };
    case 'upload':
      return a.added.length
        ? { ...s, uploadError: a.rejected, files: [...s.files, ...a.added], errors: { ...s.errors, form: undefined } }
        : { ...s, uploadError: a.rejected };
    case 'remove-file':
      return {
        ...s,
        files: s.files.filter((x) => x.id !== a.id),
        preview: s.preview?.kind === 'temp' && s.preview.file.id === a.id ? null : s.preview,
      };
    case 'preview':
      return { ...s, preview: a.preview };
    case 'errors':
      return { ...s, errors: a.errors };
  }
}
