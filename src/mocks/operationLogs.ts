/*
 * Nhật ký vận hành – sự kiện GIẢ LẬP (vận hành, thao tác người dùng, kết nối thiết bị) sinh xác định theo ngày giờ nhà máy.
 * Cảnh báo KHÔNG sinh ở đây: lấy từ store cảnh báo chung (`alertToLogEvent`) để khớp Trung tâm cảnh báo.
 *
 * - Mỗi ngày 144 khe 10 phút; mỗi khe có/không có sự kiện + mẫu sự kiện chọn bằng số giả ngẫu nhiên theo (ngày, khe) →
 *   F5 / qua phút mới không đổi sự kiện cũ, chỉ thêm khe mới. Hôm nay chỉ tới `now`.
 * - Kịch bản cố định (lùi theo phút từ `now`): 2 thiết bị mất kết nối chưa xử lý (FT-102, TT-305 – không có tag trực tiếp
 *   nên không mâu thuẫn số đo trên Tổng quan), 1 sự kiện "Đang theo dõi" mới.
 * TODO(backend): GET /operation-logs?from=&to= (docs/decisions.md – "Nhật ký vận hành – hợp đồng API cần bổ sung").
 */
import type { LogCategory, LogLevel, LogStatus, OperationLogEvent } from '@/features/operations/logs';
import { shiftDayKey } from '@/features/operations/logs';
import { dayNumber, parsePlantDateTime, plantDayKey } from '@/lib/plantTime';

type Template = {
  category: LogCategory;
  level: LogLevel;
  title: string;
  area: string;
  device: string;
  /** Trạng thái khi sự kiện đã cũ; `recentStatus` = trạng thái trong `RECENT_MIN` phút gần nhất (vd còn đang theo dõi). */
  status: LogStatus;
  recentStatus?: LogStatus;
  /** Thao tác người dùng – tiêu đề kèm tên người ("… – Lê Thị C"). */
  withActor?: boolean;
  weight: number;
};

const RECENT_MIN = 120;
const CONTROL_ROOM = 'Phòng điều khiển';

/** Người thao tác (cùng danh sách nhân sự mock của Bảo trì/Cảnh báo). */
const LOG_ACTORS = ['Nguyễn Văn A', 'Trần Văn B', 'Lê Thị C', 'Phạm Văn D', 'Admin'] as const;

/** Mẫu sự kiện – khu vực theo danh sách chung `features/plant/areas.ts` (+ Phòng điều khiển cho thao tác trên HMI). */
const TEMPLATES: readonly Template[] = [
  // ---- Vận hành (~70 %) ----
  { category: 'operation', level: 'info', title: 'Khởi động Bơm P-101A', area: 'Khu bơm', device: 'P-101A', status: 'done', weight: 6 },
  { category: 'operation', level: 'info', title: 'Dừng Bơm P-101A theo lịch', area: 'Khu bơm', device: 'P-101A', status: 'done', weight: 5 },
  { category: 'operation', level: 'info', title: 'Bơm P-101B chuyển sang Standby', area: 'Khu bơm', device: 'P-101B', status: 'done', weight: 3 },
  {
    category: 'operation',
    level: 'info',
    title: 'Ghi nhận mức bồn V-101 định kỳ',
    area: 'Khu bồn LPG',
    device: 'V-101 LI',
    status: 'recorded',
    weight: 8,
  },
  {
    category: 'operation',
    level: 'info',
    title: 'Ghi nhận mức bồn V-102 định kỳ',
    area: 'Khu bồn LPG',
    device: 'V-102 LI',
    status: 'recorded',
    weight: 6,
  },
  {
    category: 'operation',
    level: 'info',
    title: 'Ghi nhận áp suất bồn V-101 định kỳ',
    area: 'Khu bồn LPG',
    device: 'PT-101',
    status: 'recorded',
    weight: 6,
  },
  {
    category: 'operation',
    level: 'info',
    title: 'Máy hóa hơi E-101A chạy chính, E-101B dự phòng',
    area: 'Trạm hóa hơi',
    device: 'E-101A',
    status: 'recorded',
    weight: 4,
  },
  {
    category: 'operation',
    level: 'info',
    title: 'Điều chỉnh áp suất ra trạm điều áp PR-101',
    area: 'Trạm hóa hơi',
    device: 'PR-101',
    status: 'done',
    weight: 3,
  },
  {
    category: 'operation',
    level: 'info',
    title: 'Bắt đầu nạp xe bồn tại họng nạp số 1',
    area: 'Khu nạp xuất',
    device: 'LA-01',
    status: 'done',
    weight: 5,
  },
  {
    category: 'operation',
    level: 'info',
    title: 'Hoàn tất nạp xe bồn tại họng nạp số 1',
    area: 'Khu nạp xuất',
    device: 'LA-01',
    status: 'done',
    weight: 5,
  },
  { category: 'operation', level: 'info', title: 'Mở van cấp tuyến chính XV-101', area: 'Tuyến chính', device: 'XV-101', status: 'done', weight: 3 },
  {
    category: 'operation',
    level: 'info',
    title: 'Đóng van cấp tuyến chính XV-101',
    area: 'Tuyến chính',
    device: 'XV-101',
    status: 'done',
    weight: 2,
  },
  {
    category: 'operation',
    level: 'medium',
    title: 'Chênh áp bộ lọc F-201 tăng gần ngưỡng',
    area: 'Khu Lọc',
    device: 'F-201 DP',
    status: 'done',
    recentStatus: 'monitoring',
    weight: 3,
  },
  {
    category: 'operation',
    level: 'medium',
    title: 'Lưu lượng tuyến chính dao động',
    area: 'Tuyến chính',
    device: 'FT-101',
    status: 'done',
    recentStatus: 'monitoring',
    weight: 2,
  },
  {
    category: 'operation',
    level: 'medium',
    title: 'Nhiệt độ ra E-101A dưới mức vận hành tối ưu',
    area: 'Trạm hóa hơi',
    device: 'TT-201',
    status: 'done',
    recentStatus: 'monitoring',
    weight: 2,
  },
  // ---- Thao tác người dùng (~25 %) ----
  {
    category: 'user-action',
    level: 'info',
    title: 'Đăng nhập hệ thống',
    area: CONTROL_ROOM,
    device: 'HMI-01',
    status: 'recorded',
    withActor: true,
    weight: 6,
  },
  {
    category: 'user-action',
    level: 'info',
    title: 'Xác nhận giao ca vận hành',
    area: CONTROL_ROOM,
    device: 'HMI-01',
    status: 'done',
    withActor: true,
    weight: 2,
  },
  {
    category: 'user-action',
    level: 'info',
    title: 'Ghi nhận mốc kiểm tra báo cáo ngày',
    area: CONTROL_ROOM,
    device: 'HMI-01',
    status: 'done',
    withActor: true,
    weight: 4,
  },
  {
    category: 'user-action',
    level: 'info',
    title: 'Xuất báo cáo vận hành',
    area: CONTROL_ROOM,
    device: 'HMI-02',
    status: 'done',
    withActor: true,
    weight: 3,
  },
  {
    category: 'user-action',
    level: 'medium',
    title: 'Thay đổi điểm đặt áp suất PR-101',
    area: 'Trạm hóa hơi',
    device: 'PR-101',
    status: 'done',
    withActor: true,
    weight: 2,
  },
  {
    category: 'user-action',
    level: 'info',
    title: 'Điều khiển từ xa: khởi động Bơm P-101B',
    area: 'Khu bơm',
    device: 'P-101B',
    status: 'done',
    withActor: true,
    weight: 2,
  },
  // ---- Kết nối thiết bị (~5 %) – sự kiện cũ đã khôi phục ----
  {
    category: 'connection',
    level: 'high',
    title: 'Mất kết nối cảm biến khí GS-06',
    area: 'Khu nạp xuất',
    device: 'GS-06',
    status: 'done',
    weight: 1,
  },
  {
    category: 'connection',
    level: 'info',
    title: 'Khôi phục kết nối PLC-01 ↔ SCADA',
    area: CONTROL_ROOM,
    device: 'PLC-01',
    status: 'done',
    weight: 1,
  },
  {
    category: 'connection',
    level: 'medium',
    title: 'Độ trễ truyền thông PLC-01 tăng',
    area: CONTROL_ROOM,
    device: 'PLC-01',
    status: 'done',
    weight: 1,
  },
];

const TOTAL_WEIGHT = TEMPLATES.reduce((s, t) => s + t.weight, 0);

/** Kịch bản cố định so với `now` (phút trước). */
const SCENARIO: readonly (Omit<Template, 'weight' | 'recentStatus'> & { minutesAgo: number; actor?: string })[] = [
  {
    minutesAgo: 24,
    category: 'connection',
    level: 'high',
    title: 'Mất tín hiệu Lưu lượng kế FT-102',
    area: 'Tuyến chính',
    device: 'FT-102',
    status: 'open',
  },
  {
    minutesAgo: 95,
    category: 'connection',
    level: 'high',
    title: 'Mất kết nối cảm biến nhiệt độ TT-305',
    area: 'Khu bơm',
    device: 'TT-305',
    status: 'open',
  },
  {
    minutesAgo: 7,
    category: 'operation',
    level: 'medium',
    title: 'Chênh áp bộ lọc F-202 tăng gần ngưỡng',
    area: 'Khu Lọc',
    device: 'F-202 DP',
    status: 'monitoring',
  },
];

/** PRNG xác định (mulberry32) – cùng seed → cùng dãy. */
function rand(seed: number) {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** Sự kiện của một khe 10 phút (hoặc null). */
function slotEvent(day: string, slot: number, now: Date): OperationLogEvent | null {
  const base = dayNumber(day) * 1000 + slot * 7;
  if (rand(base) > 0.78) return null;
  let pick = rand(base + 1) * TOTAL_WEIGHT;
  const t = TEMPLATES.find((x) => (pick -= x.weight) < 0) ?? TEMPLATES[0]!;
  const sec = Math.floor(rand(base + 2) * 600);
  const at = parsePlantDateTime(`${day}T${pad(Math.floor(slot / 6))}:${pad((slot % 6) * 10 + Math.floor(sec / 60))}:${pad(sec % 60)}`)!;
  if (at.getTime() > now.getTime()) return null;
  const actor = t.withActor ? LOG_ACTORS[Math.floor(rand(base + 3) * LOG_ACTORS.length)] : undefined;
  const recent = now.getTime() - at.getTime() <= RECENT_MIN * 60_000;
  return {
    id: `${day}-${pad(slot, 3)}`,
    code: `EV-${day.slice(8, 10)}${day.slice(5, 7)}-${pad(slot, 3)}`,
    at: at.toISOString(),
    category: t.category,
    level: t.level,
    title: actor ? `${t.title} – ${actor}` : t.title,
    area: t.area,
    device: t.device,
    status: recent && t.recentStatus ? t.recentStatus : t.status,
    actor,
  };
}

/** Sự kiện `days` ngày gần nhất (gồm hôm nay tới `now`), chưa sắp xếp. */
export function buildOperationLogs(now: Date, days = 31): OperationLogEvent[] {
  const today = plantDayKey(now);
  const out: OperationLogEvent[] = [];
  for (let d = days - 1; d >= 0; d--) {
    const day = shiftDayKey(today, -d);
    for (let slot = 0; slot < 144; slot++) {
      const e = slotEvent(day, slot, now);
      if (e) out.push(e);
    }
  }
  SCENARIO.forEach(({ minutesAgo, ...s }, i) => {
    const at = new Date(now.getTime() - minutesAgo * 60_000);
    const day = plantDayKey(at);
    out.push({ ...s, id: `scenario-${i}`, code: `EV-${day.slice(8, 10)}${day.slice(5, 7)}-${900 + i}`, at: at.toISOString() });
  });
  return out;
}
