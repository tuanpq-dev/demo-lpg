import { describe, expect, test } from 'vitest';
import { formatGaugeNumber, gaugeFraction, gaugeScale, gaugeValueText, isBreached, withUnit } from './gauge';

describe('gaugeScale', () => {
  test('có cấu hình: 0 → nguy hiểm × 1.2 (V-101: 12 → 14.4)', () => {
    const s = gaugeScale({ value: 11.8, threshold: 10.5, danger: 12, direction: 'above' })!;
    expect(s).toMatchObject({ min: 0, max: 14.4, breached: true });
    expect(gaugeFraction(s, 10.5)).toBeCloseTo(0.729, 3);
  });
  test('không cấu hình: 0 → ngưỡng × 1.2', () => {
    expect(gaugeScale({ value: 45, threshold: 50, direction: 'below' })!.max).toBe(60);
  });
  test('giá trị vượt thang → nới tới giá trị × 1.05', () => {
    const s = gaugeScale({ value: 25, threshold: 20, direction: 'above' })!;
    expect(s.max).toBe(26.25);
    expect(gaugeFraction(s, 25)).toBeLessThan(1);
  });
  test('danger không lớn hơn ngưỡng → bỏ qua, dùng ngưỡng', () => {
    expect(gaugeScale({ value: 1, threshold: 10, danger: 8, direction: 'above' })!.max).toBe(12);
  });
  test('biên: 0 hợp lệ; chỉ chốt an toàn khi số không hợp lệ hoặc thang suy biến (max ≤ 0)', () => {
    expect(gaugeScale({ value: 0, threshold: 1, direction: 'below' })).toMatchObject({ max: 1.2, breached: true });
    expect(gaugeScale({ value: Number.NaN, threshold: 1, direction: 'above' })).toBeNull();
    expect(gaugeScale({ value: 0, threshold: 0, direction: 'above' })).toBeNull();
    expect(gaugeScale({ value: -4.2, threshold: -3, direction: 'below' })).toBeNull();
  });
  test('giá trị âm với thang dương: vẫn dựng (không còn luật "số âm"), vạch kẹp về 0', () => {
    const s = gaugeScale({ value: -1, threshold: 10, direction: 'below' })!;
    expect(s).toMatchObject({ min: 0, max: 12, breached: true });
    expect(gaugeFraction(s, -1)).toBe(0);
  });
  test('nới thang × 1.05 giữ nguyên khi vượt mức nguy hiểm × 1.2', () => {
    expect(gaugeScale({ value: 20, threshold: 10.5, danger: 12, direction: 'above' })!.max).toBe(21);
  });
  test('gaugeFraction kẹp trong [0, 1]', () => {
    expect(gaugeFraction({ min: 0, max: 10 }, -1)).toBe(0);
    expect(gaugeFraction({ min: 0, max: 10 }, 99)).toBe(1);
  });
});

describe('isBreached / gaugeValueText – hai chiều', () => {
  test('above: vượt khi lớn hơn; bằng ngưỡng chưa vượt', () => {
    expect(isBreached(11.8, 10.5, 'above')).toBe(true);
    expect(isBreached(10.5, 10.5, 'above')).toBe(false);
  });
  test('below: vượt khi nhỏ hơn', () => {
    expect(isBreached(45, 50, 'below')).toBe(true);
    expect(isBreached(50, 50, 'below')).toBe(false);
    expect(isBreached(55, 50, 'below')).toBe(false);
  });
  test('chữ đọc nói rõ vượt / dưới / trong giới hạn', () => {
    expect(gaugeValueText({ value: 11.8, threshold: 10.5, direction: 'above', breached: true }, 'bar')).toBe('11.8 bar, vượt ngưỡng 10.5 bar');
    expect(gaugeValueText({ value: 45, threshold: 50, direction: 'below', breached: true }, '°C')).toBe('45°C, dưới ngưỡng 50°C');
    expect(gaugeValueText({ value: 9.6, threshold: 10.5, direction: 'above', breached: false }, 'bar')).toBe(
      '9.6 bar, trong giới hạn (ngưỡng 10.5 bar)',
    );
  });
  test('định dạng số và đơn vị', () => {
    expect(formatGaugeNumber(12.0)).toBe('12');
    expect(formatGaugeNumber(10.456)).toBe('10.46');
    expect(withUnit('25', '% LEL')).toBe('25% LEL');
    expect(withUnit('11.8', 'bar')).toBe('11.8 bar');
  });
});
