/** Lõi mô phỏng: kiểu phiên, mô hình diễn biến (tăng → đỉnh → ESD ảo giảm), mốc cảnh báo / AI. Tách từ monitor.ts. */
import type { TagValue } from '@/features/live/types';
import { referenceReading, type LeakRate, type ScenarioConfig, type ScenarioSetup, type SimVariable } from './config';
import type { Scenario } from './scenarios';
import { withUnit } from '@/lib/number';

export type LiveMap = Readonly<Record<string, TagValue>> | undefined;

/** Chữ riêng của màn theo dõi / kết quả cho từng kịch bản (mock – SC-001 nguyên văn ảnh). */
export type MonitorSetup = {
  /** Chủ ngữ ngắn: "Nồng độ" → "Nồng độ hiện tại" (KPI), "Nồng độ đạt 28% LEL" (timeline), "Nồng độ thực tế" (chú thích). */
  subject: string;
  /** Tín hiệu khởi tạo: "tín hiệu gas" → "Khởi tạo tín hiệu gas mô phỏng từ trạng thái tham chiếu PLC/SCADA." */
  signal: string;
  /** Đối tượng trong mô tả cảnh báo: "Nồng độ Gas khu vực V-101". */
  alertSubject: string;
  /** Tiêu đề cảnh báo High (vượt ngưỡng PLC) ở màn theo dõi: "Gas khu vực bồn vượt ngưỡng cảnh báo PLC". */
  alertTitle: string;
  /** Tiêu đề cảnh báo High-High (chạm mục tiêu) ở màn theo dõi. */
  peakTitle: string;
  /** Câu khuyến nghị kèm High-High: "Gợi ý rà soát quy trình ESD mô phỏng nếu vượt mức nguy hiểm." */
  peakAdvice: string;
  /** Kèm mốc "AI ghi nhận xu hướng": "Gợi ý kiểm tra van xả mô phỏng." */
  watchAdvice: string;
  /** Dòng timeline theo dõi khi AI đưa gợi ý: "[Mô phỏng] Gợi ý thực hiện quy trình cô lập khu vực theo SOP". */
  aiAction: string;
  /** Mô tả mốc đó ở màn kết quả: "AI gợi ý rà soát quy trình cô lập khu vực theo SOP mô phỏng." */
  aiDetail: string;
  /** Pha giảm: "Nồng độ gas bắt đầu giảm" + mô tả. */
  recoveryTitle: string;
  recoveryDetail: string;
  /** Về dưới mức theo dõi: "Nồng độ dưới ngưỡng nguy hiểm". */
  recoveredTitle: string;
  /** Cụm cuối câu tóm tắt AI: "khu vực bồn LPG". */
  reviewArea: string;
  /** Danh sách gợi ý AI (đánh số). */
  recommendations: readonly string[];
  /** Màn kết quả. */
  result: {
    /** KPI "Gas cao nhất". */
    peakLabel: string;
    /** Tên tiêu chí gợi ý AI: "Gợi ý AI (Virtual ESD)". */
    aiCriterion: string;
    /** Câu đề nghị tiếp theo khi Đạt: "Nên tiếp tục chạy thêm kịch bản …". */
    next: string;
    strengths: readonly string[];
    improvements: readonly string[];
  };
};

/** Một dòng "Dữ liệu PLC/SCADA tham chiếu" – CHỤP lúc bắt đầu (null = mất tín hiệu lúc chụp). */
export type ReferenceSnapshotRow = {
  id: string;
  /** Tên tag PLC ("Tank_Gas_Detector"). */
  label: string;
  /** Nhãn ngắn màn kết quả ("Gas nền (thực tế)"); không có → không hiện ở danh sách rút gọn. */
  shortLabel?: string;
  valueText: string | null;
};

export type ReportState = {
  /** "Thêm vào báo cáo" gợi ý AI. */
  aiIncluded?: boolean;
  /** "Bỏ qua" gợi ý AI. */
  aiDismissed?: boolean;
  /** ISO – lần xuất Excel (CSV) gần nhất. */
  excelAt?: string;
};

/** Một lượt mô phỏng đang chạy / đã xong (store riêng; khi xong mới ghi `SimulationRun` vào lịch sử). */
export type SimulationSession = {
  id: string;
  scenarioId: string;
  /** ISO – giờ ứng dụng lúc bắt đầu. */
  startedAt: string;
  by: string;
  /** Tham số dùng cho lượt (bản sao lúc bắt đầu). */
  config: ScenarioConfig;
  /** Giá trị thực tế của biến chính lúc bắt đầu. */
  startValue: number;
  reference: readonly ReferenceSnapshotRow[];
  /** Tình trạng 21 tag PLC/SCADA lúc bắt đầu ("Số biến tham chiếu", "Đã đồng bộ…"). */
  referenceHealth?: { ok: number; total: number };
  /** ISO – người dùng bấm "Dừng mô phỏng". */
  stoppedAt?: string;
  /** Mã lượt đã ghi vào lịch sử (lượt đã kết thúc). */
  runId?: string;
  report?: ReportState;
};

/**
 * Tỉ lệ thời lượng để biến chạm mục tiêu theo tốc độ: nhanh 50 % (ảnh Kết quả: 35 % LEL ở phút 5/10), vừa 94 % (ảnh Theo
 * dõi: vượt 20 % quanh 05:00, 28 % lúc 06:32), chậm 125 % (không chạm). GIẢ ĐỊNH – docs/questions.md 17.
 */
const RATE_REACH: Record<LeakRate, number> = { fast: 0.5, medium: 0.94, slow: 1.25 };
/** Pha giảm (ESD ảo) kéo dài nửa thời lượng, về mức ban đầu + 5 % biên độ (ảnh: 35 → ~2 % LEL trong 5 phút). */
const RECOVERY_SHARE = 0.5;
const RECOVERY_FLOOR = 0.05;
/** Mức "AI ghi nhận xu hướng" = 75 % quãng đường tới ngưỡng PLC (ảnh: 15 % khi ngưỡng 20 %). */
const WATCH_SHARE = 0.75;

export type SimProfile = { start: number; target: number; durationSec: number; rate: LeakRate };

export const profileOf = (s: Pick<SimulationSession, 'startValue' | 'config'>): SimProfile => ({
  start: s.startValue,
  target: s.config.target,
  durationSec: s.config.durationMin * 60,
  rate: s.config.rate,
});

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Giây chạm mục tiêu (đỉnh); không chạm trong thời lượng → undefined. */
export function peakSec(p: SimProfile): number | undefined {
  const reach = p.durationSec * RATE_REACH[p.rate];
  return reach <= p.durationSec ? Math.round(reach) : undefined;
}

export function valueAt(p: SimProfile, sec: number): number {
  const reach = p.durationSec * RATE_REACH[p.rate];
  const amp = p.target - p.start;
  if (sec <= reach || reach > p.durationSec) {
    const x = reach > 0 ? clamp(sec / reach, 0, 1) : 1;
    return p.start + amp * x * x * (3 - 2 * x);
  }
  const floor = p.start + amp * RECOVERY_FLOOR;
  const v = clamp((sec - reach) / (p.durationSec * RECOVERY_SHARE), 0, 1);
  return p.target - (p.target - floor) * v;
}

/** Đang ở pha giảm (sau đỉnh). */
export const recovering = (p: SimProfile, sec: number) => {
  const pk = peakSec(p);
  return pk !== undefined && sec > pk;
};

/** Giây nguyên đầu tiên trong [from, thời lượng] biến chạm `level` theo chiều `direction`; không chạm → undefined. */
function firstReach(p: SimProfile, level: number, direction: SimVariable['direction'], from = 0): number | undefined {
  const hit = (v: number) => (direction === 'above' ? v >= level : v <= level);
  for (let s = Math.max(0, Math.ceil(from)); s <= p.durationSec; s++) if (hit(valueAt(p, s))) return s;
  return undefined;
}

const flip = (d: SimVariable['direction']): SimVariable['direction'] => (d === 'above' ? 'below' : 'above');

/** Dòng cố định cuối bảng: mô phỏng không điều khiển van. */
const VALVE_ROW: ReferenceSnapshotRow = { id: 'valve', label: 'Van điều khiển', valueText: 'Theo quy trình SOP' };

/** Chụp bảng tham chiếu (bỏ heartbeat) – tên tag PLC + giá trị lúc bắt đầu; mất tín hiệu → null (không số cũ). */
export function referenceSnapshot(setup: Pick<ScenarioSetup, 'referenceRows'>, live: LiveMap, now: number): ReferenceSnapshotRow[] {
  const rows = setup.referenceRows
    .filter((r) => r.kind !== 'heartbeat')
    .map((r) => {
      const v = referenceReading(r, live?.[r.tag], now).valueText;
      return { id: r.id, label: r.plcTag, ...(r.shortLabel ? { shortLabel: r.shortLabel } : {}), valueText: v === null ? null : withUnit(v, r.unit) };
    });
  return [...rows, VALVE_ROW];
}

/** Độ trễ (giây) từ lúc chạm mức tới cảnh báo SCADA: cộng các bước tới bước 'alarm' (không có → bước đầu). */
function alarmOffset(steps: Scenario['steps']): number {
  const i = steps.findIndex((x) => x.id === 'alarm');
  const upto = i >= 0 ? i : Math.min(0, steps.length - 1);
  return steps.slice(0, upto + 1).reduce((sum, x) => sum + x.seconds, 0);
}

/** Độ trễ tới gợi ý AI: bước ngay sau cảnh báo (đề xuất ESD / giảm tải / chuyển máy…). */
function aiOffset(steps: Scenario['steps']): number {
  const i = steps.findIndex((x) => x.id === 'alarm');
  const next = steps[(i >= 0 ? i : 0) + 1];
  return alarmOffset(steps) + (next?.seconds ?? 0);
}

/** AI ghi nhận xu hướng giảm sau đỉnh (giây). */
const RECOVERY_NOTICE_SEC = 60;

export type MonitorMarks = {
  /** Mức "AI ghi nhận xu hướng" (giá trị). */
  watchLevel: number;
  watch?: number;
  /** Chạm ngưỡng cảnh báo PLC. */
  cross?: number;
  /** Cảnh báo High được phát. */
  alert?: number;
  /** AI đưa gợi ý. */
  ai?: number;
  /** Chạm mục tiêu (đỉnh). */
  peak?: number;
  /** Cảnh báo High-High được phát. */
  peakAlert?: number;
  /** AI ghi nhận xu hướng giảm. */
  recovery?: number;
  /** Về lại dưới mức theo dõi. */
  recovered?: number;
};

export function monitorMarks(s: Pick<Scenario, 'steps' | 'setup'>, p: SimProfile): MonitorMarks {
  const v = s.setup.variable;
  const within = (x: number | undefined) => (x !== undefined && x <= p.durationSec ? x : undefined);
  const watchLevel = p.start + (v.threshold - p.start) * WATCH_SHARE;
  const cross = firstReach(p, v.threshold, v.direction);
  const peak = peakSec(p);
  return {
    watchLevel,
    watch: firstReach(p, watchLevel, v.direction),
    cross,
    alert: cross === undefined ? undefined : within(cross + alarmOffset(s.steps)),
    ai: cross === undefined ? undefined : within(cross + aiOffset(s.steps)),
    peak,
    peakAlert: peak === undefined ? undefined : within(peak + alarmOffset(s.steps)),
    recovery: peak === undefined ? undefined : within(peak + RECOVERY_NOTICE_SEC),
    recovered: peak === undefined ? undefined : firstReach(p, watchLevel, flip(v.direction), peak + 1),
  };
}
