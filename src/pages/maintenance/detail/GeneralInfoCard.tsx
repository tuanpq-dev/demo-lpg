import { Link } from 'react-router-dom';
import { assetPath } from '@/app/assetRoutes';
import { Card, ExternalLinkIcon, InfoGrid, InfoIcon, type InfoGridItem } from '@/components';
import { resolveAssetId } from '@/data/assetDetail';
import {
  FORM_TYPE_OPTIONS,
  PRIORITY_OPTIONS,
  SOURCE_OPTIONS,
  STATUS_LABEL,
  dueHasTime,
  formatDate,
  type MaintenanceRecord,
} from '@/data/maintenance';
import { formatPlantDateTime, relativeDayTime } from '@/data/maintenanceDetail';
import { checklistProgress } from '@/features/maintenance/checklist';
import { deadlineDayLabel } from '@/features/maintenance/deadline';
import { HOLD_LABEL, reportedProgressOf } from '@/features/maintenance/progress';
import { daysFromToday } from '@/lib/plantTime';

const PRIORITY_LABEL = Object.fromEntries(PRIORITY_OPTIONS.map((o) => [o.value, o.label]));
const FORM_TYPE_LABEL = Object.fromEntries(FORM_TYPE_OPTIONS.map((o) => [o.value, o.label]));

/** Nhận diện: mã, ngày tạo, người tạo, nguồn, loại, ưu tiên, thiết bị (→ trang chi tiết thiết bị). */
function identityItems(r: MaintenanceRecord): InfoGridItem[] {
  const created = r.history?.find((h) => h.kind === 'create')?.at;
  const assetId = resolveAssetId(r.device);
  return [
    { id: 'code', label: 'Mã yêu cầu', value: r.code },
    { id: 'created', label: 'Ngày/giờ tạo', value: created ? formatPlantDateTime(created) : formatDate(r.createdAt) },
    { id: 'by', label: 'Người tạo', value: r.createdBy ?? '—' },
    {
      id: 'source',
      label: 'Nguồn tạo',
      value: r.sourceAlertId ? `Cảnh báo ${r.sourceAlertId}` : (SOURCE_OPTIONS.find((o) => o.value === r.source)?.label ?? '—'),
    },
    { id: 'type', label: 'Loại công việc', value: `${FORM_TYPE_LABEL[r.type]}${r.priority === 'critical' ? ' (Khẩn cấp)' : ''}` },
    {
      id: 'priority',
      label: 'Mức ưu tiên',
      value: PRIORITY_LABEL[r.priority],
      tone: r.priority === 'critical' ? 'danger' : r.priority === 'high' ? 'warning' : 'default',
    },
    {
      id: 'device',
      label: 'Thiết bị',
      tone: 'link',
      value: assetId ? (
        <Link to={assetPath(assetId)} className="inline-flex items-center gap-1 rounded-sm hover:underline">
          {r.device}
          <ExternalLinkIcon size={12} />
          <span className="sr-only">– mở trang chi tiết thiết bị</span>
        </Link>
      ) : (
        r.device
      ),
    },
  ];
}

/** Phân công + hạn: khu vực, phòng ban, người phụ trách, bắt đầu dự kiến, hạn (đỏ khi quá hạn / đến hạn hôm nay). */
function scheduleItems(r: MaintenanceRecord, now: Date, overdue: boolean): InfoGridItem[] {
  const closed = r.status === 'done' || r.status === 'cancelled';
  return [
    { id: 'area', label: 'Khu vực', value: r.area },
    { id: 'dept', label: 'Phòng ban', value: r.department ?? '—' },
    { id: 'assignee', label: 'Người phụ trách', value: r.assignee ?? 'Chưa phân công' },
    { id: 'start', label: 'Thời gian bắt đầu dự kiến', value: r.startAt ? formatPlantDateTime(r.startAt) : '-' },
    {
      id: 'due',
      label: 'Hạn hoàn thành',
      value: (
        <>
          {deadlineDayLabel(r.dueAt, now, dueHasTime(r))}
          {overdue && <span className="font-normal"> · Quá hạn</span>}
        </>
      ),
      // Đỏ khi quá hạn hoặc đến hạn trong hôm nay (ảnh: "16:00 Hôm nay" đỏ).
      tone: !closed && (overdue || daysFromToday(r.dueAt, now) <= 0) ? 'danger' : 'default',
    },
  ];
}

/** Trạng thái (+ tạm dừng / sự cố), tiến độ báo cáo, checklist, lý do tạm dừng. */
function stateItems(r: MaintenanceRecord, now: Date): InfoGridItem[] {
  const progress = checklistProgress(r.checklist);
  return [
    {
      id: 'status',
      label: 'Trạng thái',
      value: r.hold ? `${STATUS_LABEL[r.status]} · ${HOLD_LABEL[r.hold.kind]}` : STATUS_LABEL[r.status],
      tone: r.hold?.kind === 'blocked' ? 'danger' : r.status === 'pending' || r.hold ? 'warning' : 'default',
      newRow: true,
    },
    { id: 'reported', label: 'Tiến độ báo cáo', value: `${reportedProgressOf(r)}%` },
    { id: 'checklist', label: 'Checklist', value: r.checklist?.length ? `${progress.done}/${progress.total}` : 'Không có' },
    ...(r.hold
      ? [
          {
            id: 'hold',
            label: r.hold.kind === 'blocked' ? 'Sự cố đang gặp' : 'Lý do tạm dừng',
            value: `${r.hold.reason} (${relativeDayTime(r.hold.at, now)})`,
          },
        ]
      : []),
  ];
}

/** Các ô của "Thông tin chung" theo thứ tự hiển thị. */
const infoItems = (r: MaintenanceRecord, now: Date, overdue: boolean): InfoGridItem[] => [
  ...identityItems(r),
  ...scheduleItems(r, now, overdue),
  ...stateItems(r, now),
];

/** Khối "Thông tin chung". */
export function GeneralInfoCard({ record, now, overdue }: { record: MaintenanceRecord; now: Date; overdue: boolean }) {
  return (
    <Card title="Thông tin chung" icon={<InfoIcon size={18} className="text-fg-secondary" />} headerVariant="divided" radius="lg">
      <InfoGrid items={infoItems(record, now, overdue)} />
    </Card>
  );
}
