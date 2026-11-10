import { describe, expect, it } from 'vitest';
import type { TagValue } from '@/features/live/types';
import { parsePlantDateTime } from '@/lib/plantTime';
import {
  checkConfig,
  configSuggestion,
  configValid,
  dataSyncState,
  defaultRunNote,
  endConditionLabel,
  formatQty,
  formatVariable,
  leakRateLabel,
  orderedAreas,
  reachesThreshold,
  readiness,
  referenceReading,
  runDateTimeText,
  sameConfig,
  scalePercent,
  scenarioRuns,
  setupTags,
  startValue,
  suggestionApplied,
  type ReferenceRow,
} from './config';
import type { SimulationRun, TagHealth } from './scenarios';
import { GAS_CONFIG, GAS_SETUP } from './testFixtures';

const T = parsePlantDateTime('2026-11-02T18:13:00')!.getTime();
const tv = (value: TagValue['value'], p: Partial<TagValue> = {}): TagValue => ({ value, unit: '', ts: T - 1000, quality: 'good', ...p });
const H = (p: Partial<TagHealth> = {}): TagHealth => ({ total: 21, ok: 21, bad: 0, missing: 0, stale: 0, ...p });
const BELOW = {
  ...GAS_SETUP.variable,
  noun: 'nhiệt độ ra',
  unit: '°C' as const,
  qualifier: undefined,
  min: 20,
  max: 70,
  threshold: 50,
  direction: 'below' as const,
};

describe('nhãn lựa chọn', () => {
  it('tốc độ theo chiều biến; điều kiện "về dưới/trên ngưỡng" theo biến', () => {
    expect(leakRateLabel('fast', 'above')).toBe('Tăng nhanh');
    expect(leakRateLabel('slow', 'below')).toBe('Giảm chậm');
    expect(endConditionLabel('back-to-normal', GAS_SETUP.variable)).toBe('Kết thúc khi nồng độ gas về dưới ngưỡng');
    expect(endConditionLabel('back-to-normal', BELOW)).toBe('Kết thúc khi nhiệt độ ra về trên ngưỡng');
    expect(endConditionLabel('ai-enough-data', BELOW)).toBe('Kết thúc khi AI đánh giá đã đủ dữ liệu phân tích');
  });
});

describe('hiển thị số', () => {
  it('% dính số, đơn vị khác cách một khoảng; qualifier sau đơn vị', () => {
    expect(formatQty(35, '%')).toBe('35%');
    expect(formatQty(10.5, 'bar', 1)).toBe('10.5 bar');
    expect(formatQty(40, '°C')).toBe('40 °C');
    expect(formatVariable(35, GAS_SETUP.variable)).toBe('35% LEL');
    expect(formatVariable(42, BELOW)).toBe('42 °C');
  });

  it('chạm ngưỡng: above ≥, below ≤ (đúng mốc tính là chạm)', () => {
    expect(reachesThreshold(GAS_SETUP.variable, 20)).toBe(true);
    expect(reachesThreshold(GAS_SETUP.variable, 19)).toBe(false);
    expect(reachesThreshold(BELOW, 50)).toBe(true);
    expect(reachesThreshold(BELOW, 51)).toBe(false);
  });

  it('vị trí trên thang kẹp trong 0–100; thang rỗng → 0', () => {
    expect(scalePercent(20, 0, 50)).toBe(40);
    expect(scalePercent(-5, 0, 50)).toBe(0);
    expect(scalePercent(80, 0, 50)).toBe(100);
    expect(scalePercent(5, 10, 10)).toBe(0);
  });
});

describe('checkConfig', () => {
  it('cấu hình như ảnh hợp lệ, không nhắc', () => {
    const c = checkConfig(GAS_CONFIG, GAS_SETUP);
    expect(c).toEqual({ errors: {}, warnings: {} });
    expect(configValid(c)).toBe(true);
  });

  it('mục tiêu chưa tới ngưỡng → chỉ nhắc (vẫn hợp lệ)', () => {
    const c = checkConfig({ ...GAS_CONFIG, target: 15 }, GAS_SETUP);
    expect(configValid(c)).toBe(true);
    expect(c.warnings.target).toBe('Mục tiêu chưa vượt ngưỡng cảnh báo PLC (20% LEL) – mô phỏng sẽ không phát cảnh báo.');
  });

  it('lỗi: mục tiêu ngoài thang, thời lượng lạ, không khu vực / khu vực không có trong danh sách', () => {
    expect(checkConfig({ ...GAS_CONFIG, target: 51 }, GAS_SETUP).errors.target).toBe('Giá trị mục tiêu phải trong khoảng 0% LEL – 50% LEL.');
    expect(checkConfig({ ...GAS_CONFIG, target: Number.NaN }, GAS_SETUP).errors.target).toBeDefined();
    expect(checkConfig({ ...GAS_CONFIG, durationMin: 7 }, GAS_SETUP).errors.durationMin).toBe('Chọn thời lượng mô phỏng.');
    expect(checkConfig({ ...GAS_CONFIG, areas: [] }, GAS_SETUP).errors.areas).toBe('Chọn ít nhất một khu vực ảnh hưởng.');
    expect(configValid(checkConfig({ ...GAS_CONFIG, areas: ['Khu lạ'] }, GAS_SETUP))).toBe(false);
  });

  it('so cấu hình: khu vực theo tập (không theo thứ tự); xếp khu vực theo danh sách lựa chọn', () => {
    const a = { ...GAS_CONFIG, areas: ['Khu bồn LPG', 'Đường cấp LPG'] };
    expect(sameConfig(a, { ...a, areas: ['Đường cấp LPG', 'Khu bồn LPG'] })).toBe(true);
    expect(sameConfig(a, { ...a, areas: ['Khu bồn LPG'] })).toBe(false);
    expect(sameConfig(a, { ...a, rate: 'slow' })).toBe(false);
    expect(orderedAreas(['Đường cấp LPG', 'Khu lạ', 'Khu bồn LPG'], GAS_SETUP.areaOptions)).toEqual(['Khu bồn LPG', 'Đường cấp LPG']);
  });
});

describe('số liệu tham chiếu', () => {
  const gas = GAS_SETUP.referenceRows[0]!;
  const hb = GAS_SETUP.referenceRows[1]!;
  const below: ReferenceRow = { ...gas, limits: { warn: 50, danger: 45, direction: 'below' } };

  it('số + trạng thái theo ngưỡng (đúng mốc tính là đạt mức)', () => {
    expect(referenceReading(gas, tv(2), T)).toEqual({ valueText: '2.0', status: 'normal' });
    expect(referenceReading(gas, tv(10), T).status).toBe('warning');
    expect(referenceReading(gas, tv(20), T).status).toBe('danger');
    expect(referenceReading(below, tv(48), T).status).toBe('warning');
    expect(referenceReading(below, tv(45), T).status).toBe('danger');
    expect(referenceReading({ ...gas, limits: undefined }, tv(99), T).status).toBe('normal');
  });

  it('mất tín hiệu (thiếu / bad / đúng 10 s) → không hiện số', () => {
    expect(referenceReading(gas, undefined, T)).toEqual({ valueText: null, status: 'lost' });
    expect(referenceReading(gas, tv(2, { quality: 'bad' }), T).status).toBe('lost');
    expect(referenceReading(gas, tv(2, { ts: T - 10_000 }), T).valueText).toBeNull();
    expect(referenceReading(gas, tv('2'), T).status).toBe('lost');
  });

  it('heartbeat: ok → Trực tuyến, khác → Ngoại tuyến, mất tín hiệu → lost', () => {
    expect(referenceReading(hb, tv('ok'), T)).toEqual({ valueText: 'Bình thường', status: 'online' });
    expect(referenceReading(hb, tv('lost'), T)).toEqual({ valueText: 'Mất heartbeat', status: 'offline' });
    expect(referenceReading(hb, tv('ok', { ts: T - 20_000 }), T).status).toBe('lost');
  });

  it('giá trị bắt đầu = số tươi của tag biến chính; tag màn cấu hình không trùng', () => {
    expect(startValue(GAS_SETUP.variable, { 'GS-06': tv(2.2) }, T)).toBe(2.2);
    expect(startValue(GAS_SETUP.variable, { 'GS-06': tv(2.2, { quality: 'bad' }) }, T)).toBeUndefined();
    expect(startValue(GAS_SETUP.variable, undefined, T)).toBeUndefined();
    expect(setupTags(GAS_SETUP)).toEqual(['GS-06', 'PLC-01.HEARTBEAT']);
  });
});

describe('trạng thái', () => {
  it('đồng bộ dữ liệu', () => {
    expect(dataSyncState(undefined)).toBe('pending');
    expect(dataSyncState(H())).toBe('synced');
    expect(dataSyncState(H({ ok: 20, stale: 1 }))).toBe('missing');
  });

  it('thứ tự: cấu hình mapping → đang tải → mất tín hiệu → cấu hình chưa hợp lệ → sẵn sàng', () => {
    expect(readiness({ kind: 'config', text: '' }, false).label).toBe('Cần cấu hình mapping');
    expect(readiness({ kind: 'pending', text: '' }, true).tone).toBe('muted');
    expect(readiness({ kind: 'signal', text: '' }, true).short).toBe('Thiếu dữ liệu');
    expect(readiness(null, false).label).toBe('Cấu hình chưa hợp lệ');
    expect(readiness(null, true)).toEqual({ tone: 'success', label: 'Sẵn sàng mô phỏng', short: 'Sẵn sàng', headline: 'Sẵn sàng chạy mô phỏng' });
  });
});

describe('configSuggestion', () => {
  const s = { title: 'Rò rỉ LPG tại khu vực bồn', setup: GAS_SETUP };

  it('chưa có số liệu → null', () => {
    expect(configSuggestion(s, undefined, 0)).toBeNull();
  });

  it('đủ dữ liệu → câu như ảnh (mức + thời lượng từ setup), giữ chữ hoa của "LPG"', () => {
    const sg = configSuggestion(s, H(), 92)!;
    expect(sg).toMatchObject({ kind: 'run', target: 35, targetText: '35% LEL', durationMin: 10, confidence: 92 });
    expect(sg.kind === 'run' && sg.lead).toBe('Kịch bản rò rỉ LPG tại khu vực bồn phù hợp để kiểm tra.');
  });

  it('thiếu thông số → đề nghị kiểm tra dữ liệu, không gợi ý mức chạy', () => {
    const sg = configSuggestion(s, H({ ok: 19, bad: 2 }), 80)!;
    expect(sg.kind).toBe('check-data');
    expect(sg.kind === 'check-data' && sg.text).toContain('Có 2/21 thông số PLC/SCADA không khả dụng');
    expect(sg.kind === 'check-data' && sg.text).toContain('kịch bản rò rỉ LPG tại khu vực bồn.');
    expect(suggestionApplied(GAS_CONFIG, sg)).toBe(false);
  });

  it('đã áp dụng = đúng cả mức và thời lượng', () => {
    const sg = configSuggestion(s, H(), 92);
    expect(suggestionApplied(GAS_CONFIG, sg)).toBe(true);
    expect(suggestionApplied({ ...GAS_CONFIG, durationMin: 15 }, sg)).toBe(false);
    expect(suggestionApplied(GAS_CONFIG, null)).toBe(false);
  });
});

describe('lịch sử của một kịch bản', () => {
  const run = (id: string, scenarioId: string, at: string, result: SimulationRun['result'] = 'pass'): SimulationRun => ({
    id,
    scenarioId,
    at: parsePlantDateTime(at)!.toISOString(),
    result,
    responseSeconds: 38,
    targetSeconds: 60,
    by: 'A',
  });

  it('chỉ lượt của kịch bản, mới nhất trước; ngày giờ theo giờ nhà máy', () => {
    const runs = [run('a', 'SC-001', '2026-06-21T10:15'), run('b', 'SC-002', '2026-06-25T09:00'), run('c', 'SC-001', '2026-06-24T15:30')];
    expect(scenarioRuns('SC-001', runs).map((r) => r.id)).toEqual(['c', 'a']);
    expect(runDateTimeText(runs[2]!.at)).toBe('24/06/2026 · 15:30');
  });

  it('ghi chú mặc định theo kết quả', () => {
    expect(defaultRunNote({ result: 'pass', responseSeconds: 38, targetSeconds: 60 })).toBe('Phản ứng 38 s, trong mục tiêu 60 s.');
    expect(defaultRunNote({ result: 'improve', responseSeconds: 72, targetSeconds: 60 })).toBe('Phản ứng 72 s, vượt mục tiêu 60 s.');
  });
});
