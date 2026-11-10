/*
 * Bộ lọc bảng báo cáo (đồng bộ URL qua `useTableFilters`) – THUẦN.
 */
import { foldSearch } from '@/lib/foldSearch';
import { REPORT_PERIODS, periodContains, periodLabel, periodRange, type ReportPeriod } from './period';
import { COMPLETION_STATUSES, SIGNATURE_STATUSES, completionOf, reportState, signatureOf, type CompletionStatus, type ReportRecord } from './status';

/** Tab: tất cả · theo kỳ · "Biểu mẫu đã ký" (đã ký đầy đủ, mọi kỳ). */
const REPORT_TABS = ['all', ...REPORT_PERIODS, 'signed'] as const;
export type ReportTab = (typeof REPORT_TABS)[number];

/** Giá trị lọc chữ ký: 4 trạng thái + "awaiting" = cả nhóm Chờ xác nhận (chờ duyệt + bị trả lại). */
const SIGNATURE_FILTERS = [...SIGNATURE_STATUSES, 'awaiting'] as const;
export type SignatureFilter = (typeof SIGNATURE_FILTERS)[number];

export const PAGE_SIZES = ['10', '20', '50'] as const;

/** Tham số URL. `tab` mặc định do từng màn quyết định (xem `reportParams`). */
export function reportParams<T extends ReportTab>(defaultTab: T) {
  return {
    tab: { values: REPORT_TABS, default: defaultTab },
    q: { default: '' },
    date: {},
    shift: {},
    completion: { values: COMPLETION_STATUSES },
    signature: { values: SIGNATURE_FILTERS },
    inspector: {},
    approver: {},
    size: { values: PAGE_SIZES, default: '10' },
  } as const;
}

export type ReportFilterValues = {
  tab: ReportTab;
  q: string;
  date: string | null;
  shift: string | null;
  completion: CompletionStatus | null;
  signature: SignatureFilter | null;
  inspector: string | null;
  approver: string | null;
};

function matchTab(r: ReportRecord, tab: ReportTab, now: Date): boolean {
  if (tab === 'all') return true;
  if (tab === 'signed') return reportState(r, now) === 'signed';
  return r.period === tab;
}

function matchSignature(r: ReportRecord, f: SignatureFilter, now: Date): boolean {
  return f === 'awaiting' ? reportState(r, now) === 'awaiting' : signatureOf(r, now) === f;
}

/** Bỏ dấu tiếng Việt + chữ thường (tìm không dấu) – định nghĩa ở `@/lib/foldSearch`, export lại cho code cũ. */
export { foldSearch };
const norm = foldSearch;

/** Tìm theo mã, kỳ ("24/06/2026", "Tháng 06/2026"), người kiểm tra/duyệt – không phân biệt dấu/hoa thường. */
function matchQuery(r: ReportRecord, q: string): boolean {
  const needle = norm(q.trim());
  if (!needle) return true;
  return [r.code, periodLabel(r.period, r.periodKey), r.inspector, r.approver ?? ''].some((s) => norm(s).includes(needle));
}

export function matchReport(r: ReportRecord, v: ReportFilterValues, now: Date): boolean {
  return (
    matchTab(r, v.tab, now) &&
    matchQuery(r, v.q) &&
    // Ngày: báo cáo ngày đúng ngày đó; báo cáo tháng/quý/năm có kỳ chứa ngày đó.
    (!v.date || periodContains(r.period, r.periodKey, v.date)) &&
    (!v.shift || r.shift === v.shift) &&
    (!v.completion || completionOf(r, now) === v.completion) &&
    (!v.signature || matchSignature(r, v.signature, now)) &&
    (!v.inspector || r.inspector === v.inspector) &&
    (!v.approver || r.approver === v.approver)
  );
}

const PERIOD_ORDER: Record<ReportPeriod, number> = { daily: 0, monthly: 1, quarterly: 2, yearly: 3 };

/** Kỳ kết thúc gần nhất trước; cùng ngày cuối → ngày, tháng, quý, năm. */
export function sortReports(a: ReportRecord, b: ReportRecord): number {
  const ea = periodRange(a.period, a.periodKey).end;
  const eb = periodRange(b.period, b.periodKey).end;
  return eb.localeCompare(ea) || PERIOD_ORDER[a.period] - PERIOD_ORDER[b.period] || a.code.localeCompare(b.code);
}

/** Lựa chọn duy nhất (đã sắp) cho Select lọc từ dữ liệu. */
export function distinctOptions(values: readonly (string | undefined)[]): { value: string; label: string }[] {
  return [...new Set(values.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, 'vi')).map((v) => ({ value: v, label: v }));
}
