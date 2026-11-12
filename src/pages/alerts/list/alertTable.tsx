/** Cấu hình bảng /alerts: tab trạng thái, bộ lọc, cột. Tách từ AlertsPage. */
import { Badge, type DataTableColumn, type FilterDef, type Severity, type TabItem } from '@/components';
import { SEVERITY_OPTIONS, SHIFT_OPTIONS, alertBadgeStatus, tableValue, uniqueOptions, type AlertRecord } from '@/data/alerts';
import { FOLLOW_UP_DUE_LABEL, followUpDue, followUpLabel } from '@/features/alerts/followUp';
import { ALERT_HOLD_LABEL } from '@/features/alerts/update';

const readingTone: Record<Severity, string> = {
  critical: 'text-danger-text',
  high: 'text-warning',
  medium: 'text-fg',
  low: 'text-fg',
};

export const dayLabel = (d: number) => (d === 0 ? 'Hôm nay' : d === 1 ? 'Hôm qua' : `${d} ngày trước`);

export function alertTabs(counts: Readonly<Record<string, number>>): TabItem[] {
  return [
    { id: 'all', label: 'Tất cả', count: counts.all },
    { id: 'unacknowledged', label: 'Chưa xác nhận', count: counts.unacknowledged, countTone: 'danger' },
    { id: 'in-progress', label: 'Đang xử lý', count: counts['in-progress'], countTone: 'info' },
    // Ngoài Figma: cảnh báo Đã xử lý chờ xác nhận đóng – docs/figma-diffs.md.
    { id: 'resolved', label: 'Chờ đóng', count: counts.resolved },
    { id: 'done', label: 'Đã hoàn thành', count: counts.done },
  ];
}

/** Bộ lọc của bảng; Khu vực / Thiết bị lấy từ `facets` máy chủ trả về (giá trị có trong dữ liệu). */
export function alertFilterDefs(facets: { areas: readonly string[]; devices: readonly string[] }): FilterDef[] {
  return [
    { id: 'severity', label: 'Mức độ', options: SEVERITY_OPTIONS },
    { id: 'area', label: 'Khu vực', allLabel: 'Tất cả khu vực', options: uniqueOptions(facets.areas) },
    { id: 'device', label: 'Thiết bị', options: uniqueOptions(facets.devices) },
    { id: 'shift', label: 'Thời gian', options: SHIFT_OPTIONS },
  ];
}

/** Cờ Tạm dừng / Cần hỗ trợ + "Đang theo dõi đến HH:MM, mục tiêu …" + chip "Đến giờ kiểm tra lại" (docs/guide/alerts.md (4o), (4p)). */
function StatusCell({ alert: a, now }: { alert: AlertRecord; now: Date }) {
  const follow = followUpLabel(a, now);
  return (
    <span className="flex flex-col items-start gap-1">
      <Badge variant="status" value={alertBadgeStatus(a.status)} />
      {a.status === 'in-progress' && a.hold && (
        <Badge variant="tag" tone="warning">
          {ALERT_HOLD_LABEL[a.hold.kind]}
        </Badge>
      )}
      {follow && <span className="text-xs text-info">{follow}</span>}
      {followUpDue(a, now) && (
        <Badge variant="tag" tone="warning">
          {FOLLOW_UP_DUE_LABEL}
        </Badge>
      )}
    </span>
  );
}

function TimeCell({ alert: a }: { alert: AlertRecord }) {
  if (a.daysAgo === 0) return <>{a.time}</>;
  return (
    <span title={dayLabel(a.daysAgo)}>
      {a.time}
      <span className="block text-2xs text-fg-muted/65">{dayLabel(a.daysAgo)}</span>
    </span>
  );
}

export function alertColumns(now: Date): DataTableColumn<AlertRecord>[] {
  return [
    { id: 'time', header: 'Thời gian', width: 81, cell: (a) => <TimeCell alert={a} /> },
    { id: 'severity', header: 'Mức độ', width: 110, cell: (a) => <Badge variant="severity" value={a.severity} /> },
    { id: 'code', header: 'Mã CB', width: 90 },
    {
      id: 'message',
      header: 'Nội dung',
      align: 'start',
      width: 260,
      className: 'max-w-[260px] truncate text-fg',
      cell: (a) => <span title={a.message}>{a.message}</span>,
    },
    { id: 'device', header: 'Thiết bị', width: 72, className: 'text-info' },
    { id: 'area', header: 'Khu vực', width: 100 },
    { id: 'reading', header: 'Giá trị/Ngưỡng', width: 116, cell: (a) => <span className={readingTone[a.severity]}>{tableValue(a)}</span> },
    { id: 'status', header: 'Trạng thái', width: 120, cell: (a) => <StatusCell alert={a} now={now} /> },
    { id: 'assignee', header: 'Người xử lý', width: 110, className: 'text-fg opacity-75', cell: (a) => a.assignee ?? '–' },
  ];
}
