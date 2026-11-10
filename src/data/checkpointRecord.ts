/*
 * Lớp dữ liệu modal "Ghi nhận mốc kiểm tra" (báo cáo ngày). Ảnh chụp số liệu IoT của mốc là mock (`buildCheckpointSnapshot`);
 * ghi mốc cập nhật CÙNG store `useReports` → danh sách, chi tiết ngày, bảng số liệu đổi theo.
 */
import {
  applyCheckpointRecord,
  canRecordCheckpoint,
  manualForDaily,
  recordBlockers,
  recordGroups,
  type CheckpointSnapshot,
  type ManualValues,
  type ReportRecord,
} from '@/features/reports';
import { appNow } from '@/lib/demoNow';
import { createSessionDraft } from '@/lib/sessionDraft';
import { buildCheckpointSnapshot } from '@/mocks/checkpointRecord';
import { currentReports, replaceReport } from './reports';

/**
 * Số liệu IoT/PLC của mốc. TODO(backend): `api.request('/reports/:code/checkpoints/:key/snapshot', { schema })` – hợp đồng ở
 * docs/decisions.md ("Báo cáo – hợp đồng API cần bổ sung").
 */
export function fetchCheckpointSnapshot(report: ReportRecord, key: string): CheckpointSnapshot {
  return buildCheckpointSnapshot(report, key, appNow());
}

// ---- Nháp (sessionStorage theo mã báo cáo + mốc). Tệp đính kèm KHÔNG lưu trong nháp.
export type RecordDraft = { remark: string; manual: Record<string, number>; savedAt: string };

const isNumberRecord = (v: unknown): v is Record<string, number> =>
  !!v && typeof v === 'object' && Object.values(v as object).every((x) => typeof x === 'number' && Number.isFinite(x));

const drafts = createSessionDraft<RecordDraft>('demo-lpg:report-record-draft:', (raw) => {
  const d = raw as Partial<RecordDraft> | null;
  return d && typeof d.remark === 'string' && isNumberRecord(d.manual) && typeof d.savedAt === 'string'
    ? { remark: d.remark, manual: d.manual, savedAt: d.savedAt }
    : null;
});
const draftId = (code: string, key: string) => `${code}@${key}`;
export const loadRecordDraft = (code: string, key: string) => drafts.load(draftId(code, key));
export const saveRecordDraft = (code: string, key: string, d: RecordDraft) => drafts.save(draftId(code, key), d);
export const clearRecordDraft = (code: string, key: string) => drafts.clear(draftId(code, key));

export type RecordCheckpointInput = { remark: string; manual: ManualValues; files: readonly string[] };
export type RecordResult = { ok: true; record: ReportRecord } | { ok: false; error: string };

/**
 * Xác nhận mốc `key` của báo cáo `id`. Kiểm LẠI từ dữ liệu hiện tại (mốc còn thiếu, đủ nhóm, có nhận xét).
 * TODO(backend): `PUT /reports/:code/checkpoints/:key` `{ remark, manual, files }`; người ghi = người đăng nhập (hiện: người kiểm tra
 * của báo cáo).
 */
export async function recordCheckpoint(id: string, key: string, input: RecordCheckpointInput): Promise<RecordResult> {
  const now = appNow();
  const r = currentReports().find((x) => x.id === id);
  if (!r || !canRecordCheckpoint(r, key, now)) return { ok: false, error: `Mốc ${key} không còn chờ ghi nhận.` };
  const snapshot = fetchCheckpointSnapshot(r, key);
  const blockers = recordBlockers(recordGroups(snapshot, input.manual), input.remark);
  if (blockers.length) return { ok: false, error: `Chưa đủ điều kiện xác nhận: ${blockers.join('; ')}.` };
  const record = applyCheckpointRecord(r, key, {
    by: r.inspector,
    remark: input.remark,
    manual: manualForDaily(snapshot, input.manual),
    files: input.files,
    at: now,
  });
  replaceReport(record);
  clearRecordDraft(r.code, key);
  return { ok: true, record };
}
