/** Nhịp pulse chậm cho trạng thái danger (giây/chu kỳ) – vật liệu, viền và vòng sáng sàn dùng chung để đồng pha. */
export const PULSE_PERIOD = 2.4;

/** 0 → 1 → 0 mượt theo thời gian `t` (giây, clock của R3F). */
export function pulse(t: number) {
  return 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / PULSE_PERIOD);
}
