/*
 * AI mô phỏng sự cố (ảnh thiết kế 02/11/2026, `scratch/figma-ref/ai-sim/`) – logic THUẦN: kịch bản, sức khoẻ dữ liệu PLC,
 * điều kiện chạy, "động cơ" mô phỏng (xác định), lịch sử, KPI, góp ý AI, lọc. `now` truyền vào.
 *
 * Mô phỏng CHỈ tính trên cấu hình kịch bản + dữ liệu tham chiếu – không gửi lệnh PLC, không đổi trạng thái thiết bị,
 * không tạo cảnh báo thật (khối "Quy tắc an toàn").
 */
import { STALE_MS } from '@/features/live/signal';
import type { TagValue } from '@/features/live/types';
import { foldSearch } from '@/lib/foldSearch';
import { dayNumber, formatDayVi, plantDayKey, plantTimeOfDay } from '@/lib/plantTime';
import type { ScenarioConfig, ScenarioSetup } from './config';

export const SCENARIO_GROUPS = ['gas-leak', 'pressure', 'equipment', 'communication', 'fire'] as const;
export type ScenarioGroup = (typeof SCENARIO_GROUPS)[number];
export const SCENARIO_GROUP_LABEL: Record<ScenarioGroup, string> = {
  'gas-leak': 'Rò rỉ khí',
  pressure: 'Áp suất',
  equipment: 'Thiết bị',
  communication: 'Truyền thông',
  fire: 'Báo cháy',
};

export const SCENARIO_RISKS = ['critical', 'high', 'medium'] as const;
export type ScenarioRisk = (typeof SCENARIO_RISKS)[number];
export const SCENARIO_RISK_LABEL: Record<ScenarioRisk, string> = { critical: 'Nghiêm trọng', high: 'Cao', medium: 'Trung bình' };

/** ready = Sẵn sàng · needs-config = Cần cấu hình mapping (thiếu ánh xạ tag/tham số). */
export const SCENARIO_STATUSES = ['ready', 'needs-config'] as const;
export type ScenarioStatus = (typeof SCENARIO_STATUSES)[number];
export const SCENARIO_STATUS_LABEL: Record<ScenarioStatus, string> = { ready: 'Sẵn sàng', 'needs-config': 'Cần cấu hình mapping' };

export type ScenarioIcon = 'gas' | 'pressure' | 'vaporizer' | 'link' | 'fire';

/** Một bước phản ứng của hệ thống / người vận hành (giây) – cộng lại = thời gian phản ứng mô phỏng. */
export type ResponseStep = { id: string; label: string; seconds: number };

export type Scenario = {
  id: string;
  /** "SC-001" */
  code: string;
  title: string;
  /** Nhãn ngắn trong "Lịch sử gần đây": "SC-001 (Khu bồn)". */
  shortLabel: string;
  /** Cụm từ trong câu góp ý AI: "rò rỉ LPG". */
  suggestLabel: string;
  group: ScenarioGroup;
  risk: ScenarioRisk;
  area: string;
  status: ScenarioStatus;
  icon: ScenarioIcon;
  /** Tên biến PLC hiển thị ("Dữ liệu PLC"). */
  plcVariables: readonly string[];
  /** Tag SCADA tham chiếu – phải còn tín hiệu mới chạy được. */
  tags: readonly string[];
  /** "Gas vượt 20% LEL" */
  threshold: string;
  /** "Gợi ý quy trình ESD mô phỏng" */
  outcome: string;
  steps: readonly ResponseStep[];
  /** Thời gian phản ứng mục tiêu (giây) – vượt → "Cần cải thiện". */
  targetSeconds: number;
  /** Ánh xạ còn thiếu (status needs-config). */
  missingMappings?: readonly string[];
  /** ISO – lần cập nhật cấu hình. */
  updatedAt: string;
  /** Thông tin cố định của màn "Cấu hình kịch bản" (loại sự cố, biến mô phỏng, bảng tham chiếu…). */
  setup: ScenarioSetup;
  /** Tham số đầu vào đang lưu (sửa ở màn cấu hình). */
  config: ScenarioConfig;
};

export type RunResult = 'pass' | 'improve';
export const RUN_RESULT_LABEL: Record<RunResult, string> = { pass: 'Đạt', improve: 'Cần cải thiện' };

export type SimulationRun = {
  id: string;
  scenarioId: string;
  /** ISO */
  at: string;
  result: RunResult;
  responseSeconds: number;
  targetSeconds: number;
  by: string;
  /** "Ghi chú: …" (Lịch sử kịch bản này). */
  note?: string;
  /** Tham số dùng cho lượt chạy (lượt mẫu cũ có thể không có). */
  config?: ScenarioConfig;
};

// ---------------------------------------------------------------------------
// Sức khoẻ dữ liệu PLC/SCADA (khối "Dữ liệu PLC/SCADA" + KPI "Dữ liệu PLC tham chiếu")

type LiveMap = Readonly<Record<string, TagValue>> | undefined;

export type TagHealth = {
  total: number;
  ok: number;
  /** quality 'bad' – "Cảm biến lỗi". */
  bad: number;
  /** Không có trong dữ liệu – "Mất kết nối". */
  missing: number;
  /** ≥ STALE_MS không cập nhật – "Dữ liệu cũ". */
  stale: number;
  /** ms – lần cập nhật mới nhất trong các tag; không có → undefined. */
  lastUpdate?: number;
};

/** Phân loại tag giám sát (không trùng). Mỗi tag thuộc đúng một nhóm: thiếu → lỗi → cũ → tốt. Chưa có số liệu → undefined. */
export function tagHealth(tags: readonly string[], live: LiveMap, now: number): TagHealth | undefined {
  if (!live) return undefined;
  const unique = [...new Set(tags)];
  const h: TagHealth = { total: unique.length, ok: 0, bad: 0, missing: 0, stale: 0 };
  for (const t of unique) {
    const tv = live[t];
    if (!tv) h.missing += 1;
    else if (tv.quality === 'bad') h.bad += 1;
    else if (now - tv.ts >= STALE_MS) h.stale += 1;
    else h.ok += 1;
    if (tv && (h.lastUpdate === undefined || tv.ts > h.lastUpdate)) h.lastUpdate = tv.ts;
  }
  return h;
}

export const healthSynced = (h: TagHealth | undefined) => !!h && h.ok === h.total;

// ---------------------------------------------------------------------------
// Điều kiện chạy

export type RunBlocker = { kind: 'config' | 'pending' | 'signal'; text: string };

/** Tag của kịch bản đang mất tín hiệu (thiếu / lỗi / cũ). */
export function lostScenarioTags(s: Pick<Scenario, 'tags'>, live: LiveMap, now: number): string[] {
  if (!live) return [];
  return s.tags.filter((t) => {
    const tv = live[t];
    return !tv || tv.quality === 'bad' || now - tv.ts >= STALE_MS;
  });
}

/** Lý do KHÔNG chạy được (null = chạy được). Thứ tự: cấu hình → chưa có dữ liệu → mất tín hiệu. */
export function runBlocker(s: Scenario, live: LiveMap, now: number): RunBlocker | null {
  if (s.status === 'needs-config') {
    const list = s.missingMappings?.length ? `: ${s.missingMappings.join('; ')}` : '';
    return { kind: 'config', text: `Cần cấu hình mapping trước khi chạy${list}.` };
  }
  if (!live) return { kind: 'pending', text: 'Đang tải dữ liệu PLC/SCADA tham chiếu…' };
  const lost = lostScenarioTags(s, live, now);
  if (lost.length) return { kind: 'signal', text: `Thiếu dữ liệu tham chiếu: ${lost.join(', ')} mất tín hiệu.` };
  return null;
}

// ---------------------------------------------------------------------------
// Mô phỏng (xác định – cùng cấu hình → cùng kết quả)

export const responseSeconds = (s: Pick<Scenario, 'steps'>) => s.steps.reduce((sum, x) => sum + x.seconds, 0);

/** Đạt khi thời gian phản ứng ≤ mục tiêu. */
export const runResult = (seconds: number, target: number): RunResult => (seconds <= target ? 'pass' : 'improve');

/** Kết quả một lượt: tổng thời gian các bước so với mục tiêu. Kèm tham số đang lưu của kịch bản (nếu có). */
export function simulateScenario(s: Scenario, at: Date, by: string, id: string, note?: string): SimulationRun {
  const total = responseSeconds(s);
  return {
    id,
    scenarioId: s.id,
    at: at.toISOString(),
    result: runResult(total, s.targetSeconds),
    responseSeconds: total,
    targetSeconds: s.targetSeconds,
    by,
    ...(note ? { note } : {}),
    ...(s.config ? { config: { ...s.config, areas: [...s.config.areas] } } : {}),
  };
}

/** "Đạt – phản ứng 38 s / mục tiêu 60 s" */
export const runSummary = (r: SimulationRun) => `${RUN_RESULT_LABEL[r.result]} – phản ứng ${r.responseSeconds} s / mục tiêu ${r.targetSeconds} s`;

// ---------------------------------------------------------------------------
// Lịch sử

export const byNewestRun = (a: SimulationRun, b: SimulationRun) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id);

export function lastRunOf(scenarioId: string, runs: readonly SimulationRun[]): SimulationRun | undefined {
  let best: SimulationRun | undefined;
  for (const r of runs) if (r.scenarioId === scenarioId && (!best || byNewestRun(r, best) < 0)) best = r;
  return best;
}

const daysAgo = (iso: string, now: Date) => dayNumber(plantDayKey(now)) - dayNumber(plantDayKey(new Date(iso)));

/** Hôm nay "10:23" · hôm qua "Hôm qua, 14:05" · cũ hơn "30/10/2026, 08:00" (giờ nhà máy, 24 giờ). */
export function runTimeText(iso: string, now: Date): string {
  const at = new Date(iso);
  const hm = plantTimeOfDay(at).slice(0, 5);
  const d = daysAgo(iso, now);
  if (d === 0) return hm;
  if (d === 1) return `Hôm qua, ${hm}`;
  return `${formatDayVi(plantDayKey(at))}, ${hm}`;
}

/** "2 giờ trước" / "15 phút trước" / "3 ngày trước" / "Vừa xong". */
export function agoText(iso: string, now: Date): string {
  // Làm tròn phút: mốc tạo trong cùng lượt tải lệch vài ms không làm "2 giờ" thành "1 giờ".
  const min = Math.round((now.getTime() - Date.parse(iso)) / 60_000);
  if (min < 1) return 'Vừa xong';
  if (min < 60) return `${min} phút trước`;
  if (min < 1440) return `${Math.floor(min / 60)} giờ trước`;
  return `${Math.floor(min / 1440)} ngày trước`;
}

// ---------------------------------------------------------------------------
// KPI (4 thẻ)

export type SimulationKpis = {
  total: number;
  ready: number;
  runsToday: number;
  needsConfig: number;
  /** undefined = chưa có số liệu trực tiếp. */
  health: TagHealth | undefined;
};

export function deriveSimulationKpis(
  scenarios: readonly Scenario[],
  runs: readonly SimulationRun[],
  health: TagHealth | undefined,
  now: Date,
): SimulationKpis {
  return {
    total: scenarios.length,
    ready: scenarios.filter((s) => s.status === 'ready').length,
    // Không loại lượt "sau now": `now` của trang làm tròn theo phút, lượt vừa chạy có thể muộn hơn vài giây.
    runsToday: runs.filter((r) => daysAgo(r.at, now) <= 0).length,
    needsConfig: scenarios.filter((s) => s.status === 'needs-config').length,
    health,
  };
}

// ---------------------------------------------------------------------------
// Góp ý từ AI (luật đơn giản – TODO(backend): dịch vụ AI thật)

const COVERAGE_DAYS = 7;
const RISK_ORDER: Record<ScenarioRisk, number> = { critical: 0, high: 1, medium: 2 };

const joinVi = (xs: readonly string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} và ${xs[xs.length - 1]}`);

export type AiSuggestion = { text: string; /** 0–100 */ confidence: number };

/** Độ tin cậy (GIẢ ĐỊNH, 0–100) = 60 % × tỉ lệ thông số khả dụng + 40 % × tỉ lệ kịch bản đã chạy trong 7 ngày. */
export function suggestionConfidence(scenarios: readonly Scenario[], runs: readonly SimulationRun[], health: TagHealth, now: Date): number {
  const availability = health.total ? health.ok / health.total : 0;
  const covered = scenarios.filter((s) => runs.some((r) => r.scenarioId === s.id && daysAgo(r.at, now) < COVERAGE_DAYS)).length;
  const coverage = scenarios.length ? covered / scenarios.length : 0;
  return Math.round((0.6 * availability + 0.4 * coverage) * 100);
}

/**
 * - Dữ liệu chưa tải → null.
 * - Có tag mất tín hiệu → đề nghị kiểm tra kết nối trước.
 * - Ngược lại: ưu tiên kịch bản sẵn sàng có lần chạy gần nhất "Cần cải thiện", rồi mức Nghiêm trọng/Cao (theo thứ tự rủi ro).
 * - Độ tin cậy (GIẢ ĐỊNH) = 60 % × tỉ lệ thông số khả dụng + 40 % × tỉ lệ kịch bản đã chạy trong 7 ngày.
 */
export function aiSuggestion(
  scenarios: readonly Scenario[],
  runs: readonly SimulationRun[],
  health: TagHealth | undefined,
  now: Date,
): AiSuggestion | null {
  if (!health) return null;
  const confidence = suggestionConfidence(scenarios, runs, health, now);

  const lost = health.total - health.ok;
  if (lost > 0) {
    return {
      text: `Có ${lost}/${health.total} thông số PLC/SCADA không khả dụng. Nên kiểm tra kết nối và dữ liệu tham chiếu trước khi mô phỏng để kết quả phản ánh đúng hệ thống.`,
      confidence,
    };
  }
  const ready = scenarios.filter((s) => s.status === 'ready');
  const needsImprove = ready.filter((s) => lastRunOf(s.id, runs)?.result === 'improve');
  const priority = [
    ...needsImprove,
    ...ready
      .filter((s) => !needsImprove.includes(s) && s.risk !== 'medium')
      .sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk] || a.code.localeCompare(b.code)),
  ];
  const picked = (priority.length ? priority : ready).slice(0, 3).sort((a, b) => a.code.localeCompare(b.code));
  const text = picked.length
    ? `Dữ liệu vận hành hiện tại ổn định. Có thể ưu tiên mô phỏng các kịch bản ${joinVi(picked.map((s) => s.suggestLabel))} để kiểm tra khả năng phản ứng của hệ thống.`
    : 'Dữ liệu vận hành hiện tại ổn định. Chưa có kịch bản sẵn sàng – cần cấu hình mapping trước khi mô phỏng.';
  return { text, confidence };
}

// ---------------------------------------------------------------------------
// Lọc (URL: ?q=&group=&risk=&status=&area=)

export const SIMULATION_PARAMS = {
  q: { default: '' },
  group: { values: SCENARIO_GROUPS },
  risk: { values: SCENARIO_RISKS },
  status: { values: SCENARIO_STATUSES },
  area: {},
} as const;

export type ScenarioFilterValues = {
  q: string;
  group: ScenarioGroup | null;
  risk: ScenarioRisk | null;
  status: ScenarioStatus | null;
  area: string | null;
};

/** Tìm (không dấu) theo tên kịch bản, mã, tag, biến PLC, khu vực. */
export function matchScenario(s: Scenario, f: ScenarioFilterValues) {
  if (f.group && s.group !== f.group) return false;
  if (f.risk && s.risk !== f.risk) return false;
  if (f.status && s.status !== f.status) return false;
  if (f.area && s.area !== f.area) return false;
  const q = foldSearch(f.q.trim());
  if (!q) return true;
  return [s.title, s.code, s.area, ...s.tags, ...s.plcVariables].some((v) => foldSearch(v).includes(q));
}

/** Theo mã kịch bản (thứ tự như ảnh: SC-001 → SC-005). */
export const byScenarioCode = (a: Scenario, b: Scenario) => a.code.localeCompare(b.code);
