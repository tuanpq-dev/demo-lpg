import { describe, expect, test } from 'vitest';
import {
  heightToVolumePercent,
  horizontalCylinderFillFraction,
  levelPercentToVolumePercent,
  strappingVolume,
} from './volume';

/** Công thức giải tích độc lập: diện tích viên phân = R²·acos((R−h)/R) − (R−h)·√(2Rh − h²), chia πR². */
function segmentFraction(h: number, D: number) {
  const R = D / 2;
  return (R * R * Math.acos((R - h) / R) - (R - h) * Math.sqrt(2 * R * h - h * h)) / (Math.PI * R * R);
}

describe('horizontalCylinderFillFraction – bồn trụ nằm', () => {
  test('rỗng 0 %, nửa chiều cao = 50 % thể tích, đầy 100 %', () => {
    expect(horizontalCylinderFillFraction(0, 4.4)).toBe(0);
    expect(horizontalCylinderFillFraction(2.2, 4.4)).toBeCloseTo(0.5, 12);
    expect(horizontalCylinderFillFraction(4.4, 4.4)).toBeCloseTo(1, 12);
    expect(levelPercentToVolumePercent(50)).toBeCloseTo(50, 10);
  });

  test.each([0.1, 0.25, 0.4, 0.6, 0.75, 0.9, 0.97])('khớp công thức giải tích tại h/D = %s', (x) => {
    expect(horizontalCylinderFillFraction(x * 3, 3)).toBeCloseTo(segmentFraction(x * 3, 3), 10);
  });

  test('giá trị mẫu (%): h/D 0.1 → 5.20 · 0.25 → 19.55 · 0.75 → 80.45 · 0.9 → 94.80', () => {
    expect(levelPercentToVolumePercent(10)).toBeCloseTo(5.2, 2);
    expect(levelPercentToVolumePercent(25)).toBeCloseTo(19.55, 2);
    expect(levelPercentToVolumePercent(75)).toBeCloseTo(80.45, 2);
    expect(levelPercentToVolumePercent(90)).toBeCloseTo(94.8, 2);
    expect(heightToVolumePercent(3.3, 4.4)).toBeCloseTo(80.45, 2); // V-101 D = 4.4 m
  });

  test('đơn điệu tăng trên [0, D]', () => {
    let prev = -1;
    for (let i = 0; i <= 1000; i++) {
      const f = horizontalCylinderFillFraction((i / 1000) * 4.4, 4.4);
      expect(f).toBeGreaterThanOrEqual(prev);
      prev = f;
    }
  });

  test('đối xứng: f(x) + f(1 − x) = 1', () => {
    for (const x of [0.05, 0.2, 0.37, 0.6]) expect(horizontalCylinderFillFraction(x, 1) + horizontalCylinderFillFraction(1 - x, 1)).toBeCloseTo(1, 12);
  });

  test('chiều cao âm → 0, vượt đường kính → 100 % (kẹp, cảm biến lệch không làm vỡ số)', () => {
    expect(horizontalCylinderFillFraction(-1, 4.4)).toBe(0);
    expect(horizontalCylinderFillFraction(9, 4.4)).toBe(1);
    expect(levelPercentToVolumePercent(-5)).toBe(0);
    expect(levelPercentToVolumePercent(130)).toBe(100);
  });

  test('đường kính 0/âm, chiều cao NaN/∞ → NaN (không có kết quả hợp lệ)', () => {
    expect(horizontalCylinderFillFraction(1, 0)).toBeNaN();
    expect(horizontalCylinderFillFraction(1, -2)).toBeNaN();
    expect(horizontalCylinderFillFraction(Number.NaN, 2)).toBeNaN();
    expect(horizontalCylinderFillFraction(Number.POSITIVE_INFINITY, 2)).toBeNaN();
  });
});

describe('strappingVolume – bảng dung tích', () => {
  const table = [
    { height: 0, volume: 0 },
    { height: 1, volume: 10 },
    { height: 2, volume: 30 },
  ];
  test('nội suy tuyến tính, kẹp ngoài bảng, bảng rỗng → NaN', () => {
    expect(strappingVolume(table, 0.5)).toBe(5);
    expect(strappingVolume(table, 1.5)).toBe(20);
    expect(strappingVolume(table, -1)).toBe(0);
    expect(strappingVolume(table, 5)).toBe(30);
    expect(strappingVolume([], 1)).toBeNaN();
  });
});
