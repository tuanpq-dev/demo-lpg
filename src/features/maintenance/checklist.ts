/*
 * Checklist yêu cầu bảo trì – thuần (không React, không gọi Date.now()).
 */
import { plantDateTimeKey } from '@/lib/plantTime';
import type { MaintenanceChecklistItem, MaintenanceStatus } from '@/features/maintenance/types';

export type ChecklistProgress = { done: number; total: number; percent: number };

/**
 * Tiến độ = số mục đã xong / số mục áp dụng (bỏ mục "Không áp dụng"), làm tròn %.
 * Ảnh ghi "2/7 · 28%" (tính cả mục N/A) → ở đây 2/6 · 33% (đã duyệt, docs/figma-diffs.md).
 */
export function checklistProgress(items: readonly MaintenanceChecklistItem[] | undefined): ChecklistProgress {
  const applicable = (items ?? []).filter((c) => !c.na);
  const done = applicable.filter((c) => c.done).length;
  const total = applicable.length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

/**
 * Khi nào được tick:
 * - `null`: được tick (Đã phân công / Đang thực hiện).
 * - `'pending'`: khoá, gợi ý "Tiếp nhận yêu cầu trước".
 * - `'readonly'`: chỉ đọc (Chờ nghiệm thu / Hoàn thành / Đã hủy).
 * Mục "Không áp dụng" luôn khoá, bất kể trạng thái.
 */
export function checklistLock(status: MaintenanceStatus): 'pending' | 'readonly' | null {
  if (status === 'assigned' || status === 'in-progress') return null;
  if (status === 'pending') return 'pending';
  return 'readonly';
}

export const CHECKLIST_LOCK_HINT: Record<'pending' | 'readonly', string> = {
  pending: 'Tiếp nhận yêu cầu trước khi cập nhật checklist.',
  readonly: 'Checklist chỉ đọc ở trạng thái này.',
};

/** Đảo trạng thái một mục: xong → ghi giờ (giờ nhà máy) + bỏ "Đang làm"; bỏ tick → xoá giờ. Mục N/A / id lạ → giữ nguyên. */
export function toggleChecklistItem(
  items: readonly MaintenanceChecklistItem[],
  id: string,
  now: Date,
): MaintenanceChecklistItem[] {
  return items.map((c) => {
    if (c.id !== id || c.na) return c;
    if (c.done) {
      const { doneAt: _drop, ...rest } = c;
      return { ...rest, done: false };
    }
    const { active: _active, ...rest } = c;
    return { ...rest, done: true, doneAt: plantDateTimeKey(now) };
  });
}
