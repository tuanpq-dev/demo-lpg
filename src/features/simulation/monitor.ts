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
import type { TagValue } from '@/features/live/types';
import { formatDayVi, plantDayKey, plantTimeOfDay } from '@/lib/plantTime';
import {
  defaultRunNote,
  formatQty,
  formatVariable,
  lowerFirst,
  reachesThreshold,
  referenceReading,
  startValue,
  type LeakRate,
  type ScenarioConfig,
  type ScenarioSetup,
  type SimVariable,
} from './config';
import { runBlocker, simulateScenario, type RunBlocker, type Scenario, type SimulationRun, type TagHealth } from './scenarios';

type LiveMap = Readonly<Record<string, TagValue>> | undefined;

// ---------------------------------------------------------------------------
// Kiểu

/** Chữ riêng của màn theo dõi / kết quả cho từng kịch bản (mock – SC-001 nguyên văn ảnh). */
export type MonitorSetup = {
  /** Chủ ngữ ngắn: "Nồng độ" → "Nồng độ hiện tại" (KPI), "Nồng độ đạt 28% LEL" (timeline), "Nồng độ thực tế" (chú thích). */
  subject: string;
  /** Tín hiệu khởi tạo: "tín hiệu gas" → "Khởi tạo tín hiệu gas mô phỏng từ trạng thái tham chiếu PLC/SCADA." */
  signal: string;
  /** Đối tượng trong mô tả cảnh báo: "Nồng độ Gas khu vực V-101". */
  alertSubject: string;
  /** Tiêu đề cảnh báo High (vượt ngưỡng PLC) ở màn theo dõi: "Gas khu vực bồn vượt ngưỡng cảnh báo PLC". */
  alertTitle: string;
  /** Tiêu đề cảnh báo High-High (chạm mục tiêu) ở màn theo dõi. */
  peakTitle: string;
  /** Câu khuyến nghị kèm High-High: "Gợi ý rà soát quy trình ESD mô phỏng nếu vượt mức nguy hiểm." */
  peakAdvice: string;
  /** Kèm mốc "AI ghi nhận xu hướng": "Gợi ý kiểm tra van xả mô phỏng." */
  watchAdvice: string;
  /** Dòng timeline theo dõi khi AI đưa gợi ý: "[Mô phỏng] Gợi ý thực hiện quy trình cô lập khu vực theo SOP". */
  aiAction: string;
  /** Mô tả mốc đó ở màn kết quả: "AI gợi ý rà soát quy trình cô lập khu vực theo SOP mô phỏng." */
  aiDetail: string;
  /** Pha giảm: "Nồng độ gas bắt đầu giảm" + mô tả. */
  recoveryTitle: string;
  recoveryDetail: string;
  /** Về dưới mức theo dõi: "Nồng độ dưới ngưỡng nguy hiểm". */
  recoveredTitle: string;
  /** Cụm cuối câu tóm tắt AI: "khu vực bồn LPG". */
  reviewArea: string;
  /** Danh sách gợi ý AI (đánh số). */
  recommendations: readonly string[];
  /** Màn kết quả. */
  result: {
    /** KPI "Gas cao nhất". */
    peakLabel: string;
    /** Tên tiêu chí gợi ý AI: "Gợi ý AI (Virtual ESD)". */
    aiCriterion: string;
    /** Câu đề nghị tiếp theo khi Đạt: "Nên tiếp tục chạy thêm kịch bản …". */
    next: string;
    strengths: readonly string[];
    improvements: readonly string[];
  };
};

/** Một dòng "Dữ liệu PLC/SCADA tham chiếu" – CHỤP lúc bắt đầu (null = mất tín hiệu lúc chụp). */
export type ReferenceSnapshotRow = {
  id: string;
  /** Tên tag PLC ("Tank_Gas_Detector"). */
  label: string;
  /** Nhãn ngắn màn kết quả ("Gas nền (thực tế)"); không có → không hiện ở danh sách rút gọn. */
  shortLabel?: string;
  valueText: string | null;
};

export type ReportState = {
  /** "Thêm vào báo cáo" gợi ý AI. */
  aiIncluded?: boolean;
  /** "Bỏ qua" gợi ý AI. */
  aiDismissed?: boolean;
  /** ISO – lần xuất Excel (CSV) gần nhất. */
  excelAt?: string;
};

/** Một lượt mô phỏng đang chạy / đã xong (store riêng; khi xong mới ghi `SimulationRun` vào lịch sử). */
export type SimulationSession = {
  id: string;
  scenarioId: string;
  /** ISO – giờ ứng dụng lúc bắt đầu. */
  startedAt: string;
  by: string;
  /** Tham số dùng cho lượt (bản sao lúc bắt đầu). */
  config: ScenarioConfig;
  /** Giá trị thực tế của biến chính lúc bắt đầu. */
  startValue: number;
  reference: readonly ReferenceSnapshotRow[];
  /** Tình trạng 21 tag PLC/SCADA lúc bắt đầu ("Số biến tham chiếu", "Đã đồng bộ…"). */
  referenceHealth?: { ok: number; total: number };
  /** ISO – người dùng bấm "Dừng mô phỏng". */
  stoppedAt?: string;
  /** Mã lượt đã ghi vào lịch sử (lượt đã kết thúc). */
  runId?: string;
  report?: ReportState;
};

// ---------------------------------------------------------------------------
// Đường diễn biến (xác định: cùng tham số → cùng đường)

/**
 * Tỉ lệ thời lượng để biến chạm mục tiêu theo tốc độ: nhanh 50 % (ảnh Kết quả: 35 % LEL ở phút 5/10), vừa 94 % (ảnh Theo
 * dõi: vượt 20 % quanh 05:00, 28 % lúc 06:32), chậm 125 % (không chạm). GIẢ ĐỊNH – docs/questions.md 17.
 */
export const RATE_REACH: Record<LeakRate, number> = { fast: 0.5, medium: 0.94, slow: 1.25 };
/** Pha giảm (ESD ảo) kéo dài nửa thời lượng, về mức ban đầu + 5 % biên độ (ảnh: 35 → ~2 % LEL trong 5 phút). */
export const RECOVERY_SHARE = 0.5;
export const RECOVERY_FLOOR = 0.05;
/** Mức "AI ghi nhận xu hướng" = 75 % quãng đường tới ngưỡng PLC (ảnh: 15 % khi ngưỡng 20 %). */
export const WATCH_SHARE = 0.75;

export type SimProfile = { start: number; target: number; durationSec: number; rate: LeakRate };

export const profileOf = (s: Pick<SimulationSession, 'startValue' | 'config'>): SimProfile => ({
  start: s.startValue,
  target: s.config.target,
  durationSec: s.config.durationMin * 60,
  rate: s.config.rate,
});

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Giây chạm mục tiêu (đỉnh); không chạm trong thời lượng → undefined. */
export function peakSec(p: SimProfile): number | undefined {
  const reach = p.durationSec * RATE_REACH[p.rate];
  return reach <= p.durationSec ? Math.round(reach) : undefined;
}

export function valueAt(p: SimProfile, sec: number): number {
  const reach = p.durationSec * RATE_REACH[p.rate];
  const amp = p.target - p.start;
  if (sec <= reach || reach > p.durationSec) {
    const x = reach > 0 ? clamp(sec / reach, 0, 1) : 1;
    return p.start + amp * x * x * (3 - 2 * x);
  }
  const floor = p.start + amp * RECOVERY_FLOOR;
  const v = clamp((sec - reach) / (p.durationSec * RECOVERY_SHARE), 0, 1);
  return p.target - (p.target - floor) * v;
}

/** Đang ở pha giảm (sau đỉnh). */
export const recovering = (p: SimProfile, sec: number) => {
  const pk = peakSec(p);
  return pk !== undefined && sec > pk;
};

/** Giây nguyên đầu tiên trong [from, thời lượng] biến chạm `level` theo chiều `direction`; không chạm → undefined. */
export function firstReach(p: SimProfile, level: number, direction: SimVariable['direction'], from = 0): number | undefined {
  const hit = (v: number) => (direction === 'above' ? v >= level : v <= level);
  for (let s = Math.max(0, Math.ceil(from)); s <= p.durationSec; s++) if (hit(valueAt(p, s))) return s;
  return undefined;
}

const flip = (d: SimVariable['direction']): SimVariable['direction'] => (d === 'above' ? 'below' : 'above');

// ---------------------------------------------------------------------------
// Trạng thái lượt

/** running = đang chạy · holding = hết thời lượng, chờ người dùng dừng (điều kiện "người dùng dừng") · completed · stopped. */
export type SessionPhase = 'running' | 'holding' | 'completed' | 'stopped';

export const PHASE_LABEL: Record<SessionPhase, string> = {
  running: 'Đang chạy mô phỏng',
  holding: 'Chờ dừng mô phỏng',
  completed: 'Đã hoàn thành',
  stopped: 'Đã dừng',
};

/** Chữ trong ngoặc sau "/ 10:00". */
export const PHASE_NOTE: Record<SessionPhase, string> = {
  running: 'Đang mô phỏng',
  holding: 'Hết thời lượng – chờ dừng',
  completed: 'Hoàn thành',
  stopped: 'Đã dừng',
};

export const isActivePhase = (ph: SessionPhase) => ph === 'running' || ph === 'holding';

export function sessionPhase(s: Pick<SimulationSession, 'startedAt' | 'config' | 'stoppedAt'>, now: number): SessionPhase {
  if (s.stoppedAt) return 'stopped';
  if (now - Date.parse(s.startedAt) < s.config.durationMin * 60_000) return 'running';
  // Chỉ "Kết thúc khi người dùng dừng" chờ bấm Dừng; các điều kiện khác kết thúc khi hết thời lượng (GIẢ ĐỊNH – questions 17).
  return s.config.endCondition === 'manual-stop' ? 'holding' : 'completed';
}

/** Giây đã chạy (0…thời lượng; dừng → tới lúc dừng). */
export function elapsedSec(s: Pick<SimulationSession, 'startedAt' | 'config' | 'stoppedAt'>, now: number): number {
  const end = s.stoppedAt ? Date.parse(s.stoppedAt) : now;
  return clamp(Math.floor((end - Date.parse(s.startedAt)) / 1000), 0, s.config.durationMin * 60);
}

/** Mốc tự kết thúc (ms) – "người dùng dừng" → undefined (chờ bấm Dừng). */
export function autoEndAt(s: Pick<SimulationSession, 'startedAt' | 'config'>): number | undefined {
  return s.config.endCondition === 'manual-stop' ? undefined : Date.parse(s.startedAt) + s.config.durationMin * 60_000;
}

const byNewestSession = (a: SimulationSession, b: SimulationSession) => b.startedAt.localeCompare(a.startedAt) || b.id.localeCompare(a.id);

/** Lượt hiển thị cho một kịch bản: lượt đang chạy, không có thì lượt bắt đầu gần nhất. */
export function sessionOf(scenarioId: string, sessions: readonly SimulationSession[], now: number): SimulationSession | undefined {
  const mine = sessions.filter((x) => x.scenarioId === scenarioId).sort(byNewestSession);
  return mine.find((x) => isActivePhase(sessionPhase(x, now))) ?? mine[0];
}

/** Lượt đang chạy của kịch bản (để nút chạy chuyển thành "Theo dõi"). */
export function activeSessionOf(scenarioId: string, sessions: readonly SimulationSession[], now: number): SimulationSession | undefined {
  const s = sessionOf(scenarioId, sessions, now);
  return s && isActivePhase(sessionPhase(s, now)) ? s : undefined;
}

/** Lượt đã kết thúc gần nhất (đã ghi lịch sử) của kịch bản – màn "Kết quả mô phỏng". */
export function finishedSessionOf(scenarioId: string, sessions: readonly SimulationSession[]): SimulationSession | undefined {
  return sessions.filter((x) => x.scenarioId === scenarioId && x.runId).sort(byNewestSession)[0];
}

/** "SIM-RUN-24062026-001": ngày (giờ nhà máy) + thứ tự lượt trong ngày đó (mọi kịch bản). */
export function sessionCode(session: SimulationSession, sessions: readonly SimulationSession[]): string {
  const day = plantDayKey(new Date(session.startedAt));
  const sameDay = sessions
    .filter((x) => plantDayKey(new Date(x.startedAt)) === day)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id));
  const seq = Math.max(1, sameDay.findIndex((x) => x.id === session.id) + 1);
  const [y, m, d] = day.split('-');
  return `SIM-RUN-${d}${m}${y}-${String(seq).padStart(3, '0')}`;
}

// ---------------------------------------------------------------------------
// Bắt đầu / kết thúc

/** Như `runBlocker`, thêm: biến chính mất tín hiệu → không có giá trị bắt đầu. */
export function startBlocker(s: Scenario, live: LiveMap, now: number): RunBlocker | null {
  const b = runBlocker(s, live, now);
  if (b) return b;
  if (startValue(s.setup.variable, live, now) === undefined) {
    return { kind: 'signal', text: `Thiếu dữ liệu tham chiếu: ${s.setup.variable.tag} mất tín hiệu – không có giá trị bắt đầu.` };
  }
  return null;
}

/** "9.2 bar" · "28.7°C" · "76.0%" · "2.0% LEL" (đơn vị bảng tham chiếu). */
export function withUnit(text: string, unit: string): string {
  if (unit === '%LEL') return `${text}% LEL`;
  if (unit === '%' || unit.startsWith('°')) return `${text}${unit}`;
  if (unit === '—' || !unit) return text;
  return `${text} ${unit}`;
}

/** Dòng cố định cuối bảng: mô phỏng không điều khiển van. */
export const VALVE_ROW: ReferenceSnapshotRow = { id: 'valve', label: 'Van điều khiển', valueText: 'Theo quy trình SOP' };

/** Chụp bảng tham chiếu (bỏ heartbeat) – tên tag PLC + giá trị lúc bắt đầu; mất tín hiệu → null (không số cũ). */
export function referenceSnapshot(setup: Pick<ScenarioSetup, 'referenceRows'>, live: LiveMap, now: number): ReferenceSnapshotRow[] {
  const rows = setup.referenceRows
    .filter((r) => r.kind !== 'heartbeat')
    .map((r) => {
      const v = referenceReading(r, live?.[r.tag], now).valueText;
      return { id: r.id, label: r.plcTag, ...(r.shortLabel ? { shortLabel: r.shortLabel } : {}), valueText: v === null ? null : withUnit(v, r.unit) };
    });
  return [...rows, VALVE_ROW];
}

/**
 * Tạo lượt mới (đã kiểm `startBlocker` ở nơi gọi; vẫn ném lỗi nếu chưa chạy được). `liveNow` = giờ THẬT cho độ tươi số liệu;
 * `health` = tình trạng 21 tag lúc bắt đầu.
 */
export function createSession(
  s: Scenario,
  live: LiveMap,
  liveNow: number,
  at: Date,
  by: string,
  id: string,
  health?: Pick<TagHealth, 'ok' | 'total'>,
): SimulationSession {
  const blocker = startBlocker(s, live, liveNow);
  if (blocker) throw new Error(blocker.text);
  return {
    id,
    scenarioId: s.id,
    startedAt: at.toISOString(),
    by,
    config: { ...s.config, areas: [...s.config.areas] },
    startValue: startValue(s.setup.variable, live, liveNow)!,
    reference: referenceSnapshot(s.setup, live, liveNow),
    ...(health ? { referenceHealth: { ok: health.ok, total: health.total } } : {}),
  };
}

/** "06:32" (phút:giây kể từ lúc bắt đầu). */
export function clockText(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Bản ghi lịch sử khi lượt kết thúc: kết quả như `simulateScenario` (theo tham số của lượt); dừng sớm → ghi chú thêm giờ dừng. */
export function sessionRun(s: Scenario, session: SimulationSession, id: string, now: number): SimulationRun {
  const base = simulateScenario({ ...s, config: session.config }, new Date(session.startedAt), session.by, id);
  const note = defaultRunNote(base);
  return { ...base, note: session.stoppedAt ? `Dừng thủ công lúc ${clockText(elapsedSec(session, now))}. ${note}` : note };
}

// ---------------------------------------------------------------------------
// Mốc sự kiện (giây kể từ lúc bắt đầu)

/** Độ trễ (giây) từ lúc chạm mức tới cảnh báo SCADA: cộng các bước tới bước 'alarm' (không có → bước đầu). */
export function alarmOffset(steps: Scenario['steps']): number {
  const i = steps.findIndex((x) => x.id === 'alarm');
  const upto = i >= 0 ? i : Math.min(0, steps.length - 1);
  return steps.slice(0, upto + 1).reduce((sum, x) => sum + x.seconds, 0);
}

/** Độ trễ tới gợi ý AI: bước ngay sau cảnh báo (đề xuất ESD / giảm tải / chuyển máy…). */
export function aiOffset(steps: Scenario['steps']): number {
  const i = steps.findIndex((x) => x.id === 'alarm');
  const next = steps[(i >= 0 ? i : 0) + 1];
  return alarmOffset(steps) + (next?.seconds ?? 0);
}

/** AI ghi nhận xu hướng giảm sau đỉnh (giây). */
export const RECOVERY_NOTICE_SEC = 60;

export type MonitorMarks = {
  /** Mức "AI ghi nhận xu hướng" (giá trị). */
  watchLevel: number;
  watch?: number;
  /** Chạm ngưỡng cảnh báo PLC. */
  cross?: number;
  /** Cảnh báo High được phát. */
  alert?: number;
  /** AI đưa gợi ý. */
  ai?: number;
  /** Chạm mục tiêu (đỉnh). */
  peak?: number;
  /** Cảnh báo High-High được phát. */
  peakAlert?: number;
  /** AI ghi nhận xu hướng giảm. */
  recovery?: number;
  /** Về lại dưới mức theo dõi. */
  recovered?: number;
};

export function monitorMarks(s: Pick<Scenario, 'steps' | 'setup'>, p: SimProfile): MonitorMarks {
  const v = s.setup.variable;
  const within = (x: number | undefined) => (x !== undefined && x <= p.durationSec ? x : undefined);
  const watchLevel = p.start + (v.threshold - p.start) * WATCH_SHARE;
  const cross = firstReach(p, v.threshold, v.direction);
  const peak = peakSec(p);
  return {
    watchLevel,
    watch: firstReach(p, watchLevel, v.direction),
    cross,
    alert: cross === undefined ? undefined : within(cross + alarmOffset(s.steps)),
    ai: cross === undefined ? undefined : within(cross + aiOffset(s.steps)),
    peak,
    peakAlert: peak === undefined ? undefined : within(peak + alarmOffset(s.steps)),
    recovery: peak === undefined ? undefined : within(peak + RECOVERY_NOTICE_SEC),
    recovered: peak === undefined ? undefined : firstReach(p, watchLevel, flip(v.direction), peak + 1),
  };
}

// ---------------------------------------------------------------------------
// Sự kiện + cảnh báo (một nguồn cho 2 màn)

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

const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
    events.push({ id: 'ai', sec: marks.ai, time: at(marks.ai), title: 'AI gợi ý rà soát quy trình', detail: monitor.aiDetail, feedTitle: monitor.aiAction, tone: 'info' });
  }
  if (seen(marks.recovery)) {
    events.push({ id: 'recovery', sec: marks.recovery, time: at(marks.recovery), title: monitor.recoveryTitle, detail: monitor.recoveryDetail, feedTitle: monitor.recoveryTitle, tone: 'info' });
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
  if (!active) {
    const stopped = phase === 'stopped';
    const reached = marks.peak !== undefined && marks.peak <= elapsed;
    events.push({
      id: 'end',
      sec: elapsed,
      time: at(elapsed),
      title: stopped ? 'Dừng mô phỏng thủ công' : reached ? 'Hoàn thành mô phỏng theo giá trị mục tiêu' : 'Hoàn thành mô phỏng – chưa chạm giá trị mục tiêu',
      detail: stopped ? `Dừng lúc ${clockText(elapsed)}. Tạo báo cáo nháp.` : `Kết thúc phiên chạy sau ${session.config.durationMin} phút. Tạo báo cáo nháp.`,
      feedTitle: stopped ? 'Dừng mô phỏng' : 'Kết thúc mô phỏng',
      tone: 'success',
    });
  }
  events.sort((a, b) => a.sec - b.sec);
  return { alerts, events, marks };
}

// ---------------------------------------------------------------------------
// Ảnh chụp màn theo dõi tại `now`

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

export const CHART_STEP_SEC = 5;

const FEED_TONE: Record<SimEventTone, MonitorTimelineItem['tone']> = {
  primary: 'info',
  info: 'info',
  warning: 'warning',
  success: 'success',
  neutral: 'neutral',
  danger: 'danger',
};

export function trendAt(p: SimProfile, sec: number, active: boolean): Trend {
  if (!active || p.target === p.start) return 'steady';
  const rising = p.target > p.start;
  const pk = peakSec(p);
  if (pk !== undefined && sec >= p.durationSec) return 'steady';
  if (pk !== undefined && sec > pk) return rising ? 'down' : 'up';
  return rising ? 'up' : 'down';
}

export function monitorSnapshot(s: Pick<Scenario, 'steps' | 'setup'>, monitor: MonitorSetup, session: SimulationSession, now: number): MonitorSnapshot {
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
    .map((e) => ({ id: e.id, time: e.id === 'start' ? clockText(0) : e.time, title: e.feedTitle, tone: e.id === 'start' ? 'neutral' : FEED_TONE[e.tone] }));
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
export function pendingSuggestionText(v: Pick<SimVariable, 'noun' | 'direction' | 'thresholdLabel' | 'threshold' | 'unit' | 'qualifier' | 'digits'>): string {
  return `AI đang theo dõi diễn biến – gợi ý sẽ có khi ${v.noun} ${v.direction === 'above' ? 'vượt' : 'xuống dưới'} ${lowerFirst(v.thresholdLabel)} (${formatVariable(v.threshold, v)}).`;
}

/** "24/06/2026 18:14" – ngày giờ bắt đầu một lượt. */
export const sessionStartText = (s: Pick<SimulationSession, 'startedAt'>) => {
  const d = new Date(s.startedAt);
  return `${formatDayVi(plantDayKey(d))} ${plantTimeOfDay(d).slice(0, 5)}`;
};

// ---------------------------------------------------------------------------
// Trục biểu đồ

/** Nhãn trục X: 5 mốc chia đều thời lượng ("00:00 · 02:30 · 05:00 · 07:30 · 10:00"). */
export const chartTicks = (durationSec: number) => [0, 1, 2, 3, 4].map((i) => Math.round((durationSec * i) / 4));

const NICE = [1, 2, 2.5, 5, 10];

/** Miền trục Y "đẹp" bao start / mục tiêu / ngưỡng (ảnh: 0–40 %). `intervals` = số khoảng mong muốn (theo dõi 4, kết quả 8). */
export function chartDomain(values: readonly number[], intervals = 4): { domain: [number, number]; ticks: number[] } {
  const lo0 = Math.min(...values);
  const hi0 = Math.max(...values);
  const raw = (hi0 - lo0 || Math.abs(hi0) || 1) / intervals;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = (NICE.find((n) => n * mag >= raw) ?? 10) * mag;
  let lo = Math.floor(lo0 / step) * step;
  let hi = Math.ceil(hi0 / step) * step;
  if (hi === hi0) hi += step;
  if (lo === lo0 && lo0 > 0) lo -= step;
  if (lo < 0 && lo0 >= 0) lo = 0;
  const ticks: number[] = [];
  for (let t = lo; t <= hi + step / 1e6; t += step) ticks.push(Math.round(t * 1e6) / 1e6);
  return { domain: [lo, hi], ticks };
}

/** "40%" · "12 bar" – nhãn trục Y (không qualifier). */
export const axisLabel = (v: number, variable: Pick<SimVariable, 'unit'>) => (v === 0 ? '0' : formatQty(v, variable.unit, Number.isInteger(v) ? 0 : 1));
