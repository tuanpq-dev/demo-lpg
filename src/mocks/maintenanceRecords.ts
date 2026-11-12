/**
 * Mock yêu cầu bảo trì – Figma 70:3964. Ngày tính TƯƠNG ĐỐI theo hôm nay (Figma: hôm nay = 15/10).
 * Đây là NGUỒN DUY NHẤT: KPI, thẻ ưu tiên, số đếm Tabs, Lịch sắp tới đều suy ra từ danh sách này (ở mock server).
 * Nạp LƯỜI (`data/maintenanceStore.ts` → `maintenanceReady`) – không nằm trong chunk các trang.
 */
import { checklistProgress } from '@/features/maintenance/checklist';
import type { MaintenanceRecord } from '@/features/maintenance/types';
import { DETAILS } from './maintenanceDetails';
import { at, isoDay } from './maintenanceDates';
import { seeds } from './maintenanceSeeds';

export const maintenanceRecords: MaintenanceRecord[] = seeds.map(({ created, due, dueTime, completed, ...s }) => {
  const r: MaintenanceRecord = {
    ...s,
    id: s.code,
    createdAt: isoDay(created),
    dueAt: at(due, dueTime),
    ...(dueTime ? {} : { dueHasTime: false }),
    completedAt: completed === undefined ? null : isoDay(completed),
    ...DETAILS[s.code]?.(),
  };
  // Tiến độ của bản ghi có checklist = tính từ checklist (bỏ mục Không áp dụng).
  if (r.checklist?.length) r.progress = checklistProgress(r.checklist).percent;
  return r;
});
