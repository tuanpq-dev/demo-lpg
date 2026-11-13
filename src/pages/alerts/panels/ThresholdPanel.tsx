import { Link } from 'react-router-dom';
import { Icon, KpiCard, SignalLostIcon, ThresholdGauge, type KpiTone } from '@/components';
import { assetPath } from '@/app/assetRoutes';
import { resolveAssetId } from '@/data/assetDetail';
import { useRelatedDevice } from '@/data/maintenanceDetail';
import { alertGauge, alertMetric, alertPlaybook, metricText, useAlertLive } from '@/data/alertDetail';
import type { AlertRecord } from '@/data/alerts';
import { formatGaugeNumber, gaugeValueText } from '@/features/alerts/gauge';
import { withUnit } from '@/lib/number';
import { Pair, Section } from '../drawerParts';

/**
 * Panel MỘT ngưỡng (loại `panel: 'threshold'` – áp suất bồn và các loại cũ; ảnh drawer ALT-00128):
 * Thông số cảnh báo (giá trị LÚC cảnh báo + "Hiện tại" live nếu có tag, ngưỡng từ cấu hình tag, thanh đo) · Thiết bị liên quan ·
 * Nguyên nhân có thể (khi cấu hình có). Tách nguyên từ drawer cũ – không đổi hành vi.
 */
export function ThresholdPanel({ alert: a }: { alert: AlertRecord }) {
  const causes = alertPlaybook(a).causes;
  return (
    <>
      <AlertMetrics alert={a} />
      <Section title="Thiết bị liên quan">
        <RelatedDevice device={a.device} />
      </Section>
      {causes.length > 0 && (
        <Section title="Nguyên nhân có thể">
          <ul className="flex flex-col gap-2.5">
            {causes.map((c) => (
              <li key={c} className="flex items-start gap-3 text-md text-fg">
                <Icon name="danger" box={20} className="mt-0.5 shrink-0" />
                {c}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

/** "Thông số cảnh báo": giá trị LÚC cảnh báo (bản ghi) + "Hiện tại" trực tiếp nếu có tag; ngưỡng từ cấu hình tag; thanh đo. */
function AlertMetrics({ alert: a }: { alert: AlertRecord }) {
  const m = alertMetric(a);
  const live = useAlertLive(m.tag);
  const gauge = alertGauge(a);
  const scale = gauge.kind === 'scale' ? gauge.scale : null;
  const tone: KpiTone = (scale ? scale.breached : true) ? 'danger' : 'neutral';
  const current =
    live.state === 'none' ? undefined : live.state === 'ok' ? (
      <>Hiện tại: {withUnit(live.value!.toFixed(1), m.unit)}</>
    ) : live.state === 'lost' ? (
      <span className="inline-flex items-center gap-1">
        Hiện tại: <SignalLostIcon size={14} /> Mất tín hiệu
      </span>
    ) : (
      'Hiện tại: —'
    );
  return (
    <Section title="Thông số cảnh báo">
      <div className="grid grid-cols-2 gap-4">
        <KpiCard
          size="sm"
          valueSize="lg"
          label="Giá trị lúc cảnh báo"
          value={formatGaugeNumber(m.value)}
          unit={m.unit}
          tone={tone}
          footnote={current}
        />
        <KpiCard
          size="sm"
          valueSize="lg"
          label={m.direction === 'below' ? 'Ngưỡng tối thiểu' : 'Ngưỡng cho phép'}
          hint={m.fromConfig ? `Theo cấu hình tag ${m.tag}` : 'Theo bản ghi cảnh báo'}
          value={formatGaugeNumber(m.threshold)}
          unit={m.unit}
          tone="success"
        />
      </div>
      {scale ? (
        <ThresholdGauge
          label="Giá trị lúc cảnh báo so với ngưỡng"
          {...scale}
          valueText={gaugeValueText(scale, m.unit)}
          valueLabel={formatGaugeNumber(m.value)}
        />
      ) : (
        <p className="text-sm text-fg-secondary">
          {gauge.kind === 'off'
            ? 'Cảnh báo tốc độ thay đổi – không dùng thang đo ngưỡng.'
            : `Không dựng được thang đo cho giá trị này (${metricText(m.value, m.unit)}).`}
        </p>
      )}
    </Section>
  );
}

const DEVICE_STATUS = {
  danger: { label: 'Nguy hiểm', className: 'text-danger-text' },
  warning: { label: 'Cảnh báo', className: 'text-warning' },
  offline: { label: 'Mất tín hiệu', className: 'text-fg-secondary' },
  normal: { label: 'Bình thường', className: 'text-success' },
} as const;
const readingClass = (status: string) => (status === 'danger' ? 'text-danger-text' : status === 'warning' ? 'text-warning' : 'text-fg');

function LiveValue({ r, unit, digits = 1 }: { r: { state: string; value?: number; status: string }; unit: string; digits?: number }) {
  if (r.state === 'lost')
    return (
      <span className="inline-flex items-center gap-1 text-fg-secondary">
        <SignalLostIcon size={14} /> Mất tín hiệu
      </span>
    );
  if (r.value === undefined) return <span className="text-fg">—</span>;
  return <span className={readingClass(r.status)}>{withUnit(r.value.toFixed(digits), unit)}</span>;
}

function RelatedDevice({ device }: { device: string }) {
  const view = useRelatedDevice(device);
  const assetId = resolveAssetId(device);
  return (
    <div className="flex flex-col gap-4 rounded-md border border-line/30 bg-surface-muted/40 px-5 py-4">
      {view.kind === 'live' ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-base">
          <Pair label="Mã" value={view.id} />
          <Pair label="Tên" value={view.name} />
          <Pair label="Trạng thái" value={<span className={DEVICE_STATUS[view.status].className}>{DEVICE_STATUS[view.status].label}</span>} />
          <Pair label="Áp suất" value={<LiveValue r={view.pressure} unit="bar" />} />
          <Pair label="Nhiệt độ" value={<LiveValue r={view.temperature} unit="°C" />} />
        </dl>
      ) : (
        <div className="flex flex-col gap-2.5 text-base">
          <dl>
            <Pair label="Mã" value={device} />
          </dl>
          <p className="text-fg-secondary">{view.kind === 'loading' ? 'Đang tải số liệu…' : 'Chưa có số liệu trực tiếp'}</p>
        </div>
      )}
      {assetId && (
        <Link to={assetPath(assetId)} className="self-center rounded-sm text-base text-info hover:underline">
          Xem chi tiết thiết bị <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}
