/*
 * Tên tag cảm biến GIẢ ĐỊNH (chưa có danh sách tag SCADA thật của khách) – gom về một chỗ để đổi một lần.
 * Mock số liệu (`mocks/scenes/live.ts`), KPI Tổng quan, trang chi tiết tài sản và mock cảnh báo đều đọc từ đây.
 *
 * Cảnh 3D là JSON (không import được TS) nên `bindings` trong `mocks/scenes/*.json` vẫn ghi chuỗi tag; test
 * `tags.test.ts` so các binding đó với file này → đổi tag ở đây mà quên JSON thì test báo đúng chỗ cần sửa.
 */

/** KPI cấp nhà máy (Tổng quan, Figma 53:166). */
export const SYSTEM_TAGS = {
  /** Tồn kho toàn nhà máy (Nm³). */
  inventory: 'INV-TOTAL',
  /** Áp suất hệ thống (bar). */
  pressure: 'PT-100',
  /** Tiêu thụ (Nm³/h). */
  consumption: 'FQ-100',
} as const;

/** Bồn LPG V-101 (khu bồn LPG). */
export const V101_TAGS = {
  /** Mức TỔNG chất lỏng (LPG + nước) theo chiều cao, % đường kính. */
  level: 'LT-101',
  /** Mức mặt phân cách nước đáy / LPG theo chiều cao, % đường kính. */
  waterLevel: 'LT-101W',
  /** Áp suất bồn (bar). */
  pressure: 'PT-101',
  /** Nhiệt độ LPG (°C). */
  temperature: 'TT-101',
} as const;

/** Trạm hóa hơi E-101A (màn Vận hành – chi tiết thiết bị đọc cả 6 tag). */
export const VAPORIZER_TAGS = {
  /** Áp suất đầu vào hóa hơi (bar). */
  inletPressure: 'PT-201',
  /** Nhiệt độ đầu ra (°C). */
  temperature: 'TT-201',
  /** Nhiệt độ LPG lỏng đầu vào (°C). */
  inletTemperature: 'TT-200',
  /**
   * Áp suất khí đầu ra (bar). Dùng chung PT-202 với tháp điều áp C-101 trong cảnh 3D (đầu ra E-101A nối thẳng vào C-101,
   * chưa có tag riêng – docs/questions.md).
   */
  outletPressure: 'PT-202',
  /** Hiệu suất hóa hơi (%) – PLC tính sẵn. */
  efficiency: 'E-101A.EFF',
  /** Lưu lượng khí ra (m³/h) – cùng tag lưu lượng ống PL-07 trong cảnh 3D. */
  outletFlow: 'FT-201',
} as const;

/** Tuyến chính sau trạm hóa hơi – lưu lượng khí cấp (m³/h; Tổng quan 53:11 "FT-101 203 m³/h", báo cáo ngày). */
export const MAIN_LINE_TAGS = {
  flow: 'FT-101',
} as const;

/** Cảm biến khí gas khu nạp xuất (đầu dò % LEL) – mã tag = mã thiết bị. Khu của từng cảm biến: `mocks/sensors.ts`. */
export const GAS_TAGS = ['GS-01', 'GS-02', 'GS-03', 'GS-04'] as const;

/**
 * Đầu dò gas khu bồn V-101 (% LEL) – tag PLC hiển thị `Tank_Gas_Detector` (`PLC_REPORT_TAGS.tankGas`). Mã GIẢ ĐỊNH; KHÔNG
 * thuộc 21 tag giám sát của hệ PLC/SCADA (màn AI mô phỏng – cấu hình kịch bản SC-001 đọc làm "Nồng độ bắt đầu").
 */
export const TANK_AREA_TAGS = {
  gas: 'GS-06',
} as const;

/**
 * Trạm hóa hơi (FZ-02) – báo cháy (FIR-00018, ảnh `scratch/figma-ref/alert-drawer-fire-*.png`). Mã giả định như mọi tag ở đây.
 * Nhiệt độ ĐẦU BÁO (`heatTemp`) là tag riêng, KHÁC nhiệt độ máy hóa hơi (`VAPORIZER_TAGS.temperature`).
 * Tag trạng thái là chuỗi: `.ALARM` 'alarm' | 'normal' · `.STATE` đầu báo 'online' | 'fault' · nút nhấn 'idle' | 'activated' ·
 * máy 'running' | 'standby' | 'fault' | 'stopped'. Cảm biến gas của khu = GS-05 (GS-02 thuộc Khu nạp xuất – docs/figma-diffs.md).
 */
export const VAPORIZER_AREA_TAGS = {
  heatTemp: 'HD-02',
  heatAlarm: 'HD-02.ALARM',
  heatState: 'HD-02.STATE',
  smokeAlarm: 'SD-02.ALARM',
  callPoint: 'MCP-02.STATE',
  gas: 'GS-05',
  runA: 'E-101A.STATE',
  runB: 'E-101B.STATE',
} as const;

/**
 * Bộ điều áp sau bồn (modal "Cập nhật xử lý cảnh báo áp suất", ảnh 28/10/2026 – dòng "Áp suất sau PR-101").
 * `PT-103` là tag GIẢ ĐỊNH (chưa có trong danh sách tag của khách – docs/questions.md). Không dùng PT-102 vì PT-102 đã là
 * áp suất đẩy bơm P-101A trong cảnh 3D và là cảm biến của ALT-00122 / MT-00116. Chưa có ngưỡng cấu hình → số không tô màu.
 */
export const REGULATOR_TAGS: Readonly<Record<string, { outletPressure: string }>> = {
  'PR-101': { outletPressure: 'PT-103' },
};

/** Bảng tag theo mã thiết bị (trang chi tiết tài sản). */
export const ASSET_TAGS = {
  'V-101': V101_TAGS,
} as const;

/**
 * Tên tag PLC hiển thị trong modal "Ghi nhận mốc kiểm tra" (Figma bản sao 126:8506, bảng Bồn chứa LPG) – GIẢ ĐỊNH theo
 * Figma, chưa đối chiếu danh mục tag PLC thật (docs/questions.md 12.18). Giá trị đọc qua tag SCADA tương ứng ở trên.
 */
export const PLC_REPORT_TAGS = {
  tankLevel: 'Tank_Liquid_Level_Percent',
  tankVolume: 'Tank_Liquid_Level_m3',
  tankPressure: 'Tank_Pressure_Bar',
  tankTemperature: 'Tank_Temperature_C',
  tankZoneTemperature: 'Tank_Temperature_Zone_C',
  tankGas: 'Tank_Gas_Detector',
} as const;

/**
 * Hệ thống PLC/SCADA (màn Vận hành – chi tiết thiết bị PLC-SCADA, Figma bản sao 168:4689): tag chẩn đoán do PLC/gateway
 * công bố – GIẢ ĐỊNH (docs/questions.md 13.x). Chuỗi: heartbeat 'ok' | 'lost'; link 'active' | 'down';
 * mode 'scada-remote' | 'local'; historian 'ok' | 'failed'. Số: độ trễ (s), mất gói (%), số tag PLC báo khả dụng.
 */
export const PLC_SCADA_TAGS = {
  heartbeat: 'PLC-01.HEARTBEAT',
  plcLink: 'PLC-01.LINK',
  scadaLink: 'SCADA-01.LINK',
  latency: 'PLC-01.LATENCY',
  packetLoss: 'PLC-01.PKT_LOSS',
  activeTagCount: 'PLC-01.TAG_OK',
  mode: 'PLC-01.MODE',
  historian: 'HIST-01.SYNC',
} as const;
