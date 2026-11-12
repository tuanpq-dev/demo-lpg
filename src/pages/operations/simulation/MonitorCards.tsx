import {
  ActivityLineIcon,
  AiSparklesIcon,
  AlertTriangleIcon,
  Badge,
  BellRingIcon,
  Card,
  DetectorIcon,
  EventTimeline,
  FlaskIcon,
  GaugeIcon,
  KpiCard,
  TargetTrendChart,
  TimerIcon,
  TrendDownIcon,
  TrendUpIcon,
  type TagTone,
} from '@/components';
import { formatQty, formatVariable } from '@/features/simulation/config';
import {
  PHASE_LABEL,
  PHASE_NOTE,
  TREND_LABEL,
  axisLabel,
  chartDomain,
  chartTicks,
  clockText,
  isActivePhase,
  type MonitorSnapshot,
  type SessionPhase,
  type SimulationSession,
} from '@/features/simulation/monitor';
import { SCENARIO_RISK_LABEL, type Scenario } from '@/features/simulation/scenarios';
import { cn } from '@/lib/cn';

const PHASE_TONE: Record<SessionPhase, TagTone> = { running: 'warning', holding: 'warning', completed: 'success', stopped: 'neutral' };

/** Huy hiệu cạnh tiêu đề: "Đang chạy mô phỏng" (ảnh `4.png`) / "Đã hoàn thành" / "Đã dừng". Bình thí nghiệm = chế độ mô phỏng. */
export function PhaseBadge({ phase }: { phase: SessionPhase }) {
  return (
    <Badge variant="tag" size="md" tone={PHASE_TONE[phase]} className="gap-1.5 rounded-full px-3">
      <FlaskIcon size={14} className="shrink-0" />
      {PHASE_LABEL[phase]}
    </Badge>
  );
}

/** Khối thông tin bên phải header (ảnh `4.png`): Mã kịch bản · Mức độ · Kịch bản · Thời lượng / Mục tiêu, ngăn bằng vạch dọc. */
export function MonitorHeaderMeta({ scenario: s, session }: { scenario: Scenario; session: SimulationSession }) {
  const items = [
    { id: 'code', label: 'Mã kịch bản', value: s.code },
    {
      id: 'risk',
      label: 'Mức độ',
      value: (
        <span
          className={cn(
            'inline-flex items-center gap-1',
            s.risk === 'critical' ? 'text-danger-text' : s.risk === 'high' ? 'text-warning' : 'text-fg',
          )}
        >
          {s.risk !== 'medium' && <AlertTriangleIcon size={16} className="shrink-0" />}
          {SCENARIO_RISK_LABEL[s.risk]}
        </span>
      ),
    },
    { id: 'title', label: 'Kịch bản', value: s.title },
    {
      id: 'target',
      label: 'Thời lượng / Mục tiêu',
      value: `${session.config.durationMin} phút / ${formatVariable(session.config.target, s.setup.variable)}`,
    },
  ];
  return (
    <dl className="flex flex-wrap items-stretch justify-end gap-y-2">
      {items.map((it, i) => (
        <div key={it.id} className={cn('flex flex-col items-end gap-1 px-4 last:pr-0', i > 0 && 'border-l border-line')}>
          <dt className="whitespace-nowrap text-sm text-fg-secondary">{it.label}</dt>
          <dd className="whitespace-nowrap text-md text-fg">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** 5 KPI (ảnh `5.png`): thời gian chạy · giá trị hiện tại · ngưỡng PLC · cảnh báo mô phỏng · gợi ý AI. */
export function MonitorKpis({ scenario: s, snap }: { scenario: Scenario; snap: MonitorSnapshot }) {
  const v = s.setup.variable;
  const active = isActivePhase(snap.phase);
  const above = v.direction === 'above';
  const TrendIcon = snap.trend === 'down' ? TrendDownIcon : TrendUpIcon;
  return (
    <section aria-label="Chỉ số mô phỏng" className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 wide:gap-4">
      <KpiCard
        variant="compact"
        label="Thời gian chạy"
        icon={<TimerIcon size={18} className="shrink-0 text-fg-secondary" />}
        iconPosition="start"
        value={<span className="tabular-nums">{clockText(snap.elapsed)}</span>}
        tone="primary"
        valueNote={`/ ${clockText(snap.durationSec)} (${PHASE_NOTE[snap.phase]})`}
      />
      <KpiCard
        variant="compact"
        label={`${s.setup.monitor.subject} hiện tại`}
        icon={<DetectorIcon size={18} className="shrink-0 text-fg-secondary" />}
        iconPosition="start"
        value={<span className="tabular-nums">{formatQty(snap.value, v.unit, v.digits)}</span>}
        tone={snap.exceeded ? 'danger' : 'warning'}
        outlined={snap.exceeded}
        valueNote={`${v.qualifier ? `${v.qualifier} ` : ''}(${TREND_LABEL[snap.trend]})`}
        valueNoteIcon={snap.trend !== 'steady' ? <TrendIcon size={18} className="order-last ml-1 shrink-0 text-danger-text" /> : undefined}
      />
      <KpiCard
        variant="compact"
        label={v.thresholdLabel}
        icon={<GaugeIcon size={18} className="shrink-0 text-fg-secondary" />}
        iconPosition="start"
        value={formatQty(v.threshold, v.unit, v.digits)}
        tone="neutral"
        valueNote={snap.exceeded ? `(Đã ${above ? 'vượt' : 'xuống dưới'})` : `(Chưa ${above ? 'vượt' : 'xuống dưới'})`}
        valueNoteTone={snap.exceeded ? 'danger' : 'muted'}
      />
      <KpiCard
        variant="compact"
        label="Cảnh báo mô phỏng"
        icon={<BellRingIcon size={18} className="shrink-0 text-fg-secondary" />}
        iconPosition="start"
        value={snap.alerts.length}
        tone={snap.alerts.length ? 'warning' : 'neutral'}
        valueNote={snap.alerts.length ? (active ? '(Đang hoạt động)' : '(Đã kết thúc)') : '(Chưa phát sinh)'}
      />
      <KpiCard
        variant="compact"
        label="Gợi ý AI"
        icon={<AiSparklesIcon size={18} className="shrink-0 text-fg-secondary" />}
        iconPosition="start"
        value={snap.recommendations.length}
        tone="primary"
        valueNote={snap.recommendations.length ? '(Đã tạo)' : '(Đang theo dõi)'}
      />
    </section>
  );
}

/** "Diễn biến nồng độ gas mô phỏng" (ảnh `2.png`): đường thực tế (mô phỏng) + vạch ngưỡng PLC + vạch mục tiêu, trục X = thời lượng. */
export function SimulationTrendCard({ scenario: s, session, snap }: { scenario: Scenario; session: SimulationSession; snap: MonitorSnapshot }) {
  const v = s.setup.variable;
  const target = session.config.target;
  const y = chartDomain([session.startValue, target, v.threshold]);
  const qty = (x: number) => formatQty(x, v.unit, v.digits);
  const subject = s.setup.monitor.subject;
  const summary = `${subject} ${snap.valueText} sau ${clockText(snap.elapsed)} trên ${clockText(snap.durationSec)}; ${v.thresholdLabel} ${qty(v.threshold)}, mục tiêu ${qty(target)}.`;
  return (
    <Card
      title={`Diễn biến ${v.noun} mô phỏng`}
      headerVariant="plain"
      radius="lg"
      titleSize="lg"
      aria-label={`Diễn biến ${v.noun} mô phỏng`}
      headerEnd={
        <ul className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 text-base text-fg-secondary" aria-label="Chú thích">
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-3.5 rounded-xs border-2 border-danger bg-danger/20" />
            {subject} thực tế
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-0.5 w-3.5 rounded-full bg-warning" />
            {v.thresholdLabel} ({qty(v.threshold)})
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-0.5 w-3.5 rounded-full bg-primary" />
            Mục tiêu mô phỏng ({qty(target)})
          </li>
        </ul>
      }
    >
      <div role="img" aria-label={summary} className="h-64 wide:h-[260px]">
        <TargetTrendChart
          data={snap.points.map((p) => ({ x: p.sec, value: p.value }))}
          xDomain={[0, snap.durationSec]}
          xTicks={chartTicks(snap.durationSec)}
          formatX={clockText}
          domain={y.domain}
          yTicks={y.ticks}
          formatY={(n) => axisLabel(n, v)}
          lines={[
            { id: 'target', value: target, color: 'primary' },
            { id: 'threshold', value: v.threshold, color: 'warning' },
          ]}
          name={`${subject} thực tế`}
          format={(n) => formatVariable(n, v)}
        />
      </div>
      <p className="mt-3 text-right text-sm text-fg-secondary">
        * {formatVariable(target, v)} là giá trị mục tiêu mô phỏng, không phải trạng thái thiết bị thật.
      </p>
    </Card>
  );
}

/** "Cảnh báo mô phỏng" (ảnh `8.png` trái) – mới nhất trước; mỗi thẻ có nhãn "Mô phỏng". */
export function SimAlertsCard({ scenario: s, snap }: { scenario: Scenario; snap: MonitorSnapshot }) {
  const v = s.setup.variable;
  return (
    <Card
      title="Cảnh báo mô phỏng"
      icon={<AlertTriangleIcon size={22} className="shrink-0 text-warning" />}
      headerVariant="plain"
      radius="lg"
      titleSize="lg"
      aria-label="Cảnh báo mô phỏng"
    >
      {snap.alerts.length === 0 ? (
        <p className="text-base text-fg-secondary">
          Chưa có cảnh báo mô phỏng – cảnh báo phát khi {v.noun} {v.direction === 'above' ? 'vượt' : 'xuống dưới'} ngưỡng.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {snap.alerts.map((a) => (
            <li
              key={a.id}
              className={cn(
                'flex flex-col gap-2 rounded-lg border px-3 py-3',
                a.tone === 'danger' ? 'border-danger/40 bg-danger/10' : 'border-warning/25 bg-warning/5',
              )}
            >
              <p className="text-md text-fg">
                {a.id}: {a.title}
              </p>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <p className="text-sm text-fg-secondary">{a.detail}</p>
                <Badge variant="tag" size="sm" tone="warning" className="rounded-md px-2">
                  Mô phỏng
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** "Timeline diễn biến" (ảnh `8.png` phải) – mới nhất trước. */
export function MonitorTimelineCard({ snap }: { snap: MonitorSnapshot }) {
  return (
    <Card
      title="Timeline diễn biến"
      icon={<ActivityLineIcon size={22} className="shrink-0 text-fg-secondary" />}
      headerVariant="plain"
      radius="lg"
      titleSize="lg"
      aria-label="Timeline diễn biến"
    >
      <EventTimeline variant="feed" events={snap.timeline.map((e) => ({ id: e.id, time: e.time, title: e.title, tone: e.tone }))} />
    </Card>
  );
}
