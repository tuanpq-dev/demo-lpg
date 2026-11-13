/*
 * Báo cáo vận hành định kỳ – dữ liệu mẫu SINH THEO NGÀY HIỆN TẠI (giờ nhà máy): mọi báo cáo từ 1/1 năm nay tới hôm nay.
 * Mở `/reports?now=2026-06-24T18:30` (dev) → gần với ảnh thiết kế: 175 báo cáo ngày (ảnh ghi 176), 6 tháng, 2 quý, 1 năm; KPI
 * Đang thực hiện 4 · Chờ xác nhận 6 (2/2/2) · Thiếu dữ liệu 8; "Tiến độ tháng 06" 19/24; dòng 18–24/06 như bảng trong ảnh.
 * (Ảnh ghi tổng 186 / ngày 176 / đã ký 168 – không khớp nhau; ở đây tính từ danh sách → 184 / 175 / 166. docs/figma-diffs.md.)
 */
import { dayNumber, plantDateTimeKey, plantDayKey } from '@/lib/plantTime';
import { pad2 } from '@/lib/number';
import {
  DAILY_CHECKPOINTS,
  dayFromNumber,
  daysInMonth,
  periodRange,
  reportCode,
  type ReportCheckpoint,
  type ReportPeriod,
  type ReportRecord,
  type SignatureStep,
  type StoredSignature,
} from '@/features/reports';

const REPORT_INSPECTORS = ['Nguyễn Văn A', 'Lê Thị B', 'Phạm Văn D'] as const;
const REPORT_APPROVERS = ['Trần Văn C', 'Hoàng Thị E'] as const;

/** Kịch bản theo số ngày LÙI từ hôm nay (0 = hôm nay). Ngày không có ở đây = đủ mốc + đã ký. */
const AWAITING: Record<number, SignatureStep | 'rejected'> = {
  1: 'approver',
  4: 'rejected',
  26: 'inspector',
  27: 'approver',
  28: 'tap',
  29: 'tap',
};
/** Mốc thiếu dữ liệu của các ngày đã qua. */
const MISSING: Record<number, readonly string[]> = {
  3: ['16:00', '18:00'],
  13: ['12:00'],
  31: ['08:00'],
  35: ['14:00', '16:00'],
  40: ['18:00'],
  44: ['10:00'],
  50: ['12:00', '14:00'],
};
/** Mốc hôm nay cần xác minh. */
const TODAY_VERIFY = '14:00';
/** Lý do trả lại của báo cáo "Bị trả lại" (khớp kịch bản GS-03 chưa ghi chú ở mocks/dailyReport.ts). */
const REJECT_REASON = 'Chưa ghi chú nồng độ khí GS-03 lúc 10:00 vượt ngưỡng cảnh báo.';
/** Nhận xét cuối ca mẫu – có ở mọi báo cáo ngày đã đủ mốc (màn nhập nhận xét chưa có thiết kế). */
const SHIFT_REMARKS = [
  'Hệ thống vận hành ổn định, không phát sinh sự cố. Mức bồn giảm theo tiêu thụ bình thường.',
  'Thiết bị hóa hơi E-101A chạy liên tục, E-101B dự phòng. Áp suất cấp ổn định.',
  'Đã kiểm tra đầu dò khí khu nạp xuất, không phát hiện rò rỉ. Bàn giao ca đầy đủ.',
] as const;

const mod = (n: number, m: number) => ((n % m) + m) % m;
/** Mốc xoay vòng người: 24/06/2026 → Nguyễn Văn A (như ảnh). */
const ROTATION_BASE = dayNumber('2026-06-24');

function addMinutes(dayTime: string, minutes: number): string {
  const [h, m] = dayTime.slice(11, 16).split(':').map(Number);
  const total = h! * 60 + m! + minutes;
  const dayShift = Math.floor(total / 1440);
  const day = dayShift ? dayFromNumber(dayNumber(dayTime) + dayShift) : dayTime.slice(0, 10);
  const t = mod(total, 1440);
  return `${day}T${pad2(Math.floor(t / 60))}:${pad2(t % 60)}`;
}

function dailyReport(day: string, back: number, nowKey: string): ReportRecord {
  const n = dayNumber(day) - ROTATION_BASE;
  const inspector = REPORT_INSPECTORS[mod(-n, 3)]!;
  const today = back === 0;
  const passed = DAILY_CHECKPOINTS.filter((t) => `${day}T${t}` <= nowKey);
  // Hôm nay: mốc vừa tới hạn gần nhất còn đang nhập (luôn có một "Thiếu mốc" để demo); các mốc trước đã có dữ liệu.
  const pendingToday = today ? passed[passed.length - 1] : undefined;
  const missing = MISSING[back] ?? [];
  const checkpoints: ReportCheckpoint[] = DAILY_CHECKPOINTS.map((t) => ({
    key: t,
    label: t,
    dueAt: `${day}T${t}`,
    done: today ? passed.includes(t) && t !== pendingToday : !missing.includes(t),
    ...(today && t === TODAY_VERIFY && passed.includes(t) && t !== pendingToday ? { needsVerify: true } : {}),
  }));
  const lastDone = [...checkpoints].reverse().find((c) => c.done);
  const step = AWAITING[back];
  const complete = !today && !missing.length;
  const signature: StoredSignature = !complete
    ? { status: 'not-sent' }
    : step === 'rejected'
      ? { status: 'rejected', reason: REJECT_REASON }
      : step
        ? { status: 'pending', step }
        : { status: 'signed' };
  const updatedAt = !complete
    ? addMinutes(lastDone?.dueAt ?? `${day}T08:00`, today ? 5 : 20)
    : addMinutes(`${dayFromNumber(dayNumber(day) + 1)}T08:30`, mod(n * 37, 180));
  return {
    id: reportCode('daily', day),
    code: reportCode('daily', day),
    period: 'daily',
    periodKey: day,
    shift: 'Ca 1',
    checkpoints,
    inspector,
    approver: complete ? REPORT_APPROVERS[mod(-n + 1, 2)] : undefined,
    signature,
    updatedAt,
    ...(complete ? { shiftRemark: SHIFT_REMARKS[mod(n, SHIFT_REMARKS.length)] } : {}),
  };
}

/** Báo cáo gộp (tháng/quý/năm): mỗi mốc = một kỳ con; mốc đạt khi mọi báo cáo con đủ dữ liệu. */
function rollupReport(
  period: Exclude<ReportPeriod, 'daily'>,
  key: string,
  parts: readonly { key: string; label: string; dueAt: string; done: boolean }[],
  nowDay: string,
): ReportRecord {
  const { end } = periodRange(period, key);
  const closed = nowDay > end;
  const complete = closed && parts.every((p) => p.done);
  return {
    id: reportCode(period, key),
    code: reportCode(period, key),
    period,
    periodKey: key,
    checkpoints: parts,
    inspector: REPORT_INSPECTORS[0],
    approver: complete ? REPORT_APPROVERS[0] : undefined,
    signature: complete ? { status: 'signed' } : { status: 'not-sent' },
    updatedAt: closed ? `${dayFromNumber(dayNumber(end) + 1)}T10:00` : `${nowDay}T07:00`,
  };
}

export function buildReports(now: Date): ReportRecord[] {
  const nowKey = plantDateTimeKey(now);
  const today = plantDayKey(now);
  const year = Number(today.slice(0, 4));
  const first = dayNumber(`${year}-01-01`);
  const last = dayNumber(today);

  const daily: ReportRecord[] = [];
  for (let d = last; d >= first; d--) daily.push(dailyReport(dayFromNumber(d), last - d, nowKey));
  const dailyByDay = new Map(daily.map((r) => [r.periodKey, r]));
  const dayComplete = (day: string) => {
    const r = dailyByDay.get(day);
    return !!r && r.checkpoints.every((c) => c.done);
  };

  const curMonth = Number(today.slice(5, 7));
  const months: ReportRecord[] = [];
  const monthDone = new Map<number, boolean>();
  for (let m = curMonth; m >= 1; m--) {
    const key = `${year}-${pad2(m)}`;
    const parts = Array.from({ length: daysInMonth(year, m) }, (_, i) => {
      const day = `${key}-${pad2(i + 1)}`;
      return { key: day, label: `${pad2(i + 1)}/${pad2(m)}`, dueAt: `${day}T23:59`, done: day <= today && dayComplete(day) };
    });
    const r = rollupReport('monthly', key, parts, today);
    monthDone.set(m, r.checkpoints.every((c) => c.done) && today > periodRange('monthly', key).end);
    months.push(r);
  }

  const curQuarter = Math.ceil(curMonth / 3);
  const quarters: ReportRecord[] = [];
  const quarterDone = new Map<number, boolean>();
  for (let q = curQuarter; q >= 1; q--) {
    const key = `${year}-Q${q}`;
    const parts = [1, 2, 3].map((i) => {
      const m = (q - 1) * 3 + i;
      return {
        key: `${year}-${pad2(m)}`,
        label: `Tháng ${pad2(m)}`,
        dueAt: `${year}-${pad2(m)}-${pad2(daysInMonth(year, m))}T23:59`,
        done: !!monthDone.get(m),
      };
    });
    const r = rollupReport('quarterly', key, parts, today);
    quarterDone.set(q, r.checkpoints.every((c) => c.done) && today > periodRange('quarterly', key).end);
    quarters.push(r);
  }

  const yearParts = [1, 2, 3, 4].map((q) => ({
    key: `${year}-Q${q}`,
    label: `Quý ${q}`,
    dueAt: `${periodRange('quarterly', `${year}-Q${q}`).end}T23:59`,
    done: !!quarterDone.get(q),
  }));
  const yearly = rollupReport('yearly', String(year), yearParts, today);

  return [...daily, ...months, ...quarters, yearly];
}
