import { type ReactNode } from 'react';
import {
  ActivityLineIcon,
  Badge,
  BadgeCheckIcon,
  BroadcastIcon,
  Card,
  CheckCircleIcon,
  CpuIcon,
  KpiCard,
  ShieldPlusIcon,
  TargetTrendChart,
  UserIcon,
} from '@/components';
import { formatQty, formatVariable } from '@/features/simulation/config';
import type { SimEvent, SimulationSession } from '@/features/simulation/monitor';
import { CHECK_LABEL, areaAssetText, minuteLabel, type ResultTile, type SimulationResult } from '@/features/simulation/result';
import { chartDomain } from '@/features/simulation/monitor';
import type { Scenario } from '@/features/simulation/scenarios';
import { cn } from '@/lib/cn';

/** Khối thông tin lượt (ảnh `16.png`): Mã phiên · Kịch bản · Tên kịch bản · Khu vực / Tài sản chính · Người chạy · Trạng thái. */
export function ResultInfoStrip({
  scenario: s,
  session,
  code,
  stopped,
}: {
  scenario: Scenario;
  session: SimulationSession;
  code: string;
  stopped: boolean;
}) {
  const items: { id: string; label: string; value: ReactNode }[] = [
    { id: 'code', label: 'Mã phiên', value: code },
    { id: 'scenario', label: 'Kịch bản', value: s.code },
    { id: 'title', label: 'Tên kịch bản', value: s.title },
    { id: 'area', label: 'Khu vực / Tài sản chính', value: areaAssetText(s, session) },
    {
      id: 'by',
      label: 'Người chạy',
      value: (
        <span className="inline-flex items-center gap-1.5">
          <UserIcon size={16} className="shrink-0 text-fg-secondary" />
          {session.by}
        </span>
      ),
    },
    {
      id: 'status',
      label: 'Trạng thái',
      value: (
        <span className={cn('inline-flex items-center gap-1.5', stopped ? 'text-fg-secondary' : 'text-success')}>
          <CheckCircleIcon size={16} className="shrink-0" />
          {stopped ? 'Đã dừng' : 'Đã hoàn thành'}
        </span>
      ),
    },
  ];
  return (
    <section aria-label="Thông tin phiên mô phỏng" className="rounded-lg border border-line/30 bg-surface px-4 py-3.5">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {items.map((it) => (
          <div key={it.id} className="flex min-w-0 flex-col gap-1">
            <dt className="text-sm text-fg-secondary">{it.label}</dt>
            <dd className="break-words text-base font-semibold text-fg">{it.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** 5 KPI (ảnh `15.png`). */
export function ResultKpis({ result: r }: { result: SimulationResult }) {
  return (
    <section aria-label="Chỉ số kết quả" className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 wide:gap-6">
      {r.kpis.map((k) => (
        <KpiCard key={k.id} variant="compact" label={k.label} value={k.value} tone={k.tone} sub={k.sub} subTone="muted" />
      ))}
    </section>
  );
}

const TILE_ICON: Record<ResultTile['id'], ReactNode> = {
  detect: <BroadcastIcon size={22} />,
  trend: <ActivityLineIcon size={22} />,
  ai: <CpuIcon size={22} />,
  safety: <ShieldPlusIcon size={22} />,
};

/** "Đánh giá tổng quan" (ảnh `11.png`): câu tổng kết + huy hiệu kết quả + 4 ô Phát hiện / Diễn biến / AI / An toàn. */
export function OverviewCard({ result: r }: { result: SimulationResult }) {
  const pass = r.result === 'pass';
  return (
    <Card
      title="Đánh giá tổng quan"
      headerVariant="plain"
      radius="lg"
      titleSize="lg"
      aria-label="Đánh giá tổng quan"
      headerEnd={
        <Badge variant="tag" size="md" tone={pass ? 'success' : 'warning'} className="gap-1.5 px-3">
          <BadgeCheckIcon size={16} className="shrink-0" />
          Kết quả : {pass ? 'Đạt' : 'Cần cải thiện'}
        </Badge>
      }
    >
      <div className="-mt-2 flex flex-col gap-4">
        <p className="text-base leading-6 text-fg-secondary">{r.summary}</p>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {r.tiles.map((t) => {
            const ok = t.result === 'pass';
            return (
              <li key={t.id} className="flex flex-col items-center gap-2 rounded-lg border border-line/40 bg-surface-raised px-3 py-4 text-center">
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-10 items-center justify-center rounded-lg',
                    ok ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning',
                  )}
                >
                  {TILE_ICON[t.id]}
                </span>
                <span className="text-base text-fg-secondary">{t.label}</span>
                <span className={cn('text-md font-bold', ok ? 'text-success' : 'text-warning')}>{CHECK_LABEL[t.result]}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}

/** "Diễn biến nồng độ gas mô phỏng" (ảnh `19.png`): mỗi mốc một chấm, lưới 2 chiều, vạch ngưỡng (vàng) + mục tiêu (đỏ), chú thích dưới. */
export function ResultTrendCard({ scenario: s, session, result: r }: { scenario: Scenario; session: SimulationSession; result: SimulationResult }) {
  const v = s.setup.variable;
  const target = session.config.target;
  const y = chartDomain([session.startValue, target, v.threshold], 8);
  const qty = (x: number) => formatQty(x, v.unit, Number.isInteger(x) ? 0 : 1);
  const series = `${v.noun.charAt(0).toUpperCase()}${v.noun.slice(1)} mô phỏng`;
  const dur = session.config.durationMin * 60;
  const ticks = [...Array(11).keys()].map((i) => Math.round((dur * i) / 10));
  const summary = `${series}: ${r.points.map((p) => `${minuteLabel(p.sec)} ${formatVariable(p.value, v)}`).join(', ')}.`;
  return (
    <Card title={`Diễn biến ${v.noun} mô phỏng`} headerVariant="plain" radius="lg" titleSize="lg" aria-label={`Diễn biến ${v.noun} mô phỏng`}>
      <div role="img" aria-label={summary} className="h-72 wide:h-[260px]">
        <TargetTrendChart
          data={r.points.map((p) => ({ x: p.sec, value: p.value }))}
          xDomain={[0, dur]}
          xTicks={ticks}
          formatX={minuteLabel}
          domain={y.domain}
          yTicks={y.ticks}
          formatY={qty}
          lines={[
            { id: 'target', value: target, color: 'danger-strong' },
            { id: 'threshold', value: v.threshold, color: 'warning' },
          ]}
          color="primary"
          name={series}
          format={(n) => formatVariable(n, v)}
          grid
          dots
          endDot={false}
          areaOpacity={0.15}
          thinTicks
        />
      </div>
      <ul aria-label="Chú thích" className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-base text-fg-secondary">
        <li className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="size-3 rounded-full bg-primary" />
          {series}
        </li>
        <li className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="w-4 border-t-2 border-dashed border-warning" />
          {v.thresholdLabel}: {formatVariable(v.threshold, v)}
        </li>
        <li className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="w-4 border-t-2 border-dashed border-danger" />
          Giá trị mục tiêu mô phỏng: {formatVariable(target, v)}
        </li>
      </ul>
    </Card>
  );
}

const EVENT_DOT: Record<SimEvent['tone'], string> = {
  primary: 'bg-primary',
  info: 'bg-info',
  warning: 'bg-warning',
  success: 'bg-success',
  neutral: 'bg-neutral',
  danger: 'bg-danger',
};

/** "Dòng thời gian sự kiện mô phỏng" (ảnh `23.png`): chấm + giờ, thẻ tiêu đề + mô tả; cảnh báo viền trái vàng + nhãn "Mô phỏng". */
export function ResultTimelineCard({ events }: { events: readonly SimEvent[] }) {
  return (
    <Card title="Dòng thời gian sự kiện mô phỏng" headerVariant="plain" radius="lg" titleSize="lg" aria-label="Dòng thời gian sự kiện mô phỏng">
      <ol className="flex flex-col gap-4">
        {events.map((e) => {
          const warn = e.tone === 'warning';
          return (
            <li key={e.id} className="flex items-center gap-3 sm:gap-4">
              <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-raised sm:ml-2">
                <span className={cn('size-3 rounded-full', EVENT_DOT[e.tone])} />
              </span>
              <time className="w-16 shrink-0 text-sm tabular-nums text-fg-secondary">{e.time}</time>
              <div
                className={cn(
                  'flex min-w-0 flex-1 items-start justify-between gap-3 rounded-lg border px-3 py-3',
                  warn ? 'border-warning/40 border-l-4 border-l-warning bg-warning/5' : 'border-line/40 bg-surface-raised',
                )}
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span className={cn('text-md', warn ? 'text-warning' : e.tone === 'success' ? 'text-success' : 'text-fg')}>{e.title}</span>
                  <span className="text-sm text-fg-secondary">{e.detail}</span>
                </span>
                {e.simulated && (
                  <Badge variant="tag" size="sm" tone="warning" className="rounded-md border-transparent px-2">
                    Mô phỏng
                  </Badge>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

// Tách file (10/11/2026) – giữ đường import cũ.
export * from './ResultDetailCards';
