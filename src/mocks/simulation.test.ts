import { describe, expect, it } from 'vitest';
import { SENSOR_TAGS } from '@/data/live';
import { SIMULATION_REFERENCE_TAGS } from '@/data/simulation';
import { aiSuggestion, deriveSimulationKpis, lastRunOf } from '@/features/simulation/scenarios';
import { parsePlantDateTime } from '@/lib/plantTime';
import { alertRecords } from './alerts';
import { buildScenarios, buildSimulationRuns } from './simulation';

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
});
