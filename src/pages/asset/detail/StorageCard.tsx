import { Card, StatusPill, TankCutawayDiagram, TankLayerList } from '@/components';
import { STATUS_LABEL } from '@/data/assetDetail';
import { SIGNAL_LOST_LABEL } from '@/features/live/signal';
import { cn } from '@/lib/cn';
import type { AssetData } from './AssetKpiSection';
import { fixed, lost, readingText, statusTone, tankLayerItems, type AssetLive } from './assetView';

/** "Trạng thái tồn chứa trong bồn": mặt cắt 3 lớp + 5 dòng lớp / trạng thái + áp suất · nhiệt độ · mức bồn. */
export function StorageCard({ data, live, liquidPct }: { data: AssetData; live: AssetLive; liquidPct: number | undefined }) {
  const { level, pressure, temperature, layers, layersState, storageStatus } = live;
  return (
    <Card
      title="Trạng thái tồn chứa trong bồn"
      headerVariant="plain"
      className="flex-1"
      headerEnd={
        <StatusPill size="sm" tone={statusTone(storageStatus)}>
          {STATUS_LABEL[storageStatus]}
        </StatusPill>
      }
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="flex min-h-[260px] flex-col justify-center rounded-lg border border-line/30 bg-surface-sunken/40 p-3">
          <TankCutawayDiagram
            label={`Mặt cắt ${data.name}`}
            length={data.tank.length}
            diameter={data.tank.diameter}
            state={layersState === 'lost' ? 'lost' : 'pending'}
            layers={
              layers && {
                levelPct: layers.levelPct,
                waterPct: layers.waterPct,
                lpgPercent: layers.lpg.percent,
                vaporPercent: layers.vapor.percent,
                waterPercent: layers.water.percent,
              }
            }
          />
        </div>
        <TankLayerList items={tankLayerItems(live)} />
      </div>
      <dl className="mt-5 grid max-w-[360px] grid-cols-3 gap-4">
        {[
          { id: 'p', label: 'Áp suất bồn', value: readingText(pressure, 1, ' bar'), tone: 'text-fg' },
          { id: 't', label: 'Nhiệt độ LPG', value: readingText(temperature, 1, '°C'), tone: 'text-fg' },
          { id: 'l', label: 'Mức bồn', value: liquidPct !== undefined ? `${fixed(liquidPct)}%` : lost(level) ? SIGNAL_LOST_LABEL : '—', tone: 'text-info' },
        ].map((x) => (
          <div key={x.id} className="flex flex-col gap-1">
            <dt className="text-2xs uppercase tracking-caps text-fg-secondary">{x.label}</dt>
            <dd className={cn('text-base tabular-nums', x.value === SIGNAL_LOST_LABEL ? 'text-fg-secondary' : x.tone)}>{x.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
