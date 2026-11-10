import { ASSET_SPECS, assetLayout } from './assets/specs';
import type { SceneObject, Vec3 } from './types';

/*
 * Mặt sàn y = 0 – hàm THUẦN (không three) dùng chung cho Editor (validate, Properties) và Viewer (nhãn khoảng cách).
 * Quy ước: đáy object (min.y của hộp bao sau xoay + scale) nằm đúng tại elevation.
 */

/** Sai số coi như trùng mặt phẳng (m). */
export const GROUND_EPS = 0.01;

/** Hàng y của ma trận xoay Euler XYZ (giống three `Matrix4.makeRotationFromEuler`, thứ tự 'XYZ'). */
function rotationRowY([x, y, z]: Vec3): Vec3 {
  const [a, b, c, d, e, f] = [Math.cos(x), Math.sin(x), Math.cos(y), Math.sin(y), Math.cos(z), Math.sin(z)];
  return [a * f + b * e * d, a * e - b * f * d, -b * c];
}

type Placed = Pick<SceneObject, 'asset' | 'params' | 'path' | 'rotation' | 'scale'>;

/** Độ lệch (m) từ gốc object tới điểm thấp nhất của hộp bao, sau xoay + scale (0 nếu chỉ xoay quanh Y, scale > 0). */
function baseOffset(o: Placed): number {
  const { min, max } = assetLayout(o).bounds;
  const s = o.scale ?? [1, 1, 1];
  const row = rotationRowY(o.rotation ?? [0, 0, 0]);
  let lo = Infinity;
  for (const x of [min[0], max[0]])
    for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) lo = Math.min(lo, row[0] * x * s[0] + row[1] * y * s[1] + row[2] * z * s[2]);
  return lo;
}

/** Độ cao thế giới của đáy object (điểm thấp nhất) khi gốc ở độ cao `originY`. */
export const worldBaseY = (o: Placed, originY: number) => originY + baseOffset(o);

/** Asset được phép nâng khỏi sàn (lắp trên ống: van, đồng hồ lưu lượng). */
export const mayFloat = (o: Pick<SceneObject, 'asset'>) => !!ASSET_SPECS[o.asset]?.inline;
