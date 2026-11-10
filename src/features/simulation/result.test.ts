import { describe, expect, it } from 'vitest';
import type { SimulationSession } from './monitor';
import { areaAssetText, minuteLabel, reportStatusText, resultCsv, resultFileName, resultPoints, simulationResult } from './result';
import type { SimulationRun } from './scenarios';
import { GAS_CONFIG, GAS_SCENARIO as S } from './testFixtures';

const T0 = Date.parse('2026-06-24T11:14:00Z'); // 18:14:00 giờ nhà máy
const at = (sec: number) => T0 + sec * 1000;
const session = (over: Partial<SimulationSession> = {}): SimulationSession => ({
  id: 'SES-1',
  scenarioId: 'SC-001',
  startedAt: new Date(T0).toISOString(),
  by: 'Nguyễn Văn A',
  config: { ...GAS_CONFIG },
  startValue: 0.1,
  reference: [],
  runId: 'R1',
  ...over,
});
const run = (over: Partial<SimulationRun> = {}): SimulationRun => ({
  id: 'R1',
  scenarioId: 'SC-001',
  at: new Date(T0).toISOString(),
  result: 'pass',
  responseSeconds: 38,
  targetSeconds: 60,
  by: 'Nguyễn Văn A',
  ...over,
});

describe('simulationResult – lượt nhanh hoàn thành (ảnh Kết quả)', () => {
  const r = simulationResult(S, session(), run(), at(700));

  it('KPI: Đạt · 10:00 · 35% LEL · 2 cảnh báo · gợi ý AI', () => {
    expect(r.kpis.map((k) => [k.label, k.value, k.sub])).toEqual([
      ['Kết quả', 'Đạt', 'Hệ thống phản ứng đúng kịch bản'],
      ['Thời gian chạy', '10:00', 'Hoàn thành đủ thời lượng'],
      ['Gas cao nhất', '35% LEL', 'Đạt giá trị mục tiêu mô phỏng'],
      ['Cảnh báo mô phỏng', '2', 'Đã tạo đúng ngưỡng'],
      ['Gợi ý AI', '2', 'Đã ghi nhận'],
    ]);
  });

  it('đánh giá tổng quan: câu tổng kết như ảnh + 4 ô Đạt', () => {
    expect(r.summary).toBe(
      'Kịch bản mô phỏng rò rỉ LPG tại khu vực bồn đã hoàn thành. Hệ thống phát hiện nồng độ gas vượt ngưỡng cảnh báo PLC tại 20% LEL, tạo cảnh báo mô phỏng đúng thời điểm và đưa ra gợi ý xử lý phù hợp. Không có tác động đến thiết bị thật trong quá trình mô phỏng.',
    );
    expect(r.tiles.map((t) => `${t.label}:${t.result}`)).toEqual(['Phát hiện:pass', 'Diễn biến:pass', 'AI:pass', 'An toàn:pass']);
  });

  it('bảng tiêu chí: 5 dòng Đạt, nhận xét theo mốc', () => {
    expect(r.criteria.map((c) => [c.label, c.result])).toEqual([
      ['Khả năng phát hiện', 'pass'],
      ['Tạo cảnh báo mô phỏng', 'pass'],
      ['Gợi ý AI (Virtual ESD)', 'pass'],
      ['Phân biệt Mô phỏng/Thật', 'pass'],
      ['Ghi nhận lịch sử', 'pass'],
    ]);
    expect(r.criteria[0]!.comment).toBe('Nhận diện chính xác xu hướng tăng 15% LEL từ phút thứ 2.');
    expect(r.criteria[1]!.comment).toBe('Sinh cảnh báo giả lập SIM-AL-001 đúng tại mốc >20% LEL, không lẫn lộn với cảnh báo thật.');
    expect(r.criteria[2]!.comment).toBe('AI gợi ý rà soát quy trình ESD mô phỏng nếu vượt mức nguy hiểm.');
  });

  it('gợi ý AI sau lượt Đạt + điểm biểu đồ 11 mốc (đỉnh 35 ở 5m, cuối ~1.8)', () => {
    expect(r.advice).toBe(
      'Kết quả mô phỏng đạt yêu cầu. Hệ thống phản ứng ổn định với các ngưỡng cảnh báo thiết lập. Nên tiếp tục chạy thêm kịch bản mất kết nối PLC/SCADA trong 2 phút.',
    );
    expect(r.points).toHaveLength(11);
    expect(r.points[5]).toEqual({ sec: 300, value: 35 });
    expect(r.points[10]!.value).toBeCloseTo(1.845, 3);
    expect(r.events.at(-1)!.time).toBe('18:24:00');
    expect(minuteLabel(300)).toBe('5m');
    expect(minuteLabel(90)).toBe('1.5m');
  });
});

describe('simulationResult – ca biên', () => {
  it('Cần cải thiện: KPI + câu tổng kết + gợi ý theo thời gian phản ứng', () => {
    const r = simulationResult(S, session(), run({ result: 'improve', responseSeconds: 72 }), at(700));
    expect(r.kpis[0]).toMatchObject({ value: 'Cần cải thiện', sub: 'Phản ứng 72 s > mục tiêu 60 s', tone: 'warning' });
    expect(r.summary).toContain('Thời gian phản ứng 72 s vượt mục tiêu 60 s.');
    expect(r.advice).toMatch(/^Kết quả mô phỏng cần cải thiện: phản ứng 72 s vượt mục tiêu 60 s\./);
  });

  it('dừng sớm trước ngưỡng: điểm biểu đồ chỉ tới lúc dừng, Phát hiện / Diễn biến / AI chưa đạt, An toàn vẫn đạt', () => {
    const r = simulationResult(S, session({ stoppedAt: new Date(at(100)).toISOString() }), run(), at(400));
    expect(r.stopped).toBe(true);
    expect(r.points.at(-1)!.sec).toBe(100);
    expect(r.alerts).toEqual([]);
    expect(r.tiles.map((t) => t.result)).toEqual(['fail', 'fail', 'fail', 'pass']);
    expect(r.kpis[1]!.sub).toBe('Dừng trước thời lượng');
    expect(r.kpis[2]!.sub).toBe('Chưa chạm giá trị mục tiêu');
    expect(r.summary).toMatch(/^Kịch bản mô phỏng rò rỉ LPG tại khu vực bồn đã dừng thủ công lúc 01:40\./);
  });

  it('chưa có bản ghi lịch sử → "Ghi nhận lịch sử" chưa đạt', () => {
    const r = simulationResult(S, session(), undefined, at(700));
    expect(r.criteria.at(-1)).toMatchObject({ result: 'fail' });
  });

  it('resultPoints: thêm điểm lúc dừng khi không trùng mốc', () => {
    expect(resultPoints(session(), 95).map((p) => p.sec)).toEqual([0, 60, 95]);
  });
});

describe('báo cáo', () => {
  it('trạng thái tệp: Nháp • Chưa xuất → thêm gợi ý AI + đã xuất Excel', () => {
    expect(reportStatusText({})).toBe('Nháp • Chưa xuất');
    expect(reportStatusText({ report: { aiIncluded: true, excelAt: '2026-06-24T11:30:00Z' } }, () => '18:30')).toBe(
      'Nháp • Đã thêm gợi ý AI • Đã xuất Excel 18:30',
    );
  });

  it('CSV có thông tin lượt, KPI, tiêu chí, sự kiện; gợi ý AI chỉ khi đã thêm; ô có dấu phẩy được bao nháy', () => {
    const s = session();
    const r = simulationResult(S, s, run(), at(700));
    const csv = resultCsv(S, s, 'SIM-RUN-24062026-001', r);
    expect(csv.split('\r\n')[0]).toBe('Báo cáo mô phỏng,SIM-RUN-24062026-001');
    expect(csv).toContain('Khu vực / Tài sản chính,Khu bồn LPG / Bồn V-101');
    expect(csv).toContain('"Kịch bản mô phỏng rò rỉ LPG');
    expect(csv).not.toContain('Gợi ý AI,Kết quả mô phỏng đạt');
    const withAi = resultCsv(S, { ...s, report: { aiIncluded: true } }, 'X', r);
    expect(withAi).toContain('Gợi ý AI,Kết quả mô phỏng đạt yêu cầu.');
    expect(resultFileName('SIM-RUN-24062026-001', 'csv')).toBe('sim-run-24062026-001.csv');
    expect(areaAssetText(S, s)).toBe('Khu bồn LPG / Bồn V-101');
  });
});
