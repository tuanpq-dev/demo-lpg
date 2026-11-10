import { Link } from 'react-router-dom';
import { assetPath } from '@/app/assetRoutes';
import { Placeholder } from '@/app/Placeholder';
import { Card, DeadlineCountdownCard, DeviceArmIcon, KpiCard, StatusDot, type KpiTone } from '@/components';
import { resolveAssetId, type Reading } from '@/data/assetDetail';
import { dueHasTime, type MaintenanceRecord } from '@/data/maintenance';
import { useRelatedDevice } from '@/data/maintenanceDetail';
import { deadlineCountdown, deadlineDayLabel } from '@/features/maintenance/deadline';
import { useNow } from '@/lib/useNow';

/** Ô "Hạn chót xử lý" – đồng hồ chạy mỗi giây riêng ở đây (không vẽ lại cả trang). */
export function LiveDeadline({ record }: { record: MaintenanceRecord }) {
  const now = useNow(1000);
  const open = record.status !== 'done' && record.status !== 'cancelled';
  const hasTime = dueHasTime(record);
  return (
    <DeadlineCountdownCard
      countdown={open ? deadlineCountdown(record.dueAt, now, hasTime) : null}
      dueText={deadlineDayLabel(record.dueAt, now, hasTime)}
      closedText={record.status === 'done' ? 'Đã hoàn thành' : 'Đã hủy'}
    />
  );
}

const readingTone = (r: Reading): KpiTone => (r.status === 'danger' ? 'danger' : r.status === 'warning' ? 'warning' : 'neutral');
const DOT = { danger: 'danger', warning: 'warning', offline: 'offline', normal: 'success' } as const;
const DOT_LABEL = { danger: 'Nguy hiểm', warning: 'Cảnh báo', offline: 'Mất tín hiệu', normal: 'Bình thường' } as const;

/** "Thiết bị liên quan" – số liệu trực tiếp (PT/TT/mức % thể tích) qua useLiveData; "Mất tín hiệu" khi stale. */
export function RelatedDeviceCard({ device }: { device: string }) {
  const view = useRelatedDevice(device);
  const assetId = resolveAssetId(device);
  return (
    <Card title="Thiết bị liên quan" icon={<DeviceArmIcon size={18} className="text-fg-secondary" />} headerVariant="divided" radius="lg">
      {view.kind === 'loading' ? (
        <Placeholder label="Đang tải số liệu…" height={120} />
      ) : view.kind === 'none' ? (
        <p className="text-base text-fg-secondary">{device} – chưa có số liệu trực tiếp cho thiết bị này.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="flex items-center justify-between gap-2 text-base text-fg">
            <span>
              {view.id} ({view.name})
            </span>
            <StatusDot status={DOT[view.status]} label={`Trạng thái: ${DOT_LABEL[view.status]}`} />
          </p>
          <div className="grid grid-cols-2 gap-2">
            <KpiCard
              size="sm"
              label="Áp suất"
              value={view.pressure.value?.toFixed(1) ?? '—'}
              unit="bar"
              tone={readingTone(view.pressure)}
              signalLost={view.pressure.state === 'lost'}
            />
            <KpiCard
              size="sm"
              label="Nhiệt độ"
              value={view.temperature.value?.toFixed(1) ?? '—'}
              unit="°C"
              tone={readingTone(view.temperature)}
              signalLost={view.temperature.state === 'lost'}
            />
            <KpiCard
              size="sm"
              className="col-span-2"
              label="Mức lỏng"
              hint="% thể tích toàn bộ chất lỏng (cùng cách tính KPI Mức bồn)"
              value={view.levelPct?.toFixed(1) ?? '—'}
              unit="%"
              tone={readingTone(view.level)}
              signalLost={view.level.state === 'lost'}
            />
          </div>
        </div>
      )}
      {assetId && (
        <Link to={assetPath(assetId)} className="mt-3 self-start rounded-sm text-xs text-accent hover:underline">
          Xem chi tiết thiết bị →
        </Link>
      )}
    </Card>
  );
}
