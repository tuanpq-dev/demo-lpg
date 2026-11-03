import { describe, expect, it } from 'vitest';
import type { TagValue } from '@/features/live/types';
import { parsePlantDateTime } from '@/lib/plantTime';
import {
  agoText,
  aiSuggestion,
  deriveSimulationKpis,
  lastRunOf,
  matchScenario,
  runBlocker,
  runTimeText,
  simulateScenario,
  tagHealth,
  type Scenario,
  type ScenarioFilterValues,
  type SimulationRun,
  type TagHealth,
} from './scenarios';
import { GAS_CONFIG, GAS_SETUP } from './testFixtures';

const NOW = parsePlantDateTime('2026-11-02T18:13:00')!;
const T = NOW.getTime();
const iso = (s: string) => parsePlantDateTime(s)!.toISOString();
const tv = (p: Partial<TagValue> = {}): TagValue => ({ value: 1, unit: '', ts: T - 1000, quality: 'good', ...p });

function sc(p: Partial<Scenario> & { id: string }): Scenario {
  return {
    code: p.id,
    title: `Kịch bản ${p.id}`,
    shortLabel: 'Ngắn',
    suggestLabel: `gợi ý ${p.id}`,
    group: 'pressure',
    risk: 'high',
    area: 'Khu bồn LPG',
    status: 'ready',
    icon: 'pressure',
    plcVariables: ['Tank_Pressure_Bar'],
    tags: ['PT-101'],
    threshold: 'Áp suất vượt 10.5 bar',
    outcome: 'Gợi ý',
    steps: [
      { id: 'a', label: 'A', seconds: 20 },
      { id: 'b', label: 'B', seconds: 40 },
    ],
    targetSeconds: 60,
    updatedAt: iso('2026-11-02T16:13:00'),
    setup: GAS_SETUP,
    config: GAS_CONFIG,
    ...p,
  };
}
const run = (scenarioId: string, at: string, result: SimulationRun['result'] = 'pass', id = `${scenarioId}@${at}`): SimulationRun => ({
  id,
  scenarioId,
  at: iso(at),
  result,
  responseSeconds: 10,
  targetSeconds: 60,
  by: 'Lê Thị C',
});

describe('tagHealth', () => {
  it('chưa có số liệu → undefined', () => {
    expect(tagHealth(['PT-101'], undefined, T)).toBeUndefined();
  });

  it('mỗi tag đúng một nhóm: thiếu → lỗi → cũ (≥ 10 s) → tốt; bỏ trùng; giờ cập nhật mới nhất', () => {
    const live = {
      A: tv({ ts: T - 500 }),
      B: tv({ quality: 'bad', ts: T - 200 }),
      C: tv({ ts: T - 10_000 }),
      D: tv({ quality: 'uncertain', ts: T - 9_999 }),
    };
    expect(tagHealth(['A', 'B', 'C', 'D', 'E', 'A'], live, T)).toEqual<TagHealth>({ total: 5, ok: 2, bad: 1, missing: 1, stale: 1, lastUpdate: T - 200 });
  });
});

describe('runBlocker', () => {
  const live = { 'PT-101': tv() };
  it('thiếu mapping thắng mọi lý do khác, liệt kê ánh xạ thiếu', () => {
    const b = runBlocker(sc({ id: 'SC-9', status: 'needs-config', missingMappings: ['SD-02 chưa gán', 'MCP-02 chưa gán'] }), undefined, T);
    expect(b).toEqual({ kind: 'config', text: 'Cần cấu hình mapping trước khi chạy: SD-02 chưa gán; MCP-02 chưa gán.' });
  });
  it('chưa có số liệu → pending; tag mất tín hiệu → signal (nêu tên tag); đủ → null', () => {
    expect(runBlocker(sc({ id: 'S' }), undefined, T)?.kind).toBe('pending');
    expect(runBlocker(sc({ id: 'S', tags: ['PT-101', 'TT-101'] }), live, T)).toEqual({ kind: 'signal', text: 'Thiếu dữ liệu tham chiếu: TT-101 mất tín hiệu.' });
    expect(runBlocker(sc({ id: 'S' }), { 'PT-101': tv({ ts: T - 10_000 }) }, T)?.kind).toBe('signal');
    expect(runBlocker(sc({ id: 'S' }), live, T)).toBeNull();
  });
});

describe('simulateScenario', () => {
  it('tổng bước = mục tiêu → Đạt; vượt 1 s → Cần cải thiện', () => {
    expect(simulateScenario(sc({ id: 'S' }), NOW, 'A', 'r1')).toMatchObject({ result: 'pass', responseSeconds: 60, targetSeconds: 60, at: NOW.toISOString(), by: 'A' });
    expect(simulateScenario(sc({ id: 'S', targetSeconds: 59 }), NOW, 'A', 'r2').result).toBe('improve');
  });

  it('lưu ảnh chụp tham số đang dùng + ghi chú (đổi cấu hình sau đó không đổi lượt đã chạy)', () => {
    const s = sc({ id: 'S', config: { ...GAS_CONFIG, areas: ['Khu bồn LPG'] } });
    const r = simulateScenario(s, NOW, 'A', 'r3', 'Ghi chú');
    expect(r).toMatchObject({ note: 'Ghi chú', config: { target: 35, durationMin: 10, areas: ['Khu bồn LPG'] } });
    expect(r.config!.areas).not.toBe(s.config.areas);
    expect(simulateScenario(s, NOW, 'A', 'r4')).not.toHaveProperty('note');
  });
});

describe('lịch sử', () => {
  it('lần chạy gần nhất theo kịch bản', () => {
    const runs = [run('S1', '2026-11-02T09:00'), run('S1', '2026-11-02T15:00', 'improve'), run('S2', '2026-11-02T17:00')];
    expect(lastRunOf('S1', runs)?.result).toBe('improve');
    expect(lastRunOf('S3', runs)).toBeUndefined();
  });

  it('giờ chạy: hôm nay / hôm qua / cũ hơn (24 giờ, giờ nhà máy)', () => {
    expect(runTimeText(iso('2026-11-02T15:45'), NOW)).toBe('15:45');
    expect(runTimeText(iso('2026-11-01T23:05'), NOW)).toBe('Hôm qua, 23:05');
    expect(runTimeText(iso('2026-10-30T08:00'), NOW)).toBe('30/10/2026, 08:00');
  });

  it('"… trước" làm tròn phút (mốc lệch vài ms không tụt đơn vị)', () => {
    expect(agoText(new Date(T - 120 * 60_000 + 5).toISOString(), NOW)).toBe('2 giờ trước');
    expect(agoText(new Date(T - 20_000).toISOString(), NOW)).toBe('Vừa xong');
    expect(agoText(new Date(T - 15 * 60_000).toISOString(), NOW)).toBe('15 phút trước');
    expect(agoText(new Date(T - 3 * 1440 * 60_000).toISOString(), NOW)).toBe('3 ngày trước');
  });
});

describe('deriveSimulationKpis', () => {
  it('tổng / sẵn sàng / cần cấu hình; lượt hôm nay gồm cả lượt vừa chạy sau `now` vài giây', () => {
    const scenarios = [sc({ id: 'A' }), sc({ id: 'B' }), sc({ id: 'C', status: 'needs-config' })];
    const runs = [run('A', '2026-11-02T00:10'), run('B', '2026-11-01T23:59'), { ...run('A', '2026-11-02T18:13'), at: new Date(T + 5000).toISOString() }];
    expect(deriveSimulationKpis(scenarios, runs, undefined, NOW)).toEqual({ total: 3, ready: 2, runsToday: 2, needsConfig: 1, health: undefined });
  });
});

describe('aiSuggestion', () => {
  const ok: TagHealth = { total: 21, ok: 21, bad: 0, missing: 0, stale: 0 };
  const scenarios = [
    sc({ id: 'SC-001', risk: 'critical', suggestLabel: 'rò rỉ LPG' }),
    sc({ id: 'SC-002', risk: 'high', suggestLabel: 'áp suất bồn tăng cao' }),
    sc({ id: 'SC-003', risk: 'medium', suggestLabel: 'máy hóa hơi' }),
    sc({ id: 'SC-004', risk: 'high', suggestLabel: 'mất kết nối PLC/SCADA' }),
    sc({ id: 'SC-005', risk: 'critical', status: 'needs-config', suggestLabel: 'báo cháy' }),
  ];
  const runs = [
    run('SC-001', '2026-11-02T10:23'),
    run('SC-002', '2026-11-02T09:15'),
    run('SC-003', '2026-11-01T14:53'),
    run('SC-004', '2026-11-02T15:45', 'improve'),
  ];

  it('chưa có số liệu → null', () => {
    expect(aiSuggestion(scenarios, runs, undefined, NOW)).toBeNull();
  });

  it('dữ liệu ổn định: ưu tiên kịch bản Cần cải thiện + rủi ro Nghiêm trọng/Cao (bỏ kịch bản thiếu cấu hình), độ tin cậy 92 %', () => {
    expect(aiSuggestion(scenarios, runs, ok, NOW)).toEqual({
      text: 'Dữ liệu vận hành hiện tại ổn định. Có thể ưu tiên mô phỏng các kịch bản rò rỉ LPG, áp suất bồn tăng cao và mất kết nối PLC/SCADA để kiểm tra khả năng phản ứng của hệ thống.',
      // 60 % × 21/21 + 40 % × 4/5 kịch bản chạy trong 7 ngày.
      confidence: 92,
    });
  });

  it('có thông số không khả dụng → đề nghị kiểm tra kết nối trước; độ tin cậy giảm', () => {
    const s = aiSuggestion(scenarios, runs, { ...ok, ok: 19, bad: 2 }, NOW)!;
    expect(s.text).toMatch(/^Có 2\/21 thông số PLC\/SCADA không khả dụng/);
    expect(s.confidence).toBe(86);
  });

  it('không kịch bản nào sẵn sàng → câu nhắc cấu hình', () => {
    expect(aiSuggestion([scenarios[4]!], [], ok, NOW)?.text).toMatch(/Chưa có kịch bản sẵn sàng/);
  });
});

describe('matchScenario', () => {
  const s = sc({ id: 'SC-004', title: 'Mất kết nối PLC/SCADA', group: 'communication', area: 'Phòng điều khiển', tags: ['PLC-01.HEARTBEAT'], plcVariables: ['PLC_Heartbeat'] });
  const ALL: ScenarioFilterValues = { q: '', group: null, risk: null, status: null, area: null };
  it('tìm không dấu theo tên / mã / tag / biến PLC', () => {
    expect(matchScenario(s, { ...ALL, q: 'mat ket noi' })).toBe(true);
    expect(matchScenario(s, { ...ALL, q: 'sc-004' })).toBe(true);
    expect(matchScenario(s, { ...ALL, q: 'heartbeat' })).toBe(true);
    expect(matchScenario(s, { ...ALL, q: 'bồn' })).toBe(false);
  });
  it('nhóm / rủi ro / trạng thái / khu vực', () => {
    expect(matchScenario(s, { ...ALL, group: 'communication', risk: 'high', status: 'ready', area: 'Phòng điều khiển' })).toBe(true);
    expect(matchScenario(s, { ...ALL, group: 'fire' })).toBe(false);
    expect(matchScenario(s, { ...ALL, risk: 'critical' })).toBe(false);
    expect(matchScenario(s, { ...ALL, status: 'needs-config' })).toBe(false);
    expect(matchScenario(s, { ...ALL, area: 'Khu bồn LPG' })).toBe(false);
  });
});
