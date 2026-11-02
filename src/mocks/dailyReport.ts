/*
 * Chi tiết báo cáo ngày – danh mục hạng mục đo + số đo mẫu theo mốc (Figma 117:4250).
 * Số sinh XÁC ĐỊNH theo (ngày, hạng mục, mốc) nên F5 không đổi; mốc chưa có dữ liệu trong báo cáo (`checkpoint.done = false`)
 * → null ("—"). Danh mục, ngưỡng là GIẢ ĐỊNH (chưa có biểu mẫu thật của khách – docs/questions.md mục 12).
 */
import { tagSeed } from '@/features/operations/device';
import { GAS_TAGS, MAIN_LINE_TAGS, REGULATOR_TAGS, V101_TAGS, VAPORIZER_TAGS } from '@/features/live/tags';
import type { DailyGroupId, DailyReadingRow, ReadingLimits, ReadingSource, ReportRecord } from '@/features/reports';
import { dayNumber, plantDayKey } from '@/lib/plantTime';

type ItemDef = {
  id: string;
  groupId: DailyGroupId;
  label: string;
  device: string;
  unit: string;
  digits: number;
  limits: ReadingLimits;
  source?: ReadingSource;
  /** Giá trị nền lúc 08:00. */
  base: number;
  /** Thay đổi mỗi mốc (2 giờ): mức bồn giảm dần do tiêu thụ. */
  drift?: number;
  /** Biên dao động ngẫu nhiên ổn định. */
  noise: number;
};

/** Ngưỡng E-101A lấy theo màn Vận hành (mocks/operations.ts) để hai màn không mâu thuẫn. */
export const DAILY_ITEMS: readonly ItemDef[] = [
  { id: 'v101-level', groupId: 'V-101', label: 'Mức bồn', device: `${V101_TAGS.level} / V-101`, unit: '%', digits: 1, limits: { lowDanger: 5, lowWarn: 10, warn: 90, danger: 95 }, base: 77.1, drift: -0.22, noise: 0.06 },
  { id: 'v101-pressure', groupId: 'V-101', label: 'Áp suất bồn', device: `${V101_TAGS.pressure} / V-101`, unit: 'bar', digits: 1, limits: { lowWarn: 2, warn: 12, danger: 14 }, base: 6.8, noise: 0.25 },
  { id: 'v101-temp', groupId: 'V-101', label: 'Nhiệt độ LPG', device: `${V101_TAGS.temperature} / V-101`, unit: '°C', digits: 1, limits: { lowWarn: 0, warn: 40, danger: 50 }, base: 28.4, drift: 0.6, noise: 0.4 },
  { id: 'e101a-temp', groupId: 'E-101', label: 'Nhiệt độ khí ra', device: `${VAPORIZER_TAGS.temperature} / E-101A`, unit: '°C', digits: 1, limits: { lowWarn: 50, warn: 75 }, base: 61.5, noise: 1.2 },
  { id: 'e101a-in', groupId: 'E-101', label: 'Áp suất vào', device: `${VAPORIZER_TAGS.inletPressure} / E-101A`, unit: 'bar', digits: 1, limits: { lowWarn: 2, warn: 5, danger: 6 }, base: 4.1, noise: 0.15 },
  { id: 'e101a-out', groupId: 'E-101', label: 'Áp suất ra', device: `${VAPORIZER_TAGS.outletPressure} / E-101A`, unit: 'bar', digits: 1, limits: { lowWarn: 2, warn: 5, danger: 6 }, base: 3.8, noise: 0.12 },
  // E-101B dự phòng không có tag SCADA → đọc nhiệt kế tại chỗ (giống bảo trì MT-00115: "E-101B không có số liệu trực tiếp").
  { id: 'e101b-temp', groupId: 'E-101', label: 'Nhiệt độ thân (dự phòng)', device: 'Nhiệt kế tại chỗ / E-101B', unit: '°C', digits: 0, limits: { warn: 75 }, source: 'field', base: 31, drift: 0.8, noise: 1 },
  // PR-101: tag PT-103 chưa có ngưỡng cấu hình (features/live/tags.ts) → "—", kết quả theo số có/không.
  { id: 'pr101-out', groupId: 'PR-101', label: 'Áp suất sau điều áp', device: `${REGULATOR_TAGS['PR-101']!.outletPressure} / PR-101`, unit: 'bar', digits: 1, limits: {}, base: 4.2, noise: 0.08 },
  { id: 'pr101-gauge', groupId: 'PR-101', label: 'Áp suất đồng hồ tại chỗ', device: 'PI tại chỗ / PR-101', unit: 'bar', digits: 1, limits: {}, source: 'field', base: 4.2, noise: 0.1 },
  // Ngưỡng thấp 15 m³/h = ALT-00124 "Cảnh báo lưu lượng thấp" (mocks/alerts.ts).
  { id: 'ft101-flow', groupId: 'FT-101', label: 'Lưu lượng khí cấp', device: `${MAIN_LINE_TAGS.flow} / Tuyến chính`, unit: 'm³/h', digits: 0, limits: { lowWarn: 15 }, base: 196, drift: 2, noise: 6 },
  // Khí gas: mức theo bands cảnh báo gas (mocks/alertKinds.ts): cấp 1 từ 10, cấp 2 từ 20 % LEL.
  ...GAS_TAGS.map(
    (tag, i): ItemDef => ({
      id: `gas-${tag.toLowerCase()}`,
      groupId: 'GS',
      label: 'Nồng độ khí',
      device: `${tag} / Khu nạp xuất`,
      unit: '%LEL',
      digits: 0,
      limits: { warn: 10, danger: 20 },
      base: [2, 3, 2, 4][i]!,
      noise: 1,
    }),
  ),
];

/**
 * Số ngoài ngưỡng theo số ngày LÙI từ hôm nay (cùng kiểu kịch bản với mocks/reports.ts).
 * Lùi 2 ngày: GS-02 12:00 = 13 % LEL (Cảnh báo). Lùi 9 ngày: áp suất bồn 14:00 = 14,3 bar (Bất thường).
 */
const OUT_OF_RANGE: Record<number, readonly { item: string; checkpoint: string; value: number }[]> = {
  2: [{ item: 'gas-gs-02', checkpoint: '12:00', value: 13 }],
  9: [{ item: 'v101-pressure', checkpoint: '14:00', value: 14.3 }],
};

const round = (v: number, digits: number) => Math.round(v * 10 ** digits) / 10 ** digits;

/** Số đo của một báo cáo ngày; `now` chỉ dùng để tra kịch bản ngoài ngưỡng theo số ngày lùi. */
export function buildDailyReadings(report: Pick<ReportRecord, 'periodKey' | 'checkpoints'>, now: Date): DailyReadingRow[] {
  const day = report.periodKey;
  const back = dayNumber(plantDayKey(now)) - dayNumber(day);
  const daySeed = dayNumber(day) % 89;
  const overrides = OUT_OF_RANGE[back] ?? [];
  return DAILY_ITEMS.map((it) => {
    const seed = tagSeed(it.id);
    const values: Record<string, number | null> = {};
    report.checkpoints.forEach((c, i) => {
      if (!c.done) {
        values[c.key] = null;
        return;
      }
      const hit = overrides.find((o) => o.item === it.id && o.checkpoint === c.key);
      const v = it.base + (it.drift ?? 0) * i + it.noise * Math.sin(daySeed * 1.7 + seed + i * 2.3);
      values[c.key] = hit ? hit.value : Math.max(0, round(v, it.digits));
    });
    return { id: it.id, groupId: it.groupId, label: it.label, device: it.device, unit: it.unit, digits: it.digits, limits: it.limits, source: it.source ?? 'auto', values };
  });
}
