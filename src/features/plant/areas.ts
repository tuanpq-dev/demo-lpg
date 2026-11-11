/**
 * MỘT danh sách khu vực dùng chung cho Cảnh báo, Bảo trì và Chi tiết tài sản (bộ lọc "Khu vực", form tạo yêu cầu).
 * Trước 27/10/2026 cảnh báo/bảo trì ghi "Bồn chứa" còn MT-00128 và trang V-101 ghi "Khu bồn LPG" cho cùng một khu → gộp
 * về "Khu bồn LPG" (ảnh drawer cảnh báo ALT-00128). Figma bảng cảnh báo 70:3032 vẫn ghi "Bồn chứa" – docs/figma-diffs.md.
 * TODO(backend): GET danh mục khu vực.
 */
export const AREAS = ['Khu bồn LPG', 'Khu nạp xuất', 'Trạm hóa hơi', 'Khu Lọc', 'Khu bơm', 'Tuyến chính', 'Khu vực B'] as const;
export type Area = (typeof AREAS)[number];

const isArea = (v: string): v is Area => (AREAS as readonly string[]).includes(v);

/**
 * Mã khu (hệ thống báo cháy). Ảnh báo cháy FIR-00018 ghi "Khu máy hóa hơi (FZ-02)" → thống nhất về tên chung "Trạm hóa hơi"
 * + mã FZ-02 (docs/figma-diffs.md). Khu khác chưa có mã – chờ khách cung cấp danh mục khu báo cháy.
 */
const AREA_CODES: Partial<Readonly<Record<Area, string>>> = { 'Trạm hóa hơi': 'FZ-02' };

/** "Trạm hóa hơi (FZ-02)" – khu không có mã giữ nguyên tên. */
export const areaLabel = (area: string) => {
  const code = isArea(area) ? AREA_CODES[area] : undefined;
  return code ? `${area} (${code})` : area;
};
