/*
 * Lượt mô phỏng chạy theo thời gian thực – logic THUẦN dùng chung cho màn "Theo dõi diễn biến" (ảnh `ai-sim-monitor/`) và
 * "Kết quả mô phỏng" (ảnh `ai-sim-result/`): đường diễn biến (xác định), mốc sự kiện, cảnh báo mô phỏng High / High-High,
 * gợi ý AI, trạng thái lượt. `now` (ms) truyền vào. Mọi số chỉ nằm trên lớp mô phỏng – không lệnh PLC, không ESD thật,
 * không cảnh báo vận hành thật; dữ liệu PLC/SCADA thật chỉ được CHỤP lúc bắt đầu làm trạng thái ban đầu.
 *
 * Mô hình (người dùng chốt 03/11/2026 theo ảnh Kết quả): biến tăng (smoothstep) tới mục tiêu → chạm mục tiêu = High-High →
 * ESD ảo / biện pháp xử lý mô phỏng kéo biến về gần mức ban đầu (tuyến tính, nửa thời lượng). "Tăng chậm" có thể không chạm
 * mục tiêu (không có pha giảm).
 */
import { formatVariable, lowerFirst, reachesThreshold, type SimVariable } from './config';
import { type Scenario } from './scenarios';
import { CHART_STEP_SEC } from './monitorChart';
import { type MonitorSetup, type SimProfile, type SimulationSession, peakSec, profileOf, recovering, valueAt } from './monitorCore';
import { type SessionPhase, clockText, elapsedSec, isActivePhase, sessionPhase } from './session';
import { type SimAlert, type SimEventTone, type Trend, capFirst, simTimeline } from './timeline';

export type MonitorTimelineItem = { id: string; time: string; title: string; tone: 'danger' | 'info' | 'warning' | 'neutral' | 'success' };
export type ChartPoint = { sec: number; value: number };

export type MonitorSnapshot = {
  phase: SessionPhase;
  elapsed: number;
  durationSec: number;
  value: number;
  /** "28% LEL" */
  valueText: string;
  trend: Trend;
  /** Biến đã chạm ngưỡng cảnh báo PLC (trong lượt). */
  exceeded: boolean;
  /** Điểm biểu đồ mỗi 5 s tới hiện tại (kèm điểm hiện tại). */
  points: ChartPoint[];
  /** Mới nhất trước. */
  alerts: SimAlert[];
  /** Mới nhất trước. */
  timeline: MonitorTimelineItem[];
  /** Rỗng = AI chưa đưa gợi ý. */
  recommendations: readonly string[];
  /** Câu tóm tắt của AI (null = chưa có). */
  summary: string | null;
};

const FEED_TONE: Record<SimEventTone, MonitorTimelineItem['tone']> = {
  primary: 'info',
  info: 'info',
  warning: 'warning',
  success: 'success',
  neutral: 'neutral',
  danger: 'danger',
};

function trendAt(p: SimProfile, sec: number, active: boolean): Trend {
  if (!active || p.target === p.start) return 'steady';
  const rising = p.target > p.start;
  const pk = peakSec(p);
  if (pk !== undefined && sec >= p.durationSec) return 'steady';
  if (pk !== undefined && sec > pk) return rising ? 'down' : 'up';
  return rising ? 'up' : 'down';
}

export function monitorSnapshot(
  s: Pick<Scenario, 'steps' | 'setup'>,
  monitor: MonitorSetup,
  session: SimulationSession,
  now: number,
): MonitorSnapshot {
  const v = s.setup.variable;
  const p = profileOf(session);
  const phase = sessionPhase(session, now);
  const active = isActivePhase(phase);
  const elapsed = elapsedSec(session, now);
  const value = valueAt(p, elapsed);
  const { alerts, events, marks } = simTimeline(s, monitor, session, now);
  const fmt = (x: number) => formatVariable(x, v);
  const trend = trendAt(p, elapsed, active);

  const points: ChartPoint[] = [];
  for (let t = 0; t < elapsed; t += CHART_STEP_SEC) points.push({ sec: t, value: valueAt(p, t) });
  points.push({ sec: elapsed, value });

  // Timeline theo dõi: mốc bắt đầu theo phút:giây ("00:00"), mốc khác theo giờ nhà máy (như ảnh); hiện tại / kết thúc đầu.
  const reading = `${monitor.subject} đạt ${fmt(value)}`;
  const feed: MonitorTimelineItem[] = events
    .filter((e) => e.id !== 'end')
    .map((e) => ({
      id: e.id,
      time: e.id === 'start' ? clockText(0) : e.time,
      title: e.feedTitle,
      tone: e.id === 'start' ? 'neutral' : FEED_TONE[e.tone],
    }));
  feed.push(
    active
      ? { id: 'now', time: `${clockText(elapsed)} (Hiện tại)`, title: reading, tone: 'danger' }
      : {
          id: 'end',
          time: `${clockText(elapsed)} (${phase === 'stopped' ? 'Dừng' : 'Kết thúc'})`,
          title: `${phase === 'stopped' ? 'Dừng mô phỏng' : 'Kết thúc mô phỏng'} – ${lowerFirst(reading)}`,
          tone: 'success',
        },
  );

  const crossed = marks.cross !== undefined && marks.cross <= elapsed;
  const aiReady = marks.ai !== undefined && marks.ai <= elapsed;
  const crossVerb = v.direction === 'above' ? 'vượt' : 'xuống dưới';
  const tail = !active
    ? `dừng ở ${fmt(value)}`
    : recovering(p, elapsed)
      ? 'đang về lại mức an toàn sau quy trình xử lý mô phỏng'
      : `tiếp tục ${v.direction === 'above' ? 'tăng' : 'giảm'}`;
  const summary = aiReady
    ? `${capFirst(v.noun)} mô phỏng đã ${crossVerb} ${lowerFirst(v.thresholdLabel)} và ${tail}. Nên đánh giá phản ứng cảnh báo, kiểm tra logic hiển thị cảnh báo mô phỏng và rà soát quy trình xử lý ${monitor.reviewArea}.`
    : null;

  return {
    phase,
    elapsed,
    durationSec: p.durationSec,
    value,
    valueText: fmt(value),
    trend,
    exceeded: crossed || reachesThreshold(v, value),
    points,
    alerts: [...alerts].reverse(),
    timeline: feed.reverse(),
    recommendations: aiReady ? monitor.recommendations : [],
    summary,
  };
}

/** Câu chờ của khối Gợi ý AI trước khi có gợi ý. */
export function pendingSuggestionText(
  v: Pick<SimVariable, 'noun' | 'direction' | 'thresholdLabel' | 'threshold' | 'unit' | 'qualifier' | 'digits'>,
): string {
  return `AI đang theo dõi diễn biến – gợi ý sẽ có khi ${v.noun} ${v.direction === 'above' ? 'vượt' : 'xuống dưới'} ${lowerFirst(v.thresholdLabel)} (${formatVariable(v.threshold, v)}).`;
}

// Tách file (10/11/2026) – điểm import chung vẫn là `features/simulation/monitor`.
export * from './monitorCore';
export * from './session';
export * from './timeline';
export * from './monitorChart';
