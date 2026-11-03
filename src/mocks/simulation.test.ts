import { describe, expect, it } from 'vitest';
import { SENSOR_TAGS } from '@/data/live';
import { SIMULATION_REFERENCE_TAGS } from '@/data/simulation';
import { monitorSnapshot, sessionCode } from '@/features/simulation/monitor';
import { simulationResult } from '@/features/simulation/result';
import { aiSuggestion, deriveSimulationKpis, lastRunOf } from '@/features/simulation/scenarios';
import { parsePlantDateTime } from '@/lib/plantTime';
import { alertRecords } from './alerts';
import { SEED_SESSION_ELAPSED_SEC, buildScenarios, buildSimulationRuns, buildSimulationSessions } from './simulation';

const NOW = parsePlantDateTime('2026-11-02T18:13:00')!;
const scenarios = buildScenarios(NOW);
const runs = buildSimulationRuns(NOW, scenarios);

describe('mock AI mô phỏng sự cố', () => {
  it('5 kịch bản SC-001…SC-005; chỉ SC-005 thiếu mapping (có liệt kê ánh xạ thiếu)', () => {
    expect(scenarios.map((s) => s.code)).toEqual(['SC-001', 'SC-002', 'SC-003', 'SC-004', 'SC-005']);
    expect(scenarios.filter((s) => s.status === 'needs-config').map((s) => s.code)).toEqual(['SC-005']);
    expect(scenarios.find((s) => s.code === 'SC-005')!.missingMappings!.length).toBeGreaterThan(0);
  });

  it('mọi tag tham chiếu có trong nguồn số liệu trực tiếp (kịch bản sẵn sàng chạy được khi đủ tín hiệu)', () => {
    const live = new Set(SENSOR_TAGS);
    for (const t of [...SIMULATION_REFERENCE_TAGS, ...scenarios.flatMap((s) => s.tags)]) expect(live.has(t), t).toBe(true);
    expect(SIMULATION_REFERENCE_TAGS).toHaveLength(21);
  });

  it('ngưỡng khớp cảnh báo mock: áp suất bồn 10.5 bar (ALT-00128), nhiệt độ ra hóa hơi 50 °C (ALT-00126)', () => {
    const alert = (id: string) => alertRecords.find((a) => a.id === id)!;
    expect(scenarios.find((s) => s.code === 'SC-002')!.threshold).toContain(`${alert('ALT-00128').threshold} bar`);
    expect(scenarios.find((s) => s.code === 'SC-003')!.threshold).toContain(`${alert('ALT-00126').threshold} °C`);
  });

  it('lịch sử mẫu: 3 lượt hôm nay + 1 hôm qua; SC-004 "Cần cải thiện" (95 s > 60 s), còn lại Đạt', () => {
    expect(deriveSimulationKpis(scenarios, runs, undefined, NOW)).toMatchObject({ total: 5, ready: 4, runsToday: 3, needsConfig: 1 });
    expect(lastRunOf('SC-004', runs)).toMatchObject({ result: 'improve', responseSeconds: 95, targetSeconds: 60 });
    for (const id of ['SC-001', 'SC-002', 'SC-003']) expect(lastRunOf(id, runs)?.result).toBe('pass');
    expect(lastRunOf('SC-005', runs)).toBeUndefined();
  });

  it('góp ý AI như ảnh khi dữ liệu đủ 21/21 (độ tin cậy 92 %)', () => {
    const s = aiSuggestion(scenarios, runs, { total: 21, ok: 21, bad: 0, missing: 0, stale: 0 }, NOW)!;
    expect(s.text).toContain('rò rỉ LPG, áp suất bồn tăng cao và mất kết nối PLC/SCADA');
    expect(s.confidence).toBe(92);
  });

  // Đổi 03/11/2026 (màn Kết quả): cảnh báo theo mẫu ảnh Kết quả – lúc 06:32 chỉ còn High (SIM-AL-001); lượt chạy "Tăng vừa".
  it('lượt mẫu đang chạy SC-001 như ảnh "Theo dõi diễn biến": 06:32 / 10:00, 28% LEL đang tăng, cảnh báo High, 5 gợi ý, bảng tham chiếu chụp lúc bắt đầu', () => {
    const { sessions } = buildSimulationSessions(NOW, scenarios);
    const session = sessions.find((x) => x.id === 'SES-0001')!;
    const sc = scenarios.find((s) => s.id === 'SC-001')!;
    const snap = monitorSnapshot(sc, sc.setup.monitor, session, NOW.getTime());
    expect(snap).toMatchObject({ phase: 'running', elapsed: SEED_SESSION_ELAPSED_SEC, durationSec: 600, valueText: '28% LEL', exceeded: true, trend: 'up' });
    expect(snap.alerts.map((a) => a.id)).toEqual(['SIM-AL-001']);
    expect(snap.recommendations).toHaveLength(5);
    expect(session.reference.map((r) => `${r.label}: ${r.valueText}`)).toEqual([
      'Tank_Gas_Detector: 2.0% LEL',
      'Tank_Pressure_Bar: 9.2 bar',
      // Nhiệt độ / mức theo số liệu nền chung của V-101 (ảnh: 28.7°C / 76.0% – docs/figma-diffs.md).
      'Tank_Temperature_C: 28.5°C',
      'Tank_Liquid_Level_Percent: 73.0%',
      'Van điều khiển: Theo quy trình SOP',
    ]);
  });

  it('lượt mẫu đã xong SC-001 như ảnh "Kết quả": 18:14:00, 6 ngày trước, Đạt, đỉnh 35% ở 5m, 2 cảnh báo, dữ liệu nền như ảnh; cũ hơn mọi lượt khác', () => {
    const { sessions, runs: seededRuns } = buildSimulationSessions(NOW, scenarios);
    const done = sessions.find((x) => x.id === 'SES-0000')!;
    const sc = scenarios.find((s) => s.id === 'SC-001')!;
    expect(done.runId).toBe('RUN-0007');
    expect(sessionCode(done, sessions)).toBe('SIM-RUN-27102026-001');
    expect(seededRuns).toHaveLength(1);
    expect(seededRuns[0]).toMatchObject({ id: 'RUN-0007', scenarioId: 'SC-001', result: 'pass', at: done.startedAt });
    for (const r of runs) expect(seededRuns[0]!.at < r.at).toBe(true);
    const r = simulationResult(sc, done, seededRuns[0], NOW.getTime());
    expect(r.events[0]!.time).toBe('18:14:00');
    expect(r.kpis.map((k) => k.value)).toEqual(['Đạt', '10:00', '35% LEL', '2', '5']);
    expect(r.points[5]).toEqual({ sec: 300, value: 35 });
    expect(done.reference.filter((x) => x.shortLabel).map((x) => `${x.shortLabel}: ${x.valueText}`)).toEqual([
      'Gas nền (thực tế): 0.1% LEL',
      'Áp suất V-101: 9.2 bar',
      'Nhiệt độ V-101: 28.6°C',
      'Mức bồn V-101: 76.2%',
    ]);
    expect(done.referenceHealth).toEqual({ ok: 21, total: 21 });
  });
});
