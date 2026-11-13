/** Phiên mô phỏng: giai đoạn, thời gian chạy, mã phiên, tạo phiên. Tách từ monitor.ts. */
import { plantDayKey } from '@/lib/plantTime';
import { pad2 } from '@/lib/number';
import { defaultRunNote, startValue } from './config';
import { runBlocker, simulateScenario, type RunBlocker, type Scenario, type SimulationRun, type TagHealth } from './scenarios';
import { type LiveMap, type SimulationSession, clamp, referenceSnapshot } from './monitorCore';

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

/** Như `runBlocker`, thêm: biến chính mất tín hiệu → không có giá trị bắt đầu. */
export function startBlocker(s: Scenario, live: LiveMap, now: number): RunBlocker | null {
  const b = runBlocker(s, live, now);
  if (b) return b;
  if (startValue(s.setup.variable, live, now) === undefined) {
    return { kind: 'signal', text: `Thiếu dữ liệu tham chiếu: ${s.setup.variable.tag} mất tín hiệu – không có giá trị bắt đầu.` };
  }
  return null;
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
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
}

/** Bản ghi lịch sử khi lượt kết thúc: kết quả như `simulateScenario` (theo tham số của lượt); dừng sớm → ghi chú thêm giờ dừng. */
export function sessionRun(s: Scenario, session: SimulationSession, id: string, now: number): SimulationRun {
  const base = simulateScenario({ ...s, config: session.config }, new Date(session.startedAt), session.by, id);
  const note = defaultRunNote(base);
  return { ...base, note: session.stoppedAt ? `Dừng thủ công lúc ${clockText(elapsedSec(session, now))}. ${note}` : note };
}
