import type { LiveValue } from '@/features/live/types';

/**
 * Giá trị nền (thô, chưa có ts/quality – MockLiveSource bọc thành TagValue) theo tag cảm biến của mọi cảnh mẫu
 * (khu-bon-lpg khớp nhãn Figma: FT-101 203 m³/h, hóa hơi 45,6 °C). LT-xxx = mức theo CHIỀU CAO (% đường kính).
 */
export const liveBase: Record<string, LiveValue> = {
  // KPI Tổng quan (Figma 53:11): tồn kho, áp suất hệ thống, tiêu thụ.
  'INV-TOTAL': 152340,
  'PT-100': 1.82,
  'FQ-100': 203,
  'LOAD-01.STATE': 'loading',
  'LT-TK01': 64,
  'FT-001': 180,
  'P-101A.STATE': 'running',
  'P-101B.STATE': 'standby',
  'PT-102': 15.2,
  'PDT-101': 0.42,
  'FT-101': 203,
  'FT-102': 48,
  'XV-101.POS': 100,
  'XV-102.POS': 100,
  'LT-101': 72.4,
  'PT-101': 14.2,
  'TT-101': 28.5,
  'TT-201': 45.6,
  'PT-201': 4.1,
  'PT-202': 3.8,
  'FT-201': 155,
  // Cảnh tram-chiet-nap: V-303 mức cao (warning), P-302B sự cố (danger).
  'LOAD-02.STATE': 'loading',
  'FT-311': 150,
  'LT-301': 62,
  'LT-302': 48.5,
  'LT-303': 87,
  'PT-301': 12.4,
  'PT-302': 12.1,
  'PT-303': 12.8,
  'P-301A.STATE': 'running',
  'P-301B.STATE': 'standby',
  'P-302A.STATE': 'running',
  'P-302B.STATE': 'fault',
  'FT-301': 240,
  'FT-302': 230,
  'XV-301.POS': 100,
  'PT-311': 4.2,
};

/** Đơn vị theo tiền tố tag (SCADA thật gửi kèm đơn vị). */
export function liveUnit(tag: string): string | undefined {
  if (tag.endsWith('.STATE')) return undefined;
  if (tag.endsWith('.POS')) return '%';
  if (tag.startsWith('INV-')) return 'Nm³';
  if (tag.startsWith('FQ-')) return 'Nm³/h';
  if (tag.startsWith('LT-')) return '%';
  if (tag.startsWith('PT-') || tag.startsWith('PDT-')) return 'bar';
  if (tag.startsWith('TT-')) return '°C';
  if (tag.startsWith('FT-')) return 'm³/h';
  return undefined;
}

/** Biên độ dao động ± theo tag (tag không có ở đây giữ nguyên). */
export const liveJitter: Record<string, number> = {
  'INV-TOTAL': 60,
  'PT-100': 0.03,
  'FQ-100': 8,
  'FT-001': 12,
  'PT-102': 0.4,
  'PDT-101': 0.05,
  'FT-101': 10,
  'FT-102': 6,
  'LT-101': 0.6,
  'PT-101': 0.3,
  'TT-101': 0.4,
  'TT-201': 1.2,
  'PT-201': 0.15,
  'PT-202': 0.12,
  'FT-201': 8,
  'FT-311': 10,
  'LT-301': 0.5,
  'LT-302': 0.5,
  'LT-303': 0.8,
  'FT-301': 12,
  'FT-302': 12,
  'PT-311': 0.2,
};
