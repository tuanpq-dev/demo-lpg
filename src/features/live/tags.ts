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

/** Trạm hóa hơi E-101A. */
export const VAPORIZER_TAGS = {
  /** Áp suất đầu vào hóa hơi (bar). */
  inletPressure: 'PT-201',
  /** Nhiệt độ đầu ra (°C). */
  temperature: 'TT-201',
} as const;

/** Cảm biến khí gas khu nạp xuất (đầu dò % LEL) – mã tag = mã thiết bị. Khu của từng cảm biến: `mocks/sensors.ts`. */
export const GAS_TAGS = ['GS-01', 'GS-02', 'GS-03', 'GS-04'] as const;

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
 * `PT-103` là tag GIẢ ĐỊNH (chưa có trong danh sách tag của khách – scratch/designer-questions.md). Không dùng PT-102 vì PT-102 đã là
 * áp suất đẩy bơm P-101A trong cảnh 3D và là cảm biến của ALT-00122 / MT-00116. Chưa có ngưỡng cấu hình → số không tô màu.
 */
export const REGULATOR_TAGS: Readonly<Record<string, { outletPressure: string }>> = {
  'PR-101': { outletPressure: 'PT-103' },
};

/** Bảng tag theo mã thiết bị (trang chi tiết tài sản). */
export const ASSET_TAGS = {
  'V-101': V101_TAGS,
} as const;
