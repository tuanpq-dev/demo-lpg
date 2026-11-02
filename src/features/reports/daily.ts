/*
 * Chi tiết báo cáo ngày (Figma A88YJ2BRhICDDdeu2rtRg1 – 117:4250) – kiểu dữ liệu + suy dẫn THUẦN, `now` qua tham số.
 *
 * Bảng số liệu: mỗi dòng = một hạng mục đo của một thiết bị, mỗi cột giờ = một mốc kiểm tra (DAILY_CHECKPOINTS).
 * Màu/kết quả theo ngưỡng dùng chung `paramStatus` của màn Vận hành (low/high = Cảnh báo, danger = Bất thường).
 */
import { paramStatus } from '@/features/operations/device';
import { foldSearch } from './filter';
import { SIGNATURE_STEPS, SIGNATURE_STEP_LABEL, checkpointProgress, missingCheckpoints, signatureOf, type ReportRecord } from './status';

/** Nhóm thiết bị – thứ tự hiển thị trong bảng. */
export const DAILY_GROUPS = [
  { id: 'V-101', label: 'Bồn chứa LPG – V-101' },
  { id: 'E-101', label: 'Thiết bị hóa hơi – E-101A/B' },
  { id: 'PR-101', label: 'Cụm điều áp – PR-101' },
  { id: 'FT-101', label: 'Lưu lượng khí cấp – FT-101' },
  { id: 'GS', label: 'Đầu dò khí gas – GS-01…GS-04' },
] as const;
export type DailyGroupId = (typeof DAILY_GROUPS)[number]['id'];
export const DAILY_GROUP_IDS = DAILY_GROUPS.map((g) => g.id) as readonly DailyGroupId[];

/** Cùng dạng `ParamLimits` (mocks/operations): cảnh báo dưới/trên, nguy hiểm dưới/trên. Không có → chưa cấu hình ngưỡng. */
export type ReadingLimits = { lowDanger?: number; lowWarn?: number; warn?: number; danger?: number };

/** auto = số đo SCADA (icon sóng) · field = đọc đồng hồ tại chỗ, có ghi chú "XM hiện trường" (dòng cao hơn). */
export type ReadingSource = 'auto' | 'field';

export type DailyReadingRow = {
  id: string;
  groupId: DailyGroupId;
  /** Cột "Hạng mục": "Mức bồn". */
  label: string;
  /** Cột "Thiết bị": "LT-101 / V-101". */
  device: string;
  unit: string;
  /** Số chữ số thập phân khi hiển thị. */
  digits: number;
  limits: ReadingLimits;
  source: ReadingSource;
  /** Giá trị theo khoá mốc ("08:00"); null = chưa có dữ liệu. */
  values: Readonly<Record<string, number | null>>;
  /** Ghi chú theo khoá mốc – ô ngoài ngưỡng cần có ghi chú trước khi ký (điều kiện "Không có bất thường chưa ghi chú"). */
  notes?: Readonly<Record<string, string>>;
};

/** Trạng thái một mốc của báo cáo (timeline). */
export type CheckpointState = 'confirmed' | 'needs-verify' | 'missing' | 'upcoming';
export const CHECKPOINT_STATE_LABEL: Record<CheckpointState, string> = {
  confirmed: 'Đã xác nhận',
  'needs-verify': 'Cần xác minh',
  missing: 'Chưa có dữ liệu',
  upcoming: 'Chưa tới hạn',
};

export type CheckpointView = { key: string; label: string; state: CheckpointState };

/** Mốc đã tới hạn mà chưa có dữ liệu → missing; chưa tới hạn → upcoming; có dữ liệu → confirmed / needs-verify. */
export function checkpointStates(r: ReportRecord, now: Date): CheckpointView[] {
  const missing = new Set(missingCheckpoints(r, now).map((c) => c.key));
  return r.checkpoints.map((c) => ({
    key: c.key,
    label: c.label,
    state: c.done ? (c.needsVerify ? 'needs-verify' : 'confirmed') : missing.has(c.key) ? 'missing' : 'upcoming',
  }));
}

// ============================================================================
// Ô giờ + kết quả dòng
// ============================================================================

export type ReadingLevel = 'normal' | 'warning' | 'abnormal';
export type CellState = ReadingLevel | 'missing' | 'upcoming';

export function readingLevel(value: number, limits: ReadingLimits): ReadingLevel {
  const s = paramStatus(value, limits);
  return s === 'danger' ? 'abnormal' : s === 'normal' ? 'normal' : 'warning';
}

/** Trạng thái ô: có số → theo ngưỡng; không có số → theo mốc (đã tới hạn = thiếu, chưa = chưa tới hạn). */
export function cellState(value: number | null | undefined, limits: ReadingLimits, checkpoint: CheckpointState): CellState {
  if (value === null || value === undefined) return checkpoint === 'upcoming' ? 'upcoming' : 'missing';
  return readingLevel(value, limits);
}

export const ROW_RESULTS = ['normal', 'warning', 'abnormal', 'no-data'] as const;
export type RowResult = (typeof ROW_RESULTS)[number];
export const ROW_RESULT_LABEL: Record<RowResult, string> = {
  normal: 'Bình thường',
  warning: 'Cảnh báo',
  abnormal: 'Bất thường',
  'no-data': 'Chưa có dữ liệu',
};

/** Kết quả = mức xấu nhất trong các số đã có; mốc thiếu KHÔNG làm đổi kết quả (ảnh: 18:00 "—" vẫn "Bình thường"). */
export function rowResult(row: Pick<DailyReadingRow, 'values' | 'limits'>): RowResult {
  const present = Object.values(row.values).filter((v): v is number => v !== null);
  if (!present.length) return 'no-data';
  const levels = present.map((v) => readingLevel(v, row.limits));
  return levels.includes('abnormal') ? 'abnormal' : levels.includes('warning') ? 'warning' : 'normal';
}

// ============================================================================
// Định dạng
// ============================================================================

/** "77,1" (dấu phẩy thập phân như ảnh). */
export const formatReading = (v: number, digits: number) => v.toFixed(digits).replace('.', ',');

/** Ghép số + đơn vị: "90%" · "45°C" · "5 bar" · "10 %LEL". */
const withUnit = (n: string, unit: string) => (unit === '%' || unit.startsWith('°') ? `${n}${unit}` : `${n} ${unit}`);

/**
 * Cột "Ngưỡng/chuẩn" theo vùng cảnh báo: "10–90%" · "< 10 %LEL" · "> 15 m³/h" · "—" (chưa cấu hình).
 * Số nguyên hiển thị không có phần thập phân.
 */
export function standardText(l: ReadingLimits, unit: string): string {
  const f = (v: number) => (Number.isInteger(v) ? String(v) : formatReading(v, 1));
  if (l.lowWarn !== undefined && l.warn !== undefined) return withUnit(`${f(l.lowWarn)}–${f(l.warn)}`, unit);
  if (l.warn !== undefined) return `< ${withUnit(f(l.warn), unit)}`;
  if (l.lowWarn !== undefined) return `> ${withUnit(f(l.lowWarn), unit)}`;
  return '—';
}

// ============================================================================
// 5 thẻ tóm tắt (117:4367)
// ============================================================================

export type DailyCardTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
export type DailyCardId = 'progress' | 'confirmed' | 'abnormal' | 'missing' | 'signature';

export type DailyCard = {
  id: DailyCardId;
  /** Số góc phải: "5/6 mốc" · "0" · "0/3". */
  value: string;
  title: string;
  sub: string;
  tone: DailyCardTone;
  /** Chỉ thẻ tiến độ: phần trăm + thanh. */
  percent?: number;
};

/** Ô ngoài ngưỡng: "GS-02 lúc 12:00". */
export type FlaggedReading = { rowId: string; device: string; checkpoint: string; level: Exclude<ReadingLevel, 'normal'> };

export function flaggedReadings(rows: readonly DailyReadingRow[], checkpointKeys: readonly string[]): FlaggedReading[] {
  const out: FlaggedReading[] = [];
  for (const row of rows) {
    for (const key of checkpointKeys) {
      const v = row.values[key];
      if (v === null || v === undefined) continue;
      const level = readingLevel(v, row.limits);
      if (level !== 'normal') out.push({ rowId: row.id, device: row.device.split(' / ')[0]!, checkpoint: key, level });
    }
  }
  return out;
}

const listText = (items: readonly string[], max = 2) =>
  items.length > max ? `${items.slice(0, max).join(', ')} +${items.length - max}` : items.join(', ');

/** Số bước ký đã xong (0–3): chờ Người duyệt → 1 (Người kiểm tra đã ký), chờ TAP → 2, đã ký → 3, trả lại / chưa gửi → 0. */
export function signedSteps(r: ReportRecord, now: Date): number {
  const s = signatureOf(r, now);
  if (s === 'signed') return SIGNATURE_STEPS.length;
  if (s === 'pending' && r.signature.status === 'pending') return SIGNATURE_STEPS.indexOf(r.signature.step);
  return 0;
}

export function deriveDailyCards(r: ReportRecord, rows: readonly DailyReadingRow[], now: Date): DailyCard[] {
  const states = checkpointStates(r, now);
  const p = checkpointProgress(r);
  const missing = states.filter((s) => s.state === 'missing').map((s) => s.label);
  const upcoming = states.filter((s) => s.state === 'upcoming').length;
  const confirmed = states.filter((s) => s.state === 'confirmed').length;
  const verify = states.filter((s) => s.state === 'needs-verify').map((s) => s.label);
  const flagged = flaggedReadings(rows, r.checkpoints.map((c) => c.key));
  const abnormal = flagged.filter((f) => f.level === 'abnormal').length;

  const sig = signatureOf(r, now);
  const signed = signedSteps(r, now);
  const sigSub =
    sig === 'signed'
      ? 'Đã đủ chữ ký'
      : sig === 'rejected'
        ? 'Bị trả lại – chờ Người kiểm tra ký lại'
        : sig === 'pending' && r.signature.status === 'pending'
          ? `Chờ ${SIGNATURE_STEP_LABEL[r.signature.step]}`
          : 'Chưa bắt đầu quy trình ký';
  const sigTone: DailyCardTone = sig === 'signed' ? 'success' : sig === 'rejected' ? 'danger' : sig === 'pending' ? 'warning' : 'neutral';

  return [
    {
      id: 'progress',
      value: `${p.done}/${p.total} mốc`,
      title: 'Tiến độ kiểm tra',
      sub: missing.length ? `Còn thiếu mốc ${listText(missing)}` : upcoming ? `Còn ${upcoming} mốc chưa tới hạn` : 'Đã đủ dữ liệu các mốc',
      tone: 'primary',
      percent: p.percent,
    },
    {
      id: 'confirmed',
      value: `${confirmed} mốc`,
      title: 'Dữ liệu đã xác nhận',
      sub: verify.length
        ? `Mốc ${listText(verify)} cần xác minh lại`
        : confirmed
          ? 'Toàn bộ dữ liệu hiện có đã được xác nhận'
          : 'Chưa có dữ liệu được xác nhận',
      tone: verify.length ? 'warning' : 'success',
    },
    {
      id: 'abnormal',
      value: String(flagged.length),
      title: 'Dữ liệu bất thường',
      sub: flagged.length ? listText(flagged.map((f) => `${f.device} lúc ${f.checkpoint}`)) : 'Chưa phát hiện bất thường trong ngày',
      tone: abnormal ? 'danger' : flagged.length ? 'warning' : 'success',
    },
    {
      id: 'missing',
      value: `${missing.length} mốc`,
      title: 'Dữ liệu còn thiếu',
      sub: missing.length ? `Chưa có dữ liệu lúc ${listText(missing, 3)}` : 'Không thiếu dữ liệu',
      tone: missing.length ? 'warning' : 'success',
    },
    {
      id: 'signature',
      value: `${signed}/${SIGNATURE_STEPS.length}`,
      title: 'Xác nhận báo cáo',
      sub: sigSub,
      tone: sigTone,
    },
  ];
}

// ============================================================================
// Lọc bảng (URL: q, group, result)
// ============================================================================

export const DAILY_DETAIL_PARAMS = {
  q: {},
  group: { values: DAILY_GROUP_IDS },
  result: { values: ROW_RESULTS },
} as const;

export type DailyDetailFilter = { q: string | null; group: DailyGroupId | null; result: RowResult | null };

/** Tìm không dấu theo hạng mục + thiết bị; nhóm; kết quả dòng. */
export function matchReadingRow(row: DailyReadingRow, f: DailyDetailFilter): boolean {
  if (f.group && row.groupId !== f.group) return false;
  if (f.result && rowResult(row) !== f.result) return false;
  const q = foldSearch(f.q ?? '');
  return !q || foldSearch(`${row.label} ${row.device}`).includes(q);
}
