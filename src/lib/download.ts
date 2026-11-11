/** Mở hộp "lưu tệp" của trình duyệt cho nội dung tạo ở FE (CSV, JSON, tệp mẫu); thu hồi URL ngay sau khi bấm. */
export function downloadFile(content: BlobPart, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** BOM UTF-8 – Excel cần để đọc đúng tiếng Việt trong CSV. */
export const CSV_BOM = '﻿';

/**
 * Bảng → chuỗi CSV (dòng cách bằng CRLF). `quote`: 'always' = mọi ô trong ngoặc kép (mặc định) · 'minimal' = chỉ ô có
 * dấu phẩy / ngoặc kép / xuống dòng. Không tự thêm BOM.
 */
export function toCsv(rows: readonly (readonly (string | undefined)[])[], { quote = 'always' }: { quote?: 'always' | 'minimal' } = {}): string {
  const cell = (raw: string | undefined) => {
    const v = raw ?? '';
    return quote === 'always' || /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  return rows.map((row) => row.map(cell).join(',')).join('\r\n');
}

/** Tải CSV (thêm BOM nếu chưa có). */
export function downloadCsv(csv: string, fileName: string) {
  downloadFile(csv.startsWith(CSV_BOM) ? csv : CSV_BOM + csv, fileName, 'text/csv;charset=utf-8');
}
