/*
 * Quy đổi mức chất lỏng (chiều cao) → % thể tích cho bồn trụ nằm ngang. Module thuần, có test: volume.test.ts
 * (`npm test`).
 *
 * Mô hình: thân trụ tròn nằm ngang, BỎ QUA thể tích 2 đáy elip/chỏm cầu (sai số vài % ở mức thấp/cao).
 * TODO(khách hàng): thay bằng bảng dung tích thật (strapping table – chiều cao → thể tích theo hiệu chuẩn bồn)
 * khi khách gửi; dùng `strappingVolume` bên dưới để nội suy. Chưa có bảng → dùng công thức hình học.
 */

/**
 * Phần thể tích (0–1) khi chất lỏng cao `height` trong bồn trụ nằm ngang đường kính `diameter` (cùng đơn vị).
 * Diện tích viên phân / diện tích tròn = (θ − sin θ) / 2π, với θ = 2·acos(1 − 2h/D). Kẹp h vào [0, D].
 */
export function horizontalCylinderFillFraction(height: number, diameter: number): number {
  if (!(diameter > 0) || !Number.isFinite(height)) return NaN;
  const x = Math.min(1, Math.max(0, height / diameter));
  const theta = 2 * Math.acos(1 - 2 * x);
  return (theta - Math.sin(theta)) / (2 * Math.PI);
}

/** % thể tích từ chiều cao chất lỏng (m) và đường kính bồn (m). */
export function heightToVolumePercent(heightM: number, diameterM: number): number {
  return horizontalCylinderFillFraction(heightM, diameterM) * 100;
}

/** % thể tích từ mức theo chiều cao (% đường kính – cách các tag LT-xxx đang báo). */
export function levelPercentToVolumePercent(levelPct: number): number {
  return horizontalCylinderFillFraction(levelPct, 100) * 100;
}

/** Một dòng bảng dung tích: chiều cao (m) → thể tích (m³). */
export type StrappingRow = { height: number; volume: number };

/**
 * Nội suy tuyến tính trên bảng dung tích (sắp tăng dần theo chiều cao). Ngoài bảng → kẹp ở đầu/cuối.
 * Dùng khi có bảng thật từ khách (xem TODO đầu file).
 */
export function strappingVolume(table: readonly StrappingRow[], height: number): number {
  if (!table.length) return NaN;
  if (height <= table[0]!.height) return table[0]!.volume;
  for (let i = 1; i < table.length; i++) {
    const a = table[i - 1]!;
    const b = table[i]!;
    if (height <= b.height) return a.volume + ((b.volume - a.volume) * (height - a.height)) / (b.height - a.height || 1);
  }
  return table[table.length - 1]!.volume;
}
