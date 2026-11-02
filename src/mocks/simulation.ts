/*
 * AI mô phỏng sự cố – 5 kịch bản (ảnh thiết kế 02/11/2026) + lịch sử chạy mẫu (lùi theo phút từ `now`).
 * Tag tham chiếu lấy từ `features/live/tags.ts` (cùng tag các màn khác); ngưỡng khớp cảnh báo mock (ALT-00128 10.5 bar,
 * ALT-00126 50 °C, gas 20 % LEL). Các bước phản ứng + mục tiêu là GIẢ ĐỊNH (docs/questions.md 15.x).
 * TODO(backend): GET /simulation/scenarios, GET /simulation/runs, POST /simulation/scenarios/:id/runs.
 */
import { PLC_REPORT_TAGS, PLC_SCADA_TAGS, V101_TAGS, VAPORIZER_AREA_TAGS, VAPORIZER_TAGS } from '@/features/live/tags';
import { simulateScenario, type Scenario, type SimulationRun } from '@/features/simulation/scenarios';

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
      tags: [V101_TAGS.pressure, V101_TAGS.level, V101_TAGS.temperature],
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
    },
  ];
}

/** Lượt chạy mẫu: 3 hôm nay (SC-001 Đạt, SC-002 Đạt, SC-004 Cần cải thiện), 1 hôm qua (SC-003). */
const SEED_RUNS: readonly { scenarioId: string; minutesAgo: number; by: string }[] = [
  { scenarioId: 'SC-004', minutesAgo: 150, by: 'Trần Văn B' },
  { scenarioId: 'SC-001', minutesAgo: 470, by: 'Lê Thị C' },
  { scenarioId: 'SC-002', minutesAgo: 545, by: 'Nguyễn Văn A' },
  { scenarioId: 'SC-003', minutesAgo: 1440 + 200, by: 'Phạm Văn D' },
];

export function buildSimulationRuns(now: Date, scenarios: readonly Scenario[] = buildScenarios(now)): SimulationRun[] {
  return SEED_RUNS.flatMap((r, i) => {
    const s = scenarios.find((x) => x.id === r.scenarioId);
    return s ? [simulateScenario(s, ago(now, r.minutesAgo), r.by, `RUN-${String(i + 1).padStart(4, '0')}`)] : [];
  });
}
