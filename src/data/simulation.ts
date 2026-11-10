/*
 * Lớp dữ liệu màn AI mô phỏng sự cố (`/operations/ai-simulation`, cấu hình, theo dõi). Trang chỉ đọc qua `useSimulation()`;
 * chạy qua `startSimulation` (lượt theo thời gian thực) / `stopSimulation`. Mô phỏng KHÔNG ghi gì vào store cảnh báo / thiết bị
 * (quy tắc an toàn) – chỉ thêm lượt chạy và, khi lượt kết thúc, bản ghi lịch sử.
 */
import { useCallback, useMemo } from 'react';
import type { LiveData } from '@/features/live/types';
import { checkConfig, configValid, orderedAreas, setupTags, type ScenarioConfig } from '@/features/simulation/config';
import {
  activeSessionOf,
  autoEndAt,
  createSession,
  isActivePhase,
  sessionPhase,
  sessionRun,
  type ReportState,
  type SimulationSession,
} from '@/features/simulation/monitor';
import { tagHealth, type Scenario, type SimulationRun } from '@/features/simulation/scenarios';
import { createCollectionStore } from '@/lib/createCollectionStore';
import { appNow } from '@/lib/demoNow';
import { plcScadaDevices } from '@/mocks/operations';
import { buildScenarios, buildSimulationRuns, buildSimulationSessions } from '@/mocks/simulation';
import { useLiveData } from './live';

/** 21 tag giám sát của hệ PLC/SCADA – cùng nguồn "Tag khả dụng" ở màn Vận hành PLC-SCADA. */
export const SIMULATION_REFERENCE_TAGS: readonly string[] = plcScadaDevices['PLC-SCADA']!.monitoredTags;

let scenariosDb: Scenario[] | null = null;
let runsDb: SimulationRun[] | null = null;
let sessionsDb: SimulationSession[] | null = null;

function seed() {
  if (scenariosDb && runsDb && sessionsDb) return;
  const now = appNow();
  scenariosDb = buildScenarios(now);
  const seeded = buildSimulationSessions(now, scenariosDb);
  runsDb = [...buildSimulationRuns(now, scenariosDb), ...seeded.runs];
  sessionsDb = seeded.sessions;
  sessionsDb.forEach(scheduleEnd);
}

/** GET /simulation/scenarios – TODO(backend). */
async function fetchScenarios(): Promise<Scenario[]> {
  seed();
  return scenariosDb!.map((s) => ({ ...s }));
}

/** GET /simulation/runs – TODO(backend). */
async function fetchSimulationRuns(): Promise<SimulationRun[]> {
  seed();
  return runsDb!.map((r) => ({ ...r }));
}

/** GET /simulation/sessions – lượt đang chạy / đã kết thúc (TODO(backend)). */
async function fetchSimulationSessions(): Promise<SimulationSession[]> {
  seed();
  return sessionsDb!.map((x) => ({ ...x }));
}

const scenarioStore = createCollectionStore(fetchScenarios);
const runStore = createCollectionStore(fetchSimulationRuns);
const sessionStore = createCollectionStore(fetchSimulationSessions);

/** Độ trễ giả lập khi khởi tạo một lượt mô phỏng (ms) – nút hiện "Đang khởi động…". */
const SIMULATION_DELAY_MS = 600;

let sessionSeq = 0;
let runSeq = 0;
/** Hẹn giờ tự kết thúc theo mã lượt. */
const endTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Lượt kết thúc (hết thời lượng hoặc bấm Dừng): ghi `SimulationRun` vào lịch sử, gắn `runId`. Gọi lại không ghi trùng. */
function finishSession(sessionId: string) {
  const timer = endTimers.get(sessionId);
  if (timer) clearTimeout(timer);
  endTimers.delete(sessionId);
  const session = sessionsDb?.find((x) => x.id === sessionId);
  const s = session && scenariosDb?.find((x) => x.id === session.scenarioId);
  if (!session || !s || session.runId) return;
  runSeq += 1;
  const run = sessionRun(s, session, `RUN-S${Date.now().toString(36)}-${runSeq}`, appNow().getTime());
  runsDb = [run, ...runsDb!];
  sessionsDb = sessionsDb!.map((x) => (x.id === sessionId ? { ...x, runId: run.id } : x));
  runStore.commit(runsDb.map((r) => ({ ...r })));
  sessionStore.commit(sessionsDb.map((x) => ({ ...x })));
}

function scheduleEnd(session: SimulationSession) {
  const end = autoEndAt(session);
  if (end === undefined || session.runId || session.stoppedAt) return;
  endTimers.set(
    session.id,
    setTimeout(() => finishSession(session.id), Math.max(0, end - appNow().getTime())),
  );
}

/**
 * Bắt đầu một lượt chạy theo thời gian thực (tham số đã lưu của kịch bản). Kịch bản đang có lượt chạy → trả lượt đó.
 * Chụp số liệu PLC/SCADA lúc bấm làm trạng thái ban đầu (`live`; độ tươi so với giờ THẬT). Không gửi lệnh PLC, không tạo
 * cảnh báo thật; lượt kết thúc → kết quả vào lịch sử.
 * TODO(backend): POST /simulation/scenarios/:id/runs → lượt đang chạy (diễn biến qua WebSocket).
 */
export async function startSimulation(scenarioId: string, by: string, live: LiveData | undefined): Promise<SimulationSession> {
  seed();
  const s = scenariosDb!.find((x) => x.id === scenarioId);
  if (!s) throw new Error(`Không tìm thấy kịch bản ${scenarioId}`);
  const running = activeSessionOf(s.id, sessionsDb!, appNow().getTime());
  if (running) return running;
  sessionSeq += 1;
  // Kiểm + chụp số liệu TRƯỚC độ trễ: đúng lúc người dùng bấm.
  const session = createSession(
    s,
    live,
    Date.now(),
    appNow(),
    by,
    `SES-${Date.now().toString(36)}-${sessionSeq}`,
    tagHealth(SIMULATION_REFERENCE_TAGS, live, Date.now()),
  );
  await new Promise((r) => setTimeout(r, SIMULATION_DELAY_MS));
  const started: SimulationSession = { ...session, startedAt: appNow().toISOString() };
  sessionsDb = [started, ...sessionsDb!];
  sessionStore.commit(sessionsDb.map((x) => ({ ...x })));
  scheduleEnd(started);
  return started;
}

/** Dừng lượt đang chạy (nút "Dừng mô phỏng") → ghi lịch sử ngay. TODO(backend): POST /simulation/sessions/:id/stop. */
export async function stopSimulation(sessionId: string): Promise<SimulationSession> {
  seed();
  const session = sessionsDb!.find((x) => x.id === sessionId);
  if (!session) throw new Error(`Không tìm thấy lượt mô phỏng ${sessionId}`);
  if (!isActivePhase(sessionPhase(session, appNow().getTime()))) return session;
  sessionsDb = sessionsDb!.map((x) => (x.id === sessionId ? { ...x, stoppedAt: appNow().toISOString() } : x));
  finishSession(sessionId);
  return sessionsDb.find((x) => x.id === sessionId)!;
}

/**
 * Cập nhật trạng thái báo cáo nháp của một lượt (màn Kết quả: "Thêm vào báo cáo" / "Bỏ qua" gợi ý AI, đã xuất Excel).
 * TODO(backend): PATCH /simulation/sessions/:id/report.
 */
export async function updateSessionReport(sessionId: string, patch: ReportState): Promise<SimulationSession> {
  seed();
  const session = sessionsDb!.find((x) => x.id === sessionId);
  if (!session) throw new Error(`Không tìm thấy lượt mô phỏng ${sessionId}`);
  const next: SimulationSession = { ...session, report: { ...session.report, ...patch } };
  sessionsDb = sessionsDb!.map((x) => (x.id === sessionId ? next : x));
  sessionStore.commit(sessionsDb.map((x) => ({ ...x })));
  return next;
}

/** Độ trễ giả lập khi lưu cấu hình (ms). */
const SAVE_CONFIG_DELAY_MS = 400;

/**
 * Lưu "Tham số đầu vào" của một kịch bản (chỉ lớp mô phỏng – không đổi ngưỡng/cấu hình PLC thật). Kiểm tra lại bằng
 * `checkConfig` (UI đã chặn, đây là lớp chặn cuối). Cập nhật `updatedAt` = giờ ứng dụng.
 * TODO(backend): PUT /simulation/scenarios/:id/config.
 */
export async function saveScenarioConfig(scenarioId: string, config: ScenarioConfig): Promise<Scenario> {
  seed();
  const s = scenariosDb!.find((x) => x.id === scenarioId);
  if (!s) throw new Error(`Không tìm thấy kịch bản ${scenarioId}`);
  if (!configValid(checkConfig(config, s.setup))) throw new Error(`Cấu hình ${s.code} chưa hợp lệ`);
  await new Promise((r) => setTimeout(r, SAVE_CONFIG_DELAY_MS));
  const next: Scenario = {
    ...s,
    config: { ...config, areas: orderedAreas(config.areas, s.setup.areaOptions) },
    updatedAt: appNow().toISOString(),
  };
  scenariosDb = scenariosDb!.map((x) => (x.id === scenarioId ? next : x));
  scenarioStore.commit(scenariosDb.map((x) => ({ ...x })));
  return next;
}

type SimulationState =
  | { status: 'loading'; scenarios?: undefined; runs?: undefined; sessions?: undefined; error?: undefined }
  | { status: 'error'; scenarios?: undefined; runs?: undefined; sessions?: undefined; error: Error }
  | { status: 'success'; scenarios: Scenario[]; runs: SimulationRun[]; sessions: SimulationSession[]; error?: undefined };

/** Kịch bản + lịch sử + lượt chạy + số liệu trực tiếp của tag tham chiếu (21 tag PLC/SCADA + tag riêng của từng kịch bản). */
export function useSimulation() {
  const scenarios = scenarioStore.useCollection();
  const runs = runStore.useCollection();
  const sessions = sessionStore.useCollection();
  const tags = useMemo(
    () => [...new Set([...SIMULATION_REFERENCE_TAGS, ...(scenarios.data ?? []).flatMap((s) => [...s.tags, ...setupTags(s.setup)])])],
    [scenarios.data],
  );
  const liveData = useLiveData(tags);
  const refetchScenarios = scenarios.refetch;
  const refetchRuns = runs.refetch;
  const refetchSessions = sessions.refetch;
  const refetch = useCallback(() => {
    refetchScenarios();
    refetchRuns();
    refetchSessions();
  }, [refetchScenarios, refetchRuns, refetchSessions]);

  let state: SimulationState;
  if (scenarios.status === 'error') state = { status: 'error', error: scenarios.error };
  else if (runs.status === 'error') state = { status: 'error', error: runs.error };
  else if (sessions.status === 'error') state = { status: 'error', error: sessions.error };
  else if (scenarios.status === 'success' && runs.status === 'success' && sessions.status === 'success') {
    state = { status: 'success', scenarios: scenarios.data, runs: runs.data, sessions: sessions.data };
  } else state = { status: 'loading' };
  return { ...state, liveData, refetch };
}
