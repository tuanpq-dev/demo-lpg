import { SEVERITY_OPTIONS, tableValue, type AlertRecord } from '@/data/alerts';
import { plantDayKey } from '@/lib/plantTime';
import { dayLabel } from './alertTable';

const STATUS_LABEL = { unacknowledged: 'Chưa xác nhận', 'in-progress': 'Đang xử lý', resolved: 'Đã xử lý (chờ đóng)', done: 'Hoàn thành' } as const;

/** Xuất CSV các cảnh báo đang lọc (UTF-8 BOM để Excel đọc đúng tiếng Việt). */
export function exportAlertsCsv(rows: readonly AlertRecord[]) {
  const head = ['Ngày', 'Thời gian', 'Mức độ', 'Mã CB', 'Nội dung', 'Thiết bị', 'Khu vực', 'Giá trị/Ngưỡng', 'Trạng thái', 'Người xử lý'];
  const sev = Object.fromEntries(SEVERITY_OPTIONS.map((o) => [o.value, o.label]));
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map((a) =>
    [
      dayLabel(a.daysAgo),
      a.time,
      sev[a.severity] ?? a.severity,
      a.code,
      a.message,
      a.device,
      a.area,
      tableValue(a),
      STATUS_LABEL[a.status],
      a.assignee ?? '',
    ]
      .map(esc)
      .join(','),
  );
  const blob = new Blob(['\uFEFF' + [head.map(esc).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  // Ngày theo giờ nhà máy (toISOString là UTC → lệch ngày từ 0h đến 7h sáng).
  link.download = `canh-bao-${plantDayKey(new Date())}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
