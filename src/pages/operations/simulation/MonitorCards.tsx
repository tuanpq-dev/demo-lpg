import { useId } from 'react';
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
  MetricListCard,
  SignalLostIcon,
  TargetTrendChart,
  TimerIcon,
  TrendDownIcon,
  TrendUpIcon,
  type TagTone,
} from '@/components';
import { DATA_SYNC_LABEL, formatQty, formatVariable, orderedAreas, type DataSyncState } from '@/features/simulation/config';
import {
  PHASE_LABEL,
  PHASE_NOTE,
  TREND_LABEL,
  axisLabel,
  chartDomain,
  chartTicks,
  clockText,
  isActivePhase,
  pendingSuggestionText,
  type MonitorSnapshot,
  type ReferenceSnapshotRow,
  type SessionPhase,
  type SimulationSession,
} from '@/features/simulation/monitor';
import { SCENARIO_RISK_LABEL, type Scenario, type TagHealth } from '@/features/simulation/scenarios';
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
        <span className={cn('inline-flex items-center gap-1', s.risk === 'critical' ? 'text-danger-text' : s.risk === 'high' ? 'text-warning' : 'text-fg')}>
          {s.risk !== 'medium' && <AlertTriangleIcon size={16} className="shrink-0" />}
          {SCENARIO_RISK_LABEL[s.risk]}
        </span>
      ),
    },
    { id: 'title', label: 'Kịch bản', value: s.title },
    { id: 'target', label: 'Thời lượng / Mục tiêu', value: `${session.config.durationMin} phút / ${formatVariable(session.config.target, s.setup.variable)}` },
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
      <p className="mt-3 text-right text-sm text-fg-secondary">* {formatVariable(target, v)} là giá trị mục tiêu mô phỏng, không phải trạng thái thiết bị thật.</p>
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
              className={cn('flex flex-col gap-2 rounded-lg border px-3 py-3', a.tone === 'danger' ? 'border-danger/40 bg-danger/10' : 'border-warning/25 bg-warning/5')}
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

/** "Gợi ý từ AI" (ảnh `1.png`): câu tóm tắt + danh sách đánh số + chân trang an toàn. */
export function MonitorSuggestionCard({ scenario: s, snap, confidence }: { scenario: Scenario; snap: MonitorSnapshot; confidence: number | undefined }) {
  const listId = useId();
  return (
    <Card
      title={<span className="text-primary">Gợi ý từ AI</span>}
      icon={<AiSparklesIcon size={22} className="shrink-0 text-primary" />}
      headerVariant="plain"
      radius="lg"
      titleSize="lg"
      tone="primary"
      aria-label="Gợi ý từ AI"
      headerEnd={
        snap.summary && confidence !== undefined ? (
          <span
            className="rounded-md border border-primary/60 px-2 py-1 text-sm text-primary"
            title="Giả định: 60 % tỉ lệ thông số khả dụng + 40 % tỉ lệ kịch bản đã chạy trong 7 ngày"
          >
            Độ tin cậy: {confidence}%
          </span>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-base leading-6 text-fg">{snap.summary ?? pendingSuggestionText(s.setup.variable)}</p>
        {snap.recommendations.length > 0 && (
          <ol aria-labelledby={listId} className="flex flex-col gap-3">
            <span id={listId} hidden>
              Các bước gợi ý
            </span>
            {snap.recommendations.map((r, i) => (
              <li key={r} className="flex items-center gap-3 rounded-lg border border-line/30 bg-app/60 px-3 py-2.5">
                <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-surface-raised text-sm font-bold text-primary">
                  {i + 1}
                </span>
                <span className="text-md text-fg">{r}</span>
              </li>
            ))}
          </ol>
        )}
        <p className="border-t border-line/30 pt-4 text-center text-sm text-fg-secondary">
          AI chỉ đưa ra gợi ý trong mô phỏng. Không có lệnh điều khiển nào được gửi đến thiết bị thật.
        </p>
      </div>
    </Card>
  );
}

/** "Trạng thái mô phỏng" (ảnh `9.png`). */
export function MonitorStatusCard({ scenario: s, session, snap }: { scenario: Scenario; session: SimulationSession; snap: MonitorSnapshot }) {
  const v = s.setup.variable;
  const areas = orderedAreas(session.config.areas, s.setup.areaOptions);
  return (
    <section aria-label="Trạng thái mô phỏng">
      <MetricListCard
        title="Trạng thái mô phỏng"
        headerVariant="divided"
        titleSize="lg"
        divided
        rows={[
          { id: 'area', label: 'Khu vực:', value: areas.length ? areas.join(', ') : '—' },
          { id: 'equipment', label: 'Thiết bị:', value: s.setup.equipment },
          {
            id: 'progress',
            label: `Tiến độ (Mục tiêu ${formatQty(session.config.target, v.unit, v.digits)}):`,
            value: `${formatQty(snap.value, v.unit, v.digits)} (${TREND_LABEL[snap.trend]})`,
            tone: snap.exceeded ? 'danger' : 'primary',
          },
          { id: 'plc', label: 'Lệnh điều khiển PLC:', value: 'Không gửi', tone: 'success' },
          { id: 'esd', label: 'Trạng thái ESD thật:', value: 'Không kích hoạt', tone: 'success' },
        ]}
      />
    </section>
  );
}

const SYNC_BADGE: Record<DataSyncState, TagTone> = { synced: 'success', missing: 'warning', pending: 'muted' };

/** "Dữ liệu PLC/SCADA tham chiếu" (ảnh `7.png`): trạng thái nguồn thật (trực tiếp) + giá trị CHỤP lúc bắt đầu. */
export function ReferenceSnapshotCard({ rows, sync, health }: { rows: readonly ReferenceSnapshotRow[]; sync: DataSyncState; health: TagHealth | undefined }) {
  return (
    <Card title="Dữ liệu PLC/SCADA tham chiếu" headerVariant="divided" radius="lg" titleSize="lg" aria-label="Dữ liệu PLC/SCADA tham chiếu">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-base text-fg-secondary">PLC/SCADA thật:</span>
          <Badge variant="tag" size="sm" tone={SYNC_BADGE[sync]} className="gap-1.5 rounded-md px-2 font-bold uppercase">
            <span aria-hidden="true" className={cn('size-1.5 rounded-full', sync === 'synced' ? 'bg-success' : sync === 'missing' ? 'bg-warning' : 'bg-neutral')} />
            {DATA_SYNC_LABEL[sync]}
          </Badge>
        </div>
        <p className="text-base text-fg-secondary">
          Thông số khả dụng: <strong className="font-bold text-fg">{health ? `${health.ok}/${health.total}` : '—'}</strong>
        </p>
        <dl className="flex flex-col gap-3 rounded-lg border border-line/30 bg-app/60 px-4 py-4 text-sm">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3">
              <dt className="min-w-0 break-words text-fg-secondary">{r.label}</dt>
              <dd className="shrink-0 tabular-nums text-fg">
                {r.valueText ?? (
                  <span className="inline-flex items-center gap-1 text-fg-secondary">
                    <SignalLostIcon size={14} className="shrink-0" />
                    Mất tín hiệu
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
        <p className="px-1 text-sm italic leading-6 text-fg-secondary">Dữ liệu thật chỉ dùng làm trạng thái ban đầu và không bị thay đổi trong quá trình mô phỏng.</p>
      </div>
    </Card>
  );
}
