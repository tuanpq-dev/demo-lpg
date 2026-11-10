import { useEffect, useLayoutEffect, useMemo, useReducer, useState, type FormEvent } from 'react';
import type { AlertRecord } from '@/data/alerts';
import {
  clearMaintenanceDraft,
  loadMaintenanceDraft,
  saveMaintenanceDraft,
  suggestForRequest,
  type NewMaintenanceInput,
  type ShiftId,
} from '@/data/maintenance';
import { actionErrorText } from '@/lib/actionError';
import {
  blankForm,
  createFormReducer,
  formFromAlert,
  toCreateInput,
  validateCreate,
  type CreateFormState,
  type CreateFormValues,
} from './createForm';

export type UseCreateMaintenanceFormOptions = {
  devices: readonly { device: string; area: string }[];
  defaultDevice?: string;
  alert?: AlertRecord;
  defaultTitle?: string;
  onSubmit: (input: NewMaintenanceInput) => Promise<unknown>;
  onDraftSaved?: () => void;
};

const draftTime = (iso: string) => new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

/** Giá trị khởi tạo: cảnh báo nguồn > bản nháp (khi không điền sẵn thiết bị) > form trống. */
function initialState(alert: AlertRecord | undefined, defaultTitle: string | undefined, defaultDevice: string | undefined): CreateFormState {
  const base = { errors: {}, submitting: false, submitError: '', touched: { department: false, shift: false }, errorTick: 0 };
  if (alert) return { ...base, form: formFromAlert(alert, defaultTitle), draftInfo: null };
  const draft = loadMaintenanceDraft<CreateFormValues>();
  if (draft && !defaultDevice)
    return { ...base, form: { ...blankForm(null), ...draft.draft, attachments: draft.draft.attachments ?? [] }, draftInfo: draftTime(draft.savedAt) };
  return { ...base, form: blankForm(defaultDevice ?? null), draftInfo: null };
}

/**
 * State + kiểm tra của "Tạo yêu cầu bảo trì" (reducer `createFormReducer`): giá trị form, lỗi trường, đang gửi, lỗi mạng,
 * nháp khôi phục, tự điền (phòng ban theo thiết bị, ca theo giờ bắt đầu – trừ khi đã chọn tay), góp ý AI ↔ checklist.
 * Nháp localStorage (`saveMaintenanceDraft`) – lưu xong nơi gọi đóng modal (`onDraftSaved`); tạo xong xoá nháp.
 * Không dùng `useFormModal`: modal đóng không hỏi lại và lưu nháp do nơi gọi đóng (giữ hành vi đã có).
 */
export function useCreateMaintenanceForm({ devices, defaultDevice, alert, defaultTitle, onSubmit, onDraftSaved }: UseCreateMaintenanceFormOptions) {
  const [state, dispatch] = useReducer(createFormReducer, undefined, () => initialState(alert, defaultTitle, defaultDevice));
  const { form, errorTick } = state;

  // Gửi bị chặn → focus trường lỗi đầu tiên (sau khi render lỗi).
  useEffect(() => {
    if (errorTick) document.querySelector<HTMLElement>('[role=dialog] [aria-invalid="true"]')?.focus();
  }, [errorTick]);

  // Modal được mount khi mở (trang render có điều kiện) → state khởi tạo đúng ngay lần vẽ đầu.
  // Chỉ nạp lại nếu cảnh báo nguồn tới muộn (F5 thẳng vào URL ?from=…).
  const [loadedAlert, setLoadedAlert] = useState(alert?.id);
  useLayoutEffect(() => {
    if (alert && alert.id !== loadedAlert) {
      setLoadedAlert(alert.id);
      dispatch({ type: 'reset', form: formFromAlert(alert, defaultTitle) });
    }
  }, [alert, loadedAlert, defaultTitle]);

  const areaOf = (d: string | null) => (d ? (devices.find((x) => x.device === d)?.area ?? 'Khác') : '');
  const suggestion = useMemo(() => suggestForRequest({ device: form.device, alert }), [form.device, alert]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validateCreate(form);
    if (Object.values(errs).some(Boolean)) {
      dispatch({ type: 'invalid', errors: errs });
      return;
    }
    dispatch({ type: 'submit-start' });
    try {
      await onSubmit(toCreateInput(form, areaOf(form.device), alert));
      clearMaintenanceDraft();
      dispatch({ type: 'submit-end' });
    } catch (err) {
      dispatch({ type: 'submit-end', error: actionErrorText(err) });
    }
  };

  return {
    ...state,
    suggestion,
    areaOf,
    set: <K extends keyof CreateFormValues>(key: K, value: CreateFormValues[K]) => dispatch({ type: 'set', key, value }),
    setDevice: (device: string | null) => dispatch({ type: 'device', device }),
    setStart: (startAt: string) => dispatch({ type: 'start', startAt }),
    setDepartment: (department: string | null) => dispatch({ type: 'department', department }),
    setShift: (shift: ShiftId) => dispatch({ type: 'shift', shift }),
    toggleSuggestion: (text: string) => dispatch({ type: 'toggle-suggestion', text }),
    discardDraft: () => {
      clearMaintenanceDraft();
      dispatch({ type: 'reset', form: blankForm(null) });
    },
    saveDraft: () => {
      // File thật không lưu được vào localStorage – chỉ giữ tên/dung lượng.
      saveMaintenanceDraft({ ...form, attachments: form.attachments.map(({ id, name, size }) => ({ id, name, size })) });
      onDraftSaved?.();
    },
    handleSubmit,
  };
}

export type CreateMaintenanceForm = ReturnType<typeof useCreateMaintenanceForm>;
