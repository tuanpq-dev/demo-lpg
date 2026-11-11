/**
 * Định dạng số DÙNG CHUNG toàn app: dấu CHẤM thập phân, dấu PHẨY phân tách hàng nghìn – "12,450.5", "3.8", "92.5" (như
 * Figma đa số màn; chốt 11/11/2026 – docs/decisions.md). Không dùng `toLocaleString(...)` / `.replace('.', ',')` rải rác.
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
