import type { ReactNode } from 'react';
import { Badge } from '@/components';
import { alertRecordedValue, alertShortTimeLabel } from '@/data/alertDetail';
import type { AlertRecord } from '@/data/alerts';
import { cn } from '@/lib/cn';
import { areaLabel } from '@/features/plant/areas';

/** Hàng loạt: hiện tối đa bấy nhiêu mã, còn lại "+N". */
const MAX_CODES = 12;

/**
 * Thẻ đầu modal "Phân công xử lý cảnh báo" (ảnh `scratch/figma-ref/alert-assign-modal-design.png`).
 * Một cảnh báo: badge mức độ · mã + tiêu đề · badge trạng thái · Thiết bị · Khu vực · Thời gian phát hiện · "Lúc cảnh báo"
 * (ảnh ghi "Giá trị hiện tại" – đổi vì là số của bản ghi; loại `numericValue: false` → ẩn ô).
 * Hàng loạt: "Đã chọn N cảnh báo" + danh sách mã gọn.
 */
export function AlertAssignSummary({ alerts, now }: { alerts: readonly AlertRecord[]; now: Date }) {
  if (alerts.length !== 1) {
    const shown = alerts.slice(0, MAX_CODES);
    const critical = alerts.filter((a) => a.severity === 'critical').length;
    return (
      <section aria-label="Cảnh báo được chọn" className="flex flex-col gap-3 rounded-lg border border-line/30 bg-surface-raised/40 px-5 py-4">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-lg font-semibold text-fg">Đã chọn {alerts.length} cảnh báo</span>
          {critical > 0 && <span className="text-sm text-danger-text">{critical} nghiêm trọng</span>}
        </p>
        <ul aria-label="Mã cảnh báo" className="flex flex-wrap gap-1.5">
          {shown.map((a) => (
            <li key={a.id}>
              <Badge variant="tag" tone={a.severity === 'critical' ? 'danger' : 'neutral'}>
                {a.code}
              </Badge>
            </li>
          ))}
          {alerts.length > shown.length && (
            <li>
              <Badge variant="tag" tone="muted">
                +{alerts.length - shown.length}
              </Badge>
            </li>
          )}
        </ul>
      </section>
    );
  }

  const a = alerts[0]!;
  const critical = a.severity === 'critical';
  const recorded = alertRecordedValue(a);
  const items: { label: string; value: ReactNode }[] = [
    { label: 'Thiết bị', value: a.device },
    { label: 'Khu vực', value: areaLabel(a.area) },
    { label: 'Thời gian phát hiện', value: alertShortTimeLabel(a, now) },
  ];
  if (recorded) {
    items.push({
      label: 'Lúc cảnh báo',
      value: (
        <>
          <span className={recorded.breached ? 'text-danger-text' : undefined}>{recorded.value}</span>
          <span className="sr-only">, ngưỡng</span> / {recorded.threshold}
        </>
      ),
    });
  }
  return (
    <section
      aria-label={`Cảnh báo ${a.code}`}
      className={cn(
        'flex flex-col gap-4 rounded-lg border px-5 py-4',
        critical ? 'border-danger/40 bg-danger/5' : 'border-line/30 bg-surface-raised/40',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="flex min-w-0 flex-wrap items-center gap-3">
          <Badge variant="severity" value={a.severity} size="chip" withIcon={critical} />
          <span className={cn('text-lg font-semibold', critical ? 'text-danger-text' : 'text-fg')}>
            {a.code}: {a.message}
          </span>
        </p>
        <Badge variant="status" value={a.status} size="md" />
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-4">
        {items.map((it) => (
          <div key={it.label} className="flex min-w-0 flex-col gap-1">
            <dt className="text-base text-fg-secondary">{it.label}:</dt>
            <dd className="text-md font-semibold text-fg">{it.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
