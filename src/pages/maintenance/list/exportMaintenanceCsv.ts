import { PRIORITY_OPTIONS, STATUS_LABEL, TYPE_LABEL, formatDate, isOverdue, type MaintenanceRecord } from '@/data/maintenance';
import { checklistProgress } from '@/features/maintenance/checklist';
import { HOLD_LABEL, reportedProgressOf } from '@/features/maintenance/progress';
import { plantDayKey } from '@/lib/plantTime';

/** "2/6" hoặc "" (không có checklist). */
export const checklistText = (r: MaintenanceRecord) => {
  if (!r.checklist?.length) return '';
  const p = checklistProgress(r.checklist);
  return `${p.done}/${p.total}`;
};

/** Tải CSV các dòng đang lọc (BOM UTF-8, CRLF) – tên `bao-tri-<ngày nhà máy>.csv`. */
export function exportMaintenanceCsv(rows: readonly MaintenanceRecord[], now: Date) {
  const head = ['Mã yêu cầu', 'Ngày tạo', 'Nội dung', 'Thiết bị', 'Khu vực', 'Loại', 'Mức độ', 'Người PT', 'Hạn xử lý', 'Trạng thái', 'Tiến độ báo cáo (%)', 'Checklist', 'Quá hạn'];
  const pr = Object.fromEntries(PRIORITY_OPTIONS.map((o) => [o.value, o.label]));
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [r.code, formatDate(r.createdAt), r.title, r.device, r.area, TYPE_LABEL[r.type], pr[r.priority], r.assignee ?? '', formatDate(r.dueAt), r.hold ? `${STATUS_LABEL[r.status]} – ${HOLD_LABEL[r.hold.kind]}` : STATUS_LABEL[r.status], String(reportedProgressOf(r)), checklistText(r), isOverdue(r, now) ? 'Có' : '']
      .map(esc)
      .join(','),
  );
  const blob = new Blob(['﻿' + [head.map(esc).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  // Ngày theo giờ nhà máy (toISOString là UTC → lệch ngày từ 0h đến 7h sáng).
  a.download = `bao-tri-${plantDayKey(now)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
