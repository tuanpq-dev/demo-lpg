/*
 * Hạng mục kiểm tra = bước "Hướng dẫn xử lý" của drawer – MỘT danh sách theo loại cảnh báo (`ALERT_KINDS[kind].steps`),
 * MỘT nguồn dữ liệu (`AlertRecord.guide`). Drawer hiện gọn (tick = Đạt), modal "Cập nhật xử lý" áp suất hiện chi tiết
 * (Chưa kiểm tra / Đạt / Có vấn đề / Không áp dụng + người, giờ, ghi chú).
 *
 * `guide[id]` có hai dạng: cũ `{ at, by }` (chỉ tick) = Đạt; mới có `status`. Mọi nơi đọc qua
 * `inspectionEntry` / `inspectionItems` ở đây – không tự kiểm tra dạng dữ liệu ở chỗ khác. Thuần, có test.
 */
import type { AlertGuideEntry, AlertGuideProgress, InspectionStatus } from '@/features/alerts/types';

export type { InspectionStatus };

export const INSPECTION_STATUS_LABEL: Record<InspectionStatus, string> = {
  pending: 'Chưa kiểm tra',
  pass: 'Đạt',
  issue: 'Có vấn đề',
  na: 'Không áp dụng',
};

export const INSPECTION_STATUSES: readonly InspectionStatus[] = ['pending', 'pass', 'issue', 'na'];

/** Hạng mục đã chuẩn hoá. `by`/`at` chỉ có khi đã kiểm tra (status ≠ pending). */
export type InspectionEntry = { status: InspectionStatus; by?: string; at?: string; note: string };

/** Đọc một hạng mục từ `guide` (dạng cũ hoặc mới). Thiếu → Chưa kiểm tra. */
export function inspectionEntry(guide: AlertGuideProgress | undefined, id: string): InspectionEntry {
  const raw: AlertGuideEntry | undefined = guide?.[id];
  if (!raw) return { status: 'pending', note: '' };
  const status: InspectionStatus = raw.status ?? 'pass';
  const note = raw.note ?? '';
  return status === 'pending' ? { status, note } : { status, by: raw.by, at: raw.at, note };
}

export type InspectionItem = InspectionEntry & { id: string; text: string };

/** Danh sách hạng mục theo thứ tự cấu hình (chữ đã điền `{device}`…). */
export function inspectionItems(steps: readonly { id: string; text: string }[], guide: AlertGuideProgress | undefined): InspectionItem[] {
  return steps.map((s) => ({ id: s.id, text: s.text, ...inspectionEntry(guide, s.id) }));
}

/** Đếm đã kiểm tra (mọi trạng thái ≠ Chưa kiểm tra) – tiến độ ở drawer. */
export const inspectedCount = (items: readonly Pick<InspectionEntry, 'status'>[]) => items.filter((i) => i.status !== 'pending').length;

/** Ghi một hạng mục về dạng lưu (pending không ghi chú → xoá khỏi guide). */
export function writeInspection(
  guide: AlertGuideProgress | undefined,
  id: string,
  e: InspectionEntry,
  ctx: { by: string; at: Date },
): AlertGuideProgress {
  const next: Record<string, AlertGuideEntry> = { ...(guide ?? {}) };
  const note = e.note.trim();
  if (e.status === 'pending' && !note) delete next[id];
  else next[id] = { status: e.status, by: e.by ?? ctx.by, at: e.at ?? ctx.at.toISOString(), ...(note ? { note } : {}) };
  return next;
}

/**
 * Drawer: tick/bỏ tick nhanh. Chưa kiểm tra → Đạt; Đạt → Chưa kiểm tra (giữ ghi chú nếu có). Có vấn đề / Không áp dụng
 * → khoá ở drawer (đổi trong modal) → trả `null` (không đổi).
 */
export function toggledInspection(cur: InspectionEntry): InspectionEntry | null {
  if (cur.status === 'pending') return { status: 'pass', note: cur.note };
  if (cur.status === 'pass') return { status: 'pending', note: cur.note };
  return null;
}

/** Đổi trạng thái trong modal: tự điền người + giờ (về Chưa kiểm tra → bỏ người/giờ). */
export function setInspectionStatus(cur: InspectionEntry, status: InspectionStatus, ctx: { by: string; at: Date }): InspectionEntry {
  if (status === cur.status) return cur;
  return status === 'pending' ? { status, note: cur.note } : { status, note: cur.note, by: ctx.by, at: ctx.at.toISOString() };
}

/** Lỗi theo hạng mục: "Có vấn đề" bắt buộc ghi chú. */
export function inspectionErrors(items: Readonly<Record<string, InspectionEntry>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, e] of Object.entries(items)) if (e.status === 'issue' && !e.note.trim()) out[id] = 'Nhập ghi chú cho hạng mục có vấn đề.';
  return out;
}
