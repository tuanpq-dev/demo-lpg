/*
 * Ngày theo GIỜ NHÀ MÁY (không phụ thuộc múi giờ máy người xem / máy chủ). Thuần – mọi hàm nhận `now` từ ngoài.
 * Dữ liệu ngày dạng "yyyy-mm-dd" hoặc "yyyy-mm-ddTHH:mm" là giờ địa phương nhà máy (không kèm múi giờ).
 */

/** Múi giờ nhà máy (Việt Nam dùng chung UTC+7 với Bangkok, không đổi giờ mùa hè). */
export const PLANT_TIME_ZONE = 'Asia/Bangkok';

const DAY_MS = 86_400_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

/** "yyyy-mm-dd" của thời điểm `now` theo múi giờ `timeZone`. */
export function plantDayKey(now: Date, timeZone: string = PLANT_TIME_ZONE): string {
  let f = formatters.get(timeZone);
  if (!f) {
    // en-CA định dạng sẵn yyyy-mm-dd.
    f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    formatters.set(timeZone, f);
  }
  return f.format(now);
}

/** Số thứ tự ngày (lịch Gregory, không múi giờ) của "yyyy-mm-dd…" – hiệu hai ngày luôn là số nguyên. */
export function dayNumber(isoDay: string): number {
  const [y, m, d] = isoDay.slice(0, 10).split('-').map(Number);
  return Date.UTC(y!, m! - 1, d!) / DAY_MS;
}

/** Số ngày từ hôm nay (giờ nhà máy) tới ngày `isoDay` – âm = đã qua. */
export const daysFromToday = (isoDay: string, now: Date, timeZone?: string) =>
  dayNumber(isoDay) - dayNumber(plantDayKey(now, timeZone));

/** "yyyy-mm" của tháng hiện tại (giờ nhà máy) dời `offset` tháng. */
export function plantMonthKey(now: Date, offset = 0, timeZone?: string): string {
  const [y, m] = plantDayKey(now, timeZone).split('-').map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
