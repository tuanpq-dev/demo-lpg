import { VAPORIZER_AREA_TAGS, VAPORIZER_TAGS } from '@/features/live/tags';
import type { Area } from './areas';

/**
 * Màn Vận hành – chi tiết thiết bị (ảnh `scratch/figma-ref/op-device-*.png`, chưa có node Figma).
 * Cấu hình TĨNH của thiết bị: tham số + ngưỡng, tín hiệu PLC, nhật ký mẫu. Số đo lấy từ tag trực tiếp (`features/live/tags.ts`),
 * cảnh báo / bảo trì lấy từ store chung – không chép số của ảnh vào đây.
 * TODO(backend): `GET /api/devices/:id` (cấu hình + ngưỡng), `GET /api/tags/history` (xu hướng), `GET /api/devices/:id/logs`.
 */

/**
 * Ngưỡng một tham số: `lowWarn`/`warn` = biên dưới/trên của khoảng cho phép (chạm biên = cảnh báo, như `fieldStatus`),
 * `lowDanger`/`danger` = nguy hiểm.
 */
export type ParamLimits = { lowDanger?: number; lowWarn?: number; warn?: number; danger?: number };

export type DeviceParamId = 'inletTemperature' | 'outletTemperature' | 'inletPressure' | 'outletPressure' | 'efficiency' | 'outletFlow';

export type DeviceParam = {
  id: DeviceParamId;
  /** Tên trong bảng "Thông số vận hành chi tiết". */
  label: string;
  tag: string;
  unit: string;
  /** Số chữ số thập phân khi hiển thị giá trị. */
  digits: number;
  /** Số chữ số thập phân của cột "Ngưỡng cảnh báo" ("0 - 35", "2.0 - 6.0"). */
  limitDigits: number;
  limits: ParamLimits;
  /** Nhãn khi trong ngưỡng – theo ảnh: nhiệt độ "Bình thường", áp suất "Ổn định", hiệu suất "Tốt", không ngưỡng "Theo dõi". */
  okLabel: string;
  /** Màu nhãn khi trong ngưỡng; "Theo dõi" (không có ngưỡng) vàng như ảnh. */
  okTone: 'success' | 'warning';
};

export type PlcSignal = { id: string; label: string; /** Địa chỉ/tên biến trên PLC (ảnh). */ address: string; tag: string };

/** Một dòng nhật ký: `minutesAgo` so với lúc mở trang (mốc tương đối – giờ hiển thị tính từ `now`). */
export type OperationLogEntry = { id: string; minutesAgo: number; text: string };

export type OperationDeviceMock = {
  id: string;
  /** "Máy hóa hơi LPG" – ô "Tên" ở header. */
  name: string;
  /** Tiêu đề trong sơ đồ. */
  diagramTitle: string;
  area: Area;
  /** Tag trạng thái chạy ('running' | 'standby' | 'fault' | 'stopped'). */
  stateTag: string;
  /** Máy dự phòng. */
  standby: { id: string; stateTag: string };
  /** Thiết bị / tag dùng để lọc "Cảnh báo liên quan" và đếm cảnh báo nghiêm trọng. */
  relatedDevices: readonly string[];
  params: readonly DeviceParam[];
  /** 4 KPI đầu trang. */
  kpi: { temperature: DeviceParamId; pressure: DeviceParamId; efficiency: DeviceParamId };
  /** "Xu hướng vận hành": hai tham số + thang đo (chọn để hai đường không chồng nhau, như ảnh). */
  trend: {
    minutes: number;
    temperature: { param: DeviceParamId; domain: [number, number]; amplitude: number };
    pressure: { param: DeviceParamId; domain: [number, number]; amplitude: number };
  };
  plcSignals: readonly PlcSignal[];
  /** "Chế độ vận hành" – SỐ TẠM (chưa có tag chế độ điều khiển). */
  controlMode: { value: string; note: string };
  /** Phạm vi bảo dưỡng định kỳ ("Hạng mục chi tiết") – SỐ TẠM, chờ kế hoạch bảo trì từ API. */
  maintenanceScope: readonly string[];
  log: readonly OperationLogEntry[];
};

const T = VAPORIZER_TAGS;

export const operationDevices: Record<string, OperationDeviceMock> = {
  'E-101A': {
    id: 'E-101A',
    name: 'Máy hóa hơi LPG',
    diagramTitle: 'MÁY HÓA HƠI E-101A',
    // Ảnh ghi "Khu hóa hơi" – dùng tên khu chung (AREAS) như Cảnh báo/Bảo trì (docs/figma-diffs.md).
    area: 'Trạm hóa hơi',
    stateTag: VAPORIZER_AREA_TAGS.runA,
    standby: { id: 'E-101B', stateTag: VAPORIZER_AREA_TAGS.runB },
    relatedDevices: ['E-101A', T.temperature, T.inletPressure, T.inletTemperature, T.outletPressure, T.efficiency, T.outletFlow],
    params: [
      { id: 'inletTemperature', label: 'Nhiệt độ vào', tag: T.inletTemperature, unit: '°C', digits: 1, limitDigits: 0, limits: { lowWarn: 0, warn: 35 }, okLabel: 'Bình thường', okTone: 'success' },
      // Ảnh "< 75"; thêm biên dưới 50 °C = ngưỡng của cảnh báo ALT-00126 "Nhiệt độ máy hóa hơi thấp" (một nguồn ngưỡng).
      { id: 'outletTemperature', label: 'Nhiệt độ ra', tag: T.temperature, unit: '°C', digits: 1, limitDigits: 0, limits: { lowWarn: 50, warn: 75 }, okLabel: 'Bình thường', okTone: 'success' },
      // Ngưỡng trên 5 / nguy hiểm 6 bar = binding PT-201 trong cảnh 3D khu-bon-lpg (ảnh ghi "2.0 - 6.0").
      { id: 'inletPressure', label: 'Áp suất vào', tag: T.inletPressure, unit: 'bar', digits: 1, limitDigits: 1, limits: { lowWarn: 2, warn: 5, danger: 6 }, okLabel: 'Ổn định', okTone: 'success' },
      // Ngưỡng trên 5 / nguy hiểm 6 bar = binding PT-202 (C-101) trong cảnh 3D + đường "Ngưỡng áp suất cao 5.0" của biểu đồ ảnh
      // (bảng trong ảnh ghi "2.0 - 4.5" – lệch với biểu đồ, docs/figma-diffs.md).
      { id: 'outletPressure', label: 'Áp suất ra', tag: T.outletPressure, unit: 'bar', digits: 1, limitDigits: 1, limits: { lowWarn: 2, warn: 5, danger: 6 }, okLabel: 'Ổn định', okTone: 'success' },
      { id: 'efficiency', label: 'Hiệu suất', tag: T.efficiency, unit: '%', digits: 0, limitDigits: 0, limits: { lowWarn: 85 }, okLabel: 'Tốt', okTone: 'success' },
      { id: 'outletFlow', label: 'Lưu lượng khí ra', tag: T.outletFlow, unit: 'm³/h', digits: 1, limitDigits: 0, limits: {}, okLabel: 'Theo dõi', okTone: 'warning' },
    ],
    kpi: { temperature: 'outletTemperature', pressure: 'outletPressure', efficiency: 'efficiency' },
    trend: {
      minutes: 60,
      temperature: { param: 'outletTemperature', domain: [10, 100], amplitude: 2.2 },
      pressure: { param: 'outletPressure', domain: [3, 11], amplitude: 0.15 },
    },
    plcSignals: [
      { id: 'temp', label: 'Nhiệt độ đầu ra', address: 'Vaporizer_Outlet_Temp', tag: T.temperature },
      { id: 'pressure', label: 'Áp suất đầu ra', address: 'Vaporizer_Outlet_Pressure', tag: T.outletPressure },
      { id: 'flow', label: 'Lưu lượng hơi', address: 'Steam_Flow_Rate_AI', tag: T.outletFlow },
    ],
    controlMode: { value: 'SCADA từ xa', note: 'Số tạm – chưa có tag chế độ điều khiển (tại chỗ / SCADA).' },
    maintenanceScope: ['Kiểm tra bộ gia nhiệt E-101A', 'Hiệu chuẩn cảm biến nhiệt độ/áp suất', 'Vệ sinh đường ống LPG lỏng'],
    log: [
      { id: 'l1', minutesAgo: 1, text: 'Cập nhật thông số vận hành (Real-time)' },
      { id: 'l2', minutesAgo: 19, text: 'Hệ thống tự động điều chỉnh bộ gia nhiệt' },
      { id: 'l3', minutesAgo: 214, text: 'Kiểm tra định kỳ cảm biến áp suất đầu ra' },
      { id: 'l4', minutesAgo: 469, text: 'Khởi động quy trình hóa hơi buổi sáng' },
      { id: 'l5', minutesAgo: 604, text: 'Bàn giao ca trực - Thiết bị ổn định' },
    ],
  },
};
