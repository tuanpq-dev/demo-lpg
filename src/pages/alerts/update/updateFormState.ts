import { alertPlaybook, updateConfig, updateDraft } from '@/data/alertDetail';
import type { AlertRecord } from '@/data/alerts';
import { inspectionItems, type InspectionEntry } from '@/features/alerts/inspection';
import { updateStateOf, type AlertUpdateInput, type UpdateErrors, type UpdateFile, type VerificationSource } from '@/features/alerts/update';
import { plantDateTimeKey } from '@/lib/plantTime';

export type UpdateFormValues = Omit<AlertUpdateInput, 'files' | 'readings'> & {
  source: VerificationSource;
  /** Giờ nhà máy "yyyy-mm-ddTHH:mm". */
  recordedAt: string;
  /** Giá trị "Sau" sửa tay theo dòng (chỉ dùng khi nguồn có đồng hồ cơ). Thiếu khoá = theo số live. */
  manualAfter: Record<string, number | null>;
  /** Giờ nhà máy "yyyy-mm-ddTHH:mm" – theo dõi Tùy chỉnh. */
  customAtLocal: string;
};

export type TempFile = UpdateFile & { id: string };

export type FormState = {
  values: UpdateFormValues;
  /** Bản đã lưu gần nhất (nháp khôi phục / vừa lưu nháp) – "đã sửa" = khác bản này. */
  saved: UpdateFormValues;
  files: TempFile[];
  uploadError: string;
  /** Lỗi trả về lúc lưu (`{ ok: false }`) – chỉ đúng với giá trị lúc đó → sửa form là bỏ. */
  errors: UpdateErrors;
  /** Lỗi khi lưu thất bại (mạng / máy chủ) – khác lỗi kiểm tra form; sửa một ô là bỏ. */
  submitError: string;
  /** Đã bấm "Lưu cập nhật" ít nhất một lần → hiện mọi lỗi. */
  triedSubmit: boolean;
};

export type FormAction =
  | { type: 'set'; patch: Partial<UpdateFormValues> }
  | { type: 'inspection'; id: string; entry: InspectionEntry }
  | { type: 'verification'; id: string; on: boolean }
  | { type: 'files-added'; files: readonly UpdateFile[] }
  | { type: 'upload-error'; text: string }
  | { type: 'file-removed'; id: string }
  | { type: 'submit-start' }
  | { type: 'submit-sent' }
  | { type: 'submit-rejected'; errors: UpdateErrors }
  | { type: 'submit-error'; text: string }
  | { type: 'draft-saved' };

/**
 * Đổi giá trị form → bỏ mọi lỗi lưu: lỗi trả về (`{ ok: false }`) và lỗi mạng / máy chủ – chỉ đúng với lần lưu đó
 * (lỗi theo giá trị hiện tại vẫn tính lại mỗi lần render).
 */
const edit = (s: FormState, values: UpdateFormValues): FormState => ({ ...s, values, errors: {}, submitError: '' });

export function updateFormReducer(s: FormState, a: FormAction): FormState {
  switch (a.type) {
    case 'set':
      return edit(s, { ...s.values, ...a.patch });
    case 'inspection':
      return edit(s, { ...s.values, inspection: { ...s.values.inspection, [a.id]: a.entry } });
    case 'verification': {
      const cur = s.values.verification;
      return edit(s, { ...s.values, verification: a.on ? [...cur, a.id] : cur.filter((x) => x !== a.id) });
    }
    case 'files-added':
      return { ...s, files: [...s.files, ...a.files.map((f, i) => ({ ...f, id: `tmp-${s.files.length + i}-${f.name}` }))] };
    case 'upload-error':
      return { ...s, uploadError: a.text };
    case 'file-removed':
      return { ...s, files: s.files.filter((x) => x.id !== a.id) };
    case 'submit-start':
      return { ...s, triedSubmit: true, errors: {} };
    case 'submit-sent':
      return { ...s, submitError: '' };
    case 'submit-rejected':
      return { ...s, errors: a.errors };
    case 'submit-error':
      return { ...s, submitError: a.text };
    case 'draft-saved':
      return { ...s, saved: s.values };
  }
}

/** Giá trị mở form: từ bản ghi + cấu hình theo loại, hoặc nháp sessionStorage theo mã (nếu có, hợp lệ). */
export function initialValues(a: AlertRecord, now: Date) {
  const cfg = updateConfig(a)!;
  const base: UpdateFormValues = {
    state: updateStateOf(a),
    holdReason: a.hold?.reason ?? '',
    supportPeople: [],
    inspection: Object.fromEntries(inspectionItems(alertPlaybook(a).steps, a.guide).map(({ id, text: _t, ...e }) => [id, e])),
    verification: [...(a.verification ?? [])],
    cause: a.cause ?? '',
    actionTaken: a.actionTaken ?? '',
    issue: { kind: a.issue?.kind ?? 'none', note: a.issue?.note ?? '' },
    followUp: { choice: cfg.followUp.defaultMinutes, target: cfg.followUp.target, owner: a.assignee ?? '' },
    source: cfg.sources ? 'both' : 'sensor',
    recordedAt: plantDateTimeKey(now),
    manualAfter: {},
    customAtLocal: '',
  };
  const draft = updateDraft.load(a.id);
  if (!draft) return { values: base, draft: false };
  const manualAfter: Record<string, number | null> = {};
  for (const r of draft.readings.rows) if (r.manual) manualAfter[r.id] = r.after ?? null;
  const values: UpdateFormValues = {
    ...base,
    ...draft,
    source: draft.readings.source,
    recordedAt: plantDateTimeKey(new Date(draft.readings.at)),
    manualAfter,
    customAtLocal: draft.followUp.customAt ? plantDateTimeKey(new Date(draft.followUp.customAt)) : '',
  };
  return { values, draft: true };
}
