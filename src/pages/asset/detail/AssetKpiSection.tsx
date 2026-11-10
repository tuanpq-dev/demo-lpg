import { Icon, KpiCard } from '@/components';
import type { useAssetDetail } from '@/data/assetDetail';
import { LEVEL_HINT, fixed, kpiTone, lost, type AssetLive } from './assetView';

type AssetData = NonNullable<ReturnType<typeof useAssetDetail>['data']>;

/** 6 KPI cột giữa: mức bồn (% thể tích), thể tích LPG lỏng, áp suất, nhiệt độ, tồn kho, sức khỏe (số tạm có ghi chú). */
export function AssetKpiSection({ data, live, liquidPct }: { data: AssetData; live: AssetLive; liquidPct: number | undefined }) {
  const { level, pressure, temperature, layers, layersState } = live;
  const ph = data.placeholders;
  return (
    <section aria-label="Chỉ số bồn" className="grid auto-rows-[102px] grid-cols-2 gap-4 sm:grid-cols-3">
      <KpiCard
        dense
        label="Mức bồn"
        hint={LEVEL_HINT}
        hintIcon
        value={liquidPct !== undefined ? fixed(liquidPct) : '—'}
        unit="%"
        signalLost={lost(level)}
        tone={kpiTone(level)}
        progress={liquidPct !== undefined ? { value: liquidPct, tone: 'info' } : undefined}
      />
      <KpiCard
        dense
        label="Thể tích"
        hint={`Thể tích LPG lỏng (m³). Xu hướng 1 giờ là số tạm: ${ph.volumeTrend1h.note}`}
        value={layers ? fixed(layers.lpg.volume) : '—'}
        unit="m³"
        signalLost={layersState === 'lost'}
        sub={`+${fixed(ph.volumeTrend1h.value)}% (1h)`}
        subIcon={<Icon name="kpiTrendUp" box={12} />}
        subTone="success"
      />
      <KpiCard
        dense
        label="Áp suất"
        hint={`Ngưỡng cảnh báo ${data.alarms.pressure.warn} bar, nguy hiểm ${data.alarms.pressure.danger} bar. Định mức thiết kế ${fixed(data.designPressure)} bar là thông số chế tạo, không phải ngưỡng cảnh báo.`}
        value={pressure.state === 'ok' ? fixed(pressure.value!) : '—'}
        unit="bar"
        signalLost={lost(pressure)}
        tone={kpiTone(pressure)}
        sub={`Định mức: ${fixed(data.designPressure)} bar`}
        subTone="muted"
      />
      <KpiCard
        dense
        label="Nhiệt độ"
        value={temperature.state === 'ok' ? fixed(temperature.value!) : '—'}
        unit="°C"
        signalLost={lost(temperature)}
        tone={kpiTone(temperature)}
        progress={temperature.state === 'ok' ? { value: temperature.value!, max: data.alarms.temperature.danger, tone: 'warning' } : undefined}
      />
      <KpiCard
        dense
        label="Tồn kho"
        hint={`Số tạm: ${ph.inventory.note} ${ph.daysOfSupply.note}`}
        value={fixed(ph.inventory.value)}
        unit="Nm³"
        sub={`Dự kiến: ${ph.daysOfSupply.value} ngày`}
        subTone="muted"
      />
      <KpiCard
        dense
        label="Sức khỏe thiết bị"
        hint={`Số tạm: ${ph.health.note}`}
        value={String(ph.health.value)}
        unit="%"
        tone="success"
        sub="Hoạt động ổn định"
        subTone="success"
      />
    </section>
  );
}

export type { AssetData };
