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

/** Bảng tag theo mã thiết bị (trang chi tiết tài sản). */
export const ASSET_TAGS = {
  'V-101': V101_TAGS,
} as const;
