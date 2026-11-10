import {
  AlertCircleIcon,
  Badge,
  EmergencyBanner,
  InfoGrid,
  SensorList,
  SignalLostIcon,
  ThresholdGauge,
  type InfoGridItem,
  type TagTone,
} from '@/components';
import { cn } from '@/lib/cn';
import { alertKind, alertOccurredAt, levelOf, useAlertLive, useAreaSensors, useTagSignal } from '@/data/alertDetail';
import type { AlertRecord } from '@/data/alerts';
import { bandTicks, bannerFor, formatMinutes, overThreshold } from '@/features/alerts/bands';
import { formatDelta, formatMeasure } from '@/features/alerts/gauge';
import { Section } from '../drawerParts';

// eslint-disable-next-line no-restricted-syntax -- chữ lớn 32px đậm (số nồng độ ở mức ESD)
const BIG_TONE = { success: 'text-success', warning: 'text-warning', danger: 'text-danger-strong', neutral: 'text-fg' } as const;
const BADGE_TONE: Record<'success' | 'warning' | 'danger' | 'neutral', TagTone> = {
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  neutral: 'neutral',
};

/** "25" + "% LEL" → số lớn "25%" + đơn vị nhỏ "LEL" (ảnh); đơn vị khác → số lớn + đơn vị nhỏ. */
function BigValue({ value, unit, tone }: { value: number; unit: string; tone: keyof typeof BIG_TONE }) {
  const n = String(Math.round(value * 10) / 10);
  const glued = unit.startsWith('%');
  const small = glued ? unit.slice(1).trim() : unit;
  return (
    <p className="flex items-baseline gap-1.5 tabular-nums">
      <span className={cn('text-3xl font-bold leading-9', BIG_TONE[tone])}>
        {n}
        {glued && '%'}
      </span>
      {small && <span className="text-md text-fg-secondary">{small}</span>}
    </p>
  );
}

/**
 * Panel KHÍ GAS (loại `panel: 'gas'`, ảnh `scratch/figma-ref/alert-drawer-gas-*.png`): số lớn = nồng độ LIVE của tag (dòng nhỏ
 * "Lúc cảnh báo"), badge mức theo bands, thang nhiều mức, 4 chỉ số, banner ESD theo cấu hình, cảm biến trong khu của cảnh báo.
 * Mất tín hiệu: "Mất tín hiệu" (không giữ số cũ); thang + banner dùng giá trị lúc cảnh báo (thận trọng) và ghi rõ.
 */
export function GasPanel({ alert: a, now }: { alert: AlertRecord; now: Date }) {
  const cfg = alertKind(a);
  const unit = a.unit;
  const live = useAlertLive(a.tag);
  const signal = useTagSignal(a.tag);
  const sensors = useAreaSensors(a.area, cfg);
  const liveVal = live.state === 'ok' ? live.value : undefined;
  const recordVal = Number(a.value);
  const prev = a.previousValue !== undefined ? Number(a.previousValue) : undefined;
  const lv = liveVal !== undefined ? levelOf(cfg, liveVal) : null;
  const scale = cfg.scale ?? { min: 0, max: 100 };
  const bands = cfg.bands ?? [];
  const gaugeVal = liveVal ?? recordVal;
  const banner = bannerFor(gaugeVal, cfg, unit);
  const over = overThreshold(alertOccurredAt(a, now), liveVal, Number(a.threshold), now);
  const delta = liveVal !== undefined && prev !== undefined ? liveVal - prev : undefined;

  const valueText =
    liveVal !== undefined
      ? `${formatMeasure(liveVal, unit)} – ${lv?.label ?? ''}`
      : `${live.state === 'pending' ? 'Chưa có số liệu' : 'Mất tín hiệu'}, giá trị lúc cảnh báo ${formatMeasure(recordVal, unit)}`;
  const thresholdText = formatMeasure(Number(a.threshold), unit);

  const stats: InfoGridItem[] = [
    { id: 'prev', label: 'Giá trị trước đó', value: prev !== undefined ? formatMeasure(prev, unit) : '—' },
    {
      id: 'delta',
      label: 'Mức tăng',
      value:
        delta === undefined ? (
          '—'
        ) : (
          <span className={delta > 0 ? 'text-warning' : 'text-success'}>
            <span aria-hidden="true">{delta > 0 ? '↑' : delta < 0 ? '↓' : ''}</span>
            {formatDelta(delta, unit)}
          </span>
        ),
    },
    {
      id: 'over',
      label: `T/G vượt ngưỡng ${thresholdText}`,
      hint: `Thời gian nồng độ còn ≥ ${thresholdText} (ngưỡng của cảnh báo), tính từ lúc phát sinh.`,
      value:
        over.state === 'over' ? formatMinutes(over.minutes) : over.state === 'below' ? <span className="text-success">Đã về dưới ngưỡng</span> : '—',
    },
    {
      id: 'signal',
      label: 'Trạng thái CB',
      value:
        signal === 'online' ? (
          <span className="inline-flex items-center gap-1.5 text-success">
            <span aria-hidden="true" className="size-2 rounded-full bg-success" />
            Online
          </span>
        ) : signal === 'uncertain' ? (
          <span className="text-warning">Không chắc chắn</span>
        ) : signal === 'lost' ? (
          <span className="inline-flex items-center gap-1 text-fg-secondary">
            <SignalLostIcon size={14} /> Mất tín hiệu
          </span>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <>
      <Section title="Thông số cảnh báo">
        <div className="flex flex-col gap-4 rounded-md border border-line/30 bg-surface-muted/40 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-md font-semibold text-fg-secondary">Nồng độ hiện tại</p>
              {liveVal !== undefined ? (
                <BigValue value={liveVal} unit={unit} tone={lv?.tone ?? 'neutral'} />
              ) : (
                <p className="flex items-center gap-2 text-xl font-semibold text-fg-secondary">
                  {live.state === 'lost' ? (
                    <>
                      <SignalLostIcon size={22} /> Mất tín hiệu
                    </>
                  ) : (
                    '—'
                  )}
                </p>
              )}
              <p className="text-sm text-fg-secondary">Lúc cảnh báo: {formatMeasure(recordVal, unit)}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {lv && lv.tone !== 'success' && (
                // eslint-disable-next-line no-restricted-syntax -- icon
                <AlertCircleIcon size={22} aria-hidden="true" className={lv.tone === 'danger' ? 'text-danger-strong' : 'text-warning'} />
              )}
              {lv ? (
                // Lót nền đặc (tương phản chữ đỏ mức ESD trên nền thẻ sáng hơn).
                <span className="rounded-sm bg-surface">
                  <Badge variant="tag" tone={BADGE_TONE[lv.tone]} size="md">
                    {lv.label}
                  </Badge>
                </span>
              ) : (
                live.state === 'lost' && (
                  <Badge variant="tag" tone="neutral" size="md">
                    Mất tín hiệu
                  </Badge>
                )
              )}
            </div>
          </div>
          <ThresholdGauge
            label="Nồng độ khí so với các mức cảnh báo"
            value={gaugeVal}
            min={scale.min}
            max={scale.max}
            threshold={Number(a.threshold)}
            bands={bands}
            ticks={bandTicks(bands, scale).map((t) => ({ value: t.value, label: t.label, danger: t.level === 'esd' }))}
            valueText={valueText}
            stale={liveVal === undefined}
            valueLabel={liveVal !== undefined ? `${Math.round(liveVal * 10) / 10}%` : `Lúc CB ${Math.round(recordVal * 10) / 10}%`}
          />
          <InfoGrid variant="stats" items={stats} className="border-t border-line/30 pt-4" />
        </div>
      </Section>

      {banner && <EmergencyBanner title={banner.title} text={banner.text} stage={banner.stage} />}

      <Section title={`Cảm biến trong khu vực (${a.area})`}>
        <SensorList
          label={`Cảm biến khí trong ${a.area}`}
          rows={sensors.map((s) => ({
            id: s.tag,
            name: s.tag,
            valueText: s.state === 'lost' ? null : s.value !== undefined ? formatMeasure(s.value, unit) : undefined,
            levelLabel: s.label ?? null,
            tone: s.tone,
            highlight: s.tag === a.tag,
          }))}
        />
      </Section>
    </>
  );
}
