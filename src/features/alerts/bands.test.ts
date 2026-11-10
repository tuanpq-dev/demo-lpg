import { describe, expect, test } from 'vitest';
import { ALERT_KINDS, GAS_BANDS } from '@/mocks/alertKinds';
import { bandOf, bandTicks, bannerFor, canCloseGas, formatMinutes, levelStart, overThreshold } from './bands';
import { formatDelta, formatMeasure } from './gauge';

const gas = ALERT_KINDS['gas-leak'];
const U = '% LEL';

describe('bands – mức theo số live', () => {
  test('mốc đúng bằng đầu đoạn = mức cao hơn; dưới 0 → bình thường; trên 100 → ESD', () => {
    const lv = (v: number) => bandOf(v, GAS_BANDS).label;
    expect([lv(0), lv(8), lv(9.99), lv(10), lv(19.9), lv(20), lv(25), lv(39.9), lv(40), lv(120), lv(-1)]).toEqual([
      'Bình thường',
      'Bình thường',
      'Bình thường',
      'Cảnh báo cấp 1',
      'Cảnh báo cấp 1',
      'Cảnh báo cấp 2',
      'Cảnh báo cấp 2',
      'Cảnh báo cấp 2',
      'ESD',
      'ESD',
      'Bình thường',
    ]);
    expect(levelStart(GAS_BANDS, 'level-1')).toBe(10);
    expect(levelStart(GAS_BANDS, 'esd')).toBe(40);
  });
  test('mốc trục 0 · 10 · 20 · 40 (ESD) · 100', () => {
    expect(bandTicks(GAS_BANDS, { min: 0, max: 100 }).map((t) => t.label)).toEqual(['0', '10', '20', '40 (ESD)', '100']);
  });
});

describe('banner ESD theo ngưỡng', () => {
  test('dưới cấp 2 không hiện; cấp 2 → câu "nếu đạt hoặc vượt 40% LEL"; ≥ 40 → câu "đã vượt ESD"', () => {
    expect(bannerFor(19.9, gas, U)).toBeNull();
    expect(bannerFor(20, gas, U)).toMatchObject({ stage: 'before-esd', title: 'Quy trình Khẩn cấp (ESD)' });
    expect(bannerFor(25, gas, U)!.text).toBe(
      'Nồng độ hiện tại đang ở mức cảnh báo cấp 2. Nếu đạt hoặc vượt 40% LEL, thực hiện quy trình ESD và sơ tán theo quy định.',
    );
    expect(bannerFor(40, gas, U)).toMatchObject({
      stage: 'after-esd',
      text: 'Đã vượt ngưỡng ESD (40% LEL), thực hiện quy trình ESD và sơ tán ngay.',
    });
    expect(bannerFor(undefined, gas, U)).toBeNull();
    expect(bannerFor(50, ALERT_KINDS['tank-overpressure'], 'bar')).toBeNull();
  });
});

describe('thời gian vượt ngưỡng', () => {
  const at = new Date('2026-10-27T03:00:00Z');
  test('live còn ≥ ngưỡng → phút từ lúc phát sinh; dưới ngưỡng → below; mất tín hiệu → unknown', () => {
    expect(overThreshold(at, 25, 10, new Date('2026-10-27T03:06:30Z'))).toEqual({ state: 'over', minutes: 6 });
    expect(overThreshold(at, 10, 10, new Date('2026-10-27T03:00:10Z'))).toEqual({ state: 'over', minutes: 0 });
    expect(overThreshold(at, 9.9, 10, new Date('2026-10-27T04:00:00Z'))).toEqual({ state: 'below' });
    expect(overThreshold(at, undefined, 10, new Date())).toEqual({ state: 'unknown' });
  });
  test('định dạng phút / giờ', () => {
    expect([formatMinutes(0), formatMinutes(6), formatMinutes(60), formatMinutes(65)]).toEqual(['dưới 1 phút', '6 phút', '1 giờ', '1 giờ 5 phút']);
  });
});

describe('định dạng chung', () => {
  test('"25% LEL", mức tăng "+11% LEL" / "−3% LEL" / "0% LEL", 1 chữ số lẻ', () => {
    expect(formatMeasure(25, U)).toBe('25% LEL');
    expect(formatMeasure(25.36, U)).toBe('25.4% LEL');
    expect(formatMeasure(11.8, 'bar')).toBe('11.8 bar');
    expect(formatDelta(11, U)).toBe('+11% LEL');
    expect(formatDelta(-3.04, U)).toBe('−3% LEL');
    expect(formatDelta(0.01, U)).toBe('0% LEL');
  });
});

describe('khoá "Đã xử lý xong"', () => {
  const lim = { limit: 10, unit: U };
  test('live còn ≥ ngưỡng cấp 1 → khoá, lý do nêu số hiện tại', () => {
    expect(canCloseGas({ live: 25, ...lim })).toEqual({ ok: false, reason: 'above', message: 'Nồng độ hiện tại 25% LEL vẫn trên ngưỡng (10% LEL).' });
    expect(canCloseGas({ live: 10, ...lim }).ok).toBe(false);
  });
  test('live dưới ngưỡng → được; số đo lại (nếu nhập) cũng phải dưới ngưỡng', () => {
    expect(canCloseGas({ live: 6, ...lim })).toEqual({ ok: true, value: 6, source: 'live' });
    expect(canCloseGas({ live: 6, measured: 4, ...lim })).toEqual({ ok: true, value: 4, source: 'measured' });
    expect(canCloseGas({ live: 6, measured: 12, ...lim })).toMatchObject({ ok: false, reason: 'measured-above' });
  });
  test('mất tín hiệu → bắt buộc số đo lại < ngưỡng; số không hợp lệ bị chặn', () => {
    expect(canCloseGas({ live: undefined, ...lim })).toMatchObject({ ok: false, reason: 'need-measure' });
    expect(canCloseGas({ live: undefined, measured: 10, ...lim })).toMatchObject({ ok: false, reason: 'measured-above' });
    expect(canCloseGas({ live: undefined, measured: 3, ...lim })).toEqual({ ok: true, value: 3, source: 'measured' });
    expect(canCloseGas({ live: 3, measured: -1, ...lim })).toMatchObject({ ok: false, reason: 'invalid-measure' });
  });
});
