import { GAS_TAGS, MAIN_LINE_TAGS, PLC_SCADA_TAGS, REGULATOR_TAGS, SYSTEM_TAGS, V101_TAGS, VAPORIZER_AREA_TAGS, VAPORIZER_TAGS } from '@/features/live/tags';
import type { OperationDeviceMock, PlcScadaDeviceMock, PlcSource } from '@/features/operations/types';

// Kiểu nằm ở features/operations/types – re-export cho test / mock cũ (code mới import thẳng từ features).
export * from '@/features/operations/types';

/**
 * Màn Vận hành – chi tiết thiết bị (ảnh `scratch/figma-ref/op-device-*.png`, chưa có node Figma).
 * Cấu hình TĨNH của thiết bị: tham số + ngưỡng, tín hiệu PLC, nhật ký mẫu. Số đo lấy từ tag trực tiếp (`features/live/tags.ts`),
 * cảnh báo / bảo trì lấy từ store chung – không chép số của ảnh vào đây.
 * TODO(backend): `GET /api/devices/:id` (cấu hình + ngưỡng), `GET /api/tags/history` (xu hướng), `GET /api/devices/:id/logs`.
 */


const T = VAPORIZER_TAGS;

export const operationDevices: Record<string, OperationDeviceMock> = {
  'E-101A': {
    kind: 'vaporizer',
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

// ============================================================================
// Hệ thống PLC/SCADA (Figma bản sao A88YJ2BRhICDDdeu2rtRg1 – 168:4689)
// ============================================================================


const P = PLC_SCADA_TAGS;

/** 6 nhóm nguồn như sơ đồ trong ảnh; tag lấy từ `features/live/tags.ts` (cùng tag các màn khác dùng). */
const PLC_SOURCES: readonly PlcSource[] = [
  { id: 'v101', label: 'Bồn LPG V-101', icon: 'tank', tags: [V101_TAGS.level, V101_TAGS.waterLevel, V101_TAGS.pressure, V101_TAGS.temperature] },
  { id: 'e101', label: 'E-101A/B', icon: 'vaporizer', tags: [VAPORIZER_TAGS.temperature, VAPORIZER_TAGS.inletPressure, VAPORIZER_TAGS.inletTemperature, VAPORIZER_TAGS.outletPressure, VAPORIZER_TAGS.efficiency, VAPORIZER_TAGS.outletFlow, VAPORIZER_AREA_TAGS.runA, VAPORIZER_AREA_TAGS.runB] },
  { id: 'pr101', label: 'PR-101', icon: 'regulator', tags: [REGULATOR_TAGS['PR-101']!.outletPressure] },
  { id: 'lines', label: 'Line 0/1/2', icon: 'line', tags: [MAIN_LINE_TAGS.flow, SYSTEM_TAGS.pressure] },
  { id: 'gas', label: 'Gas Detector', icon: 'gas', tags: [...GAS_TAGS, VAPORIZER_AREA_TAGS.gas] },
  { id: 'fire', label: 'Báo cháy', icon: 'fire', tags: [VAPORIZER_AREA_TAGS.heatTemp] },
];

export const plcScadaDevices: Record<string, PlcScadaDeviceMock> = {
  'PLC-SCADA': {
    kind: 'plc-scada',
    id: 'PLC-SCADA',
    name: 'Hệ thống PLC/SCADA',
    area: 'Trung tâm điều khiển',
    controller: 'Siemens S7-1200',
    tags: P,
    sources: PLC_SOURCES,
    // 21 tag = toàn bộ tag của 6 nhóm nguồn (ảnh "Tag khả dụng 21/21").
    monitoredTags: [...new Set(PLC_SOURCES.flatMap((s) => s.tags))],
    // Ảnh: "> 3.0 giây", "> 5.0%", "< 18/21 tag".
    limits: { latency: { warn: 3 }, packetLoss: { warn: 5 }, minAvailableTags: 18 },
    trend: { minutes: 60, latency: { domain: [0, 3.2], amplitude: 0.3 } },
    runningSinceMinutes: 45 * 1440 + 12 * 60,
    relatedDevices: ['PLC-SCADA', 'PLC-01', 'SCADA-01'],
    // Ảnh minh hoạ COM-WARN-01 / PLC-SYNC-02 / SYS-REST-00 – store chung chưa có cảnh báo truyền thông → lấy cảnh báo mất tín hiệu cảm biến.
    relatedKinds: ['sensor-signal-lost'],
    plcSignals: [
      { id: 'heartbeat', label: 'PLC_Heartbeat', tag: P.heartbeat },
      { id: 'scada', label: 'SCADA_Connection_Status', tag: P.scadaLink },
      { id: 'tags', label: 'Active_Tag_Count', tag: P.activeTagCount },
      { id: 'latency', label: 'Data_Latency', tag: P.latency },
      { id: 'historian', label: 'Historian_Sync_Status', tag: P.historian },
    ],
    maintenanceScope: ['Kiểm tra truyền thông PLC (PLC communication)', 'Đối chiếu ánh xạ tag (Tag mapping)', 'Sao lưu cấu hình (Config backup)'],
    log: [
      { id: 'p1', minutesAgo: 1, text: 'Cập nhật thông số vận hành (Real-time)' },
      { id: 'p2', minutesAgo: 19, text: 'Đồng bộ dữ liệu lịch sử (Historian) thành công' },
      { id: 'p3', minutesAgo: 214, text: 'Kiểm tra định kỳ kết nối PLC – SCADA' },
      { id: 'p4', minutesAgo: 469, text: 'Sao lưu cấu hình PLC tự động' },
      { id: 'p5', minutesAgo: 604, text: 'Bàn giao ca trực - Hệ thống ổn định' },
    ],
  },
};
