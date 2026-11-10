import { describe, expect, it } from 'vitest';
import type { TagValue } from '@/features/live/types';
import type { ScenarioConfig } from './config';
import {
  aiOffset,
  alarmOffset,
  autoEndAt,
  activeSessionOf,
  chartDomain,
  chartTicks,
  clockText,
  createSession,
  elapsedSec,
  finishedSessionOf,
  firstReach,
  monitorMarks,
  monitorSnapshot,
  peakSec,
  profileOf,
  referenceSnapshot,
  sessionCode,
  sessionOf,
  sessionPhase,
  sessionRun,
  simTimeline,
  startBlocker,
  trendAt,
  valueAt,
  withUnit,
  type SimulationSession,
} from './monitor';
import { GAS_CONFIG, GAS_SCENARIO as SCENARIO, GAS_SETUP } from './testFixtures';

const T0 = Date.parse('2026-11-02T11:13:50Z'); // 18:13:50 giờ nhà máy
const tv = (value: number | string, extra: Partial<TagValue> = {}): TagValue => ({ value, ts: T0, quality: 'good', ...extra });
const LIVE = { 'GS-06': tv(2), 'PLC-01.HEARTBEAT': tv('ok') };

const session = (over: Partial<SimulationSession> = {}, config: Partial<ScenarioConfig> = {}): SimulationSession => ({
  id: 'SES-1',
  scenarioId: 'SC-001',
  startedAt: new Date(T0).toISOString(),
  by: 'Kỹ sư A',
  config: { ...GAS_CONFIG, ...config },
  startValue: 2,
  reference: [],
  ...over,
});
const at = (sec: number) => T0 + sec * 1000;
const MEDIUM = { rate: 'medium' } as const;

describe('đường diễn biến: tăng → đỉnh (mục tiêu) → ESD ảo giảm', () => {
  it('nhanh (ảnh Kết quả): đỉnh 35 % ở phút 5, giảm tuyến tính về ~3.65 % ở phút 10', () => {
    const p = profileOf(session());
    expect(peakSec(p)).toBe(300);
    expect(valueAt(p, 0)).toBe(2);
    expect(valueAt(p, 300)).toBe(35);
    expect(valueAt(p, 360)).toBeCloseTo(35 - 31.35 * 0.2, 5);
    expect(valueAt(p, 600)).toBeCloseTo(3.65, 5);
    for (let s = 1; s <= 300; s += 7) expect(valueAt(p, s)).toBeGreaterThanOrEqual(valueAt(p, s - 1));
    for (let s = 301; s <= 600; s += 7) expect(valueAt(p, s)).toBeLessThanOrEqual(valueAt(p, s - 1));
  });

  it('vừa (ảnh Theo dõi): vượt 20 % quanh 05:00, 28 % lúc 06:32 vẫn đang tăng', () => {
    const p = profileOf(session({}, MEDIUM));
    const cross = firstReach(p, 20, 'above')!;
    expect(cross).toBeGreaterThanOrEqual(290);
    expect(cross).toBeLessThanOrEqual(305);
    expect(Math.round(valueAt(p, 392))).toBe(28);
    expect(trendAt(p, 392, true)).toBe('up');
    expect(trendAt(p, 590, true)).toBe('down');
  });

  it('chậm: không chạm mục tiêu, không có pha giảm; biến giảm (below) tìm mốc theo chiều xuống', () => {
    const slow = profileOf(session({}, { rate: 'slow' }));
    expect(peakSec(slow)).toBeUndefined();
    expect(valueAt(slow, 600)).toBeLessThan(35);
    const down = { start: 60, target: 42, durationSec: 900, rate: 'medium' as const };
    expect(firstReach(down, 50, 'below')).toBeGreaterThan(0);
    expect(firstReach(down, 30, 'below')).toBeUndefined();
  });
});

describe('trạng thái lượt', () => {
  it('đang chạy → hết thời lượng = hoàn thành; "người dùng dừng" chờ bấm Dừng; dừng → stopped, đồng hồ dừng ở lúc bấm', () => {
    expect(sessionPhase(session(), at(10))).toBe('running');
    expect(sessionPhase(session(), at(600))).toBe('completed');
    expect(sessionPhase(session({}, { endCondition: 'manual-stop' }), at(700))).toBe('holding');
    const stopped = session({ stoppedAt: new Date(at(125)).toISOString() });
    expect(sessionPhase(stopped, at(400))).toBe('stopped');
    expect(elapsedSec(stopped, at(400))).toBe(125);
    expect(elapsedSec(session(), at(9999))).toBe(600);
    expect(elapsedSec(session(), at(-5))).toBe(0);
  });

  it('autoEndAt: theo thời lượng; "người dùng dừng" → không tự kết thúc', () => {
    expect(autoEndAt(session())).toBe(at(600));
    expect(autoEndAt(session({}, { endCondition: 'manual-stop' }))).toBeUndefined();
  });

  it('sessionOf ưu tiên lượt đang chạy; activeSessionOf chỉ lượt đang chạy; finishedSessionOf = lượt đã ghi lịch sử gần nhất', () => {
    const old = session({ id: 'A', startedAt: new Date(at(-3600)).toISOString(), runId: 'R1' });
    const cur = session({ id: 'B' });
    expect(sessionOf('SC-001', [old, cur], at(30))?.id).toBe('B');
    expect(sessionOf('SC-001', [old], at(30))?.id).toBe('A');
    expect(activeSessionOf('SC-001', [old], at(30))).toBeUndefined();
    expect(sessionOf('SC-002', [old, cur], at(30))).toBeUndefined();
    expect(finishedSessionOf('SC-001', [old, cur])?.id).toBe('A');
  });

  it('sessionCode: SIM-RUN-ddmmyyyy-NNN theo thứ tự trong ngày (giờ nhà máy)', () => {
    const a = session({ id: 'A' });
    const b = session({ id: 'B', startedAt: new Date(at(3600)).toISOString() });
    const other = session({ id: 'C', startedAt: '2026-11-01T11:00:00Z' });
    expect(sessionCode(b, [b, a, other])).toBe('SIM-RUN-02112026-002');
    expect(sessionCode(a, [b, a, other])).toBe('SIM-RUN-02112026-001');
    expect(sessionCode(other, [b, a, other])).toBe('SIM-RUN-01112026-001');
  });
});

describe('bắt đầu / kết thúc', () => {
  it('startBlocker: biến chính mất tín hiệu → khoá kèm tên tag', () => {
    expect(startBlocker(SCENARIO, LIVE, T0)).toBeNull();
    expect(startBlocker({ ...SCENARIO, tags: [] }, { 'PLC-01.HEARTBEAT': tv('ok') }, T0)?.text).toMatch(/GS-06 mất tín hiệu/);
    expect(startBlocker({ ...SCENARIO, status: 'needs-config' }, LIVE, T0)?.kind).toBe('config');
  });

  it('createSession chụp giá trị bắt đầu + bảng tham chiếu (bỏ heartbeat, thêm van) + tình trạng 21 tag; mất tín hiệu → ném lỗi', () => {
    const s = createSession(SCENARIO, LIVE, T0, new Date(T0), 'Kỹ sư A', 'SES-9', { ok: 21, total: 21 });
    expect(s.startValue).toBe(2);
    expect(s.referenceHealth).toEqual({ ok: 21, total: 21 });
    expect(s.reference).toEqual([
      { id: 'gas', label: 'Tank_Gas_Detector', valueText: '2.0% LEL' },
      { id: 'valve', label: 'Van điều khiển', valueText: 'Theo quy trình SOP' },
    ]);
    expect(() => createSession(SCENARIO, { 'GS-06': tv(2, { quality: 'bad' }) }, T0, new Date(T0), 'A', 'X')).toThrow(/mất tín hiệu/);
  });

  it('referenceSnapshot: tag cũ ≥ 10 s → null (không hiện số cũ); withUnit theo đơn vị', () => {
    expect(referenceSnapshot(GAS_SETUP, { 'GS-06': tv(2, { ts: T0 - 10_000 }) }, T0)[0]!.valueText).toBeNull();
    expect(withUnit('9.2', 'bar')).toBe('9.2 bar');
    expect(withUnit('28.7', '°C')).toBe('28.7°C');
    expect(withUnit('76.0', '%')).toBe('76.0%');
    expect(withUnit('ok', '—')).toBe('ok');
  });

  it('sessionRun: kết quả theo bước phản ứng; dừng sớm ghi thêm giờ dừng', () => {
    expect(sessionRun(SCENARIO, session(), 'R', at(600))).toMatchObject({
      result: 'pass',
      responseSeconds: 38,
      note: 'Phản ứng 38 s, trong mục tiêu 60 s.',
    });
    const stopped = session({ stoppedAt: new Date(at(95)).toISOString() });
    expect(sessionRun(SCENARIO, stopped, 'R', at(200)).note).toBe('Dừng thủ công lúc 01:35. Phản ứng 38 s, trong mục tiêu 60 s.');
  });
});

describe('mốc sự kiện', () => {
  it('cảnh báo sau bước "alarm"; gợi ý AI sau bước kế tiếp; không có "alarm" → sau bước đầu', () => {
    expect(alarmOffset(SCENARIO.steps)).toBe(8);
    expect(aiOffset(SCENARIO.steps)).toBe(18);
    const noAlarm = [
      { id: 'detect', label: '', seconds: 10 },
      { id: 'local', label: '', seconds: 45 },
    ];
    expect(alarmOffset(noAlarm)).toBe(10);
    expect(aiOffset(noAlarm)).toBe(55);
    expect(alarmOffset([])).toBe(0);
  });

  it('nhanh: theo dõi 15.5 % → vượt 20 % → đỉnh 300 s (High-High +8 s) → AI ghi nhận giảm +60 s → về dưới mức theo dõi', () => {
    const m = monitorMarks(SCENARIO, profileOf(session()));
    expect(m.watchLevel).toBe(15.5);
    expect(m.watch!).toBeLessThan(m.cross!);
    expect(m.alert).toBe(m.cross! + 8);
    expect(m.ai).toBe(m.cross! + 18);
    expect(m).toMatchObject({ peak: 300, peakAlert: 308, recovery: 360 });
    expect(m.recovered!).toBeGreaterThan(450);
    expect(m.recovered!).toBeLessThan(500);
  });
});

describe('simTimeline (một nguồn cho 2 màn)', () => {
  it('lượt nhanh đã xong: 2 cảnh báo High / High-High + 7 sự kiện như ảnh Kết quả', () => {
    const { alerts, events } = simTimeline(SCENARIO, GAS_SETUP.monitor, session(), at(700));
    expect(alerts.map((a) => [a.id, a.level, a.tone])).toEqual([
      ['SIM-AL-001', 'high', 'warning'],
      ['SIM-AL-002', 'high-high', 'danger'],
    ]);
    expect(alerts[0]!.description).toMatch(/^Cảnh báo mức cao \(High Level\): Nồng độ Gas khu vực V-101 vượt ngưỡng 20% LEL\. Đo được: 2\d%\.$/);
    expect(alerts[1]!.description).toBe(
      'Cảnh báo nguy hiểm (High-High): Nồng độ Gas khu vực V-101 chạm ngưỡng 35% LEL. Gợi ý rà soát quy trình ESD mô phỏng nếu vượt mức nguy hiểm.',
    );
    expect(alerts[1]!.time).toBe('18:18:58');
    expect(events.map((e) => e.title)).toEqual([
      'Bắt đầu mô phỏng',
      'AI ghi nhận xu hướng tăng',
      'Cảnh báo mô phỏng: SIM-AL-001',
      'AI gợi ý rà soát quy trình',
      'Nồng độ gas bắt đầu giảm',
      'Nồng độ dưới ngưỡng nguy hiểm',
      'Hoàn thành mô phỏng theo giá trị mục tiêu',
    ]);
    expect(events[0]).toMatchObject({ time: '18:13:50', detail: 'Khởi tạo tín hiệu gas mô phỏng từ trạng thái tham chiếu PLC/SCADA.' });
    expect(events[1]!.detail).toBe('Đạt 16% LEL. Gợi ý kiểm tra van xả mô phỏng.');
    expect(events[2]).toMatchObject({ tone: 'warning', simulated: true });
    expect(events.at(-1)).toMatchObject({ time: '18:23:50', detail: 'Kết thúc phiên chạy sau 10 phút. Tạo báo cáo nháp.', tone: 'success' });
  });

  it('dừng sớm trước ngưỡng: không cảnh báo, mốc cuối "Dừng mô phỏng thủ công"', () => {
    const { alerts, events } = simTimeline(SCENARIO, GAS_SETUP.monitor, session({ stoppedAt: new Date(at(30)).toISOString() }), at(300));
    expect(alerts).toEqual([]);
    expect(events.map((e) => e.id)).toEqual(['start', 'end']);
    expect(events[1]).toMatchObject({ title: 'Dừng mô phỏng thủ công', detail: 'Dừng lúc 00:30. Tạo báo cáo nháp.' });
  });
});

describe('monitorSnapshot', () => {
  it('trước khi vượt ngưỡng: chưa cảnh báo, chưa gợi ý AI, timeline = bắt đầu + hiện tại', () => {
    const snap = monitorSnapshot(SCENARIO, GAS_SETUP.monitor, session({}, MEDIUM), at(60));
    expect(snap.phase).toBe('running');
    expect(snap.trend).toBe('up');
    expect(snap.exceeded).toBe(false);
    expect(snap.alerts).toEqual([]);
    expect(snap.recommendations).toEqual([]);
    expect(snap.summary).toBeNull();
    expect(snap.timeline.map((e) => e.id)).toEqual(['now', 'start']);
    expect(snap.points[0]).toEqual({ sec: 0, value: 2 });
    expect(snap.points.at(-1)!.sec).toBe(60);
  });

  it('lượt vừa lúc 06:32 (ảnh Theo dõi): 28% LEL đang tăng, 1 cảnh báo High, timeline 5 mốc, gợi ý AI + tóm tắt', () => {
    const snap = monitorSnapshot(SCENARIO, GAS_SETUP.monitor, session({}, MEDIUM), at(392));
    expect(snap.valueText).toBe('28% LEL');
    expect(snap.exceeded).toBe(true);
    expect(snap.alerts.map((a) => a.id)).toEqual(['SIM-AL-001']);
    expect(snap.alerts[0]).toMatchObject({ title: 'Gas khu vực bồn vượt ngưỡng cảnh báo PLC', tone: 'warning' });
    expect(snap.alerts[0]!.detail).toMatch(/^Đạt 2\d% LEL lúc 18:1[89]:\d\d\. Đang theo dõi\.$/);
    expect(snap.timeline.map((e) => e.title)).toEqual([
      'Nồng độ đạt 28% LEL',
      '[Mô phỏng] Gợi ý thực hiện quy trình cô lập khu vực theo SOP',
      'Vượt ngưỡng cảnh báo PLC 20% LEL',
      'AI ghi nhận xu hướng tăng (16% LEL)',
      'Bắt đầu mô phỏng sự cố',
    ]);
    expect(snap.timeline[0]!.time).toBe('06:32 (Hiện tại)');
    expect(snap.timeline.at(-1)!.time).toBe('00:00');
    expect(snap.summary).toBe(
      'Nồng độ gas mô phỏng đã vượt ngưỡng cảnh báo PLC và tiếp tục tăng. Nên đánh giá phản ứng cảnh báo, kiểm tra logic hiển thị cảnh báo mô phỏng và rà soát quy trình xử lý khu vực bồn LPG.',
    );
    expect(snap.recommendations).toHaveLength(2);
  });

  it('lượt nhanh pha giảm (06:00): đang giảm, vẫn "đã vượt", 2 cảnh báo, tóm tắt về mức an toàn', () => {
    const snap = monitorSnapshot(SCENARIO, GAS_SETUP.monitor, session(), at(360));
    expect(snap.trend).toBe('down');
    expect(snap.exceeded).toBe(true);
    expect(snap.alerts.map((a) => a.id)).toEqual(['SIM-AL-002', 'SIM-AL-001']);
    expect(snap.summary).toMatch(/đang về lại mức an toàn sau quy trình xử lý mô phỏng/);
  });

  it('hoàn thành: ổn định, cảnh báo "Đã kết thúc", mốc cuối "Kết thúc mô phỏng"', () => {
    const snap = monitorSnapshot(SCENARIO, GAS_SETUP.monitor, session(), at(700));
    expect(snap.phase).toBe('completed');
    expect(snap.elapsed).toBe(600);
    expect(snap.trend).toBe('steady');
    expect(snap.valueText).toBe('4% LEL');
    expect(snap.alerts.every((a) => a.detail.endsWith('Đã kết thúc mô phỏng.'))).toBe(true);
    expect(snap.timeline[0]).toMatchObject({ time: '10:00 (Kết thúc)', title: 'Kết thúc mô phỏng – nồng độ đạt 4% LEL', tone: 'success' });
    expect(snap.summary).toMatch(/dừng ở 4% LEL\./);
  });

  it('dừng sớm trước ngưỡng: đồng hồ dừng, không cảnh báo, mốc "Dừng"', () => {
    const snap = monitorSnapshot(SCENARIO, GAS_SETUP.monitor, session({ stoppedAt: new Date(at(90)).toISOString() }), at(300));
    expect(snap.phase).toBe('stopped');
    expect(snap.elapsed).toBe(90);
    expect(snap.alerts).toEqual([]);
    expect(snap.timeline[0]!.time).toBe('01:30 (Dừng)');
  });
});

describe('trục biểu đồ', () => {
  it('nhãn X 5 mốc chia đều thời lượng', () => {
    expect(chartTicks(600).map(clockText)).toEqual(['00:00', '02:30', '05:00', '07:30', '10:00']);
  });

  it('miền Y "đẹp": gas 2–35 → 0–40 bước 10 (8 khoảng → bước 5); biên chạm mép → nới 1 bước; biến giảm không về 0', () => {
    expect(chartDomain([2, 35, 20])).toEqual({ domain: [0, 40], ticks: [0, 10, 20, 30, 40] });
    expect(chartDomain([0.1, 35, 20], 8).ticks).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40]);
    expect(chartDomain([0, 40, 20]).domain).toEqual([0, 50]);
    const down = chartDomain([60, 42, 50]);
    expect(down.domain[0]).toBeGreaterThan(0);
    expect(down.domain[0]).toBeLessThanOrEqual(42);
    expect(down.domain[1]).toBeGreaterThan(60);
  });
});
