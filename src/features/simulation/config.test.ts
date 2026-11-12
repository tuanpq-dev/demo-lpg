import { describe, expect, test } from 'vitest';
import type { TagValue } from '@/features/live/types';
import {
  checkConfig,
  configSuggestion,
  configValid,
  readiness,
  reachesThreshold,
  referenceReading,
  sameConfig,
  suggestionApplied,
  type ReferenceRow,
  type ScenarioConfig,
  type ScenarioSetup,
  type SimVariable,
} from './config';
import type { TagHealth } from './scenarios';

const gas: SimVariable = {
  noun: 'nồng độ gas',
  startLabel: 'Nồng độ bắt đầu',
  targetLabel: 'Nồng độ mục tiêu',
  rateLabel: 'Tốc độ rò rỉ',
  tag: 'GD-101',
  plcTag: 'Tank_Gas_Detector',
  unit: '%',
  qualifier: 'LEL',
  digits: 0,
  min: 0,
  max: 100,
  step: 1,
  threshold: 20,
  thresholdLabel: 'Ngưỡng cảnh báo PLC',
  direction: 'above',
};
const setup = { variable: gas, areaOptions: ['Khu bồn LPG', 'Khu nạp xuất'] } satisfies Pick<ScenarioSetup, 'variable' | 'areaOptions'>;
const cfg = (patch: Partial<ScenarioConfig> = {}): ScenarioConfig => ({
  target: 35,
  durationMin: 10,
  rate: 'medium',
  endCondition: 'duration',
  areas: ['Khu bồn LPG'],
  ...patch,
});

describe('kiểm tra cấu hình (chỉ lớp mô phỏng)', () => {
  test('hợp lệ khi mục tiêu trong khoảng, thời lượng có trong danh sách, có khu vực hợp lệ', () => {
    expect(configValid(checkConfig(cfg(), setup))).toBe(true);
  });

  test('chặn: mục tiêu ngoài khoảng / không phải số, thời lượng lạ, khu vực không thuộc danh sách', () => {
    const c = checkConfig(cfg({ target: 120, durationMin: 7, areas: ['Khu lạ'] }), setup);
    expect(Object.keys(c.errors).sort()).toEqual(['areas', 'durationMin', 'target']);
    expect(c.errors.target).toBe('Giá trị mục tiêu phải trong khoảng 0% LEL – 100% LEL.');
    expect(checkConfig(cfg({ target: Number.NaN }), setup).errors.target).toBeDefined();
  });

  test('mục tiêu chưa chạm ngưỡng PLC → chỉ nhắc (vẫn chạy được); chiều "below" so ngược', () => {
    const c = checkConfig(cfg({ target: 15 }), setup);
    expect(configValid(c)).toBe(true);
    expect(c.warnings.target).toContain('mô phỏng sẽ không phát cảnh báo');
    expect(reachesThreshold({ threshold: 5, direction: 'below' }, 4)).toBe(true);
    expect(reachesThreshold({ threshold: 5, direction: 'below' }, 6)).toBe(false);
  });

  test('so cấu hình: khu vực so theo tập, không theo thứ tự', () => {
    expect(sameConfig(cfg({ areas: ['A', 'B'] }), cfg({ areas: ['B', 'A'] }))).toBe(true);
    expect(sameConfig(cfg(), cfg({ rate: 'fast' }))).toBe(false);
  });
});

describe('số liệu tham chiếu – không hiện số cũ khi mất tín hiệu', () => {
  const NOW = 1_000_000;
  const row: ReferenceRow = { id: 'p', label: 'Áp suất', plcTag: 'PT_101', tag: 'PT-101', unit: 'bar', digits: 1, limits: { warn: 10, danger: 12 } };
  const tv = (value: number | string, ago = 1000, quality: TagValue['quality'] = 'good'): TagValue => ({
    value,
    unit: 'bar',
    ts: NOW - ago,
    quality,
  });

  test('số tươi → giá trị + mức theo ngưỡng', () => {
    expect(referenceReading(row, tv(9.4), NOW)).toEqual({ valueText: '9.4', status: 'normal' });
    expect(referenceReading(row, tv(12.3), NOW)).toEqual({ valueText: '12.3', status: 'danger' });
  });

  test('thiếu tag / quality bad / quá 10 s → "Mất tín hiệu", valueText null', () => {
    expect(referenceReading(row, undefined, NOW)).toEqual({ valueText: null, status: 'lost' });
    expect(referenceReading(row, tv(9.4, 1000, 'bad'), NOW).valueText).toBeNull();
    expect(referenceReading(row, tv(9.4, 10_000), NOW).status).toBe('lost');
  });

  test('heartbeat PLC: ok → Trực tuyến, khác → Ngoại tuyến', () => {
    const hb: ReferenceRow = { ...row, kind: 'heartbeat', tag: 'PLC_HB' };
    expect(referenceReading(hb, tv('ok'), NOW).status).toBe('online');
    expect(referenceReading(hb, tv('lost'), NOW).status).toBe('offline');
  });
});

describe('sẵn sàng + gợi ý AI', () => {
  test('thứ tự: thiếu mapping → đang tải → thiếu dữ liệu → cấu hình sai → sẵn sàng', () => {
    expect(readiness({ kind: 'config', text: '' }, false).short).toBe('Cần cấu hình');
    expect(readiness({ kind: 'signal', text: '' }, true).short).toBe('Thiếu dữ liệu');
    expect(readiness(null, false).short).toBe('Chưa hợp lệ');
    expect(readiness(null, true)).toMatchObject({ tone: 'success', short: 'Sẵn sàng' });
  });

  test('thiếu thông số PLC → khuyên kiểm tra dữ liệu, KHÔNG gợi ý mức chạy; đủ → gợi ý mức + thời lượng', () => {
    const s = {
      title: 'Rò rỉ LPG tại bồn V-101',
      setup: { variable: gas, suggestion: { target: 35, durationMin: 10, purpose: 'phù hợp kiểm tra', goal: 'đánh giá', refs: ['PLC/SCADA'] } },
    } as unknown as Parameters<typeof configSuggestion>[0];
    const health = (ok: number): TagHealth => ({ total: 5, ok, bad: 5 - ok, missing: 0, stale: 0 });
    expect(configSuggestion(s, undefined, 80)).toBeNull();
    expect(configSuggestion(s, health(3), 60)).toMatchObject({ kind: 'check-data', text: expect.stringContaining('2/5') });
    const run = configSuggestion(s, health(5), 92);
    expect(run).toMatchObject({ kind: 'run', target: 35, targetText: '35% LEL', durationMin: 10 });
    expect(suggestionApplied(cfg({ target: 35, durationMin: 10 }), run)).toBe(true);
    expect(suggestionApplied(cfg({ target: 40 }), run)).toBe(false);
  });
});
