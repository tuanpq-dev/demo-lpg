/*
 * Hạn chót – thuần, `now` truyền vào. Hạn lưu "yyyy-mm-ddTHH:mm" theo giờ nhà máy (Asia/Bangkok).
 *
 * MỘT quy tắc quá hạn cho cả app (danh sách, KPI, thẻ ưu tiên, lịch, trang chi tiết, tóm tắt ở trang tài sản):
 *   quá hạn ⇔ now ≥ thời điểm hạn  (đúng 16:00:00 với hạn 16:00 là đã quá hạn).
 * Hạn chỉ có ngày (chuỗi "yyyy-mm-dd" hoặc cờ `hasTime = false` – `MaintenanceRecord.dueHasTime`) = hết ngày 23:59:59.
 * Hạn có giờ thật 23:59 vẫn là 23:59:00 – phân biệt bằng cờ, không so chuỗi.
 */
import { daysFromToday, parsePlantDateTime } from '@/lib/plantTime';

export type DeadlineCountdown = {
  /** Hạn − now (ms); âm = đã quá hạn. */
  remainingMs: number;
  overdue: boolean;
  /** "04:15:00" / "1 ngày 04:15:00" – độ dài |còn lại| (quá hạn: thời gian đã quá). */
  clock: string;
  /** Câu cho trình đọc màn hình, độ phân giải phút: "Còn 4 giờ 15 phút" / "Quá hạn 1 giờ 5 phút". */
  speech: string;
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Độ dài → "HH:MM:SS" (≥ 24 giờ: "N ngày HH:MM:SS"). Làm tròn xuống tới giây. */
function formatClock(ms: number): string {
  const total = Math.floor(Math.abs(ms) / 1000);
  const days = Math.floor(total / 86_400);
  const h = Math.floor((total % 86_400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const hms = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return days ? `${days} ngày ${hms}` : hms;
}

/** Độ dài → "4 giờ 15 phút" (độ phân giải phút, bỏ phần bằng 0; < 1 phút → "dưới 1 phút"). */
function speakDuration(ms: number): string {
  const totalMin = Math.floor(Math.abs(ms) / 60_000);
  if (totalMin === 0) return 'dưới 1 phút';
  const days = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  return [days && `${days} ngày`, h && `${h} giờ`, m && `${m} phút`].filter(Boolean).join(' ');
}

/**
 * Thời điểm hạn. Chỉ có ngày (chuỗi "yyyy-mm-dd" hoặc `hasTime = false`) → 23:59:59 ngày đó; ngược lại đúng giờ ghi.
 * Sai định dạng → null.
 */
export function dueInstant(dueAt: string, hasTime = true): Date | null {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dueAt);
  if (dateOnly || !hasTime) return parsePlantDateTime(`${dueAt.slice(0, 10)}T23:59:59`);
  return parsePlantDateTime(dueAt);
}

/** Đã tới / qua giờ hạn (now ≥ hạn). Hạn sai định dạng → false. */
export function isPastDue(dueAt: string, now: Date, hasTime = true): boolean {
  const due = dueInstant(dueAt, hasTime);
  return !!due && now.getTime() >= due.getTime();
}

/** Đếm ngược tới hạn. Hạn sai định dạng → null. Đúng mốc hạn (0 ms) = đã quá hạn; quá hạn thì đếm lên. */
export function deadlineCountdown(dueAt: string, now: Date, hasTime = true): DeadlineCountdown | null {
  const due = dueInstant(dueAt, hasTime);
  if (!due) return null;
  const remainingMs = due.getTime() - now.getTime();
  const overdue = remainingMs <= 0;
  return {
    remainingMs,
    overdue,
    clock: formatClock(remainingMs),
    speech: `${overdue ? 'Quá hạn' : 'Còn'} ${speakDuration(remainingMs)}`,
  };
}

/**
 * "16:00 Hôm nay" · "16:00 Ngày mai" · "16:00 Hôm qua" · "16:00 20/10/2026" (ngày theo giờ nhà máy).
 * Hạn chỉ có ngày → "Cuối ngày Hôm nay"…
 */
export function deadlineDayLabel(dueAt: string, now: Date, hasTime = true): string {
  const time = hasTime && dueAt.length > 10 ? dueAt.slice(11, 16) : 'Cuối ngày';
  const d = daysFromToday(dueAt, now);
  if (d === 0) return `${time} Hôm nay`;
  if (d === 1) return `${time} Ngày mai`;
  if (d === -1) return `${time} Hôm qua`;
  const [y, m, day] = dueAt.slice(0, 10).split('-');
  return `${time} ${day}/${m}/${y}`;
}
