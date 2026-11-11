import { SEVERITY_OPTIONS, tableValue, type AlertRecord } from '@/data/alerts';
import { plantDayKey } from '@/lib/plantTime';
import { dayLabel } from './alertTable';
import { downloadCsv, toCsv } from '@/lib/download';

const STATUS_LABEL = { unacknowledged: 'Chưa xác nhận', 'in-progress': 'Đang xử lý', resolved: 'Đã xử lý (chờ đóng)', done: 'Hoàn thành' } as const;

/** Xuất CSV các cảnh báo đang lọc (UTF-8 BOM để Excel đọc đúng tiếng Việt). */
export function exportAlertsCsv(rows: readonly AlertRecord[]) {
  const head = ['Ngày', 'Thời gian', 'Mức độ', 'Mã CB', 'Nội dung', 'Thiết bị', 'Khu vực', 'Giá trị/Ngưỡng', 'Trạng thái', 'Người xử lý'];
  const sev = Object.fromEntries(SEVERITY_OPTIONS.map((o) => [o.value, o.label]));
  const lines = rows.map((a) => [
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
  ]);
  // Ngày theo giờ nhà máy (toISOString là UTC → lệch ngày từ 0h đến 7h sáng).
  downloadCsv(toCsv([head, ...lines]), `canh-bao-${plantDayKey(new Date())}.csv`);
}
