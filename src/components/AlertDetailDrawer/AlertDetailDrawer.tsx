import { Badge, type Severity, type WorkStatus } from '../Badge';
import { Button } from '../Button';
import { DetailDrawer } from '../DetailDrawer';
import { Icon } from '../Icon';

export type AlertDetailData = {
  id: string;
  code: string;
  severity: Severity;
  status: WorkStatus;
  message: string;
  device: string;
  area: string;
  /** Thời điểm đã định dạng, ví dụ "Hôm nay, 10:45:22". */
  time: string;
  /** Giá trị/ngưỡng đã định dạng, ví dụ "11.8 / 10.5 bar". */
  reading: string;
  assignee: string | null;
};

export type AlertDetailDrawerProps = {
  /** null = đóng. */
  alert: AlertDetailData | null;
  onClose: () => void;
  onAcknowledge?: (id: string) => void;
  onComplete?: (id: string) => void;
  /** Mở form "Tạo yêu cầu bảo trì" cho thiết bị của cảnh báo. */
  onCreateMaintenance?: (alert: AlertDetailData) => void;
  /** Tô màu giá trị đo theo mức độ (khớp bảng). */
  readingClassName?: string;
};

/** Chi tiết cảnh báo – dựng trên DetailDrawer (⚠ Figma chưa có thiết kế). */
export function AlertDetailDrawer({
  alert,
  onClose,
  onAcknowledge,
  onComplete,
  onCreateMaintenance,
  readingClassName,
}: AlertDetailDrawerProps) {
  return (
    <DetailDrawer
      open={alert !== null}
      onClose={onClose}
      contentKey={alert?.status}
      eyebrow="Chi tiết cảnh báo"
      title={alert?.code}
      badges={alert && <Badge variant="severity" value={alert.severity} size="md" />}
      description={alert?.message}
      summary={
        alert && (
          <div>
            <Badge variant="status" value={alert.status} />
          </div>
        )
      }
      fields={
        alert
          ? [
              { label: 'Thời gian', value: alert.time },
              { label: 'Thiết bị', value: <span className="text-info">{alert.device}</span> },
              { label: 'Khu vực', value: alert.area },
              { label: 'Giá trị / Ngưỡng', value: <span className={readingClassName}>{alert.reading}</span> },
              { label: 'Người xử lý', value: alert.assignee ?? '–' },
            ]
          : []
      }
      actions={
        alert && (
          <>
            {onCreateMaintenance && (
              <Button icon={<Icon name="add" />} onClick={() => onCreateMaintenance(alert)} className="mr-auto">
                Tạo yêu cầu bảo trì
              </Button>
            )}
            {alert.status === 'unacknowledged' && onAcknowledge && (
              <Button variant="primary" onClick={() => onAcknowledge(alert.id)}>
                Xác nhận
              </Button>
            )}
            {alert.status !== 'done' && onComplete && (
              <Button onClick={() => onComplete(alert.id)}>Đánh dấu hoàn thành</Button>
            )}
            {alert.status === 'done' && <span className="text-sm text-success">Cảnh báo đã được xử lý xong.</span>}
          </>
        )
      }
    />
  );
}
