import { GAS_TAGS, PLC_SCADA_TAGS, SYSTEM_TAGS, V101_TAGS, VAPORIZER_AREA_TAGS, VAPORIZER_TAGS } from '@/features/live/tags';
import type { LiveValue } from '@/features/live/types';

/**
 * Giá trị nền (thô, chưa có ts/quality – MockLiveSource bọc thành TagValue) theo tag cảm biến của mọi cảnh mẫu
 * (khu-bon-lpg khớp nhãn Figma: FT-101 203 m³/h, hóa hơi 45,6 °C). LT-xxx = mức theo CHIỀU CAO (% đường kính).
 * Tên tag giả định gom ở `features/live/tags.ts`.
 *
 * V-101 (trang chi tiết, Figma "Bồn LPG V-101"): mức tổng 73,0 % và mặt nước 5,2 % chiều cao → theo hình học bồn trụ
 * nằm: LPG lỏng 76,2 % · pha hơi 21,8 % · nước đáy 2,0 % thể tích (khớp bảng trong ảnh). Áp suất 9,2 bar, 28,5 °C.
 */
export const liveBase: Record<string, LiveValue> = {
  // KPI Tổng quan (Figma 53:11): tồn kho, áp suất hệ thống, tiêu thụ.
  [SYSTEM_TAGS.inventory]: 152340,
  [SYSTEM_TAGS.pressure]: 1.82,
  [SYSTEM_TAGS.consumption]: 203,
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
  [V101_TAGS.level]: 73.0,
  [V101_TAGS.waterLevel]: 5.2,
  [V101_TAGS.pressure]: 9.2,
  [V101_TAGS.temperature]: 28.5,
  // Áp suất sau bộ điều áp PR-101 (tag giả định PT-103 – ảnh modal cập nhật xử lý áp suất: 4.2 bar).
  'PT-103': 4.2,
  [VAPORIZER_TAGS.temperature]: 45.6,
  [VAPORIZER_TAGS.inletPressure]: 4.1,
  // Màn Vận hành E-101A (ảnh op-device-*.png): nhiệt độ vào 24,8 °C, hiệu suất 92 %.
  [VAPORIZER_TAGS.inletTemperature]: 24.8,
  [VAPORIZER_TAGS.efficiency]: 92,
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
  // Khí gas khu nạp xuất (% LEL) – theo ảnh drawer gas: GS-01 2 · GS-02 4 · GS-03 8 · GS-04 25 (gây ALT-00127).
  [GAS_TAGS[0]]: 2,
  [GAS_TAGS[1]]: 4,
  [GAS_TAGS[2]]: 8,
  [GAS_TAGS[3]]: 25,
  // Báo cháy trạm hóa hơi (FIR-00018): đầu báo nhiệt HD-02 68 °C đang báo động; khói, gas GS-05 (6 % LEL), nút nhấn bình thường.
  [VAPORIZER_AREA_TAGS.heatTemp]: 68,
  [VAPORIZER_AREA_TAGS.heatAlarm]: 'alarm',
  [VAPORIZER_AREA_TAGS.heatState]: 'online',
  [VAPORIZER_AREA_TAGS.smokeAlarm]: 'normal',
  [VAPORIZER_AREA_TAGS.callPoint]: 'idle',
  [VAPORIZER_AREA_TAGS.gas]: 6,
  [VAPORIZER_AREA_TAGS.runA]: 'running',
  [VAPORIZER_AREA_TAGS.runB]: 'standby',
  // Chẩn đoán PLC/SCADA (màn Vận hành PLC-SCADA, Figma 168:4689): độ trễ 1,2 s, mất gói 0,2 %, PLC báo 21 tag khả dụng.
  [PLC_SCADA_TAGS.heartbeat]: 'ok',
  [PLC_SCADA_TAGS.plcLink]: 'active',
  [PLC_SCADA_TAGS.scadaLink]: 'active',
  [PLC_SCADA_TAGS.latency]: 1.2,
  [PLC_SCADA_TAGS.packetLoss]: 0.2,
  [PLC_SCADA_TAGS.activeTagCount]: 21,
  [PLC_SCADA_TAGS.mode]: 'scada-remote',
  [PLC_SCADA_TAGS.historian]: 'ok',
};

/** Đơn vị theo tiền tố tag (SCADA thật gửi kèm đơn vị). */
export function liveUnit(tag: string): string | undefined {
  if (tag.endsWith('.STATE')) return undefined;
  if (tag.endsWith('.POS') || tag.endsWith('.EFF')) return '%';
  if (tag.startsWith('INV-')) return 'Nm³';
  if (tag.startsWith('FQ-')) return 'Nm³/h';
  if (tag.startsWith('LT-')) return '%';
  if (tag.startsWith('PT-') || tag.startsWith('PDT-')) return 'bar';
  if (tag.startsWith('TT-')) return '°C';
  if (tag.startsWith('FT-')) return 'm³/h';
  if (tag.startsWith('GS-')) return '% LEL';
  if (tag.startsWith('HD-')) return '°C';
  return undefined;
}

/** Biên độ dao động ± theo tag (tag không có ở đây giữ nguyên). */
export const liveJitter: Record<string, number> = {
  [SYSTEM_TAGS.inventory]: 60,
  [SYSTEM_TAGS.pressure]: 0.03,
  [SYSTEM_TAGS.consumption]: 8,
  'FT-001': 12,
  'PT-102': 0.4,
  'PDT-101': 0.05,
  'FT-101': 10,
  'FT-102': 6,
  [V101_TAGS.level]: 0.3,
  [V101_TAGS.waterLevel]: 0.05,
  [V101_TAGS.pressure]: 0.1,
  [V101_TAGS.temperature]: 0.4,
  'PT-103': 0.05,
  [VAPORIZER_TAGS.temperature]: 1.2,
  [VAPORIZER_TAGS.inletPressure]: 0.15,
  [VAPORIZER_TAGS.inletTemperature]: 0.4,
  [VAPORIZER_TAGS.efficiency]: 0.6,
  'PT-202': 0.12,
  'FT-201': 8,
  'FT-311': 10,
  'LT-301': 0.5,
  'LT-302': 0.5,
  'LT-303': 0.8,
  'FT-301': 12,
  'FT-302': 12,
  'PT-311': 0.2,
  [GAS_TAGS[0]]: 0.3,
  [GAS_TAGS[1]]: 0.3,
  [GAS_TAGS[2]]: 0.4,
  [GAS_TAGS[3]]: 0.6,
  [VAPORIZER_AREA_TAGS.heatTemp]: 0.5,
  [VAPORIZER_AREA_TAGS.gas]: 0.3,
  [PLC_SCADA_TAGS.latency]: 0.25,
  [PLC_SCADA_TAGS.packetLoss]: 0.1,
};
