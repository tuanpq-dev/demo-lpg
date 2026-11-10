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
export const daysFromToday = (isoDay: string, now: Date, timeZone?: string) => dayNumber(isoDay) - dayNumber(plantDayKey(now, timeZone));

/** "yyyy-mm" của tháng hiện tại (giờ nhà máy) dời `offset` tháng. */
export function plantMonthKey(now: Date, offset = 0, timeZone?: string): string {
  const [y, m] = plantDayKey(now, timeZone).split('-').map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Giờ nhà máy lệch UTC cố định +7 (Asia/Bangkok không đổi giờ mùa hè). */
const PLANT_UTC_OFFSET_MS = 7 * 3_600_000;
const pad2 = (n: number) => String(n).padStart(2, '0');

/** "yyyy-mm-ddTHH:mm" (giờ nhà máy) của thời điểm `now`. */
export function plantDateTimeKey(now: Date): string {
  const t = new Date(now.getTime() + PLANT_UTC_OFFSET_MS);
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}T${pad2(t.getUTCHours())}:${pad2(t.getUTCMinutes())}`;
}

/** "yyyy-mm-ddTHH:mm[:ss]" (giờ nhà máy, không kèm múi giờ) → thời điểm tuyệt đối. Sai định dạng → null. */
export function parsePlantDateTime(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (!m) return null;
  const [y, mo, d, h, mi, se] = m.slice(1).map((v) => Number(v ?? 0));
  if (mo! < 1 || mo! > 12 || d! < 1 || d! > 31 || h! > 23 || mi! > 59 || se! > 59) return null;
  return new Date(Date.UTC(y!, mo! - 1, d!, h!, mi!, se!) - PLANT_UTC_OFFSET_MS);
}

/** "HH:mm:ss" (giờ nhà máy) của thời điểm `now`. */
export function plantTimeOfDay(now: Date): string {
  const t = new Date(now.getTime() + PLANT_UTC_OFFSET_MS);
  return `${pad2(t.getUTCHours())}:${pad2(t.getUTCMinutes())}:${pad2(t.getUTCSeconds())}`;
}

/** "dd/mm/yyyy" của ngày "yyyy-mm-dd…". */
export function formatDayVi(isoDay: string): string {
  const [y, m, d] = isoDay.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
