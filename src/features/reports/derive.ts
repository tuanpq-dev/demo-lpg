/*
 * Số liệu suy dẫn của màn báo cáo – mọi số tính từ CÙNG một danh sách báo cáo (không số tĩnh), nhận `now`.
 */
import { dayNumber, plantDateTimeKey, plantDayKey } from '@/lib/plantTime';
import { pad2 } from '@/lib/number';
import { dayFromNumber, daysInMonth, quarterOf, weekdayIndex } from './period';
import { SIGNATURE_STEPS, awaitingStep, missingCheckpoints, reportState, type ReportRecord, type ReportState, type SignatureStep } from './status';

export type ReportKpis = { total: number } & Record<ReportState, number>;

export function deriveReportKpis(rows: readonly ReportRecord[], now: Date): ReportKpis {
  const out: ReportKpis = { total: rows.length, 'in-progress': 0, 'missing-data': 0, awaiting: 0, signed: 0 };
  for (const r of rows) out[reportState(r, now)] += 1;
  return out;
}

/** "Chờ xác nhận": số báo cáo đang chờ từng bước ký (tổng = KPI Chờ xác nhận). */
export function deriveAwaitingByStep(rows: readonly ReportRecord[], now: Date): Record<SignatureStep, number> {
  const out = Object.fromEntries(SIGNATURE_STEPS.map((s) => [s, 0])) as Record<SignatureStep, number>;
  for (const r of rows) {
    const s = awaitingStep(r, now);
    if (s) out[s] += 1;
  }
  return out;
}

export type MonthProgress = {
  /** "06" */
  month: string;
  /** Số báo cáo ngày của tháng tới hôm nay (= số ngày đã qua, gồm hôm nay). */
  total: number;
  /** Đã ký đầy đủ. */
  done: number;
  inProgress: number;
  missing: number;
  awaiting: number;
};

/** Thẻ "Tiến độ tháng MM": báo cáo NGÀY của tháng hiện tại (giờ nhà máy). */
export function deriveMonthProgress(rows: readonly ReportRecord[], now: Date): MonthProgress {
  const today = plantDayKey(now);
  const month = today.slice(0, 7);
  const out: MonthProgress = { month: today.slice(5, 7), total: 0, done: 0, inProgress: 0, missing: 0, awaiting: 0 };
  for (const r of rows) {
    if (r.period !== 'daily' || !r.periodKey.startsWith(month) || r.periodKey > today) continue;
    out.total += 1;
    const s = reportState(r, now);
    if (s === 'signed') out.done += 1;
    else if (s === 'in-progress') out.inProgress += 1;
    else if (s === 'missing-data') out.missing += 1;
    else out.awaiting += 1;
  }
  return out;
}

// ---- Lịch hạn nộp sắp tới

export type DeadlineKind = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

/**
 * Quy tắc hạn nộp (GIẢ ĐỊNH theo ảnh "Lịch báo cáo sắp tới": tuần – thứ Sáu 17:00, tháng – ngày cuối tháng 12:00,
 * quý – ngày cuối quý 17:00; năm – 31/12 17:00). Chờ khách xác nhận (docs/questions.md).
 */
const DEADLINE_RULES: Record<DeadlineKind, { time: string }> = {
  weekly: { time: '17:00' },
  monthly: { time: '12:00' },
  quarterly: { time: '17:00' },
  yearly: { time: '17:00' },
};

export type UpcomingDeadline = {
  id: string;
  kind: DeadlineKind;
  /** "yyyy-mm-dd" */
  day: string;
  /** "HH:mm" */
  time: string;
  title: string;
};

function nextDeadline(kind: DeadlineKind, now: Date): UpcomingDeadline {
  const t = plantDateTimeKey(now);
  const today = t.slice(0, 10);
  const { time } = DEADLINE_RULES[kind];
  const passed = (day: string) => `${day}T${time}` < t;
  let y = Number(today.slice(0, 4));
  let m = Number(today.slice(5, 7));

  if (kind === 'weekly') {
    // Thứ Sáu gần nhất từ hôm nay (đã qua giờ hạn → tuần sau).
    let n = dayNumber(today) + ((5 - weekdayIndex(today) + 7) % 7);
    if (passed(dayFromNumber(n))) n += 7;
    const day = dayFromNumber(n);
    const week = Math.ceil(Number(day.slice(8, 10)) / 7);
    return { id: `weekly-${day}`, kind, day, time, title: `Báo cáo tuần ${week} - Tháng ${Number(day.slice(5, 7))}` };
  }
  if (kind === 'monthly') {
    let day = `${y}-${pad2(m)}-${pad2(daysInMonth(y, m))}`;
    if (passed(day)) {
      m = m === 12 ? 1 : m + 1;
      y = m === 1 ? y + 1 : y;
      day = `${y}-${pad2(m)}-${pad2(daysInMonth(y, m))}`;
    }
    return { id: `monthly-${day}`, kind, day, time, title: `Báo cáo tháng ${m}` };
  }
  if (kind === 'quarterly') {
    let q = quarterOf(m);
    let day = `${y}-${pad2(q * 3)}-${pad2(daysInMonth(y, q * 3))}`;
    if (passed(day)) {
      q = q === 4 ? 1 : q + 1;
      y = q === 1 ? y + 1 : y;
      day = `${y}-${pad2(q * 3)}-${pad2(daysInMonth(y, q * 3))}`;
    }
    return { id: `quarterly-${day}`, kind, day, time, title: `Báo cáo quý ${q}` };
  }
  let day = `${y}-12-31`;
  if (passed(day)) day = `${y + 1}-12-31`;
  return { id: `yearly-${day}`, kind, day, time, title: `Báo cáo năm ${day.slice(0, 4)}` };
}

/** `limit` hạn nộp gần nhất (theo ngày rồi giờ; cùng lúc → tuần, tháng, quý, năm). */
export function deriveUpcomingDeadlines(now: Date, limit = 3): UpcomingDeadline[] {
  const order: DeadlineKind[] = ['weekly', 'monthly', 'quarterly', 'yearly'];
  return order
    .map((k) => nextDeadline(k, now))
    .sort((a, b) => `${a.day}T${a.time}`.localeCompare(`${b.day}T${b.time}`) || order.indexOf(a.kind) - order.indexOf(b.kind))
    .slice(0, limit);
}

// ---- Cần xử lý hôm nay

export type ReportActionItem = {
  id: string;
  reportId: string;
  /** Mã báo cáo – "Xử lý ngay" lọc bảng theo mã (trang không giữ cả danh sách). */
  reportCode: string;
  tone: 'danger' | 'warning';
  /** Phần đậm: mã báo cáo hoặc "Dữ liệu 14:00". */
  subject: string;
  message: string;
};

/**
 * Việc cần xử lý: (1) báo cáo HÔM NAY có mốc đã tới hạn chưa nhập → "Thiếu mốc 18:00" (danger);
 * (2) báo cáo bị trả lại (mới nhất trước) → "Bị trả lại" (danger); (3) mốc hôm nay cần xác minh (warning).
 */
export function deriveTodayActions(rows: readonly ReportRecord[], now: Date): ReportActionItem[] {
  const today = plantDayKey(now);
  const todays = rows.filter((r) => r.period === 'daily' && r.periodKey === today);
  const out: ReportActionItem[] = [];
  for (const r of todays) {
    const miss = missingCheckpoints(r, now);
    if (miss.length) {
      out.push({
        id: `${r.id}-missing`,
        reportId: r.id,
        reportCode: r.code,
        tone: 'danger',
        subject: r.code,
        message: `Thiếu mốc ${miss.map((c) => c.label).join(', ')}`,
      });
    }
  }
  rows
    .filter((r) => reportState(r, now) === 'awaiting' && r.signature.status === 'rejected')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .forEach((r) => out.push({ id: `${r.id}-rejected`, reportId: r.id, reportCode: r.code, tone: 'danger', subject: r.code, message: 'Bị trả lại' }));
  for (const r of todays) {
    r.checkpoints
      .filter((c) => c.done && c.needsVerify)
      .forEach((c) =>
        out.push({
          id: `${r.id}-verify-${c.key}`,
          reportId: r.id,
          reportCode: r.code,
          tone: 'warning',
          subject: `Dữ liệu ${c.label}`,
          message: 'Cần xác minh',
        }),
      );
  }
  return out;
}
