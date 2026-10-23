/*
 * Ba lớp trong bồn trụ nằm ngang: nước đáy · LPG lỏng · pha hơi. Module thuần, có test: layers.test.ts.
 *
 * Đầu vào là HAI mức theo chiều cao (% đường kính, như tag LT-xxx báo):
 *   - `levelPct`: mặt thoáng chất lỏng (LPG + nước) – tag mức tổng;
 *   - `waterPct`: mặt phân cách nước / LPG – tag mức nước đáy.
 * Thể tích từng lớp tính bằng diện tích viên phân (`horizontalCylinderFillFraction`, có test ở volume.test.ts):
 *   nước = f(hw) · LPG = f(hl) − f(hw) · hơi = 1 − f(hl)  → ba phần luôn cộng lại đúng 1.
 * Cùng giả định với volume.ts: bỏ qua 2 đáy chỏm (TODO: bảng dung tích thật của khách).
 */
import { horizontalCylinderFillFraction } from './volume';

export type TankDimensions = {
  /** Chiều dài thân trụ (m). */
  length: number;
  /** Đường kính trong (m). */
  diameter: number;
};

export type TankLayerId = 'lpg' | 'vapor' | 'water';

export type TankLayer = {
  id: TankLayerId;
  /** Phần thể tích 0–1 (chưa làm tròn). */
  fraction: number;
  /** % thể tích đã làm tròn `digits` chữ số – ba lớp cộng lại đúng 100. */
  percent: number;
  /** Thể tích (m³). */
  volume: number;
};

export type TankLayers = {
  /** Thể tích hình học của thân trụ (m³). */
  capacity: number;
  /** Mức chiều cao đã kẹp vào [0, 100] (%), nước ≤ mặt thoáng. */
  levelPct: number;
  waterPct: number;
  /** % thể tích TOÀN BỘ chất lỏng (LPG + nước) – định nghĩa "Mức bồn". */
  liquidPercent: number;
  lpg: TankLayer;
  vapor: TankLayer;
  water: TankLayer;
};

const clampPct = (v: number) => Math.min(100, Math.max(0, v));

/** Thể tích thân trụ πr²L (m³). */
export const cylinderCapacity = ({ length, diameter }: TankDimensions) => Math.PI * (diameter / 2) ** 2 * length;

/**
 * Làm tròn danh sách số không âm sao cho tổng sau làm tròn đúng `total` (phương pháp phần dư lớn nhất).
 * Dùng cho % hiển thị: 76.24 + 21.78 + 1.98 → 76.2 + 21.8 + 2.0 = 100.0 (làm tròn riêng lẻ có thể ra 99.9/100.1).
 */
export function roundToTotal(values: readonly number[], digits = 1, total = 100): number[] {
  if (!values.length) return [];
  const scale = 10 ** digits;
  const target = Math.round(total * scale);
  const raw = values.map((v) => Math.max(0, v) * scale);
  const sum = raw.reduce((s, v) => s + v, 0);
  // Chuẩn hoá để tổng thô = target (sai số dấu phẩy động / đầu vào không cộng đúng total).
  const scaled = sum > 0 ? raw.map((v) => (v * target) / sum) : raw.map(() => target / raw.length);
  const floors = scaled.map(Math.floor);
  let rest = target - floors.reduce((s, v) => s + v, 0);
  const order = scaled.map((v, i) => [v - floors[i]!, i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of order) {
    if (rest <= 0) break;
    floors[i]! += 1;
    rest -= 1;
  }
  return floors.map((v) => v / scale);
}

/**
 * Tính ba lớp từ hai mức chiều cao + kích thước bồn. Trả về null khi đầu vào không phải số hữu hạn hoặc kích
 * thước không dương. Mức ngoài [0, 100] bị kẹp; nước cao hơn mặt thoáng → coi như bằng mặt thoáng (không có LPG).
 */
export function tankLayers(levelPct: number, waterPct: number, dims: TankDimensions, digits = 1): TankLayers | null {
  if (![levelPct, waterPct, dims.length, dims.diameter].every(Number.isFinite)) return null;
  if (dims.length <= 0 || dims.diameter <= 0) return null;
  const level = clampPct(levelPct);
  const water = Math.min(clampPct(waterPct), level);
  const fLiquid = horizontalCylinderFillFraction(level, 100);
  const fWater = horizontalCylinderFillFraction(water, 100);
  const fractions: Record<TankLayerId, number> = { lpg: fLiquid - fWater, vapor: 1 - fLiquid, water: fWater };
  const capacity = cylinderCapacity(dims);
  const [lpgPct, vaporPct, waterPctRounded] = roundToTotal([fractions.lpg * 100, fractions.vapor * 100, fractions.water * 100], digits);
  const layer = (id: TankLayerId, percent: number): TankLayer => ({ id, fraction: fractions[id], percent, volume: fractions[id] * capacity });
  return {
    capacity,
    levelPct: level,
    waterPct: water,
    liquidPercent: fLiquid * 100,
    lpg: layer('lpg', lpgPct!),
    vapor: layer('vapor', vaporPct!),
    water: layer('water', waterPctRounded!),
  };
}

export type LimitStatus = 'normal' | 'warning' | 'danger';

/** Ngưỡng trên (giá trị ≥ ngưỡng → vượt). */
export type UpperLimits = { warn?: number; danger?: number };

/** Trạng thái theo ngưỡng trên – dùng cho nước đáy (% thể tích). Ngưỡng bằng nhau → danger thắng. */
export function upperLimitStatus(value: number, limits: UpperLimits): LimitStatus {
  if (!Number.isFinite(value)) return 'normal';
  if (limits.danger !== undefined && value >= limits.danger) return 'danger';
  if (limits.warn !== undefined && value >= limits.warn) return 'warning';
  return 'normal';
}
