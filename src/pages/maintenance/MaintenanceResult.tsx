import { InfoGrid, type InfoGridItem } from '@/components';
import type { MaintenanceRecord } from '@/data/maintenance';
import { formatPlantDateTime } from '@/data/maintenanceDetail';
import {
  DEVICE_CONDITION_LABEL,
  REVIEW_RESULT_LABEL,
  SENSOR_STATUS_LABEL,
  VALVE_STATUS_LABEL,
  type ReadingSnapshot,
} from '@/features/maintenance/review';

const fmt = (s: ReadingSnapshot | undefined, unit: string) =>
  !s ? '—' : s.value === null ? 'Mất tín hiệu lúc gửi' : `${s.value.toFixed(1)}${unit.startsWith('°') ? unit : ` ${unit}`}${s.warn !== undefined ? ` (ngưỡng ${Number(s.warn.toFixed(2))})` : ''}`;

/**
 * Khối "Kết quả bảo trì" sau khi nghiệm thu ĐẠT: nguyên nhân, biện pháp, thông số đã chụp lúc gửi, tình trạng, kết quả, người +
 * thời gian nghiệm thu, theo dõi đến HH:MM. TODO(backend): cảnh báo tự động khi hết thời gian theo dõi.
 */
export function MaintenanceResult({ record: r }: { record: MaintenanceRecord }) {
  const sub = r.submission;
  const rv = r.review;
  if (!rv) return null;
  const items: InfoGridItem[] = [
    { id: 'result', label: 'Kết quả nghiệm thu', value: REVIEW_RESULT_LABEL[rv.result], tone: 'link' },
    { id: 'reviewer', label: 'Người nghiệm thu', value: rv.reviewer },
    { id: 'at', label: 'Thời gian nghiệm thu', value: formatPlantDateTime(rv.at) },
    {
      id: 'follow',
      label: 'Theo dõi thêm',
      value: rv.followUpUntil ? `${rv.followUpHours} giờ – đến ${rv.followUpUntil.slice(11, 16)}${rv.followUpUntil.slice(0, 10) !== rv.at.slice(0, 10) ? ` ${formatPlantDateTime(rv.followUpUntil).slice(0, 5)}` : ''}` : 'Không',
    },
    ...(sub
      ? [
          { id: 'cause', label: 'Nguyên nhân', value: sub.cause, newRow: true },
          { id: 'remedy', label: 'Biện pháp', value: sub.remedy },
          { id: 'condition', label: 'Tình trạng sau bảo trì', value: DEVICE_CONDITION_LABEL[sub.deviceCondition], tone: sub.deviceCondition === 'unresolved' ? ('danger' as const) : undefined },
          { id: 'by', label: 'Người thực hiện / gửi', value: `${sub.submittedBy} · ${formatPlantDateTime(sub.submittedAt)}` },
          { id: 'p', label: 'Áp suất lúc gửi', value: fmt(sub.readings.pressure, 'bar'), newRow: true },
          { id: 't', label: 'Nhiệt độ lúc gửi', value: fmt(sub.readings.temperature, '°C') },
          { id: 'sensor', label: 'Cảm biến', value: SENSOR_STATUS_LABEL[sub.sensorStatus] },
          { id: 'valve', label: 'Van xả', value: VALVE_STATUS_LABEL[sub.valveStatus] },
        ]
      : []),
    ...(rv.comment ? [{ id: 'comment', label: 'Ý kiến đánh giá', value: rv.comment, newRow: true }] : []),
  ];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-base text-fg">
        Hoàn thành ngày {r.completedAt ? formatPlantDateTime(r.completedAt) : '—'} · tiến độ {r.progress}%.
      </p>
      <InfoGrid items={items} />
    </div>
  );
}
