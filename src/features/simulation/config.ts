/*
 * Cấu hình kịch bản mô phỏng (ảnh người dùng gửi 03/11/2026 – `scratch/figma-ref/ai-sim-config/`) – logic THUẦN:
 * tham số đầu vào, kiểm tra hợp lệ, số liệu tham chiếu, trạng thái sẵn sàng, gợi ý AI theo kịch bản, lịch sử của một kịch bản.
 * `now` truyền vào. Cấu hình chỉ đổi lớp mô phỏng – không đổi ngưỡng / cấu hình PLC thật.
 */
import { SIGNAL_LOST_LABEL, freshNumber, freshValue } from '@/features/live/signal';
import type { TagValue } from '@/features/live/types';
import { formatDayVi, plantDayKey, plantTimeOfDay } from '@/lib/plantTime';
import type { MonitorSetup } from './monitor';
import { byNewestRun, healthSynced, type RunBlocker, type Scenario, type SimulationRun, type TagHealth } from './scenarios';

// ---------------------------------------------------------------------------
// Lựa chọn của form

export const LEAK_RATES = ['slow', 'medium', 'fast'] as const;
export type LeakRate = (typeof LEAK_RATES)[number];

export type SimDirection = 'above' | 'below';

/** "Tăng nhanh" (biến tăng – gas, áp suất, độ trễ) · "Giảm nhanh" (biến giảm – nhiệt độ ra hóa hơi). */
export function leakRateLabel(rate: LeakRate, direction: SimDirection): string {
  const verb = direction === 'above' ? 'Tăng' : 'Giảm';
  return `${verb} ${{ slow: 'chậm', medium: 'vừa', fast: 'nhanh' }[rate]}`;
}

/** Thời lượng mô phỏng (phút). */
export const DURATION_OPTIONS = [5, 10, 15, 20, 30] as const;

export const END_CONDITIONS = ['duration', 'back-to-normal', 'manual-stop', 'ai-enough-data'] as const;
export type EndCondition = (typeof END_CONDITIONS)[number];

/** Nhãn điều kiện kết thúc – "về dưới ngưỡng" theo biến của kịch bản ("nồng độ gas", "áp suất bồn"…). */
export function endConditionLabel(c: EndCondition, v: Pick<SimVariable, 'noun' | 'direction'>): string {
  switch (c) {
    case 'duration':
      return 'Kết thúc khi hết thời lượng mô phỏng';
    case 'back-to-normal':
      return `Kết thúc khi ${v.noun} về ${v.direction === 'above' ? 'dưới' : 'trên'} ngưỡng`;
    case 'manual-stop':
      return 'Kết thúc khi người dùng dừng mô phỏng';
    case 'ai-enough-data':
      return 'Kết thúc khi AI đánh giá đã đủ dữ liệu phân tích';
  }
}

// ---------------------------------------------------------------------------
// Kiểu

export type SimUnit = '%' | 'bar' | '°C' | 's';

/** Biến chính được mô phỏng (gas % LEL, áp suất bar…) – thanh trượt "mục tiêu" + ô "bắt đầu (thực tế hiện tại)". */
export type SimVariable = {
  /** Danh từ trong câu: "nồng độ gas". */
  noun: string;
  /** "Nồng độ bắt đầu (Thực tế hiện tại)" */
  startLabel: string;
  /** "Nồng độ mục tiêu mô phỏng" */
  targetLabel: string;
  /** "Tốc độ rò rỉ" */
  rateLabel: string;
  /** Tag SCADA đọc giá trị hiện tại. */
  tag: string;
  /** Tên tag PLC hiển thị ("Source: Tank_Gas_Detector"). */
  plcTag: string;
  unit: SimUnit;
  /** Chữ sau đơn vị: "LEL" → "35% LEL". */
  qualifier?: string;
  /** Số chữ số thập phân khi hiển thị. */
  digits: number;
  min: number;
  max: number;
  step: number;
  /** Ngưỡng cảnh báo PLC (vạch vàng trên thanh trượt). */
  threshold: number;
  /** "Ngưỡng cảnh báo PLC" */
  thresholdLabel: string;
  /** above = vượt lên là bất thường (gas, áp suất) · below = xuống dưới là bất thường (nhiệt độ ra hóa hơi). */
  direction: SimDirection;
  /** Dòng gợi ý dưới thanh trượt ("Gợi ý quy trình ESD mô phỏng nếu vượt mức nguy hiểm."). */
  hint?: string;
};

/** Một dòng bảng "Dữ liệu PLC/SCADA tham chiếu". */
export type ReferenceRow = {
  id: string;
  label: string;
  /** Tên tag PLC hiển thị dưới nhãn (cyan). */
  plcTag: string;
  /** Nhãn ngắn ở "Dữ liệu PLC/SCADA tham chiếu" màn Kết quả ("Áp suất V-101"). */
  shortLabel?: string;
  /** Tag SCADA đọc số liệu. */
  tag: string;
  /** Đơn vị hiển thị ("%LEL", "bar"…); heartbeat → "—". */
  unit: string;
  digits: number;
  /** Ngưỡng tô trạng thái (theo `direction`, mặc định above). */
  limits?: { warn?: number; danger?: number; direction?: SimDirection };
  /** heartbeat = tag chuỗi 'ok' | 'lost' (PLC_Heartbeat). */
  kind?: 'number' | 'heartbeat';
};

export type ScenarioSetup = {
  /** "Rò rỉ LPG" (Loại sự cố). */
  incidentType: string;
  /** "Bồn V-101" (Thiết bị liên quan). */
  equipment: string;
  /** Câu mô tả trong khung bóng đèn. */
  description: string;
  variable: SimVariable;
  referenceRows: readonly ReferenceRow[];
  /** "Khu vực ảnh hưởng" chọn được. */
  areaOptions: readonly string[];
  /** "Kết quả mong đợi của mô phỏng". */
  expectedOutcomes: readonly string[];
  /** Gợi ý AI cho kịch bản (luật – TODO(backend): dịch vụ AI). */
  suggestion: {
    target: number;
    durationMin: number;
    /** "phù hợp để kiểm tra khả năng phát hiện cảnh báo gas và quy trình phản ứng an toàn" */
    purpose: string;
    /** "đánh giá cảnh báo, phân tích xu hướng và gợi ý xử lý" */
    goal: string;
    /** Tên dữ liệu tham chiếu ("Tank_Gas_Detector", "PLC/SCADA"). */
    refs: readonly string[];
  };
  /** Chữ riêng của màn "Theo dõi diễn biến mô phỏng". */
  monitor: MonitorSetup;
};

/** Phần người dùng sửa được ("Tham số đầu vào"). */
export type ScenarioConfig = {
  target: number;
  durationMin: number;
  rate: LeakRate;
  endCondition: EndCondition;
  areas: readonly string[];
};

// ---------------------------------------------------------------------------
// Hiển thị số + đơn vị

const fixed = (v: number, digits: number) => v.toFixed(digits);

/** Hạ chữ đầu, giữ viết hoa phần sau ("Ngưỡng cảnh báo PLC" → "ngưỡng cảnh báo PLC"). */
export const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** "35%" · "12 bar" · "40 °C" · "30 s" (không có qualifier). */
export function formatQty(v: number, unit: SimUnit, digits = 0): string {
  return unit === '%' ? `${fixed(v, digits)}%` : `${fixed(v, digits)} ${unit}`;
}

/** "35% LEL" – có qualifier. */
export function formatVariable(v: number, variable: Pick<SimVariable, 'unit' | 'qualifier' | 'digits'>): string {
  const q = formatQty(v, variable.unit, variable.digits);
  return variable.qualifier ? `${q} ${variable.qualifier}` : q;
}

/** Mục tiêu chạm ngưỡng cảnh báo PLC (≥ khi above, ≤ khi below) → mô phỏng sẽ phát cảnh báo. */
export function reachesThreshold(variable: Pick<SimVariable, 'threshold' | 'direction'>, value: number): boolean {
  return variable.direction === 'above' ? value >= variable.threshold : value <= variable.threshold;
}

/** Vị trí (0–100 %) của giá trị trên thang [min, max] – vạch ngưỡng, nút kéo. */
export function scalePercent(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return ((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100;
}

// ---------------------------------------------------------------------------
// Kiểm tra cấu hình

export type ConfigCheck = {
  /** Chặn lưu / chạy. */
  errors: { target?: string; durationMin?: string; areas?: string };
  /** Chỉ nhắc (vẫn lưu / chạy được). */
  warnings: { target?: string };
};

export function checkConfig(config: ScenarioConfig, setup: Pick<ScenarioSetup, 'variable' | 'areaOptions'>): ConfigCheck {
  const v = setup.variable;
  const errors: ConfigCheck['errors'] = {};
  const warnings: ConfigCheck['warnings'] = {};
  if (!Number.isFinite(config.target) || config.target < v.min || config.target > v.max) {
    errors.target = `Giá trị mục tiêu phải trong khoảng ${formatVariable(v.min, v)} – ${formatVariable(v.max, v)}.`;
  } else if (!reachesThreshold(v, config.target)) {
    warnings.target = `Mục tiêu chưa ${v.direction === 'above' ? 'vượt' : 'xuống dưới'} ${lowerFirst(v.thresholdLabel)} (${formatVariable(v.threshold, v)}) – mô phỏng sẽ không phát cảnh báo.`;
  }
  if (!(DURATION_OPTIONS as readonly number[]).includes(config.durationMin)) errors.durationMin = 'Chọn thời lượng mô phỏng.';
  const valid = config.areas.filter((a) => setup.areaOptions.includes(a));
  if (valid.length === 0) errors.areas = 'Chọn ít nhất một khu vực ảnh hưởng.';
  return { errors, warnings };
}

export const configValid = (c: ConfigCheck) => Object.keys(c.errors).length === 0;

/** Hai cấu hình giống nhau (khu vực so theo tập, không theo thứ tự). */
export function sameConfig(a: ScenarioConfig, b: ScenarioConfig): boolean {
  if (a.target !== b.target || a.durationMin !== b.durationMin || a.rate !== b.rate || a.endCondition !== b.endCondition) return false;
  const sa = new Set(a.areas);
  const sb = new Set(b.areas);
  return sa.size === sb.size && [...sa].every((x) => sb.has(x));
}

/** Khu vực theo thứ tự danh sách lựa chọn (tóm tắt + lưu). */
export const orderedAreas = (areas: readonly string[], options: readonly string[]) => options.filter((o) => areas.includes(o));

// ---------------------------------------------------------------------------
// Số liệu tham chiếu

export type ReferenceStatus = 'normal' | 'warning' | 'danger' | 'online' | 'offline' | 'lost';

export const REFERENCE_STATUS_LABEL: Record<ReferenceStatus, string> = {
  normal: 'Bình thường',
  warning: 'Cảnh báo',
  danger: 'Nguy hiểm',
  online: 'Trực tuyến',
  offline: 'Ngoại tuyến',
  lost: SIGNAL_LOST_LABEL,
};

export type ReferenceReading = {
  /** null = mất tín hiệu (KHÔNG hiện số cũ). */
  valueText: string | null;
  status: ReferenceStatus;
};

function levelOf(v: number, limits: ReferenceRow['limits']): ReferenceStatus {
  if (!limits) return 'normal';
  const above = (limits.direction ?? 'above') === 'above';
  const hit = (x: number | undefined) => x !== undefined && (above ? v >= x : v <= x);
  if (hit(limits.danger)) return 'danger';
  if (hit(limits.warn)) return 'warning';
  return 'normal';
}

/** Giá trị + trạng thái một dòng tham chiếu. Mất tín hiệu (thiếu / bad / ≥ 10 s) → "Mất tín hiệu", không số. */
export function referenceReading(row: ReferenceRow, tv: TagValue | undefined, now: number): ReferenceReading {
  if (row.kind === 'heartbeat') {
    const v = freshValue(tv, now);
    if (v === undefined) return { valueText: null, status: 'lost' };
    return v === 'ok' ? { valueText: 'Bình thường', status: 'online' } : { valueText: 'Mất heartbeat', status: 'offline' };
  }
  const n = freshNumber(tv, now);
  if (n === undefined) return { valueText: null, status: 'lost' };
  return { valueText: fixed(n, row.digits), status: levelOf(n, row.limits) };
}

/** Giá trị hiện tại của biến chính ("Nồng độ bắt đầu") – undefined khi mất tín hiệu. */
export const startValue = (v: Pick<SimVariable, 'tag'>, live: Readonly<Record<string, TagValue>> | undefined, now: number) =>
  freshNumber(live?.[v.tag], now);

/** Tag mà kịch bản đọc trên màn cấu hình (biến chính + bảng tham chiếu). */
export const setupTags = (setup: Pick<ScenarioSetup, 'variable' | 'referenceRows'>) => [
  ...new Set([setup.variable.tag, ...setup.referenceRows.map((r) => r.tag)]),
];

// ---------------------------------------------------------------------------
// Trạng thái

export type DataSyncState = 'synced' | 'missing' | 'pending';
export const DATA_SYNC_LABEL: Record<DataSyncState, string> = { synced: 'Đã đồng bộ', missing: 'Thiếu dữ liệu', pending: 'Đang kết nối' };

export const dataSyncState = (h: TagHealth | undefined): DataSyncState => (!h ? 'pending' : healthSynced(h) ? 'synced' : 'missing');

export type Readiness = {
  tone: 'success' | 'warning' | 'muted';
  /** "Sẵn sàng mô phỏng" (Thông tin kịch bản). */
  label: string;
  /** "Sẵn sàng" (Tóm tắt cấu hình). */
  short: string;
  /** "Sẵn sàng chạy mô phỏng" (khối Trạng thái sẵn sàng). */
  headline: string;
};

/** Từ lý do không chạy được (`runBlocker`) + lỗi cấu hình → nhãn trạng thái. Thứ tự: blocker → lỗi cấu hình → sẵn sàng. */
export function readiness(blocker: RunBlocker | null, configOk: boolean): Readiness {
  if (blocker?.kind === 'config') return { tone: 'warning', label: 'Cần cấu hình mapping', short: 'Cần cấu hình', headline: 'Cần cấu hình mapping trước khi chạy' };
  if (blocker?.kind === 'pending') return { tone: 'muted', label: 'Đang tải dữ liệu', short: 'Đang tải', headline: 'Đang tải dữ liệu tham chiếu…' };
  if (blocker?.kind === 'signal') return { tone: 'warning', label: 'Thiếu dữ liệu tham chiếu', short: 'Thiếu dữ liệu', headline: 'Chưa sẵn sàng – thiếu dữ liệu tham chiếu' };
  if (!configOk) return { tone: 'warning', label: 'Cấu hình chưa hợp lệ', short: 'Chưa hợp lệ', headline: 'Chưa sẵn sàng – cấu hình chưa hợp lệ' };
  return { tone: 'success', label: 'Sẵn sàng mô phỏng', short: 'Sẵn sàng', headline: 'Sẵn sàng chạy mô phỏng' };
}

// ---------------------------------------------------------------------------
// Gợi ý AI cho một kịch bản (luật – TODO(backend): dịch vụ AI thật)

export type ConfigSuggestion =
  | { kind: 'run'; lead: string; target: number; targetText: string; durationMin: number; goal: string; refs: readonly string[]; confidence: number }
  | { kind: 'check-data'; text: string; refs: readonly string[]; confidence: number };

/**
 * - Chưa có số liệu → null.
 * - Thông số PLC/SCADA thiếu → đề nghị kiểm tra dữ liệu trước (không gợi ý mức chạy).
 * - Đủ → "Kịch bản … {purpose}. Nên chạy với mức {target} trong {phút} để {goal}." (mức/phút theo `setup.suggestion`).
 * `confidence` tính sẵn bằng `suggestionConfidence` (cùng công thức màn danh sách).
 */
export function configSuggestion(s: Pick<Scenario, 'title' | 'setup'>, health: TagHealth | undefined, confidence: number): ConfigSuggestion | null {
  if (!health) return null;
  const sg = s.setup.suggestion;
  const lost = health.total - health.ok;
  if (lost > 0) {
    return {
      kind: 'check-data',
      text: `Có ${lost}/${health.total} thông số PLC/SCADA không khả dụng. Nên kiểm tra kết nối và dữ liệu tham chiếu trước khi chạy kịch bản ${lowerFirst(s.title)}.`,
      refs: sg.refs,
      confidence,
    };
  }
  return {
    kind: 'run',
    lead: `Kịch bản ${lowerFirst(s.title)} ${sg.purpose}.`,
    target: sg.target,
    targetText: formatVariable(sg.target, s.setup.variable),
    durationMin: sg.durationMin,
    goal: sg.goal,
    refs: sg.refs,
    confidence,
  };
}

/** Cấu hình đã khớp mức + thời lượng gợi ý. */
export const suggestionApplied = (c: ScenarioConfig, sg: ConfigSuggestion | null) =>
  sg?.kind === 'run' && c.target === sg.target && c.durationMin === sg.durationMin;

// ---------------------------------------------------------------------------
// Lịch sử của một kịch bản

export const scenarioRuns = (scenarioId: string, runs: readonly SimulationRun[]) => runs.filter((r) => r.scenarioId === scenarioId).sort(byNewestRun);

/** "24/06/2026 · 15:30" (giờ nhà máy). */
export function runDateTimeText(iso: string): string {
  const at = new Date(iso);
  return `${formatDayVi(plantDayKey(at))} · ${plantTimeOfDay(at).slice(0, 5)}`;
}

/** Ghi chú mặc định của lượt chạy mới (người dùng chưa ghi chú). */
export function defaultRunNote(r: Pick<SimulationRun, 'result' | 'responseSeconds' | 'targetSeconds'>): string {
  return r.result === 'pass'
    ? `Phản ứng ${r.responseSeconds} s, trong mục tiêu ${r.targetSeconds} s.`
    : `Phản ứng ${r.responseSeconds} s, vượt mục tiêu ${r.targetSeconds} s.`;
}
