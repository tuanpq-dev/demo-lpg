/*
 * Kết quả mô phỏng (ảnh người dùng gửi 03/11/2026 – `scratch/figma-ref/ai-sim-result/`) – logic THUẦN tổng kết một lượt đã
 * kết thúc: KPI, đánh giá tổng quan + 4 ô, bảng tiêu chí, gợi ý AI sau lượt, điểm biểu đồ, nội dung báo cáo (CSV).
 * Mọi số suy từ lượt (`SimulationSession`) + bản ghi lịch sử (`SimulationRun`) + mô hình diễn biến (`monitor.ts`).
 */
import { formatVariable, lowerFirst } from './config';
import {
  clockText,
  elapsedSec,
  monitorMarks,
  profileOf,
  sessionPhase,
  simTimeline,
  valueAt,
  type SimAlert,
  type SimEvent,
  type SimulationSession,
} from './monitor';
import { RUN_RESULT_LABEL, type RunResult, type Scenario, type SimulationRun } from './scenarios';
import { toCsv } from '@/lib/download';

export type CheckResult = 'pass' | 'fail';
export const CHECK_LABEL: Record<CheckResult, string> = { pass: 'Đạt', fail: 'Chưa đạt' };

export type ResultTile = { id: 'detect' | 'trend' | 'ai' | 'safety'; label: string; result: CheckResult };
export type Criterion = { id: string; label: string; result: CheckResult; comment: string };
export type ResultKpi = { id: string; label: string; value: string; sub: string; tone: 'success' | 'warning' | 'primary' | 'danger' | 'neutral' };

export type SimulationResult = {
  result: RunResult;
  stopped: boolean;
  elapsed: number;
  /** Giá trị "cao nhất" (biến tăng) / "thấp nhất" (biến giảm) trong lượt. */
  peak: number;
  peakReached: boolean;
  alerts: SimAlert[];
  events: SimEvent[];
  kpis: ResultKpi[];
  summary: string;
  tiles: ResultTile[];
  criteria: Criterion[];
  /** Gợi ý AI sau lượt (thêm vào báo cáo). */
  advice: string;
  /** Điểm biểu đồ: 11 mốc chia đều thời lượng (0m…10m). */
  points: { sec: number; value: number }[];
};

/** Điểm biểu đồ kết quả – `count` khoảng đều (ảnh: mỗi phút một chấm, 0m → 10m). Dừng sớm → chỉ tới lúc dừng. */
function resultPoints(session: SimulationSession, elapsed: number, count = 10): { sec: number; value: number }[] {
  const p = profileOf(session);
  const out: { sec: number; value: number }[] = [];
  for (let i = 0; i <= count; i++) {
    const sec = Math.round((p.durationSec * i) / count);
    if (sec > elapsed) break;
    out.push({ sec, value: valueAt(p, sec) });
  }
  if (out[out.length - 1]?.sec !== elapsed) out.push({ sec: elapsed, value: valueAt(p, elapsed) });
  return out;
}

/** "5m" · "1.5m" – nhãn trục X màn kết quả. */
export const minuteLabel = (sec: number) => `${Math.round((sec / 60) * 10) / 10}m`;

/** Dữ kiện của lượt tại `now` – đầu vào chung của các phần kết quả (tiêu chí, tóm tắt, KPI, gợi ý). */
function resultFacts(s: Scenario, session: SimulationSession, run: SimulationRun | undefined, now: number) {
  const v = s.setup.variable;
  const m = s.setup.monitor;
  const p = profileOf(session);
  const elapsed = elapsedSec(session, now);
  const above = v.direction === 'above';
  const { alerts, events } = simTimeline(s, m, session, now);
  const marks = monitorMarks(s, p);
  const seen = (x: number | undefined): x is number => x !== undefined && x <= elapsed;
  let peak = p.start;
  for (let t = 0; t <= elapsed; t++) {
    const x = valueAt(p, t);
    if (above ? x > peak : x < peak) peak = x;
  }
  return {
    s,
    v,
    m,
    run,
    elapsed,
    above,
    alerts,
    events,
    marks,
    peak,
    stopped: sessionPhase(session, now) === 'stopped',
    result: run?.result ?? 'pass',
    peakReached: seen(marks.peak),
    detected: seen(marks.alert),
    aiDone: seen(marks.ai),
    watched: seen(marks.watch),
    fmt: (x: number) => formatVariable(x, v),
  };
}
type ResultFacts = ReturnType<typeof resultFacts>;

const check = (ok: boolean): CheckResult => (ok ? 'pass' : 'fail');

function resultTiles(f: ResultFacts): ResultTile[] {
  return [
    { id: 'detect', label: 'Phát hiện', result: check(f.detected) },
    { id: 'trend', label: 'Diễn biến', result: check(f.peakReached) },
    { id: 'ai', label: 'AI', result: check(f.aiDone) },
    // Mô phỏng không gửi lệnh PLC / không tạo cảnh báo thật (lớp dữ liệu bảo đảm – test khoá) → luôn Đạt.
    { id: 'safety', label: 'An toàn', result: 'pass' },
  ];
}

function resultCriteria(f: ResultFacts): Criterion[] {
  const { v, m, above, marks, fmt } = f;
  const trendWord = above ? 'tăng' : 'giảm';
  return [
    {
      id: 'detect',
      label: 'Khả năng phát hiện',
      result: check(f.watched),
      comment: f.watched
        ? `Nhận diện chính xác xu hướng ${trendWord} ${fmt(marks.watchLevel)} từ phút thứ ${Math.floor(marks.watch! / 60)}.`
        : `Chưa ghi nhận xu hướng ${trendWord} tới mức ${fmt(marks.watchLevel)} trong lượt.`,
    },
    {
      id: 'alert',
      label: 'Tạo cảnh báo mô phỏng',
      result: check(f.detected),
      comment: f.detected
        ? `Sinh cảnh báo giả lập ${f.alerts[0]!.id} đúng tại mốc ${above ? '>' : '<'}${fmt(v.threshold)}, không lẫn lộn với cảnh báo thật.`
        : `Chưa sinh cảnh báo giả lập – ${v.noun} chưa ${above ? 'vượt' : 'xuống dưới'} ${fmt(v.threshold)}.`,
    },
    {
      id: 'ai',
      label: m.result.aiCriterion,
      result: check(f.aiDone),
      comment: f.aiDone ? `AI ${lowerFirst(m.peakAdvice)}` : 'Lượt kết thúc trước khi AI đưa gợi ý xử lý.',
    },
    {
      id: 'flag',
      label: 'Phân biệt Mô phỏng/Thật',
      result: 'pass',
      comment: 'Cờ (flag) mô phỏng hoạt động tốt 100%. PLC thực tế vẫn vận hành bình thường.',
    },
    {
      id: 'history',
      label: 'Ghi nhận lịch sử',
      result: check(!!f.run),
      comment: f.run ? 'Chuẩn bị sẵn sàng log dữ liệu để lưu trữ và xuất báo cáo PDF.' : 'Chưa ghi lượt vào lịch sử mô phỏng.',
    },
  ];
}

function resultSummary(f: ResultFacts): string {
  const { s, v, above, fmt, run } = f;
  const dir = above ? 'vượt' : 'xuống dưới';
  const noun = `${v.noun.charAt(0).toUpperCase()}${v.noun.slice(1)}`;
  return [
    `Kịch bản mô phỏng ${lowerFirst(s.title)} đã ${f.stopped ? `dừng thủ công lúc ${clockText(f.elapsed)}` : 'hoàn thành'}.`,
    f.detected
      ? `Hệ thống phát hiện ${v.noun} ${dir} ${lowerFirst(v.thresholdLabel)} tại ${fmt(v.threshold)}, tạo cảnh báo mô phỏng đúng thời điểm${f.aiDone ? ' và đưa ra gợi ý xử lý phù hợp' : ''}.`
      : `${noun} chưa ${dir} ${lowerFirst(v.thresholdLabel)} trong lượt.`,
    run?.result === 'improve' ? `Thời gian phản ứng ${run.responseSeconds} s vượt mục tiêu ${run.targetSeconds} s.` : '',
    'Không có tác động đến thiết bị thật trong quá trình mô phỏng.',
  ]
    .filter(Boolean)
    .join(' ');
}

function resultAdvice(f: ResultFacts): string {
  return f.result === 'pass'
    ? `Kết quả mô phỏng đạt yêu cầu. Hệ thống phản ứng ổn định với các ngưỡng cảnh báo thiết lập. ${f.m.result.next}`
    : `Kết quả mô phỏng cần cải thiện: phản ứng ${f.run!.responseSeconds} s vượt mục tiêu ${f.run!.targetSeconds} s. Nên rà soát các bước phản ứng của kịch bản và chạy lại với cùng tham số để so sánh.`;
}

function resultKpis(f: ResultFacts): ResultKpi[] {
  const { result, run, alerts, aiDone, m } = f;
  const pass = result === 'pass';
  return [
    {
      id: 'result',
      label: 'Kết quả',
      value: RUN_RESULT_LABEL[result],
      sub: pass ? 'Hệ thống phản ứng đúng kịch bản' : `Phản ứng ${run?.responseSeconds} s > mục tiêu ${run?.targetSeconds} s`,
      tone: pass ? 'success' : 'warning',
    },
    {
      id: 'time',
      label: 'Thời gian chạy',
      value: clockText(f.elapsed),
      sub: f.stopped ? 'Dừng trước thời lượng' : 'Hoàn thành đủ thời lượng',
      tone: 'primary',
    },
    {
      id: 'peak',
      label: m.result.peakLabel,
      value: f.fmt(f.peak),
      sub: f.peakReached ? 'Đạt giá trị mục tiêu mô phỏng' : 'Chưa chạm giá trị mục tiêu',
      tone: 'primary',
    },
    {
      id: 'alerts',
      label: 'Cảnh báo mô phỏng',
      value: String(alerts.length),
      sub: alerts.length ? 'Đã tạo đúng ngưỡng' : 'Không phát sinh',
      tone: 'warning',
    },
    {
      id: 'ai',
      label: 'Gợi ý AI',
      value: String(aiDone ? m.recommendations.length : 0),
      sub: aiDone ? 'Đã ghi nhận' : 'Chưa có gợi ý',
      tone: 'primary',
    },
  ];
}

export function simulationResult(s: Scenario, session: SimulationSession, run: SimulationRun | undefined, now: number): SimulationResult {
  const f = resultFacts(s, session, run, now);
  return {
    result: f.result,
    stopped: f.stopped,
    elapsed: f.elapsed,
    peak: f.peak,
    peakReached: f.peakReached,
    alerts: f.alerts,
    events: f.events,
    kpis: resultKpis(f),
    summary: resultSummary(f),
    tiles: resultTiles(f),
    criteria: resultCriteria(f),
    advice: resultAdvice(f),
    points: resultPoints(session, f.elapsed),
  };
}

/** Nhãn "Khu vực / Tài sản chính": "Khu bồn LPG / Bồn V-101". */
export const areaAssetText = (s: Pick<Scenario, 'setup'>, session: Pick<SimulationSession, 'config'>) =>
  `${session.config.areas[0] ?? '—'} / ${s.setup.equipment}`;

/** Trạng thái tệp báo cáo: "Nháp • Chưa xuất" / "Nháp • Đã thêm gợi ý AI • Đã xuất Excel 18:30". */
export function reportStatusText(session: Pick<SimulationSession, 'report'>, timeText?: (iso: string) => string): string {
  const r = session.report ?? {};
  const parts = ['Nháp'];
  if (r.aiIncluded) parts.push('Đã thêm gợi ý AI');
  parts.push(r.excelAt ? `Đã xuất Excel${timeText ? ` ${timeText(r.excelAt)}` : ''}` : 'Chưa xuất');
  return parts.join(' • ');
}

/** Báo cáo dạng CSV (Excel mở được, BOM do nơi gọi thêm): thông tin lượt · KPI · tiêu chí · sự kiện · cảnh báo · gợi ý AI (nếu thêm). */
export function resultCsv(s: Scenario, session: SimulationSession, code: string, r: SimulationResult): string {
  const rows: string[][] = [
    ['Báo cáo mô phỏng', code],
    ['Kịch bản', `${s.code} – ${s.title}`],
    ['Khu vực / Tài sản chính', areaAssetText(s, session)],
    ['Người chạy', session.by],
    ['Thời lượng / Mục tiêu', `${session.config.durationMin} phút / ${formatVariable(session.config.target, s.setup.variable)}`],
    ['Tổng kết', r.summary],
    [],
    ['Chỉ số', 'Giá trị', 'Ghi chú'],
    ...r.kpis.map((k) => [k.label, k.value, k.sub]),
    [],
    ['Tiêu chí', 'Kết quả', 'Nhận xét'],
    ...r.criteria.map((c) => [c.label, CHECK_LABEL[c.result], c.comment]),
    [],
    ['Giờ', 'Sự kiện', 'Mô tả'],
    ...r.events.map((e) => [e.time, e.title, e.detail]),
    [],
    ['Cảnh báo mô phỏng', 'Giờ', 'Mô tả'],
    ...r.alerts.map((a) => [a.id, a.time, a.description]),
  ];
  if (session.report?.aiIncluded) rows.push([], ['Gợi ý AI', r.advice]);
  rows.push([], ['Ghi chú', 'Kết quả từ dữ liệu mô phỏng – không phải sự cố vận hành thật.']);
  return toCsv(rows, { quote: 'minimal' });
}

/** "sim-run-24062026-001.csv" */
export const resultFileName = (code: string, ext: 'pdf' | 'csv') => (ext === 'pdf' ? `${code}.pdf` : `${code.toLowerCase()}.csv`);
