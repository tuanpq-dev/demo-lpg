import { useMemo, useReducer, useState } from 'react';
import type { ReadingRowView } from '@/components';
import {
  alertPlaybook,
  closeLimit,
  metricText,
  updateConfig,
  updateDraft,
  updateReadingRows,
  useDetectorStatus,
  useTagReadings,
  verificationItems,
} from '@/data/alertDetail';
import type { AlertRecord } from '@/data/alerts';
import { inspectionItems, type InspectionEntry } from '@/features/alerts/inspection';
import {
  fieldItemId,
  followUpWindow,
  hasErrors,
  hasGauge,
  isResolvedState,
  normalItemId,
  readingTone,
  updateCloseCheck,
  updateStateOf,
  updateWarnings,
  validateAlertUpdate,
  type AlertUpdateInput,
  type AlertUpdateResult,
  type UpdateCheck,
  type UpdateErrors,
  type UpdateFile,
  type VerificationSource,
} from '@/features/alerts/update';
import { checkUploads, uploadKind } from '@/features/maintenance/progress';
import { announce } from '@/lib/announce';
import { appNow } from '@/lib/demoNow';
import { parsePlantDateTime, plantDateTimeKey } from '@/lib/plantTime';
import { useFormModal } from '@/lib/useFormModal';

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

type FormState = {
  values: UpdateFormValues;
  /** Bản đã lưu gần nhất (nháp khôi phục / vừa lưu nháp) – "đã sửa" = khác bản này. */
  saved: UpdateFormValues;
  files: TempFile[];
  uploadError: string;
  /** Lỗi trả về lúc lưu (`{ ok: false }`) – chỉ đúng với giá trị lúc đó → sửa form là bỏ. */
  errors: UpdateErrors;
  /** Lỗi khi lưu thất bại (mạng / máy chủ) – khác lỗi kiểm tra form. */
  submitError: string;
  /** Đã bấm "Lưu cập nhật" ít nhất một lần → hiện mọi lỗi. */
  triedSubmit: boolean;
};

type FormAction =
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

/** Đổi giá trị form → bỏ lỗi trả về lúc lưu (lỗi theo giá trị hiện tại vẫn tính lại mỗi lần render). */
const edit = (s: FormState, values: UpdateFormValues): FormState => ({ ...s, values, errors: {} });

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
function initialValues(a: AlertRecord, now: Date) {
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

const ALARM_TEXT: Record<string, { text: string; tone: 'danger' | 'normal' }> = { alarm: { text: 'Báo động', tone: 'danger' }, normal: { text: 'Bình thường', tone: 'normal' } };

export type UseAlertUpdateFormOptions = {
  alert: AlertRecord;
  /** Giờ hiện tại (đồng hồ của modal hoặc giờ cố định). */
  now: Date;
  /** Giờ cố định (playground) – dùng cho "Thời gian ghi nhận" mặc định. */
  fixedNow?: Date;
  onSubmit: (input: AlertUpdateInput, check: UpdateCheck) => Promise<AlertUpdateResult> | AlertUpdateResult;
  onClose: () => void;
};

/**
 * State + kiểm tra của modal "Cập nhật xử lý" (reducer `updateFormReducer`): giá trị form, tệp tạm, lỗi trả về lúc lưu,
 * lỗi mạng; suy ra dòng thông số, điều kiện đóng (`updateCloseCheck`), input gửi đi, lỗi / cảnh báo / lý do chặn.
 * Vòng đời modal (hỏi khi đóng, nháp, chặn gửi lặp) qua `useFormModal`: lưu nháp KHÔNG đóng, "Bỏ thay đổi" GIỮ nháp,
 * có nháp mà chưa sửa thêm → đóng không hỏi. Quy tắc: `features/alerts/update.ts`.
 */
export function useAlertUpdateForm({ alert: a, now, fixedNow, onSubmit, onClose }: UseAlertUpdateFormOptions) {
  const cfg = updateConfig(a)!;
  const steps = useMemo(() => alertPlaybook(a).steps, [a]);
  const rowsCfg = useMemo(() => updateReadingRows(a, cfg), [a, cfg]);
  const verItems = useMemo(() => verificationItems(a, cfg), [a, cfg]);
  const normalId = normalItemId(cfg);
  const fieldId = fieldItemId(cfg);
  const readings = useTagReadings(rowsCfg.map((r) => r.tag));
  const detector = useDetectorStatus(a.device);

  const [initial] = useState(() => initialValues(a, fixedNow ?? appNow()));
  const [state, dispatch] = useReducer(updateFormReducer, undefined, () => ({
    values: initial.values,
    saved: initial.values,
    files: [],
    uploadError: '',
    errors: {},
    submitError: '',
    triedSubmit: false,
  }));
  const { values: v, files, errors, triedSubmit } = state;

  const set = <K extends keyof UpdateFormValues>(k: K, val: UpdateFormValues[K]) => dispatch({ type: 'set', patch: { [k]: val } as Partial<UpdateFormValues> });
  const editable = !!cfg.sources && hasGauge(v.source);

  // ---- Thông số trước/sau ----
  const rowValues = rowsCfg.map((r) => {
    const rd = r.tag ? readings[r.tag] : undefined;
    const live = rd?.state === 'ok' ? rd.value : undefined;
    const manual = editable && !r.alarm && r.id in v.manualAfter;
    const after = manual ? (v.manualAfter[r.id] ?? undefined) : live;
    return { cfg: r, reading: rd ?? { state: 'none' as const }, live, after, manual };
  });
  const primary = rowValues.find((x) => x.cfg.primary)!;
  const warn = closeLimit(a);
  const close = updateCloseCheck(cfg.close, {
    liveState: primary.reading.state,
    live: primary.live,
    after: primary.after,
    manual: primary.manual,
    source: v.source,
    limit: warn,
    unit: a.unit,
    detector,
    fieldChecked: !!fieldId && v.verification.includes(fieldId),
  });
  const readingRows: ReadingRowView[] = rowValues.map(({ cfg: r, after, reading }) => {
    const alarm = r.alarm && reading.state === 'ok' ? ALARM_TEXT[reading.text ?? ''] : undefined;
    return {
      id: r.id,
      label: r.label,
      limit: r.primary && r.warn !== undefined ? `Giới hạn: ${metricText(r.warn, r.unit)}` : undefined,
      unit: r.unit,
      before: r.before,
      after,
      beforeTone: readingTone(r.before, r.warn, r.danger),
      afterTone: alarm ? alarm.tone : readingTone(after, r.warn, r.danger),
      afterText: alarm?.text,
      editable: editable && !r.alarm,
      afterPlaceholder: reading.state === 'lost' ? 'Mất tín hiệu' : reading.state === 'pending' ? '…' : reading.state === 'none' ? 'Chưa có tag' : undefined,
    };
  });

  // ---- Input + kiểm tra ----
  const verText = (id: string) => verItems.find((x) => x.id === id)?.text ?? id;
  const check: UpdateCheck = { close, config: cfg, steps, verificationText: verText, unit: a.unit };
  const recordedIso = (parsePlantDateTime(v.recordedAt) ?? now).toISOString();
  const customIso = v.customAtLocal ? parsePlantDateTime(v.customAtLocal)?.toISOString() : undefined;
  const input: AlertUpdateInput = {
    state: v.state,
    holdReason: v.holdReason,
    supportPeople: v.supportPeople,
    inspection: v.inspection,
    readings: {
      source: v.source,
      at: recordedIso,
      rows: rowValues.map((x) => ({ id: x.cfg.id, before: x.cfg.before, after: x.after, manual: x.manual || undefined })),
    },
    verification: v.verification,
    cause: v.cause,
    actionTaken: v.actionTaken,
    issue: v.issue,
    files: files.map(({ id: _id, ...f }) => f),
    followUp: { ...v.followUp, customAt: v.followUp.choice === 'custom' ? customIso : undefined },
  };
  // Lỗi hiện sau lần bấm "Lưu cập nhật" đầu tiên (rồi cập nhật theo giá trị) – trước đó chỉ hiện lỗi mâu thuẫn xác minh.
  const liveErrors = validateAlertUpdate(input, check, now);
  const shown: UpdateErrors = triedSubmit ? liveErrors : { verification: liveErrors.verification };
  // Lý do chặn nút "Lưu cập nhật" (sau lần bấm đầu) – tính lại theo giá trị hiện tại (+ lỗi trả về lúc lưu, xoá khi bấm lại).
  const err: UpdateErrors = triedSubmit ? { ...errors, ...liveErrors } : shown;
  const issues = [
    err.state && { id: 'state', label: err.state },
    err.close && { id: 'close', label: err.close },
    err.holdReason && { id: 'hold', label: err.holdReason },
    err.supportPeople && { id: 'people', label: err.supportPeople },
    err.inspection && Object.keys(err.inspection).length > 0 && { id: 'inspection', label: 'Hạng mục "Có vấn đề" cần ghi chú.' },
    err.verification && { id: 'verification', label: err.verification },
    err.cause && { id: 'cause', label: err.cause },
    err.actionTaken && { id: 'action', label: err.actionTaken },
    err.issueNote && { id: 'issue', label: err.issueNote },
    err.followUp && { id: 'follow', label: err.followUp },
  ].filter(Boolean) as { id: string; label: string }[];
  const resolved = isResolvedState(v.state);

  // ---- Thao tác ----
  const modal = useFormModal({
    initial: state.saved,
    values: v,
    isDirty: (cur, base) => JSON.stringify(cur) !== JSON.stringify(base) || files.length > 0,
    draft: {
      exists: initial.draft,
      save: () => {
        const { files: _f, ...rest } = input;
        return updateDraft.save(a.id, { ...rest, savedAt: appNow().toISOString() });
      },
      clear: () => updateDraft.clear(a.id),
    },
    onSubmit: (inp: AlertUpdateInput) => onSubmit(inp, check),
    onClose,
    onSubmitError: (text) => dispatch({ type: 'submit-error', text }),
    stayOpenAfterDraft: true,
    keepDraftOnDiscard: true,
    confirmIfDraft: false,
  });

  const saveDraft = () => {
    if (modal.saveDraft()) {
      dispatch({ type: 'draft-saved' });
      announce(`Đã lưu nháp cập nhật xử lý ${a.code}${files.length ? ' (tệp tạm không lưu vào nháp)' : ''}.`);
    } else announce('Không lưu được nháp – trình duyệt chặn bộ nhớ phiên.');
  };
  const addFiles = (list: File[]) => {
    const { accepted, rejected } = checkUploads(list, files.length);
    dispatch({ type: 'upload-error', text: rejected.length ? rejected.map((x) => `${x.name}: ${x.reason}`).join('; ') : '' });
    if (!accepted.length) return;
    // Chỉ giữ tên / kích thước / loại – KHÔNG tạo object URL (chưa có backend để xem/tải tệp thật).
    dispatch({ type: 'files-added', files: accepted.map((f) => ({ name: f.name, size: f.size, kind: uploadKind(f.name) })) });
    announce(`Đã thêm ${accepted.length} tệp (chưa tải lên máy chủ).`);
  };
  const removeFile = (f: TempFile) => {
    dispatch({ type: 'file-removed', id: f.id });
    announce(`Đã bỏ tệp ${f.name}.`);
  };
  const submit = async () => {
    dispatch({ type: 'submit-start' });
    const e = validateAlertUpdate(input, check, appNow());
    if (hasErrors(e)) {
      announce('Chưa lưu được – xem các mục cần bổ sung.');
      return;
    }
    dispatch({ type: 'submit-sent' });
    const res = await modal.submit(input);
    if (res && !res.ok) dispatch({ type: 'submit-rejected', errors: res.errors });
  };

  return {
    cfg,
    steps,
    verItems,
    verText,
    normalId,
    warn,
    values: v,
    set,
    setInspection: (id: string, entry: InspectionEntry) => dispatch({ type: 'inspection', id, entry }),
    toggleVerification: (id: string, on: boolean) => dispatch({ type: 'verification', id, on }),
    files,
    uploadError: state.uploadError,
    addFiles,
    removeFile,
    editable,
    primaryLost: primary.reading.state === 'lost',
    readingRows,
    close,
    warnings: updateWarnings(input, check),
    shown,
    err,
    issues,
    blocked: triedSubmit && issues.length > 0,
    resolved,
    followActive: resolved && v.followUp.choice !== 0,
    followWindow: followUpWindow(v.followUp.choice, customIso, now),
    submitError: state.submitError,
    initialDraft: initial.draft,
    modal,
    saveDraft,
    submit,
  };
}
