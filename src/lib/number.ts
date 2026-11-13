/**
 * Định dạng số DÙNG CHUNG toàn app: dấu CHẤM thập phân, dấu PHẨY phân tách hàng nghìn – "12,450.5", "3.8", "92.5" (như
 * Figma đa số màn – docs/decisions.md). Không dùng `toLocaleString(...)` / `.replace('.', ',')` rải rác.
 * Ô nhập (`NumberField`) vẫn nhận cả "3,8" lẫn "3.8".
 */
const formatters = new Map<string, Intl.NumberFormat>();

/**
 * `digits` = số chữ số thập phân cố định (bỏ qua → tối đa 3, bỏ số 0 thừa). `grouping: false` khi số là mã / năm.
 */
export function formatNumber(v: number, digits?: number, { grouping = true }: { grouping?: boolean } = {}): string {
  const key = `${digits ?? ''}|${grouping}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat('en-US', {
      useGrouping: grouping,
      ...(digits === undefined ? { maximumFractionDigits: 3 } : { minimumFractionDigits: digits, maximumFractionDigits: digits }),
    });
    formatters.set(key, f);
  }
  return f.format(v);
}

/**
 * Phần đơn vị đứng sau số – MỘT quy tắc ghép cho toàn app: đơn vị bắt đầu bằng `%` / `°` dính số ("80%", "25°C",
 * "25% LEL", "5%/h"); `%LEL` (cách ghi trong cấu hình tag) hiển thị "% LEL"; không có đơn vị (`''`, `—`, `-`) → rỗng;
 * còn lại cách một khoảng (" bar", " m³/h"). Dùng khi số và đơn vị nằm ở hai phần tử khác nhau.
 */
export function unitSuffix(unit?: string): string {
  if (!unit || unit === '—' || unit === '-') return '';
  if (unit === '%LEL') return '% LEL';
  if (unit.startsWith('%') || unit.startsWith('°')) return unit;
  return ` ${unit}`;
}

/** Số (đã định dạng) + đơn vị theo `unitSuffix`: "9.2 bar" · "28.7°C" · "76%" · "2.0% LEL". */
export const withUnit = (text: string, unit?: string) => `${text}${unitSuffix(unit)}`;

/** Số nguyên 2 chữ số, thêm 0 đằng trước: 5 → "05" (giờ, ngày, tháng, số đếm KPI). */
export const pad2 = (n: number) => String(n).padStart(2, '0');
