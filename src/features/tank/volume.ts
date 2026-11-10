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

/** % thể tích từ mức theo chiều cao (% đường kính – cách các tag LT-xxx đang báo). */
export function levelPercentToVolumePercent(levelPct: number): number {
  return horizontalCylinderFillFraction(levelPct, 100) * 100;
}

/** Một dòng bảng dung tích: chiều cao (m) → thể tích (m³). */
export type StrappingRow = { height: number; volume: number };
