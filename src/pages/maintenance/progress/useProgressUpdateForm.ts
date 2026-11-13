import { useEffect, useReducer, useRef, useState } from 'react';
import type { MaintenanceRecord } from '@/data/maintenance';
import { clearProgressDraft, loadProgressDraft, saveProgressDraft } from '@/data/maintenanceDetail';
import {
  canContinueToSubmit,
  checkUploads,
  defaultReportedProgress,
  uploadKind,
  validateProgressUpdate,
  workStateOf,
  type ProgressFile,
  type ProgressUpdateInput,
  type WorkState,
} from '@/features/maintenance/progress';
import { announce } from '@/lib/announce';
import { useFormModal, type FormModalDraft } from '@/hooks/useFormModal';
import { progressFormReducer, type Preview, type TempFile } from './progressFormReducer';

export type UseProgressUpdateFormOptions = {
  record: MaintenanceRecord;
  onClose: () => void;
  onSubmit: (input: ProgressUpdateInput) => Promise<void>;
  onOpenChecklist?: () => void;
  onContinueToSubmit: (prefill: { text: string; files: readonly ProgressFile[] }) => void;
};

type Values = { state: WorkState; progress: number; text: string; files: number };

/**
 * State + kiểm tra của "Cập nhật tiến độ bảo trì" (reducer `progressFormReducer`): trạng thái công việc, tiến độ, nội dung,
 * tệp tạm (object URL chỉ để xem trước – thu hồi khi bỏ tệp / đóng), lỗi, xem trước. Vòng đời modal qua `useFormModal`
 * (nháp sessionStorage theo mã – không giữ tệp). "Hoàn thành" → không ghi, chuyển sang Gửi nghiệm thu (`onContinueToSubmit`).
 */
export function useProgressUpdateForm({ record: r, onClose, onSubmit, onOpenChecklist, onContinueToSubmit }: UseProgressUpdateFormOptions) {
  const textWrapRef = useRef<HTMLDivElement>(null);
  const [initial] = useState(() => {
    const draft = loadProgressDraft(r.id);
    const base = { state: workStateOf(r), progress: defaultReportedProgress(r), text: '' };
    return { base, draft, values: draft ? { state: draft.state, progress: draft.progress, text: draft.text } : base };
  });
  const [s, dispatch] = useReducer(progressFormReducer, undefined, () => ({
    ...initial.values,
    files: [],
    errors: {},
    uploadError: '',
    preview: null,
  }));
  const { state, progress, text, files } = s;

  // Revoke mọi URL xem trước khi đóng modal (unmount) – ref giữ danh sách mới nhất.
  const filesRef = useRef(files);
  filesRef.current = files;
  useEffect(() => () => filesRef.current.forEach((f) => URL.revokeObjectURL(f.url)), []);

  const draft: FormModalDraft<Values> = {
    exists: !!initial.draft,
    // Nháp chỉ giữ lựa chọn + tiến độ + nội dung (KHÔNG giữ tệp – object URL chết khi đóng modal).
    save: (v) => saveProgressDraft(r.id, { state: v.state, progress: v.progress, text: v.text, savedAt: new Date().toISOString() }),
    clear: () => clearProgressDraft(r.id),
  };
  const values: Values = { state, progress, text, files: files.length };
  const modal = useFormModal({
    initial: { ...initial.base, files: 0 },
    values,
    // Nội dung chỉ có khoảng trắng = chưa sửa; có tệp tạm = đã sửa.
    isDirty: (v, i) => v.state !== i.state || v.progress !== i.progress || v.text.trim() !== '' || v.files > 0,
    draft,
    onSubmit,
    onClose,
    onSubmitError: (t) => dispatch({ type: 'errors', errors: { form: t } }),
  });

  const input = (): ProgressUpdateInput => ({ state, progress, text, files: files.map(({ name, size, kind }) => ({ name, size, kind })) });
  const continueToSubmit = state === 'completed';

  const submit = async () => {
    if (continueToSubmit) {
      if (!canContinueToSubmit(r.status, state)) {
        dispatch({ type: 'errors', errors: { state: 'Bắt đầu thực hiện trước khi báo hoàn thành.' } });
        return;
      }
      clearProgressDraft(r.id);
      onContinueToSubmit({ text: text.trim(), files: input().files ?? [] });
      return;
    }
    const e = validateProgressUpdate(r, input());
    dispatch({ type: 'errors', errors: e });
    if (e.text) {
      textWrapRef.current?.querySelector('textarea')?.focus();
      return;
    }
    if (Object.keys(e).length) return;
    await modal.submit(input());
  };

  return {
    ...s,
    modal,
    initialDraft: initial.draft,
    continueToSubmit,
    textWrapRef,
    chooseState: (next: WorkState) => dispatch({ type: 'choose-state', state: next }),
    setProgress: (value: number) => dispatch({ type: 'progress', value }),
    setText: (value: string) => dispatch({ type: 'text', value }),
    setPreview: (preview: Preview) => dispatch({ type: 'preview', preview }),
    submit,
    saveDraft: () => {
      if (!modal.saveDraft()) {
        dispatch({ type: 'errors', errors: { form: 'Không lưu được nháp (bộ nhớ trình duyệt không khả dụng).' } });
        return;
      }
      announce(`Đã lưu nháp cập nhật tiến độ ${r.code}${files.length ? ' – tệp đính kèm không được lưu trong nháp' : ''}.`);
    },
    addFiles: (list: File[]) => {
      const { accepted, rejected } = checkUploads(list, files.length);
      const added: TempFile[] = accepted.map((f, i) => ({
        id: `tmp-${Date.now()}-${i}`,
        name: f.name,
        size: f.size,
        kind: uploadKind(f.name),
        url: URL.createObjectURL(f),
        type: f.type,
      }));
      dispatch({ type: 'upload', rejected: rejected.map((x) => `${x.name}: ${x.reason}`).join('; '), added });
      if (added.length) announce(`Đã thêm ${added.length} tệp (chưa tải lên máy chủ).`);
    },
    removeFile: (f: TempFile) => {
      URL.revokeObjectURL(f.url);
      dispatch({ type: 'remove-file', id: f.id });
      announce(`Đã bỏ tệp ${f.name}.`);
    },
    openChecklist: () => {
      if (modal.dirty && draft.save(values)) announce(`Đã lưu nháp cập nhật tiến độ ${r.code}.`);
      onOpenChecklist?.();
    },
  };
}

export type ProgressUpdateForm = ReturnType<typeof useProgressUpdateForm>;
