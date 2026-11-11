/** Diễn biến mô phỏng: cảnh báo High / High-High, sự kiện theo thời gian. Tách từ monitor.ts. */
import { plantTimeOfDay } from '@/lib/plantTime';
import { formatQty, formatVariable, lowerFirst } from './config';
import type { Scenario } from './scenarios';
import { type MonitorMarks, type MonitorSetup, type SimulationSession, monitorMarks, profileOf, valueAt } from './monitorCore';
import { clockText, elapsedSec, isActivePhase, sessionPhase } from './session';

export type Trend = 'up' | 'down' | 'steady';
export const TREND_LABEL: Record<Trend, string> = { up: 'Đang tăng', down: 'Đang giảm', steady: 'Ổn định' };

export type SimAlertLevel = 'high' | 'high-high';

export type SimAlert = {
  id: string;
  level: SimAlertLevel;
  /** Tiêu đề ở màn theo dõi. */
  title: string;
  /** Dòng phụ ở màn theo dõi ("Đạt 21% LEL lúc 18:17:10. Đang theo dõi."). */
  detail: string;
  /** Mô tả ở màn kết quả ("Cảnh báo mức cao (High Level): …"). */
  description: string;
  tone: 'danger' | 'warning';
  atSec: number;
  /** "18:17:10" */
  time: string;
};

export type SimEventId = 'start' | 'watch' | 'alert' | 'ai' | 'recovery' | 'recovered' | 'end';
export type SimEventTone = 'primary' | 'info' | 'warning' | 'success' | 'neutral' | 'danger';

export type SimEvent = {
  id: SimEventId;
  sec: number;
  /** "18:14:00" (giờ nhà máy). */
  time: string;
  /** Tiêu đề ở màn kết quả ("Cảnh báo mô phỏng: SIM-AL-001"). */
  title: string;
  /** Mô tả ở màn kết quả. */
  detail: string;
  /** Tiêu đề ở timeline màn theo dõi ("Vượt ngưỡng cảnh báo PLC 20% LEL"). */
  feedTitle: string;
  tone: SimEventTone;
  /** Dòng có nhãn "Mô phỏng" (cảnh báo). */
  simulated?: boolean;
};

export const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Cảnh báo giả lập đã phát tới `elapsed`: High (vượt ngưỡng) rồi High-High (chạm giá trị mục tiêu). */
function timelineAlerts(
  s: Pick<Scenario, 'setup'>,
  monitor: MonitorSetup,
  session: SimulationSession,
  marks: MonitorMarks,
  elapsed: number,
  at: (sec: number) => string,
  active: boolean,
): SimAlert[] {
  const v = s.setup.variable;
  const p = profileOf(session);
  const seen = (x: number | undefined): x is number => x !== undefined && x <= elapsed;
  const fmt = (x: number) => formatVariable(x, v);
  const above = v.direction === 'above';
  const follow = active ? 'Đang theo dõi.' : 'Đã kết thúc mô phỏng.';
  const alerts: SimAlert[] = [];
  if (seen(marks.alert)) {
    const val = valueAt(p, marks.alert);
    alerts.push({
      id: 'SIM-AL-001',
      level: 'high',
      title: monitor.alertTitle,
      detail: `Đạt ${fmt(val)} lúc ${at(marks.alert)}. ${follow}`,
      description: `Cảnh báo mức ${above ? 'cao (High Level)' : 'thấp (Low Level)'}: ${monitor.alertSubject} ${above ? 'vượt' : 'xuống dưới'} ngưỡng ${fmt(v.threshold)}. Đo được: ${formatQty(val, v.unit, v.digits)}.`,
      tone: 'warning',
      atSec: marks.alert,
      time: at(marks.alert),
    });
  }
  if (seen(marks.peakAlert)) {
    alerts.push({
      id: `SIM-AL-${String(alerts.length + 1).padStart(3, '0')}`,
      level: 'high-high',
      title: monitor.peakTitle,
      detail: `Đạt ${fmt(session.config.target)} lúc ${at(marks.peakAlert)}. ${follow}`,
      description: `Cảnh báo nguy hiểm (${above ? 'High-High' : 'Low-Low'}): ${monitor.alertSubject} chạm ngưỡng ${fmt(session.config.target)}. ${monitor.peakAdvice}`,
      tone: 'danger',
      atSec: marks.peakAlert,
      time: at(marks.peakAlert),
    });
  }

  return alerts;
}

/** Mốc kết thúc lượt: dừng thủ công · hoàn thành (chạm / chưa chạm giá trị mục tiêu). */
function endEvent(phase: string, elapsed: number, marks: MonitorMarks, session: SimulationSession, at: (sec: number) => string): SimEvent {
  const stopped = phase === 'stopped';
  const reached = marks.peak !== undefined && marks.peak <= elapsed;
  const doneTitle = reached ? 'Hoàn thành mô phỏng theo giá trị mục tiêu' : 'Hoàn thành mô phỏng – chưa chạm giá trị mục tiêu';
  return {
    id: 'end',
    sec: elapsed,
    time: at(elapsed),
    title: stopped ? 'Dừng mô phỏng thủ công' : doneTitle,
    detail: stopped
      ? `Dừng lúc ${clockText(elapsed)}. Tạo báo cáo nháp.`
      : `Kết thúc phiên chạy sau ${session.config.durationMin} phút. Tạo báo cáo nháp.`,
    feedTitle: stopped ? 'Dừng mô phỏng' : 'Kết thúc mô phỏng',
    tone: 'success',
  };
}

/** Cảnh báo + sự kiện đã xảy ra tới `elapsed` (cũ trước). `finished` → thêm mốc kết thúc. */
export function simTimeline(
  s: Pick<Scenario, 'steps' | 'setup'>,
  monitor: MonitorSetup,
  session: SimulationSession,
  now: number,
): { alerts: SimAlert[]; events: SimEvent[]; marks: MonitorMarks } {
  const v = s.setup.variable;
  const p = profileOf(session);
  const phase = sessionPhase(session, now);
  const active = isActivePhase(phase);
  const elapsed = elapsedSec(session, now);
  const marks = monitorMarks(s, p);
  const seen = (x: number | undefined): x is number => x !== undefined && x <= elapsed;
  const at = (sec: number) => plantTimeOfDay(new Date(Date.parse(session.startedAt) + sec * 1000));
  const fmt = (x: number) => formatVariable(x, v);
  const above = v.direction === 'above';

  const alerts = timelineAlerts(s, monitor, session, marks, elapsed, at, active);
  const trendWord = above ? 'tăng' : 'giảm';
  const events: SimEvent[] = [
    {
      id: 'start',
      sec: 0,
      time: at(0),
      title: 'Bắt đầu mô phỏng',
      detail: `Khởi tạo ${monitor.signal} mô phỏng từ trạng thái tham chiếu PLC/SCADA.`,
      feedTitle: 'Bắt đầu mô phỏng sự cố',
      tone: 'primary',
    },
  ];
  if (seen(marks.watch) && marks.watch > 0) {
    events.push({
      id: 'watch',
      sec: marks.watch,
      time: at(marks.watch),
      title: `AI ghi nhận xu hướng ${trendWord}`,
      detail: `Đạt ${fmt(marks.watchLevel)}. ${monitor.watchAdvice}`,
      feedTitle: `AI ghi nhận xu hướng ${trendWord} (${fmt(marks.watchLevel)})`,
      tone: 'primary',
    });
  }
  const high = alerts.find((a) => a.level === 'high');
  if (high) {
    events.push({
      id: 'alert',
      sec: high.atSec,
      time: high.time,
      title: `Cảnh báo mô phỏng: ${high.id}`,
      detail: `${above ? 'Vượt' : 'Xuống dưới'} ngưỡng ${fmt(v.threshold)}. Đo được ${fmt(valueAt(p, high.atSec))}.`,
      feedTitle: `${above ? 'Vượt' : 'Xuống dưới'} ${lowerFirst(v.thresholdLabel)} ${fmt(v.threshold)}`,
      tone: 'warning',
      simulated: true,
    });
  }
  if (seen(marks.ai)) {
    events.push({
      id: 'ai',
      sec: marks.ai,
      time: at(marks.ai),
      title: 'AI gợi ý rà soát quy trình',
      detail: monitor.aiDetail,
      feedTitle: monitor.aiAction,
      tone: 'info',
    });
  }
  if (seen(marks.recovery)) {
    events.push({
      id: 'recovery',
      sec: marks.recovery,
      time: at(marks.recovery),
      title: monitor.recoveryTitle,
      detail: monitor.recoveryDetail,
      feedTitle: monitor.recoveryTitle,
      tone: 'info',
    });
  }
  if (seen(marks.recovered)) {
    events.push({
      id: 'recovered',
      sec: marks.recovered,
      time: at(marks.recovered),
      title: monitor.recoveredTitle,
      detail: `Đạt ${fmt(marks.watchLevel)}. Hệ thống mô phỏng xác nhận tình trạng ổn định trở lại.`,
      feedTitle: monitor.recoveredTitle,
      tone: 'info',
    });
  }
  if (!active) events.push(endEvent(phase, elapsed, marks, session, at));
  events.sort((a, b) => a.sec - b.sec);
  return { alerts, events, marks };
}
