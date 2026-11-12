/*
 * AI mô phỏng sự cố – 5 kịch bản (ảnh thiết kế) + lịch sử chạy mẫu (lùi theo phút từ `now`).
 * Tag tham chiếu lấy từ `features/live/tags.ts` (cùng tag các màn khác); ngưỡng khớp cảnh báo mock (ALT-00128 10.5 bar,
 * ALT-00126 50 °C, gas 20 % LEL). Các bước phản ứng + mục tiêu là GIẢ ĐỊNH (docs/questions.md 15.x).
 * TODO(backend): GET /simulation/scenarios, GET /simulation/runs, POST /simulation/scenarios/:id/runs.
 */
import { PLC_REPORT_TAGS, PLC_SCADA_TAGS, TANK_AREA_TAGS, V101_TAGS, VAPORIZER_AREA_TAGS, VAPORIZER_TAGS } from '@/features/live/tags';
import type { LiveData } from '@/features/live/types';
import { createSession, sessionRun, type SimulationSession } from '@/features/simulation/monitor';
import { runResult, simulateScenario, type Scenario, type SimulationRun } from '@/features/simulation/scenarios';
import { parsePlantDateTime, plantDayKey } from '@/lib/plantTime';
import { liveBase } from './scenes/live';
import { scenarioSetupOf } from './simulationSetup';

const ago = (now: Date, minutes: number) => new Date(now.getTime() - minutes * 60_000);

export function buildScenarios(now: Date): Scenario[] {
  return [
    {
      id: 'SC-001',
      code: 'SC-001',
      title: 'Rò rỉ LPG tại khu vực bồn',
      shortLabel: 'Khu bồn',
      suggestLabel: 'rò rỉ LPG',
      group: 'gas-leak',
      risk: 'critical',
      area: 'Khu bồn LPG',
      status: 'ready',
      icon: 'gas',
      plcVariables: [PLC_REPORT_TAGS.tankGas, PLC_REPORT_TAGS.tankPressure, PLC_REPORT_TAGS.tankLevel],
      tags: [TANK_AREA_TAGS.gas, V101_TAGS.pressure, V101_TAGS.level, V101_TAGS.temperature],
      threshold: 'Gas vượt 20% LEL',
      outcome: 'Gợi ý quy trình ESD mô phỏng',
      steps: [
        { id: 'detect', label: 'Đầu dò phát hiện, PLC nhận tín hiệu', seconds: 5 },
        { id: 'alarm', label: 'SCADA phát cảnh báo', seconds: 3 },
        { id: 'esd', label: 'Đề xuất quy trình ESD', seconds: 10 },
        { id: 'confirm', label: 'Người vận hành xác nhận', seconds: 20 },
      ],
      targetSeconds: 60,
      updatedAt: ago(now, 120).toISOString(),
      ...scenarioSetupOf('SC-001'),
    },
    {
      id: 'SC-002',
      code: 'SC-002',
      title: 'Áp suất bồn V-101 tăng cao',
      shortLabel: 'Áp suất',
      suggestLabel: 'áp suất bồn tăng cao',
      group: 'pressure',
      risk: 'high',
      area: 'Khu bồn LPG',
      status: 'ready',
      icon: 'pressure',
      plcVariables: [PLC_REPORT_TAGS.tankPressure, PLC_REPORT_TAGS.tankTemperature],
      tags: [V101_TAGS.pressure, V101_TAGS.temperature],
      threshold: 'Áp suất vượt 10.5 bar',
      outcome: 'Gợi ý giảm tải, kiểm tra van an toàn',
      steps: [
        { id: 'detect', label: 'PT-101 vượt ngưỡng', seconds: 5 },
        { id: 'alarm', label: 'SCADA phát cảnh báo', seconds: 3 },
        { id: 'action', label: 'Đề xuất giảm tải / kiểm tra PSV', seconds: 15 },
        { id: 'confirm', label: 'Người vận hành xác nhận', seconds: 20 },
      ],
      targetSeconds: 60,
      updatedAt: ago(now, 26 * 60).toISOString(),
      ...scenarioSetupOf('SC-002'),
    },
    {
      id: 'SC-003',
      code: 'SC-003',
      title: 'Máy hóa hơi E-101A bất thường',
      shortLabel: 'Hóa hơi',
      suggestLabel: 'máy hóa hơi E-101A bất thường',
      group: 'equipment',
      risk: 'medium',
      area: 'Trạm hóa hơi',
      status: 'ready',
      icon: 'vaporizer',
      plcVariables: ['Vaporizer_Outlet_Temp', 'Vaporizer_Inlet_Pressure', 'Vaporizer_Run_State'],
      tags: [VAPORIZER_TAGS.temperature, VAPORIZER_TAGS.inletPressure, VAPORIZER_AREA_TAGS.runA],
      threshold: 'Nhiệt độ ra dưới 50 °C',
      outcome: 'Gợi ý chuyển sang E-101B',
      steps: [
        { id: 'detect', label: 'TT-201 dưới ngưỡng', seconds: 10 },
        { id: 'alarm', label: 'SCADA phát cảnh báo', seconds: 5 },
        { id: 'switch', label: 'Đề xuất chuyển E-101B', seconds: 30 },
      ],
      targetSeconds: 90,
      updatedAt: ago(now, 3 * 1440).toISOString(),
      ...scenarioSetupOf('SC-003'),
    },
    {
      id: 'SC-004',
      code: 'SC-004',
      title: 'Mất kết nối PLC/SCADA',
      shortLabel: 'Mất SCADA',
      suggestLabel: 'mất kết nối PLC/SCADA',
      group: 'communication',
      risk: 'high',
      area: 'Phòng điều khiển',
      status: 'ready',
      icon: 'link',
      plcVariables: ['PLC_Heartbeat', 'PLC_Link_Status', 'SCADA_Link_Status'],
      tags: [PLC_SCADA_TAGS.heartbeat, PLC_SCADA_TAGS.plcLink, PLC_SCADA_TAGS.scadaLink],
      threshold: 'Mất heartbeat quá 10 giây',
      outcome: 'Gợi ý chuyển vận hành tại chỗ',
      steps: [
        { id: 'detect', label: 'Hết thời gian chờ heartbeat', seconds: 10 },
        { id: 'local', label: 'Chuyển chế độ tại chỗ (Local)', seconds: 45 },
        { id: 'notify', label: 'Thông báo ca trực + kỹ sư', seconds: 40 },
      ],
      targetSeconds: 60,
      updatedAt: ago(now, 5 * 1440).toISOString(),
      ...scenarioSetupOf('SC-004'),
    },
    {
      id: 'SC-005',
      code: 'SC-005',
      title: 'Tín hiệu báo cháy bất thường',
      shortLabel: 'Báo cháy',
      suggestLabel: 'tín hiệu báo cháy bất thường',
      group: 'fire',
      risk: 'critical',
      area: 'Trạm hóa hơi',
      status: 'needs-config',
      icon: 'fire',
      plcVariables: ['FireZone_FZ02_Heat', 'FireZone_FZ02_Smoke', 'FireZone_FZ02_MCP'],
      tags: [VAPORIZER_AREA_TAGS.heatTemp, VAPORIZER_AREA_TAGS.heatAlarm, VAPORIZER_AREA_TAGS.smokeAlarm],
      threshold: 'Đầu báo nhiệt / khói kích hoạt',
      outcome: 'Gợi ý quy trình chữa cháy mô phỏng',
      steps: [
        { id: 'detect', label: 'Đầu báo kích hoạt', seconds: 5 },
        { id: 'alarm', label: 'Tủ báo cháy → SCADA', seconds: 5 },
        { id: 'confirm', label: 'Xác minh tại chỗ', seconds: 60 },
      ],
      targetSeconds: 90,
      missingMappings: ['đầu báo khói SD-02 chưa gán biến PLC', 'nút nhấn MCP-02 chưa gán biến PLC'],
      updatedAt: ago(now, 7 * 1440).toISOString(),
      ...scenarioSetupOf('SC-005'),
    },
  ];
}

/**
 * Lượt chạy mẫu: 3 hôm nay (SC-001 Đạt, SC-002 Đạt, SC-004 Cần cải thiện), 1 hôm qua (SC-003); SC-001 thêm 2 lượt cũ
 * (lùi 2 và 4 ngày – "Lịch sử kịch bản này" ảnh cấu hình: Đạt · Đạt · Cần cải thiện). `responseSeconds` = lượt chạy với
 * cấu hình cũ chậm hơn (ghi đè tổng bước hiện tại).
 */
const SEED_RUNS: readonly { scenarioId: string; minutesAgo: number; by: string; note?: string; responseSeconds?: number }[] = [
  { scenarioId: 'SC-004', minutesAgo: 150, by: 'Trần Văn B', note: 'Chuyển vận hành tại chỗ chậm hơn mục tiêu.' },
  { scenarioId: 'SC-001', minutesAgo: 470, by: 'Lê Thị C', note: 'Phát hiện cảnh báo đúng thời điểm.' },
  { scenarioId: 'SC-002', minutesAgo: 545, by: 'Nguyễn Văn A', note: 'Đề xuất giảm tải kịp thời.' },
  { scenarioId: 'SC-003', minutesAgo: 1440 + 200, by: 'Phạm Văn D', note: 'Chuyển E-101B trong mục tiêu.' },
  { scenarioId: 'SC-001', minutesAgo: 2 * 1440 + 113, by: 'Nguyễn Văn A', note: 'AI gợi ý xử lý phù hợp.' },
  {
    scenarioId: 'SC-001',
    minutesAgo: 4 * 1440 + 478,
    by: 'Trần Văn B',
    note: 'Thiếu ghi nhận thủ công khi mất dữ liệu mô phỏng.',
    responseSeconds: 72,
  },
];

export function buildSimulationRuns(now: Date, scenarios: readonly Scenario[] = buildScenarios(now)): SimulationRun[] {
  return SEED_RUNS.flatMap((r, i) => {
    const s = scenarios.find((x) => x.id === r.scenarioId);
    if (!s) return [];
    const run = simulateScenario(s, ago(now, r.minutesAgo), r.by, `RUN-${String(i + 1).padStart(4, '0')}`, r.note);
    return [
      r.responseSeconds === undefined ? run : { ...run, responseSeconds: r.responseSeconds, result: runResult(r.responseSeconds, run.targetSeconds) },
    ];
  });
}

/** Số liệu nền (mocks/scenes/live) dạng ảnh chụp tươi tại `at` – trạng thái ban đầu của lượt mẫu. */
function baseSnapshot(at: number): LiveData {
  return Object.fromEntries(Object.entries(liveBase).map(([tag, value]) => [tag, { value, ts: at, quality: 'good' as const }]));
}

/** Lượt mẫu ĐANG CHẠY: SC-001 bắt đầu 06:32 trước `now` (như ảnh "Theo dõi diễn biến": 06:32 / 10:00, gas 28 % LEL). */
const SEED_SESSION_ELAPSED_SEC = 6 * 60 + 32;
/** Lượt mẫu ĐÃ XONG (ảnh "Kết quả mô phỏng"): SC-001, 6 ngày trước lúc 18:14:00 giờ nhà máy. */
const SEED_RESULT_DAYS_AGO = 6;
const SEED_RESULT_TIME = '18:14:00';

const FULL_HEALTH = { ok: 21, total: 21 };

/**
 * - SES-0001: đang chạy, "Tăng vừa" (đỉnh ở 94 % thời lượng → lúc 06:32 vẫn đang tăng, như ảnh Theo dõi).
 * - SES-0000: đã hoàn thành, "Tăng nhanh" (tham số đang lưu của SC-001 – đỉnh 35 % ở phút 5 rồi ESD ảo kéo giảm, như ảnh
 *   Kết quả), gas nền 0.1 % LEL, bảng tham chiếu như ảnh (9.2 bar · 28.6 °C · 76.2 %); kèm bản ghi lịch sử RUN-0007 (cũ hơn
 *   mọi lượt mẫu khác → không đổi "Lịch sử gần đây" / 3 lượt đầu "Lịch sử kịch bản này").
 */
export function buildSimulationSessions(now: Date, scenarios: readonly Scenario[]): { sessions: SimulationSession[]; runs: SimulationRun[] } {
  const s = scenarios.find((x) => x.id === 'SC-001');
  if (!s) return { sessions: [], runs: [] };
  const at = new Date(now.getTime() - SEED_SESSION_ELAPSED_SEC * 1000);
  const running = createSession(
    { ...s, config: { ...s.config, rate: 'medium' } },
    baseSnapshot(at.getTime()),
    at.getTime(),
    at,
    'Nguyễn Văn A',
    'SES-0001',
    FULL_HEALTH,
  );

  const day = plantDayKey(new Date(now.getTime() - SEED_RESULT_DAYS_AGO * 86_400_000));
  const doneAt = parsePlantDateTime(`${day}T${SEED_RESULT_TIME}`)!;
  const snap = {
    ...baseSnapshot(doneAt.getTime()),
    ...Object.fromEntries(
      [
        [TANK_AREA_TAGS.gas, 0.1],
        [V101_TAGS.pressure, 9.2],
        [V101_TAGS.temperature, 28.6],
        [V101_TAGS.level, 76.2],
      ].map(([tag, value]) => [tag, { value: value as number, ts: doneAt.getTime(), quality: 'good' as const }]),
    ),
  };
  const created = createSession(s, snap, doneAt.getTime(), doneAt, 'Nguyễn Văn A', 'SES-0000', FULL_HEALTH);
  const run = sessionRun(s, created, 'RUN-0007', doneAt.getTime() + created.config.durationMin * 60_000);
  const done: SimulationSession = { ...created, runId: run.id };
  return { sessions: [running, done], runs: [{ ...run, note: 'Phát hiện cảnh báo đúng thời điểm, ESD ảo đưa nồng độ về mức an toàn.' }] };
}
