// Chạy: npm test (node --test, bỏ kiểu TS bằng --experimental-strip-types – không thêm dependency).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  heightToVolumePercent,
  horizontalCylinderFillFraction,
  levelPercentToVolumePercent,
  strappingVolume,
} from './volume.ts';

const close = (a: number, b: number, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('rỗng, đầy, một nửa', () => {
  close(horizontalCylinderFillFraction(0, 4.4), 0, 1e-12);
  close(horizontalCylinderFillFraction(4.4, 4.4), 1, 1e-12);
  close(horizontalCylinderFillFraction(2.2, 4.4), 0.5, 1e-12);
});

test('giá trị mẫu (viên phân hình tròn)', () => {
  // h/D = 0.1 → 5.20 % · 0.25 → 19.55 % · 0.75 → 80.45 % · 0.9 → 94.80 %
  close(levelPercentToVolumePercent(10), 5.2);
  close(levelPercentToVolumePercent(25), 19.55);
  close(levelPercentToVolumePercent(75), 80.45);
  close(levelPercentToVolumePercent(90), 94.8);
  // bồn V-101 (D = 4.4 m): cao 3.3 m (75 %) → 80.45 %
  close(heightToVolumePercent(3.3, 4.4), 80.45);
});

test('đối xứng: f(x) + f(1 − x) = 1', () => {
  for (const x of [0.05, 0.2, 0.37, 0.6]) close(horizontalCylinderFillFraction(x, 1) + horizontalCylinderFillFraction(1 - x, 1), 1, 1e-12);
});

test('kẹp ngoài [0, D], đường kính sai → NaN', () => {
  close(horizontalCylinderFillFraction(-1, 4.4), 0, 1e-12);
  close(horizontalCylinderFillFraction(9, 4.4), 1, 1e-12);
  assert.ok(Number.isNaN(horizontalCylinderFillFraction(1, 0)));
});

test('bảng dung tích: nội suy tuyến tính + kẹp', () => {
  const table = [
    { height: 0, volume: 0 },
    { height: 1, volume: 10 },
    { height: 2, volume: 30 },
  ];
  close(strappingVolume(table, 0.5), 5, 1e-12);
  close(strappingVolume(table, 1.5), 20, 1e-12);
  close(strappingVolume(table, 5), 30, 1e-12);
  assert.ok(Number.isNaN(strappingVolume([], 1)));
});
