import { useReducer, useState } from 'react';
import type { AttachedFile } from '@/components';
import { clearRecordDraft, loadRecordDraft, recordCheckpoint, saveRecordDraft } from '@/data/checkpointRecord';
import {
  appendRemark,
  recordBlockers,
  recordGroups,
  recordProgress,
  recordQuality,
  sensorSummary,
  type CheckpointSnapshot,
  type ManualValues,
  type ReportRecord,
} from '@/features/reports';
import { announce } from '@/lib/announce';
import { useFormModal } from '@/lib/useFormModal';

export type RecordFormState = {
  remark: string;
  /** Giá trị đồng hồ cơ nhập tay (ghi đè số IoT) theo id ô. */
  manual: ManualValues;
  /** Tệp chỉ giữ trong phiên (không vào nháp). */
  files: AttachedFile[];
  /** Bảng bồn đang mở ô nhập đồng hồ cơ cho mọi dòng. */
  editingGauge: boolean;
  /** Lỗi lưu nháp / xác nhận (mạng, máy chủ, `{ ok: false }`). */
  error: string;
};

export type RecordFormAction =
  | { type: 'remark'; value: string }
  | { type: 'append-remark'; text: string }
  | { type: 'manual'; id: string; value: number | null }
  | { type: 'files'; files: AttachedFile[] }
  | { type: 'toggle-gauge' }
  | { type: 'error'; text: string };

/** Sửa nhận xét / số nhập tay → bỏ lỗi; chèn câu gợi ý, đổi tệp, bật ô đồng hồ cơ → giữ lỗi (như trước khi tách). */
function recordFormReducer(s: RecordFormState, a: RecordFormAction): RecordFormState {
  switch (a.type) {
    case 'remark':
      return { ...s, remark: a.value, error: '' };
    case 'append-remark':
      return { ...s, remark: appendRemark(s.remark, a.text) };
    case 'manual': {
      const manual = { ...s.manual };
      if (a.value === null) delete manual[a.id];
      else manual[a.id] = a.value;
      return { ...s, manual, error: '' };
    }
    case 'files':
      return { ...s, files: a.files };
    case 'toggle-gauge':
      return { ...s, editingGauge: !s.editingGauge };
    case 'error':
      return { ...s, error: a.text };
  }
}

/**
 * State + kiểm tra của "Ghi nhận mốc kiểm tra" (reducer `recordFormReducer`): nhận xét, số đồng hồ cơ, tệp, lỗi; suy ra
 * nhóm thiết bị / tiến độ / chất lượng / cảm biến / lý do chặn (`features/reports/record.ts`). Vòng đời modal qua
 * `useFormModal`: "Lưu bản nháp" ở lại, "Lưu và tiếp tục sau" đóng, hỏi khi đóng chỉ theo "đã sửa". Nháp sessionStorage theo mã + mốc.
 */
export function useCheckpointRecordForm(r: ReportRecord, checkpoint: string, snapshot: CheckpointSnapshot, onClose: () => void) {
  const [initialDraft] = useState(() => loadRecordDraft(r.code, checkpoint));
  const [state, dispatch] = useReducer(recordFormReducer, undefined, () => ({
    remark: initialDraft?.remark ?? '',
    manual: initialDraft?.manual ?? {},
    files: [],
    editingGauge: false,
    error: '',
  }));
  const { remark, manual, files } = state;

  const groups = recordGroups(snapshot, manual);
  const blockers = recordBlockers(groups, remark);
  const ready = blockers.length === 0;

  const modal = useFormModal({
    initial: { remark: '', manual: {}, files: 0 },
    values: { remark, manual, files: files.length },
    // Nhận xét chỉ có khoảng trắng = chưa sửa; có nhập tay hoặc tệp = đã sửa (kể cả sau khi lưu nháp).
    isDirty: (v) => !!v.remark.trim() || Object.keys(v.manual).length > 0 || v.files > 0,
    draft: {
      exists: !!initialDraft,
      save: (v) => saveRecordDraft(r.code, checkpoint, { remark: v.remark, manual: { ...v.manual }, savedAt: new Date().toISOString() }),
      clear: () => clearRecordDraft(r.code, checkpoint),
    },
    onSubmit: (input: { remark: string; manual: ManualValues; files: string[] }) => recordCheckpoint(r.id, checkpoint, input),
    onClose,
    onSubmitError: (text) => dispatch({ type: 'error', text }),
    // Hai nút nháp: "Lưu bản nháp" ở lại, "Lưu và tiếp tục sau" đóng (gọi onClose sau khi lưu được). Hỏi khi đóng chỉ theo "đã sửa".
    stayOpenAfterDraft: true,
    confirmIfDraft: false,
  });

  const saveDraft = (thenClose: boolean) => {
    if (!modal.saveDraft()) {
      dispatch({ type: 'error', text: 'Không lưu được nháp (bộ nhớ trình duyệt không khả dụng).' });
      return;
    }
    announce(`Đã lưu nháp mốc ${checkpoint} – ${r.code}${files.length ? ' (tệp đính kèm không lưu trong nháp)' : ''}.`);
    if (thenClose) onClose();
  };

  const submit = async () => {
    if (!ready || modal.submitting) return;
    const res = await modal.submit({ remark, manual, files: files.map((f) => f.name) });
    if (!res) return; // lỗi mạng / máy chủ – đã hiện qua onSubmitError
    if (!res.ok) return dispatch({ type: 'error', text: res.error });
    announce(`Đã xác nhận mốc ${checkpoint} – báo cáo ${r.code}.`);
    onClose();
  };

  return {
    ...state,
    snapshot,
    groups,
    progress: recordProgress(groups),
    quality: recordQuality(snapshot, manual),
    sensors: sensorSummary(snapshot),
    blockers,
    ready,
    remarkMissing: !remark.trim(),
    /** Mở từ nháp đã lưu (dòng "Đang mở bản nháp đã lưu."). */
    fromDraft: !!initialDraft,
    modal,
    setRemark: (value: string) => dispatch({ type: 'remark', value }),
    appendRemark: (text: string) => dispatch({ type: 'append-remark', text }),
    onManual: (id: string, value: number | null) => dispatch({ type: 'manual', id, value }),
    setFiles: (next: AttachedFile[]) => dispatch({ type: 'files', files: next }),
    toggleGauge: () => dispatch({ type: 'toggle-gauge' }),
    saveDraft,
    submit,
  };
}

export type CheckpointRecordForm = ReturnType<typeof useCheckpointRecordForm>;
