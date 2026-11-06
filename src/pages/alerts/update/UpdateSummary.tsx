import { Badge, InfoGrid } from '@/components';
import { alertDateTimeLabel, alertMetric, metricText } from '@/data/alertDetail';
import { assetName } from '@/data/assetDetail';
import { alertBadgeStatus, type AlertRecord } from '@/data/alerts';
import { areaLabel } from '@/features/plant/areas';

/** Thẻ đầu modal "Cập nhật xử lý": mã, nội dung, thiết bị, khu vực, mức độ, người xử lý, trạng thái, thời gian, giá trị / ngưỡng. */
export function UpdateSummary({ alert: a, now }: { alert: AlertRecord; now: Date }) {
  const metric = alertMetric(a);
  return (
    <div className="rounded-lg border border-line/30 bg-surface-sunken/30 p-4">
      <InfoGrid
        items={[
          { id: 'code', label: 'Mã cảnh báo', value: a.code },
          { id: 'message', label: 'Nội dung', value: a.message, tone: 'danger' },
          { id: 'device', label: 'Thiết bị', value: assetName(a.device) ?? a.device, newRow: true },
          { id: 'area', label: 'Khu vực', value: areaLabel(a.area) },
          { id: 'severity', label: 'Mức độ', value: <Badge variant="severity" value={a.severity} size="chip" /> },
          { id: 'assignee', label: 'Người xử lý', value: a.assignee ?? '–' },
          { id: 'status', label: 'Trạng thái', value: <Badge variant="status" value={alertBadgeStatus(a.status)} />, newRow: true },
          { id: 'time', label: 'Thời gian bắt đầu', value: alertDateTimeLabel(a, now) },
          { id: 'value', label: 'Giá trị lúc cảnh báo', value: metricText(metric.value, metric.unit), tone: 'danger' },
          { id: 'threshold', label: 'Ngưỡng cho phép', value: metricText(metric.threshold, metric.unit) },
        ]}
      />
    </div>
  );
}
