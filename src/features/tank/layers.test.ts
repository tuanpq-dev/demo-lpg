import { describe, expect, it } from 'vitest';
import { cylinderCapacity, roundToTotal, tankLayers, upperLimitStatus } from './layers';
import { horizontalCylinderFillFraction } from './volume';

const DIMS = { length: 4.8, diameter: 1.9 };
const sum = (l: NonNullable<ReturnType<typeof tankLayers>>) => Math.round((l.lpg.percent + l.vapor.percent + l.water.percent) * 10) / 10;

describe('cylinderCapacity', () => {
  it('πr²L', () => {
    expect(cylinderCapacity({ length: 1, diameter: 2 })).toBeCloseTo(Math.PI, 10);
    expect(cylinderCapacity(DIMS)).toBeCloseTo(13.609, 3);
  });
});

describe('roundToTotal', () => {
  it('tổng luôn đúng 100 sau làm tròn', () => {
    // Làm tròn riêng lẻ: 33.3 × 3 = 99.9 → phải bù 0.1 vào phần dư lớn nhất.
    expect(roundToTotal([100 / 3, 100 / 3, 100 / 3])).toEqual([33.4, 33.3, 33.3]);
    expect(roundToTotal([76.24, 21.78, 1.98])).toEqual([76.2, 21.8, 2]);
    // Phần dư bằng nhau → ưu tiên phần tử đứng trước.
    expect(roundToTotal([0.04, 0.04, 99.92])).toEqual([0.1, 0, 99.9]);
  });
  it('biên: rỗng, toàn 0, số âm, 0 chữ số lẻ', () => {
    expect(roundToTotal([])).toEqual([]);
    expect(roundToTotal([0, 0])).toEqual([50, 50]);
    expect(roundToTotal([-5, 10])).toEqual([0, 100]);
    expect(roundToTotal([49.5, 50.5], 0)).toEqual([50, 50]);
  });
  it('chạy lại hai lần cho cùng kết quả (không đổi đầu vào)', () => {
    const v = [12.345, 67.891, 19.764];
    const a = roundToTotal(v);
    expect(roundToTotal(v)).toEqual(a);
    expect(v).toEqual([12.345, 67.891, 19.764]);
  });
});

describe('tankLayers', () => {
  it('khớp bảng Figma: mức 73.0 %, mặt nước 5.2 % → 76.2 / 21.8 / 2.0 %', () => {
    const l = tankLayers(73.0, 5.2, DIMS)!;
    expect([l.lpg.percent, l.vapor.percent, l.water.percent]).toEqual([76.2, 21.8, 2]);
    expect(l.lpg.volume).toBeCloseTo(10.375, 3);
    expect(l.water.volume).toBeCloseTo(0.27, 2);
    expect(l.liquidPercent).toBeCloseTo(78.2, 1);
  });

  it('viên phân: thể tích lớp = f(h) theo hình học, không tỉ lệ thẳng với chiều cao', () => {
    const l = tankLayers(25, 0, { length: 1, diameter: 1 })!;
    // h/D = 0.25 → (θ − sin θ)/2π với θ = 2·acos(0.5) = 2π/3 → ≈ 19.55 %
    expect(l.lpg.fraction).toBeCloseTo((2 * Math.PI / 3 - Math.sin(2 * Math.PI / 3)) / (2 * Math.PI), 10);
    expect(l.lpg.fraction).toBeLessThan(0.25);
    expect(l.water.fraction).toBe(0);
  });

  it('đối xứng: nửa bồn = 50 %', () => {
    const l = tankLayers(50, 0, DIMS)!;
    expect(l.lpg.percent).toBe(50);
    expect(l.vapor.percent).toBe(50);
  });

  it('tổng % luôn = 100 và tổng thể tích = dung tích, quét nhiều mức', () => {
    for (let level = 0; level <= 100; level += 7.3) {
      for (let water = 0; water <= level; water += 3.1) {
        const l = tankLayers(level, water, DIMS)!;
        expect(sum(l)).toBe(100);
        expect(l.lpg.volume + l.vapor.volume + l.water.volume).toBeCloseTo(l.capacity, 9);
        expect(l.lpg.fraction).toBeGreaterThanOrEqual(-1e-12);
      }
    }
  });

  it('biên: rỗng, đầy, nước = mặt thoáng, nước > mặt thoáng, vượt [0, 100], âm', () => {
    expect(tankLayers(0, 0, DIMS)!.vapor.percent).toBe(100);
    const full = tankLayers(100, 0, DIMS)!;
    expect(full.lpg.percent).toBe(100);
    expect(full.vapor.volume).toBeCloseTo(0, 12);
    const allWater = tankLayers(40, 40, DIMS)!;
    expect(allWater.lpg.fraction).toBeCloseTo(0, 12);
    expect(allWater.water.fraction).toBeCloseTo(horizontalCylinderFillFraction(40, 100), 12);
    // Nước báo cao hơn mặt thoáng (lỗi đo) → kẹp bằng mặt thoáng, không ra LPG âm.
    const bad = tankLayers(30, 45, DIMS)!;
    expect(bad.waterPct).toBe(30);
    expect(bad.lpg.fraction).toBeCloseTo(0, 12);
    expect(tankLayers(130, -10, DIMS)!).toMatchObject({ levelPct: 100, waterPct: 0 });
  });

  it('đầu vào không hợp lệ → null', () => {
    expect(tankLayers(NaN, 0, DIMS)).toBeNull();
    expect(tankLayers(50, Infinity, DIMS)).toBeNull();
    expect(tankLayers(50, 0, { length: 0, diameter: 2 })).toBeNull();
    expect(tankLayers(50, 0, { length: 3, diameter: -1 })).toBeNull();
  });
});

describe('upperLimitStatus', () => {
  const lim = { warn: 3, danger: 5 };
  it('dưới / bằng / trên ngưỡng', () => {
    expect(upperLimitStatus(2.99, lim)).toBe('normal');
    expect(upperLimitStatus(3, lim)).toBe('warning');
    expect(upperLimitStatus(5, lim)).toBe('danger');
    expect(upperLimitStatus(80, lim)).toBe('danger');
  });
  it('thiếu ngưỡng, NaN, ngưỡng trùng nhau', () => {
    expect(upperLimitStatus(10, {})).toBe('normal');
    expect(upperLimitStatus(NaN, lim)).toBe('normal');
    expect(upperLimitStatus(4, { warn: 4, danger: 4 })).toBe('danger');
  });
});
