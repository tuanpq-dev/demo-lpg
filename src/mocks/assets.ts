/**
 * Mock trang chi tiết tài sản (GĐ 5D, ảnh "Bồn LPG V-101" người dùng gửi – chưa có node Figma).
 * NGUỒN DUY NHẤT về thông số tĩnh của tài sản: kích thước bồn, áp suất định mức thiết kế, ngưỡng cảnh báo, tag.
 * Cảnh 3D `scenes/v-101.json` (kích thước) và `scenes/khu-bon-lpg.json` (ngưỡng V-101) phải khớp – có test
 * (`assets.test.ts`). Số liệu đo lấy từ nguồn trực tiếp (`useLiveData`), không nằm ở đây.
 */
import { V101_TAGS } from '@/features/live/tags';
import type { Thresholds } from '@/features/scene/types';
import type { TankDimensions, UpperLimits } from '@/features/tank/layers';

/** Loại sự kiện – đổi nhãn/màu ở `EVENT_TYPE_META` (src/data/assetDetail.ts). */
export type AssetEventType = 'sensor' | 'operation' | 'system' | 'alert';
export type AssetEventStatus = 'success' | 'done' | 'normal' | 'acknowledged';

export type AssetEvent = {
  id: string;
  /** Mã thiết bị. */
  asset: string;
  /** Số ngày trước hôm nay (0 = hôm nay) – thời điểm TƯƠNG ĐỐI như mock cảnh báo. */
  daysAgo: number;
  /** "HH:mm:ss" */
  time: string;
  title: string;
  type: AssetEventType;
  status: AssetEventStatus;
};

/**
 * Số chưa có định nghĩa/nguồn (chờ khách): hiển thị như ảnh, đánh dấu `isPlaceholder` để UI ghi chú và để tìm
 * lại khi nối API. Mỗi mục kèm `note` giải thích vì sao còn là số giả.
 */
export type PlaceholderValue<T> = { value: T; isPlaceholder: true; note: string };
const placeholder = <T,>(value: T, note: string): PlaceholderValue<T> => ({ value, isPlaceholder: true, note });

export type AssetMock = {
  id: string;
  name: string;
  /** Khu vực (breadcrumb). */
  area: string;
  /** Cảnh 3D chỉ có tài sản này (cột "Mô hình tài sản"). */
  sceneId: string;
  /** Cảnh bản đồ Tổng quan chứa tài sản ("Xem trên bản đồ"). */
  mapSceneId: string;
  /** Kích thước thân trụ (m) – nguồn cho mọi phép tính thể tích của trang. */
  tank: TankDimensions;
  /** Áp suất định mức THIẾT KẾ (bar) – thông số chế tạo, KHÔNG phải ngưỡng cảnh báo. */
  designPressure: number;
  /** Ngưỡng CẢNH BÁO vận hành (cùng nghĩa `Thresholds` của cảnh 3D). */
  alarms: { level: Thresholds; pressure: Thresholds; temperature: Thresholds; water: UpperLimits };
  tags: typeof V101_TAGS;
  /** Mã thiết bị/tag coi là "liên quan" (cảnh báo liên quan, sự kiện). */
  relatedDevices: readonly string[];
  placeholders: {
    volumeTrend1h: PlaceholderValue<number>;
    inventory: PlaceholderValue<number>;
    daysOfSupply: PlaceholderValue<number>;
    health: PlaceholderValue<number>;
    recordCompleteness: PlaceholderValue<number>;
  };
};

export const assetMocks: Record<string, AssetMock> = {
  'V-101': {
    id: 'V-101',
    name: 'Bồn LPG V-101',
    area: 'Khu bồn LPG',
    sceneId: 'v-101',
    mapSceneId: 'khu-bon-lpg',
    // Suy từ ảnh: 10,4 m³ = 76,2 % → dung tích ≈ 13,6 m³ (D 1,9 m × L 4,8 m = 13,61 m³). Cảnh Tổng quan vẽ V-101
    // to hơn (mặc định 4,4 × 11 m) – xem docs/figma-diffs.md.
    tank: { length: 4.8, diameter: 1.9 },
    designPressure: 12.0,
    alarms: {
      // Mức theo chiều cao (% đường kính) – khớp `thresholds.level` của khu-bon-lpg.json.
      level: { warn: 85, danger: 95, lowWarn: 15, lowDanger: 5 },
      pressure: { warn: 10.5, danger: 12 },
      temperature: { warn: 40, danger: 50 },
      // Nước đáy theo % thể tích (giả định, chờ khách).
      water: { warn: 3, danger: 5 },
    },
    tags: V101_TAGS,
    relatedDevices: ['V-101', 'PSV-101', ...Object.values(V101_TAGS)],
    placeholders: {
      volumeTrend1h: placeholder(0.2, 'Chưa có lịch sử 1 giờ của tag – số tĩnh theo ảnh.'),
      inventory: placeholder(152.0, 'Chưa rõ cách quy đổi tồn kho Nm³ của một bồn (khác KPI Tồn kho ở Tổng quan).'),
      daysOfSupply: placeholder(12, 'Chưa có công thức (tồn kho / tiêu thụ trung bình).'),
      health: placeholder(98, 'Chưa có mô hình chấm điểm sức khỏe thiết bị.'),
      recordCompleteness: placeholder(100, 'Chưa định nghĩa "Tình trạng hồ sơ" (hồ sơ kiểm định, bảo trì…).'),
    },
  },
};

/**
 * Sự kiện theo tài sản. 5 dòng đầu theo ảnh (V-101, hôm nay); phần sau bổ sung để thử bộ lọc theo loại.
 * Ảnh xếp "Đăng nhập hệ thống" vào loại Cảnh báo – giữ nguyên, chờ designer (docs/questions.md).
 */
export const assetEvents: AssetEvent[] = [
  { id: 'EV-0141', asset: 'V-101', daysAgo: 0, time: '11:24:05', title: 'Cập nhật mức bồn', type: 'sensor', status: 'success' },
  { id: 'EV-0140', asset: 'V-101', daysAgo: 0, time: '11:15:22', title: 'Kiểm tra thủ công', type: 'operation', status: 'done' },
  // Ảnh ghi "Tự chuẩn chẩn đoán" → chuẩn hoá "Tự chẩn đoán" (docs/figma-diffs.md).
  { id: 'EV-0139', asset: 'V-101', daysAgo: 0, time: '10:55:10', title: 'Tự chẩn đoán', type: 'system', status: 'normal' },
  { id: 'EV-0138', asset: 'V-101', daysAgo: 0, time: '10:42:00', title: 'Cảnh báo dPdT', type: 'alert', status: 'acknowledged' },
  { id: 'EV-0137', asset: 'V-101', daysAgo: 0, time: '09:30:15', title: 'Đăng nhập hệ thống', type: 'alert', status: 'acknowledged' },
  // ---- Bổ sung ----
  { id: 'EV-0136', asset: 'V-101', daysAgo: 0, time: '08:05:40', title: 'Bàn giao ca vận hành', type: 'operation', status: 'done' },
  { id: 'EV-0135', asset: 'V-101', daysAgo: 0, time: '07:12:09', title: 'Hiệu chuẩn tự động LT-101', type: 'sensor', status: 'success' },
  { id: 'EV-0134', asset: 'V-101', daysAgo: 0, time: '06:00:00', title: 'Báo cáo tồn kho đầu ca', type: 'system', status: 'normal' },
  { id: 'EV-0133', asset: 'V-101', daysAgo: 1, time: '22:18:33', title: 'Cảnh báo mức cao (High Level)', type: 'alert', status: 'acknowledged' },
  { id: 'EV-0132', asset: 'V-101', daysAgo: 1, time: '15:28:55', title: 'Van an toàn PSV-101 kích hoạt', type: 'alert', status: 'acknowledged' },
  { id: 'EV-0131', asset: 'V-101', daysAgo: 1, time: '14:40:00', title: 'Kiểm tra định kỳ thành công', type: 'operation', status: 'done' },
  { id: 'EV-0130', asset: 'V-102', daysAgo: 0, time: '10:01:12', title: 'Cập nhật mức bồn', type: 'sensor', status: 'success' },
];
