/*
 * Ảnh chụp số liệu IoT/PLC của MỘT mốc kiểm tra – modal "Ghi nhận mốc kiểm tra" (Figma bản sao 126:7966).
 * Số sinh XÁC ĐỊNH theo (ngày, mốc). Mức bồn / áp suất / nhiệt độ LPG lấy CÙNG hàm với bảng báo cáo ngày
 * (`dailyItemReading`) → xác nhận mốc xong, bảng hiện đúng số trong modal. Các thông số khác (thể tích, khu vực, điều áp,
 * đường cấp, gas, báo cháy, PLC) theo số ảnh ± dao động nhỏ – danh mục GIẢ ĐỊNH (docs/questions.md 12.18).
 *
 * Kịch bản (số ngày lùi từ hôm nay): lùi 3 ngày → cảm biến áp suất bồn MẤT KẾT NỐI (không có số IoT, phải nhập đồng hồ cơ).
 */
import { tagSeed } from '@/features/operations/device';
import { PLC_REPORT_TAGS, VAPORIZER_AREA_TAGS } from '@/features/live/tags';
import {
  DAILY_CHECKPOINTS,
  type CheckpointSnapshot,
  type ReadingLimits,
  type RecordReading,
  type ReportRecord,
  type SensorHealth,
} from '@/features/reports';
import { cylinderCapacity } from '@/features/tank/layers';
import { levelPercentToVolumePercent } from '@/features/tank/volume';
import { dayNumber, plantDayKey } from '@/lib/plantTime';
import { assetMocks } from './assets';
import { DAILY_ITEMS, dailyItemReading } from './dailyReport';

/** Lùi N ngày → thông số mất kết nối. */
const LOST_SENSORS: Record<number, readonly string[]> = {
  3: ['tank-pressure'],
};

const round = (v: number, digits: number) => Math.round(v * 10 ** digits) / 10 ** digits;
const limitsOf = (id: string): ReadingLimits => DAILY_ITEMS.find((x) => x.id === id)?.limits ?? {};

export function buildCheckpointSnapshot(report: Pick<ReportRecord, 'periodKey'>, key: string, now: Date): CheckpointSnapshot {
  const day = report.periodKey;
  const index = Math.max(0, (DAILY_CHECKPOINTS as readonly string[]).indexOf(key));
  const back = dayNumber(plantDayKey(now)) - dayNumber(day);
  const lost = new Set(LOST_SENSORS[back] ?? []);
  const seed = dayNumber(day) % 89;
  /** Dao động ổn định theo (ngày, mốc, thông số). */
  const wobble = (id: string, amp: number) => amp * Math.sin(seed * 1.3 + tagSeed(id) + index * 1.9);

  const reading = (r: Omit<RecordReading, 'sensor' | 'value'> & { value: number | null }): RecordReading => {
    const isLost = lost.has(r.id);
    return { ...r, value: isLost || r.value === null ? null : round(r.value, r.digits), sensor: isLost ? 'lost' : 'normal' };
  };
  const fromDaily = (itemId: string) => dailyItemReading(itemId, day, index, now)?.value ?? null;

  const level = fromDaily('v101-level');
  const tankDims = assetMocks['V-101']!.tank!;
  const volume = level === null ? null : (cylinderCapacity(tankDims) * levelPercentToVolumePercent(level)) / 100;
  const lpgTemp = fromDaily('v101-temp');

  const tank: RecordReading[] = [
    reading({ id: 'tank-level', label: 'Mức chất lỏng', tag: PLC_REPORT_TAGS.tankLevel, unit: '%', digits: 1, limits: limitsOf('v101-level'), value: level, dailyItemId: 'v101-level' }),
    reading({ id: 'tank-volume', label: 'Thể tích chất lỏng', tag: PLC_REPORT_TAGS.tankVolume, unit: 'm³', digits: 1, limits: {}, value: volume }),
    reading({ id: 'tank-pressure', label: 'Áp suất bồn', tag: PLC_REPORT_TAGS.tankPressure, unit: 'bar', digits: 1, limits: limitsOf('v101-pressure'), value: fromDaily('v101-pressure'), dailyItemId: 'v101-pressure' }),
    reading({ id: 'tank-temp', label: 'Nhiệt độ bồn', tag: PLC_REPORT_TAGS.tankTemperature, unit: '°C', digits: 1, limits: limitsOf('v101-temp'), value: lpgTemp, dailyItemId: 'v101-temp' }),
    reading({ id: 'tank-zone-temp', label: 'Nhiệt độ khu vực bồn', tag: PLC_REPORT_TAGS.tankZoneTemperature, unit: '°C', digits: 1, limits: { lowWarn: 0, warn: 40, danger: 50 }, value: lpgTemp === null ? null : lpgTemp + 0.4 + wobble('zone', 0.2) }),
    reading({ id: 'tank-gas', label: 'Gas khu vực bồn', tag: PLC_REPORT_TAGS.tankGas, unit: '%LEL', digits: 0, limits: { warn: 10, danger: 20 }, value: 2 + wobble('tank-gas', 0.6), safeLabel: true }),
  ];

  const vapReading = (unit: 'A' | 'B', n: 1 | 2, temp: number, gas: number) => [
    reading({ id: `vap-${unit}-temp`, label: `Nhiệt độ KV ${n}`, tag: `${VAPORIZER_AREA_TAGS.heatTemp}.KV${n}`, unit: '°C', digits: 1, limits: { warn: 60, danger: 70 }, value: temp }),
    reading({ id: `vap-${unit}-gas`, label: `Gas KV ${n}`, tag: `${VAPORIZER_AREA_TAGS.gas}.KV${n}`, unit: '% LEL', digits: 0, limits: { warn: 10, danger: 20 }, value: gas, safeLabel: true }),
  ];

  const regulators: RecordReading[] = [
    reading({ id: 'reg-source', label: 'Áp suất nguồn', tag: 'PT-102', unit: 'bar', digits: 1, limits: { lowWarn: 1.5, warn: 3.5 }, value: 2.4 + wobble('reg-source', 0.08) }),
    reading({ id: 'reg-stage1', label: 'Áp suất sau điều áp cấp 1', tag: 'PT-103', unit: 'bar', digits: 1, limits: { lowWarn: 0.5, warn: 1.2 }, value: 0.8 + wobble('reg-stage1', 0.04) }),
    reading({ id: 'reg-stage2', label: 'Áp suất sau điều áp cấp 2', tag: 'PT-104', unit: 'mbar', digits: 0, limits: { lowWarn: 20, warn: 40 }, value: 30 + wobble('reg-stage2', 1) }),
  ];

  const lineReading = (line: string, id: string, label: string, unit: string, digits: number, value: number, limits: ReadingLimits = {}) =>
    reading({ id: `${line}-${id}`, label, tag: `FT-${line.toUpperCase()}.${id.toUpperCase()}`, unit, digits, limits, value });
  // Tổng tích luỹ tăng theo mốc (2 giờ × lưu lượng).
  const total0 = 2038 - (5 - index) * 290;

  const sensor: SensorHealth = 'normal';
  return {
    checkpoint: key,
    tank,
    vaporizers: [
      { id: 'E-101A', state: 'running', readings: vapReading('A', 1, 45.2 + wobble('vap-a', 0.6), 1 + wobble('vap-a-gas', 0.4)) },
      { id: 'E-101B', state: 'standby', readings: vapReading('B', 2, 28 + wobble('vap-b', 0.4), 0) },
    ],
    regulators,
    flowLines: [
      {
        id: 'line-0',
        label: 'Line 0',
        sensor,
        readings: [
          lineReading('l0', 'flow', 'Flow', 'Nm3/h', 0, 145 + wobble('l0', 4), { lowWarn: 15 }),
          lineReading('l0', 'total', 'Total', 'Nm3', 0, total0),
          lineReading('l0', 'temp', 'Temp', '°C', 1, 28.5 + wobble('l0t', 0.3)),
          lineReading('l0', 'press', 'Press', 'bar', 1, 2.4 + wobble('l0p', 0.05)),
        ],
      },
      {
        id: 'line-1',
        label: 'Line 1',
        sensor,
        readings: [
          lineReading('l1', 'flow', 'Flow', 'Nm3/h', 0, 0),
          lineReading('l1', 'total', 'Total', 'Nm3', 0, 1240),
          lineReading('l1', 'temp', 'Temp', '°C', 1, 27.2 + wobble('l1t', 0.3)),
          lineReading('l1', 'press', 'Press', 'bar', 1, 0),
        ],
      },
      { id: 'line-2', label: 'Line 2', sensor, readings: [lineReading('l2', 'press', 'Press', 'mbar', 0, 30 + wobble('l2p', 1))] },
    ],
    gas: [
      { readingId: 'tank-gas', label: 'Gas khu vực bồn' },
      { readingId: 'vap-A-gas', label: 'Gas khu vực máy hóa hơi 1' },
      { readingId: 'vap-B-gas', label: 'Gas khu vực máy hóa hơi 2' },
    ],
    fire: [
      { id: 'fire-signal', label: 'Tín hiệu báo cháy 1 & 2', ok: true, text: 'Bình thường' },
      { id: 'fire-panel', label: 'Tủ báo cháy 1 & 2', ok: true, text: 'Bình thường' },
      { id: 'fire-fault', label: 'Lỗi tủ', ok: true, text: 'Không phát hiện' },
    ],
    plc: {
      heartbeat: true,
      connected: true,
      scada: true,
      mode: 'SCADA Remote',
      estop: false,
      updatedAt: `${key.slice(0, 2)}:0${3 + (seed % 5)}:${String(10 + ((seed * 7) % 50)).padStart(2, '0')}`,
      delaySec: 5 + ((seed * 3) % 20),
    },
  };
}
