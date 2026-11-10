/*
 * Ghi nhận mốc kiểm tra của báo cáo ngày – modal "Ghi nhận mốc kiểm tra 18:00" (Figma bản sao A88YJ2BRhICDDdeu2rtRg1,
 * node 126:7966 trong frame 126:8506). THUẦN, `now` qua tham số.
 *
 * Ảnh chụp số liệu của mốc (`CheckpointSnapshot`) do IoT/PLC tự điền; người vận hành rà soát, có thể nhập tay giá trị đồng
 * hồ cơ (ghi đè số IoT, nguồn "Ghi nhận thủ công"), BẮT BUỘC nhập nhận xét, rồi xác nhận mốc → mốc có dữ liệu.
 */
import { plantDateTimeKey } from '@/lib/plantTime';
import { readingLevel, type ReadingLevel, type ReadingLimits } from './daily';
import { missingCheckpoints, type ReportRecord } from './status';

// ============================================================================
// Kiểu dữ liệu ảnh chụp mốc
// ============================================================================

export type SensorHealth = 'normal' | 'fault' | 'lost' | 'stale';
export const SENSOR_HEALTH_LABEL: Record<SensorHealth, string> = {
  normal: 'Bình thường',
  fault: 'Lỗi',
  lost: 'Mất kết nối',
  stale: 'Dữ liệu cũ',
};

/** Một thông số đo của mốc. */
export type RecordReading = {
  id: string;
  label: string;
  /** Tag PLC/SCADA hiển thị ở cột "Tag/Thiết bị". */
  tag: string;
  unit: string;
  digits: number;
  limits: ReadingLimits;
  /** Giá trị IoT tự điền; null = không đọc được (cảm biến mất kết nối) → cần nhập tay. */
  value: number | null;
  sensor: SensorHealth;
  /** Hạng mục bảng báo cáo ngày (`DAILY_ITEMS` id) nhận giá trị này khi xác nhận mốc. */
  dailyItemId?: string;
  /** Mức bình thường đọc "An toàn" thay cho "Bình thường" (đầu dò gas – ảnh). */
  safeLabel?: boolean;
};

export type VaporizerUnit = { id: string; state: 'running' | 'standby'; readings: readonly RecordReading[] };
/** Đường cấp: một đồng hồ lưu lượng (một cảm biến) đọc nhiều giá trị. */
export type FlowLine = { id: string; label: string; sensor: SensorHealth; readings: readonly RecordReading[] };
export type FireSignal = { id: string; label: string; ok: boolean; text: string };
export type PlcStatus = {
  heartbeat: boolean;
  connected: boolean;
  scada: boolean;
  /** "SCADA Remote" · "Local". */
  mode: string;
  estop: boolean;
  /** Giờ cập nhật cuối "HH:mm:ss". */
  updatedAt: string;
  /** Độ trễ so với mốc (giây). */
  delaySec: number;
};

export type CheckpointSnapshot = {
  /** Khoá mốc "18:00". */
  checkpoint: string;
  tank: readonly RecordReading[];
  vaporizers: readonly VaporizerUnit[];
  regulators: readonly RecordReading[];
  flowLines: readonly FlowLine[];
  /** Bảng "Cảm biến rò rỉ LPG": tham chiếu thông số đã có (gas khu bồn / khu máy hóa hơi) với nhãn riêng. */
  gas: readonly { readingId: string; label: string }[];
  fire: readonly FireSignal[];
  plc: PlcStatus;
};

/** Giá trị nhập tay theo id thông số. */
export type ManualValues = Readonly<Record<string, number>>;

// ============================================================================
// Giá trị hiệu lực + trạng thái
// ============================================================================

/** Mọi thông số (không trùng) – gồm thông số trong thẻ máy hóa hơi và đường cấp. */
function allReadings(s: CheckpointSnapshot): RecordReading[] {
  return [...s.tank, ...s.vaporizers.flatMap((v) => v.readings), ...s.regulators, ...s.flowLines.flatMap((l) => l.readings)];
}

export const findReading = (s: CheckpointSnapshot, id: string) => allReadings(s).find((r) => r.id === id);

/** Nhập tay ghi đè số IoT. */
export const effectiveValue = (r: RecordReading, manual: ManualValues): number | null => (r.id in manual ? manual[r.id]! : r.value);

export type ValueState = ReadingLevel | 'missing';
const VALUE_STATE_LABEL: Record<ValueState, string> = {
  normal: 'Bình thường',
  warning: 'Cảnh báo',
  abnormal: 'Bất thường',
  missing: 'Chưa có dữ liệu',
};

export function valueState(r: RecordReading, manual: ManualValues): ValueState {
  const v = effectiveValue(r, manual);
  return v === null ? 'missing' : readingLevel(v, r.limits);
}

export function valueStateLabel(r: RecordReading, manual: ManualValues): string {
  const s = valueState(r, manual);
  return s === 'normal' && r.safeLabel ? 'An toàn' : VALUE_STATE_LABEL[s];
}

/**
 * Nguồn giá trị (chú giải modal): iot = PLC tự điền · field = nhập đồng hồ cơ khi IoT VẪN có số (xác minh hiện trường) ·
 * manual = nhập tay khi IoT không có số (ghi nhận thủ công) · missing = chưa có giá trị.
 */
export type ValueSource = 'iot' | 'field' | 'manual' | 'missing';
export function valueSource(r: RecordReading, manual: ManualValues): ValueSource {
  if (r.id in manual) return r.value === null ? 'manual' : 'field';
  return r.value === null ? 'missing' : 'iot';
}

/** "76,0" · "2" · "—" (dấu phẩy thập phân như ảnh). */
export function formatRecordValue(v: number | null, digits: number): string {
  return v === null ? '—' : v.toFixed(digits).replace('.', ',');
}

// ============================================================================
// Chất lượng dữ liệu (4 thẻ) + tổng hợp cảm biến
// ============================================================================

export type RecordQuality = {
  /** Kết nối IoT ổn định: PLC đang kết nối và không cảm biến nào mất kết nối. */
  iotStable: boolean;
  /** Thông số đã có giá trị (IoT hoặc nhập tay) / tổng – "Tiến độ xác minh". */
  verified: number;
  total: number;
  /** Thông số ngoài ngưỡng (Cảnh báo / Bất thường). */
  anomalies: number;
  /** Thông số nhập tay. */
  manual: number;
};

export function recordQuality(s: CheckpointSnapshot, manual: ManualValues): RecordQuality {
  const list = allReadings(s);
  const lost = sensorSummary(s).lost > 0;
  return {
    iotStable: s.plc.connected && !lost,
    verified: list.filter((r) => effectiveValue(r, manual) !== null).length,
    total: list.length,
    anomalies: list.filter((r) => {
      const st = valueState(r, manual);
      return st === 'warning' || st === 'abnormal';
    }).length,
    manual: list.filter((r) => r.id in manual).length,
  };
}

export type SensorSummary = Record<SensorHealth, number> & { total: number };

/** Cảm biến = mỗi thông số bồn / máy hóa hơi / điều áp + mỗi đồng hồ đường cấp (một đồng hồ đọc nhiều giá trị). */
export function sensorSummary(s: CheckpointSnapshot): SensorSummary {
  const sensors: SensorHealth[] = [
    ...s.tank.map((r) => r.sensor),
    ...s.vaporizers.flatMap((v) => v.readings.map((r) => r.sensor)),
    ...s.regulators.map((r) => r.sensor),
    ...s.flowLines.map((l) => l.sensor),
  ];
  const count = (h: SensorHealth) => sensors.filter((x) => x === h).length;
  return { total: sensors.length, normal: count('normal'), fault: count('fault'), lost: count('lost'), stale: count('stale') };
}

// ============================================================================
// Nhóm đã kiểm tra + điều kiện xác nhận
// ============================================================================

const RECORD_GROUPS = [
  { id: 'tank', label: 'Bồn chứa LPG' },
  { id: 'vaporizer', label: 'Máy hóa hơi' },
  { id: 'regulator', label: 'Bộ điều áp' },
  { id: 'flow', label: 'Lưu lượng' },
  { id: 'gas', label: 'Cảm biến rò rỉ LPG' },
  { id: 'fire', label: 'Hệ thống báo cháy' },
  { id: 'plc', label: 'PLC/SCADA' },
] as const;
export type RecordGroupId = (typeof RECORD_GROUPS)[number]['id'];

export type RecordGroupState = { id: RecordGroupId; label: string; complete: boolean };

/**
 * Nhóm "đã kiểm tra" = đủ giá trị (IoT hoặc nhập tay) – 7 nhóm như "Nhóm đã kiểm tra 7/7" của ảnh.
 * Báo cháy / PLC: cần PLC đang kết nối (tín hiệu đọc qua PLC).
 */
export function recordGroups(s: CheckpointSnapshot, manual: ManualValues): RecordGroupState[] {
  const filled = (rs: readonly RecordReading[]) => rs.every((r) => effectiveValue(r, manual) !== null);
  const gasReadings = s.gas.map((g) => findReading(s, g.readingId)).filter((r): r is RecordReading => !!r);
  const complete: Record<RecordGroupId, boolean> = {
    tank: filled(s.tank),
    vaporizer: filled(s.vaporizers.flatMap((v) => v.readings)),
    regulator: filled(s.regulators),
    flow: filled(s.flowLines.flatMap((l) => l.readings)),
    gas: filled(gasReadings),
    fire: s.plc.connected,
    plc: s.plc.connected && s.plc.heartbeat,
  };
  return RECORD_GROUPS.map((g) => ({ id: g.id, label: g.label, complete: complete[g.id] }));
}

/** % nhóm đã kiểm tra – thanh "Hoàn thành 100%" ở chân modal. */
export function recordProgress(groups: readonly RecordGroupState[]): number {
  return groups.length ? Math.round((groups.filter((g) => g.complete).length / groups.length) * 100) : 0;
}

/** Lý do chưa xác nhận được mốc (rỗng = đủ điều kiện). */
export function recordBlockers(groups: readonly RecordGroupState[], remark: string): string[] {
  return [
    ...groups.filter((g) => !g.complete).map((g) => `Thiếu dữ liệu nhóm ${g.label}`),
    ...(remark.trim() ? [] : ['Chưa nhập nhận xét vận hành']),
  ];
}

// ============================================================================
// Nhận xét + số tính toán
// ============================================================================

export const REMARK_SUGGESTIONS = ['Không có bất thường', 'Hệ thống ổn định', 'Cần theo dõi ca tiếp theo'] as const;

/** Thêm câu gợi ý vào cuối nhận xét (không thêm trùng). */
export function appendRemark(text: string, suggestion: string): string {
  const t = text.trim();
  if (!t) return suggestion;
  if (t.toLowerCase().includes(suggestion.toLowerCase())) return text;
  return `${t}${/[.!?;]$/.test(t) ? '' : '.'} ${suggestion}`;
}

/**
 * Hệ số quy đổi tồn kho (Nm³ khí / m³ LPG lỏng) – GIẢ ĐỊNH suy từ Figma (10,3 m³ → 151,5 Nm³), chưa có công thức của khách
 * (docs/questions.md 12.18; trang chi tiết tài sản cũng ghi "Chưa rõ cách quy đổi tồn kho Nm³").
 */
const INVENTORY_NM3_PER_M3 = 14.7;
export const inventoryNm3 = (volumeM3: number) => volumeM3 * INVENTORY_NM3_PER_M3;

// ============================================================================
// Mở modal + ghi mốc
// ============================================================================

/** Chỉ báo cáo NGÀY, mốc đã tới hạn mà chưa có dữ liệu ("Chưa có dữ liệu" trên dải mốc). */
export function canRecordCheckpoint(r: ReportRecord, key: string, now: Date): boolean {
  return r.period === 'daily' && missingCheckpoints(r, now).some((c) => c.key === key);
}

/** Giá trị nhập tay theo id thông số → theo hạng mục bảng ngày (bỏ thông số không có hạng mục tương ứng). */
export function manualForDaily(s: CheckpointSnapshot, manual: ManualValues): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of allReadings(s)) if (r.dailyItemId && r.id in manual) out[r.dailyItemId] = manual[r.id]!;
  return out;
}

export type CheckpointRecordInput = {
  by: string;
  remark: string;
  /** Theo hạng mục bảng ngày (`manualForDaily`). */
  manual: Readonly<Record<string, number>>;
  files: readonly string[];
  at: Date;
};

/**
 * Xác nhận mốc: mốc có dữ liệu (bỏ cờ "Cần xác minh"), giờ cập nhật, nhật ký mốc. Không tự kiểm điều kiện – lớp dữ liệu
 * gọi `recordBlockers` trước. Nhận xét cắt khoảng trắng; không có nhập tay / tệp → không lưu trường đó.
 */
export function applyCheckpointRecord(r: ReportRecord, key: string, input: CheckpointRecordInput): ReportRecord {
  const at = plantDateTimeKey(input.at);
  const entry = {
    by: input.by,
    at,
    remark: input.remark.trim(),
    ...(Object.keys(input.manual).length ? { manual: { ...input.manual } } : {}),
    ...(input.files.length ? { files: [...input.files] } : {}),
  };
  return {
    ...r,
    checkpoints: r.checkpoints.map((c) => (c.key === key ? { key: c.key, label: c.label, dueAt: c.dueAt, done: true } : c)),
    updatedAt: at,
    checkpointLog: { ...r.checkpointLog, [key]: entry },
  };
}
