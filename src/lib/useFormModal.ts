import { useEffect, useRef, useState } from 'react';
import { actionErrorText } from './actionError';

/** Nháp của modal (sessionStorage theo mã – `createSessionDraft` hoặc hàm save/clear riêng). */
export type FormModalDraft<V> = {
  /** Modal mở từ nháp đã lưu (hoặc đã có nháp cho mã này). */
  exists: boolean;
  /** Lưu nháp – false = bộ nhớ không khả dụng (modal báo lỗi, không đóng). */
  save: (values: V) => boolean;
  clear: () => void;
};

export type UseFormModalOptions<V, I = V, R = unknown> = {
  /** Giá trị gốc lúc mở (KHÔNG phải nháp) – so với `values` để biết đã sửa chưa. */
  initial: V;
  /** Giá trị hiện tại của form (dựng lại mỗi render). */
  values: V;
  /** Mặc định so JSON; modal có trường không tính (vd công tắc thông báo) truyền hàm riêng. */
  isDirty?: (values: V, initial: V) => boolean;
  draft?: FormModalDraft<V>;
  /** Ghi. Trả `{ ok: false, … }` = không thành công (vd kiểm lại phía dữ liệu) → giữ nháp; ném lỗi = lỗi mạng / máy chủ. */
  onSubmit: (input: I) => Promise<R> | R;
  onClose: () => void;
  /** Lỗi khi `onSubmit` ném (mạng / máy chủ) – câu `actionErrorText`; modal hiện trong vùng lỗi của mình. */
  onSubmitError?: (text: string, error: unknown) => void;
  /**
   * Hành vi nháp (mặc định như modal bảo trì / phân công). Modal "Cập nhật xử lý" cảnh báo: lưu nháp KHÔNG đóng
   * (`stayOpenAfterDraft`, `initial` = bản vừa lưu), "Bỏ thay đổi" GIỮ nháp đã lưu (`keepDraftOnDiscard`), có nháp mà chưa
   * sửa thì đóng không hỏi (`confirmIfDraft: false`).
   */
  stayOpenAfterDraft?: boolean;
  keepDraftOnDiscard?: boolean;
  confirmIfDraft?: boolean;
};

const jsonDirty = <V>(a: V, b: V) => JSON.stringify(a) !== JSON.stringify(b);
/** Kết quả dạng `{ ok: false }` = thao tác bị từ chối (không xoá nháp). */
const rejected = (r: unknown) => !!r && typeof r === 'object' && 'ok' in r && r.ok === false;

/**
 * Khung chung của modal có form (phân công, tiến độ, gửi / nghiệm thu, cập nhật xử lý, ghi mốc…):
 * - `dirty` = `values` khác `initial`.
 * - `requestClose` (Hủy, ×, Esc): đang hỏi → quay lại sửa · đã sửa hoặc có nháp → hỏi ("Bỏ thay đổi?") · còn lại → đóng.
 * - `discard` (bấm "Bỏ thay đổi"): xoá nháp + đóng. `keepEditing`: thôi hỏi; nút "Tiếp tục sửa" nhận focus qua `keepEditingRef`.
 * - `saveDraft`: lưu nháp → đóng (false = không lưu được, không đóng). Tuỳ chọn khác: xem `stayOpenAfterDraft`…
 * - `submit(input)`: chặn gửi lặp; trả kết quả của `onSubmit` (undefined khi đang gửi / ném lỗi). Kết quả khác `{ ok: false }`
 *   → xoá nháp; ném lỗi → `onSubmitError` (modal giữ mở).
 * Kiểm tra form (validate, lý do chặn) vẫn ở từng modal – gọi `submit` sau khi hợp lệ.
 */
export function useFormModal<V, I = V, R = unknown>({
  initial,
  values,
  isDirty = jsonDirty,
  draft,
  onSubmit,
  onClose,
  onSubmitError,
  stayOpenAfterDraft = false,
  keepDraftOnDiscard = false,
  confirmIfDraft = true,
}: UseFormModalOptions<V, I, R>) {
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hasDraft, setHasDraft] = useState(!!draft?.exists);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);

  useEffect(() => {
    if (confirming) keepEditingRef.current?.focus();
  }, [confirming]);

  const dirty = isDirty(values, initial);

  const requestClose = () => {
    if (confirming) return setConfirming(false);
    if (dirty || (confirmIfDraft && hasDraft)) setConfirming(true);
    else onClose();
  };
  const keepEditing = () => setConfirming(false);
  const discard = () => {
    if (!keepDraftOnDiscard) draft?.clear();
    onClose();
  };
  const saveDraft = (): boolean => {
    if (!draft || !draft.save(values)) return false;
    setHasDraft(true);
    if (!stayOpenAfterDraft) onClose();
    return true;
  };
  const submit = async (input: I): Promise<R | undefined> => {
    if (busy.current) return undefined;
    busy.current = true;
    setSubmitting(true);
    try {
      const result = await onSubmit(input);
      if (!rejected(result)) draft?.clear();
      return result;
    } catch (e) {
      onSubmitError?.(actionErrorText(e), e);
      return undefined;
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  };

  return { dirty, confirming, submitting, hasDraft, requestClose, keepEditing, discard, saveDraft, submit, keepEditingRef };
}
