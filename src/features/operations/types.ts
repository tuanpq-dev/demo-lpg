/**
 * Kiểu cấu hình thiết bị màn Vận hành (tham số + ngưỡng, tín hiệu PLC, nhật ký, PLC/SCADA). Dữ liệu vẫn ở
 * `src/mocks/operations.ts`. TODO(backend): GET /api/devices/:id.
 */
import type { AlertKind } from '@/features/alerts/kinds';
import type { PLC_SCADA_TAGS } from '@/features/live/tags';
import type { Area } from '@/features/plant/areas';

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

export type PlcSignal = {
  id: string;
  label: string;
  /** Địa chỉ/tên biến trên PLC (ảnh); không có → chỉ hiện `label`. */ address?: string;
  tag: string;
};

/** Một dòng nhật ký: `minutesAgo` so với lúc mở trang (mốc tương đối – giờ hiển thị tính từ `now`). */
export type OperationLogEntry = { id: string; minutesAgo: number; text: string };

/** Phần chung mọi loại thiết bị (header, cảnh báo, bảo trì, tín hiệu PLC, nhật ký). */
export type OperationDeviceBase = {
  id: string;
  /** "Máy hóa hơi LPG" – ô "Tên" ở header. */
  name: string;
  /** Khu thực địa (`AREAS`) hoặc nơi đặt khác ("Trung tâm điều khiển" – không thuộc bộ lọc khu của Cảnh báo/Bảo trì). */
  area: string;
  /** Thiết bị / tag dùng để lọc "Cảnh báo liên quan" và đếm cảnh báo nghiêm trọng. */
  relatedDevices: readonly string[];
  /** Thêm: mọi cảnh báo thuộc các LOẠI này (vd lỗi tín hiệu cảm biến cho hệ PLC/SCADA). */
  relatedKinds?: readonly AlertKind[];
  plcSignals: readonly PlcSignal[];
  /** Phạm vi bảo dưỡng định kỳ ("Hạng mục chi tiết") – SỐ TẠM, chờ kế hoạch bảo trì từ API. */
  maintenanceScope: readonly string[];
  log: readonly OperationLogEntry[];
};

export type OperationDeviceMock = {
  kind: 'vaporizer';
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
  /** Thêm: mọi cảnh báo thuộc các LOẠI này (không dùng cho máy hóa hơi). */
  relatedKinds?: readonly AlertKind[];
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

export type PlcSourceIcon = 'tank' | 'vaporizer' | 'regulator' | 'line' | 'gas' | 'fire';

/** Một nhóm thiết bị gửi dữ liệu về PLC (nút trái của "Sơ đồ kết nối PLC/SCADA"); `tags` quyết định trạng thái nút. */
export type PlcSource = { id: string; label: string; icon: PlcSourceIcon; tags: readonly string[] };

export type PlcScadaDeviceMock = OperationDeviceBase & {
  kind: 'plc-scada';
  /** "Siemens S7-1200" – khối giữa sơ đồ + dòng phụ KPI. */
  controller: string;
  tags: typeof PLC_SCADA_TAGS;
  sources: readonly PlcSource[];
  /** Tag giám sát – "Tag khả dụng" = số tag còn tín hiệu / tổng. */
  monitoredTags: readonly string[];
  limits: {
    /** Độ trễ dữ liệu (s): ≥ warn → "Cao". */
    latency: { warn: number };
    /** Mất gói tin (%): ≥ warn → "Cao". */
    packetLoss: { warn: number };
    /** Tag khả dụng tối thiểu (dưới mức này → "Thấp"). */
    minAvailableTags: number;
  };
  trend: { minutes: number; latency: { domain: [number, number]; amplitude: number } };
  /** Hoạt động liên tục từ (phút trước lúc mở trang) – SỐ TẠM, chờ tag uptime của PLC. */
  runningSinceMinutes: number;
};
