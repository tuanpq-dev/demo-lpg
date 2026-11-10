/*
 * Kỳ báo cáo (ngày / tháng / quý / năm) – cấu hình + phép tính ngày THUẦN, dùng chung cho mọi màn báo cáo.
 * Ngày dạng "yyyy-mm-dd" theo giờ nhà máy (xem `lib/plantTime`); không phụ thuộc múi giờ máy người xem.
 */
import { dayNumber, formatDayVi } from '@/lib/plantTime';

export const REPORT_PERIODS = ['daily', 'monthly', 'quarterly', 'yearly'] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

/**
 * Mã kỳ:
 * - daily "2026-06-24" · monthly "2026-06" · quarterly "2026-Q2" · yearly "2026".
 */
export type PeriodKey = string;

export type PeriodConfig = {
  /** Nhãn tab: "Báo cáo ngày". */
  label: string;
  /** Nhãn ngắn trong câu: "ngày". */
  noun: string;
  /** Tiền tố mã báo cáo (GIẢ ĐỊNH ngoài "BCVH-N" có trong ảnh – chờ khách). */
  codePrefix: string;
  /** Đơn vị mốc kiểm tra trong cột "Tiến độ kiểm tra": "5/6 mốc", "19/30 ngày". */
  checkpointUnit: string;
  /** Tiêu đề cột kỳ báo cáo. */
  periodHeader: string;
};

export const PERIOD_CONFIG: Record<ReportPeriod, PeriodConfig> = {
  daily: { label: 'Báo cáo ngày', noun: 'ngày', codePrefix: 'BCVH-N', checkpointUnit: 'mốc', periodHeader: 'Ngày báo cáo' },
  monthly: { label: 'Báo cáo tháng', noun: 'tháng', codePrefix: 'BCVH-T', checkpointUnit: 'ngày', periodHeader: 'Tháng báo cáo' },
  quarterly: { label: 'Báo cáo quý', noun: 'quý', codePrefix: 'BCVH-Q', checkpointUnit: 'tháng', periodHeader: 'Quý báo cáo' },
  yearly: { label: 'Báo cáo năm', noun: 'năm', codePrefix: 'BCVH-NAM', checkpointUnit: 'quý', periodHeader: 'Năm báo cáo' },
};

/** Mốc kiểm tra của báo cáo ngày (ảnh: "6 mốc kiểm tra: 08:00 … 18:00"). */
export const DAILY_CHECKPOINTS = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'] as const;

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Số ngày của tháng (m: 1–12). */
export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** "yyyy-mm-dd" của số thứ tự ngày (ngược với `dayNumber`). */
export function dayFromNumber(n: number): string {
  const d = new Date(n * 86_400_000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Quý (1–4) của tháng (1–12). */
export const quarterOf = (month: number) => Math.ceil(month / 3);

/** Ngày đầu/cuối (bao gồm) của kỳ. Mã sai định dạng → ném lỗi (lỗi dữ liệu, không im lặng). */
export function periodRange(period: ReportPeriod, key: PeriodKey): { start: string; end: string } {
  if (period === 'daily' && /^\d{4}-\d{2}-\d{2}$/.test(key)) return { start: key, end: key };
  if (period === 'monthly' && /^\d{4}-\d{2}$/.test(key)) {
    const [y, m] = key.split('-').map(Number);
    return { start: `${key}-01`, end: `${key}-${pad2(daysInMonth(y!, m!))}` };
  }
  const q = /^(\d{4})-Q([1-4])$/.exec(key);
  if (period === 'quarterly' && q) {
    const y = Number(q[1]);
    const first = (Number(q[2]) - 1) * 3 + 1;
    return { start: `${y}-${pad2(first)}-01`, end: `${y}-${pad2(first + 2)}-${pad2(daysInMonth(y, first + 2))}` };
  }
  if (period === 'yearly' && /^\d{4}$/.test(key)) return { start: `${key}-01-01`, end: `${key}-12-31` };
  throw new Error(`Mã kỳ không hợp lệ: ${period} ${key}`);
}

/** Ngày `day` nằm trong kỳ. */
export function periodContains(period: ReportPeriod, key: PeriodKey, day: string): boolean {
  const { start, end } = periodRange(period, key);
  const d = day.slice(0, 10);
  return d >= start && d <= end;
}

/** Nhãn kỳ: "24/06/2026" · "Tháng 06/2026" · "Quý 2/2026" · "Năm 2026". */
export function periodLabel(period: ReportPeriod, key: PeriodKey): string {
  switch (period) {
    case 'daily':
      return formatDayVi(key);
    case 'monthly':
      return `Tháng ${key.slice(5, 7)}/${key.slice(0, 4)}`;
    case 'quarterly':
      return `Quý ${key.slice(6)}/${key.slice(0, 4)}`;
    case 'yearly':
      return `Năm ${key}`;
  }
}

/**
 * Mã báo cáo: "BCVH-N-24062026" (theo ảnh) · "BCVH-T-062026" · "BCVH-Q-22026" · "BCVH-NAM-2026"
 * (ba dạng sau là GIẢ ĐỊNH – docs/questions.md).
 */
export function reportCode(period: ReportPeriod, key: PeriodKey): string {
  const p = PERIOD_CONFIG[period].codePrefix;
  switch (period) {
    case 'daily':
      return `${p}-${key.slice(8, 10)}${key.slice(5, 7)}${key.slice(0, 4)}`;
    case 'monthly':
      return `${p}-${key.slice(5, 7)}${key.slice(0, 4)}`;
    case 'quarterly':
      return `${p}-${key.slice(6)}${key.slice(0, 4)}`;
    case 'yearly':
      return `${p}-${key}`;
  }
}

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;

/** Thứ viết tắt của ngày: "T2" … "T7", "CN" (1/1/1970 là thứ Năm). */
export function weekdayVi(day: string): (typeof WEEKDAYS)[number] {
  return WEEKDAYS[(((dayNumber(day) + 4) % 7) + 7) % 7]!;
}

/** Chỉ số thứ (0 = CN … 6 = T7). */
export const weekdayIndex = (day: string) => (((dayNumber(day) + 4) % 7) + 7) % 7;
