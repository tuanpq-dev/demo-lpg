/*
 * Lớp dữ liệu màn AI mô phỏng sự cố (`/operations/ai-simulation`). Trang chỉ đọc qua `useSimulation()`; chạy mô phỏng
 * qua `runSimulation`. Mô phỏng KHÔNG ghi gì vào store cảnh báo / thiết bị (quy tắc an toàn) – chỉ thêm vào lịch sử chạy.
 */
import { useCallback, useMemo } from 'react';
import { simulateScenario, type Scenario, type SimulationRun } from '@/features/simulation/scenarios';
import { createCollectionStore } from '@/lib/createCollectionStore';
import { appNow } from '@/lib/demoNow';
import { plcScadaDevices } from '@/mocks/operations';
import { buildScenarios, buildSimulationRuns } from '@/mocks/simulation';
import { useLiveData } from './live';

/** 21 tag giám sát của hệ PLC/SCADA – cùng nguồn "Tag khả dụng" ở màn Vận hành PLC-SCADA. */
export const SIMULATION_REFERENCE_TAGS: readonly string[] = plcScadaDevices['PLC-SCADA']!.monitoredTags;

let scenariosDb: Scenario[] | null = null;
let runsDb: SimulationRun[] | null = null;

function seed() {
  if (scenariosDb && runsDb) return;
  const now = appNow();
  scenariosDb = buildScenarios(now);
  runsDb = buildSimulationRuns(now, scenariosDb);
}

/** GET /simulation/scenarios – TODO(backend). */
export async function fetchScenarios(): Promise<Scenario[]> {
  seed();
  return scenariosDb!.map((s) => ({ ...s }));
}

/** GET /simulation/runs – TODO(backend). */
export async function fetchSimulationRuns(): Promise<SimulationRun[]> {
  seed();
  return runsDb!.map((r) => ({ ...r }));
}

const scenarioStore = createCollectionStore(fetchScenarios);
const runStore = createCollectionStore(fetchSimulationRuns);

/** Độ trễ giả lập của một lượt mô phỏng (ms) – nút hiện "Đang mô phỏng…". */
export const SIMULATION_DELAY_MS = 900;

let runSeq = 0;

/**
 * Chạy một kịch bản: tính kết quả (thuần) rồi thêm vào lịch sử. Không gửi lệnh PLC, không tạo cảnh báo.
 * TODO(backend): POST /simulation/scenarios/:id/runs → bản ghi lượt chạy.
 */
export async function runSimulation(scenarioId: string, by: string): Promise<SimulationRun> {
  seed();
  const s = scenariosDb!.find((x) => x.id === scenarioId);
  if (!s) throw new Error(`Không tìm thấy kịch bản ${scenarioId}`);
  if (s.status !== 'ready') throw new Error(`Kịch bản ${s.code} cần cấu hình trước khi chạy`);
  await new Promise((r) => setTimeout(r, SIMULATION_DELAY_MS));
  runSeq += 1;
  const run = simulateScenario(s, appNow(), by, `RUN-S${Date.now().toString(36)}-${runSeq}`);
  runsDb = [run, ...runsDb!];
  runStore.commit(runsDb.map((r) => ({ ...r })));
  return run;
}

type SimulationState =
  | { status: 'loading'; scenarios?: undefined; runs?: undefined; error?: undefined }
  | { status: 'error'; scenarios?: undefined; runs?: undefined; error: Error }
  | { status: 'success'; scenarios: Scenario[]; runs: SimulationRun[]; error?: undefined };

/** Kịch bản + lịch sử + số liệu trực tiếp của tag tham chiếu (21 tag PLC/SCADA + tag riêng của từng kịch bản). */
export function useSimulation() {
  const scenarios = scenarioStore.useCollection();
  const runs = runStore.useCollection();
  const tags = useMemo(
    () => [...new Set([...SIMULATION_REFERENCE_TAGS, ...(scenarios.data ?? []).flatMap((s) => s.tags)])],
    [scenarios.data],
  );
  const liveData = useLiveData(tags);
  const refetchScenarios = scenarios.refetch;
  const refetchRuns = runs.refetch;
  const refetch = useCallback(() => {
    refetchScenarios();
    refetchRuns();
  }, [refetchScenarios, refetchRuns]);

  let state: SimulationState;
  if (scenarios.status === 'error') state = { status: 'error', error: scenarios.error };
  else if (runs.status === 'error') state = { status: 'error', error: runs.error };
  else if (scenarios.status === 'success' && runs.status === 'success') state = { status: 'success', scenarios: scenarios.data, runs: runs.data };
  else state = { status: 'loading' };
  return { ...state, liveData, refetch };
}
