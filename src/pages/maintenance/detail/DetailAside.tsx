import { Link } from 'react-router-dom';
import { AlertCard, AlertTriangleIcon, AssigneeCard, Card } from '@/components';
import type { AlertRecord } from '@/data/alerts';
import { SHIFTS, type MaintenanceRecord } from '@/data/maintenance';
import { assignMode } from '@/features/maintenance/assign';
import { RelatedDeviceCard } from './LiveCards';

/** "Ca 1 (06:00 - 14:00)" → "Ca 1" (ảnh chỉ ghi tên ca). */
const shiftShort = (id?: string) => SHIFTS.find((s) => s.value === id)?.label.split(' (')[0];

export type DetailAsideProps = {
  record: MaintenanceRecord;
  /** Cảnh báo gốc (nếu tìm thấy). */
  alert: AlertRecord | undefined;
  canWrite: boolean;
  onAssign: () => void;
};

/** Cột phải: người phụ trách (Phân công / Đổi người theo bước), cảnh báo liên quan, thiết bị liên quan (số liệu trực tiếp). */
export function DetailAside({ record: r, alert, canWrite, onAssign }: DetailAsideProps) {
  return (
    <aside aria-label="Phân công và liên quan" className="flex min-w-0 flex-col gap-4 xl:col-start-2 xl:row-start-2">
      <AssigneeCard
        assignee={r.assignee}
        department={r.department}
        shift={shiftShort(r.shift)}
        // Phân công (Chờ tiếp nhận) / Đổi người (Đã phân công, Đang thực hiện); Chờ nghiệm thu / xong / hủy: không có nút.
        onAssign={canWrite && assignMode(r.status) ? onAssign : undefined}
        assignLabel={assignMode(r.status) === 'assign' ? 'Phân công người xử lý' : 'Đổi người xử lý'}
      />
      <Card title="Cảnh báo liên quan" icon={<AlertTriangleIcon size={18} className="text-fg-secondary" />} headerVariant="divided" radius="lg">
        {alert ? (
          <AlertCard
            variant="compact"
            id={alert.id}
            severity={alert.severity}
            code={alert.code}
            device={alert.device}
            message={alert.message}
            value={`${alert.value} ${alert.unit}`}
            threshold={`${alert.threshold} ${alert.unit}`}
            handling="action-required"
            valueLabel="Lúc cảnh báo"
            footer={
              <Link to={`/alerts?alert=${alert.id}&range=30d`} className="self-start rounded-sm text-xs text-accent hover:underline">
                Xem chi tiết cảnh báo →
              </Link>
            }
          />
        ) : (
          <p className="text-base text-fg-secondary">{r.sourceAlertId ? `Không tìm thấy cảnh báo ${r.sourceAlertId}.` : 'Không có cảnh báo liên quan.'}</p>
        )}
      </Card>
      <RelatedDeviceCard device={r.device} />
    </aside>
  );
}
