/*
 * Màn "Cấu hình kịch bản mô phỏng" (ảnh người dùng gửi 03/11/2026 – `scratch/figma-ref/ai-sim-config/`): thông tin cố định
 * + tham số đang lưu của 5 kịch bản. Ảnh chỉ vẽ SC-001 (chữ lấy nguyên văn); SC-002…005 suy theo cùng mẫu (GIẢ ĐỊNH –
 * docs/questions.md 16). Ngưỡng tô trạng thái bảng tham chiếu theo DAILY_ITEMS (mocks/dailyReport.ts) / cảnh báo mock.
 * TODO(backend): GET /simulation/scenarios/:id trả kèm setup + config; PUT /simulation/scenarios/:id/config.
 */
import { PLC_REPORT_TAGS, PLC_SCADA_TAGS, TANK_AREA_TAGS, V101_TAGS, VAPORIZER_AREA_TAGS, VAPORIZER_TAGS } from '@/features/live/tags';
import type { ReferenceRow, ScenarioConfig, ScenarioSetup } from '@/features/simulation/config';

const ROW = {
  tankGas: { id: 'tank-gas', label: 'Gas khu vực bồn', plcTag: PLC_REPORT_TAGS.tankGas, tag: TANK_AREA_TAGS.gas, unit: '%LEL', digits: 1, limits: { warn: 10, danger: 20 } },
  tankPressure: { id: 'tank-pressure', label: 'Áp suất bồn', plcTag: PLC_REPORT_TAGS.tankPressure, tag: V101_TAGS.pressure, unit: 'bar', digits: 1, limits: { warn: 10.5, danger: 14 } },
  tankTemp: { id: 'tank-temp', label: 'Nhiệt độ bồn', plcTag: PLC_REPORT_TAGS.tankTemperature, tag: V101_TAGS.temperature, unit: '°C', digits: 1, limits: { warn: 40, danger: 50 } },
  tankLevel: { id: 'tank-level', label: 'Mức chất lỏng', plcTag: PLC_REPORT_TAGS.tankLevel, tag: V101_TAGS.level, unit: '%', digits: 1, limits: { warn: 90, danger: 95 } },
  heartbeat: { id: 'heartbeat', label: 'PLC heartbeat', plcTag: 'PLC_Heartbeat', tag: PLC_SCADA_TAGS.heartbeat, unit: '—', digits: 0, kind: 'heartbeat' },
  vapOutTemp: {
    id: 'vap-out-temp',
    label: 'Nhiệt độ ra hóa hơi',
    plcTag: 'Vaporizer_Outlet_Temp',
    tag: VAPORIZER_TAGS.temperature,
    unit: '°C',
    digits: 1,
    limits: { warn: 50, danger: 45, direction: 'below' },
  },
  vapInPressure: { id: 'vap-in-pressure', label: 'Áp suất vào hóa hơi', plcTag: 'Vaporizer_Inlet_Pressure', tag: VAPORIZER_TAGS.inletPressure, unit: 'bar', digits: 1 },
  latency: { id: 'latency', label: 'Độ trễ dữ liệu', plcTag: 'Data_Latency', tag: PLC_SCADA_TAGS.latency, unit: 's', digits: 1, limits: { warn: 3, danger: 10 } },
  packetLoss: { id: 'packet-loss', label: 'Mất gói tin', plcTag: 'Packet_Loss', tag: PLC_SCADA_TAGS.packetLoss, unit: '%', digits: 1, limits: { warn: 5 } },
  heatTemp: { id: 'heat-temp', label: 'Nhiệt độ đầu báo HD-02', plcTag: 'FireZone_FZ02_Heat', tag: VAPORIZER_AREA_TAGS.heatTemp, unit: '°C', digits: 1, limits: { warn: 60, danger: 70 } },
  vapGas: { id: 'vap-gas', label: 'Gas trạm hóa hơi', plcTag: 'FireZone_FZ02_Gas', tag: VAPORIZER_AREA_TAGS.gas, unit: '%LEL', digits: 1, limits: { warn: 10, danger: 20 } },
} satisfies Record<string, ReferenceRow>;

const TANK_AREAS = ['Khu bồn LPG', 'Khu vực gần máy hóa hơi', 'Đường cấp LPG', 'Khu vực vận hành gần bồn'] as const;
const VAPORIZER_AREAS = ['Trạm hóa hơi', 'Khu vực gần máy hóa hơi', 'Đường cấp LPG', 'Khu bồn LPG'] as const;
const CONTROL_AREAS = ['Phòng điều khiển', 'Khu bồn LPG', 'Trạm hóa hơi', 'Đường cấp LPG'] as const;

/** Ảnh: chỉ 2 mục cuối khác theo kịch bản → gộp phần chung. */
const outcomes = (detect: string, trend: string, action: string) => [
  detect,
  trend,
  action,
  'Lưu kết quả vào lịch sử mô phỏng',
  'Tạo cảnh báo mô phỏng trong hệ thống',
  'Không tạo cảnh báo vận hành thật nếu chưa xác nhận',
];

const SETUPS: Record<string, ScenarioSetup> = {
  'SC-001': {
    incidentType: 'Rò rỉ LPG',
    equipment: 'Bồn V-101',
    description: 'Mô phỏng nồng độ gas tại khu vực bồn tăng vượt ngưỡng cảnh báo PLC để đánh giá phản ứng giám sát, cảnh báo và gợi ý xử lý an toàn.',
    variable: {
      noun: 'nồng độ gas',
      startLabel: 'Nồng độ bắt đầu (Thực tế hiện tại)',
      targetLabel: 'Nồng độ mục tiêu mô phỏng',
      rateLabel: 'Tốc độ rò rỉ',
      tag: TANK_AREA_TAGS.gas,
      plcTag: PLC_REPORT_TAGS.tankGas,
      unit: '%',
      qualifier: 'LEL',
      digits: 0,
      min: 0,
      max: 50,
      step: 1,
      threshold: 20,
      thresholdLabel: 'Ngưỡng cảnh báo PLC',
      direction: 'above',
      hint: 'Gợi ý quy trình ESD mô phỏng nếu vượt mức nguy hiểm.',
    },
    referenceRows: [ROW.tankGas, ROW.tankPressure, ROW.tankTemp, ROW.tankLevel, ROW.heartbeat],
    areaOptions: TANK_AREAS,
    // Thứ tự đọc theo cột (ảnh: cột trái 4 mục, cột phải 4 mục).
    expectedOutcomes: [
      'Phát hiện nồng độ gas vượt ngưỡng mô phỏng',
      'Hiển thị diễn biến nồng độ gas theo thời gian',
      'Gợi ý kiểm tra van, mặt bích và cảm biến gas',
      'Lưu kết quả vào lịch sử mô phỏng',
      'Tạo cảnh báo mô phỏng trong hệ thống',
      'Gợi ý hạn chế tiếp cận khu vực',
      'Gợi ý quy trình ESD mô phỏng nếu vượt mức nguy hiểm',
      'Không tạo cảnh báo vận hành thật nếu chưa xác nhận',
    ],
    suggestion: {
      target: 35,
      durationMin: 10,
      purpose: 'phù hợp để kiểm tra khả năng phát hiện cảnh báo gas và quy trình phản ứng an toàn',
      goal: 'đánh giá cảnh báo, phân tích xu hướng và gợi ý xử lý',
      refs: [PLC_REPORT_TAGS.tankGas, PLC_REPORT_TAGS.tankPressure, 'PLC/SCADA'],
    },
  },
  'SC-002': {
    incidentType: 'Quá áp bồn',
    equipment: 'Bồn V-101',
    description: 'Mô phỏng áp suất bồn V-101 tăng vượt ngưỡng cảnh báo PLC để đánh giá phản ứng giám sát, giảm tải và kiểm tra van an toàn.',
    variable: {
      noun: 'áp suất bồn',
      startLabel: 'Áp suất bắt đầu (Thực tế hiện tại)',
      targetLabel: 'Áp suất mục tiêu mô phỏng',
      rateLabel: 'Tốc độ tăng áp',
      tag: V101_TAGS.pressure,
      plcTag: PLC_REPORT_TAGS.tankPressure,
      unit: 'bar',
      digits: 1,
      min: 0,
      max: 16,
      step: 0.5,
      threshold: 10.5,
      thresholdLabel: 'Ngưỡng cảnh báo PLC',
      direction: 'above',
      hint: 'Gợi ý giảm tải và kiểm tra van an toàn PSV nếu vượt mức nguy hiểm.',
    },
    referenceRows: [ROW.tankPressure, ROW.tankTemp, ROW.tankLevel, ROW.heartbeat],
    areaOptions: TANK_AREAS,
    expectedOutcomes: outcomes('Phát hiện áp suất vượt ngưỡng mô phỏng', 'Hiển thị diễn biến áp suất theo thời gian', 'Gợi ý giảm tải và kiểm tra van an toàn'),
    suggestion: {
      target: 12,
      durationMin: 10,
      purpose: 'phù hợp để kiểm tra khả năng phát hiện quá áp và quy trình giảm tải an toàn',
      goal: 'đánh giá cảnh báo, phân tích xu hướng áp suất và gợi ý xử lý',
      refs: [PLC_REPORT_TAGS.tankPressure, PLC_REPORT_TAGS.tankTemperature, 'PLC/SCADA'],
    },
  },
  'SC-003': {
    incidentType: 'Thiết bị bất thường',
    equipment: 'Máy hóa hơi E-101A',
    description: 'Mô phỏng nhiệt độ đầu ra máy hóa hơi E-101A giảm dưới ngưỡng để đánh giá phản ứng giám sát và quy trình chuyển sang E-101B.',
    variable: {
      noun: 'nhiệt độ ra',
      startLabel: 'Nhiệt độ ra bắt đầu (Thực tế hiện tại)',
      targetLabel: 'Nhiệt độ ra mục tiêu mô phỏng',
      rateLabel: 'Tốc độ suy giảm',
      tag: VAPORIZER_TAGS.temperature,
      plcTag: 'Vaporizer_Outlet_Temp',
      unit: '°C',
      digits: 0,
      min: 20,
      max: 70,
      step: 1,
      threshold: 50,
      thresholdLabel: 'Ngưỡng cảnh báo PLC',
      direction: 'below',
      hint: 'Gợi ý chuyển sang E-101B nếu xuống dưới mức nguy hiểm.',
    },
    referenceRows: [ROW.vapOutTemp, ROW.vapInPressure, ROW.heartbeat],
    areaOptions: VAPORIZER_AREAS,
    expectedOutcomes: outcomes('Phát hiện nhiệt độ ra dưới ngưỡng mô phỏng', 'Hiển thị diễn biến nhiệt độ theo thời gian', 'Gợi ý chuyển sang máy hóa hơi dự phòng E-101B'),
    suggestion: {
      target: 42,
      durationMin: 15,
      purpose: 'phù hợp để kiểm tra khả năng phát hiện suy giảm nhiệt độ và quy trình chuyển máy dự phòng',
      goal: 'đánh giá cảnh báo, phân tích xu hướng và gợi ý xử lý',
      refs: ['Vaporizer_Outlet_Temp', 'Vaporizer_Inlet_Pressure', 'PLC/SCADA'],
    },
  },
  'SC-004': {
    incidentType: 'Mất truyền thông',
    equipment: 'PLC-01 / SCADA-01',
    description: 'Mô phỏng độ trễ dữ liệu PLC/SCADA tăng đến mất heartbeat để đánh giá phản ứng chuyển vận hành tại chỗ và thông báo ca trực.',
    variable: {
      noun: 'độ trễ dữ liệu',
      startLabel: 'Độ trễ bắt đầu (Thực tế hiện tại)',
      targetLabel: 'Độ trễ mục tiêu mô phỏng',
      rateLabel: 'Tốc độ suy giảm kết nối',
      tag: PLC_SCADA_TAGS.latency,
      plcTag: 'Data_Latency',
      unit: 's',
      digits: 0,
      min: 0,
      max: 60,
      step: 5,
      threshold: 10,
      thresholdLabel: 'Ngưỡng mất heartbeat',
      direction: 'above',
      hint: 'Gợi ý chuyển vận hành tại chỗ (Local) nếu mất kết nối kéo dài.',
    },
    referenceRows: [ROW.heartbeat, ROW.latency, ROW.packetLoss],
    areaOptions: CONTROL_AREAS,
    expectedOutcomes: outcomes('Phát hiện mất heartbeat PLC mô phỏng', 'Hiển thị diễn biến độ trễ dữ liệu theo thời gian', 'Gợi ý chuyển vận hành tại chỗ'),
    suggestion: {
      target: 30,
      durationMin: 10,
      purpose: 'phù hợp để kiểm tra khả năng phát hiện mất truyền thông và quy trình chuyển vận hành tại chỗ',
      goal: 'đánh giá cảnh báo, thời gian phản ứng và gợi ý xử lý',
      refs: ['PLC_Heartbeat', 'Data_Latency', 'PLC/SCADA'],
    },
  },
  'SC-005': {
    incidentType: 'Báo cháy',
    equipment: 'Trạm hóa hơi FZ-02',
    description: 'Mô phỏng tín hiệu đầu báo nhiệt / khói tại trạm hóa hơi để đánh giá phản ứng báo cháy, xác minh tại chỗ và quy trình chữa cháy mô phỏng.',
    variable: {
      noun: 'nhiệt độ đầu báo',
      startLabel: 'Nhiệt độ đầu báo bắt đầu (Thực tế hiện tại)',
      targetLabel: 'Nhiệt độ đầu báo mục tiêu mô phỏng',
      rateLabel: 'Tốc độ tăng nhiệt',
      tag: VAPORIZER_AREA_TAGS.heatTemp,
      plcTag: 'FireZone_FZ02_Heat',
      unit: '°C',
      digits: 0,
      min: 20,
      max: 120,
      step: 1,
      threshold: 70,
      thresholdLabel: 'Ngưỡng báo cháy',
      direction: 'above',
      hint: 'Gợi ý quy trình chữa cháy mô phỏng nếu đầu báo kích hoạt.',
    },
    referenceRows: [ROW.heatTemp, ROW.vapGas, ROW.heartbeat],
    areaOptions: VAPORIZER_AREAS,
    expectedOutcomes: outcomes('Phát hiện tín hiệu báo cháy mô phỏng', 'Hiển thị diễn biến nhiệt độ đầu báo theo thời gian', 'Gợi ý xác minh tại chỗ và quy trình chữa cháy'),
    suggestion: {
      target: 85,
      durationMin: 10,
      purpose: 'phù hợp để kiểm tra khả năng phát hiện báo cháy và quy trình xác minh tại chỗ',
      goal: 'đánh giá cảnh báo, thời gian phản ứng và gợi ý xử lý',
      refs: ['FireZone_FZ02_Heat', 'FireZone_FZ02_Smoke', 'PLC/SCADA'],
    },
  },
};

const cfg = (p: Partial<ScenarioConfig> & Pick<ScenarioConfig, 'target' | 'areas'>): ScenarioConfig => ({
  durationMin: 10,
  rate: 'fast',
  endCondition: 'duration',
  ...p,
});

/** Tham số đang lưu – SC-001 như ảnh (35% LEL · 10 phút · Tăng nhanh · hết thời lượng · Khu bồn LPG). */
const CONFIGS: Record<string, ScenarioConfig> = {
  'SC-001': cfg({ target: 35, areas: ['Khu bồn LPG'] }),
  'SC-002': cfg({ target: 12, rate: 'medium', areas: ['Khu bồn LPG'] }),
  'SC-003': cfg({ target: 42, durationMin: 15, rate: 'medium', areas: ['Trạm hóa hơi'] }),
  'SC-004': cfg({ target: 30, endCondition: 'manual-stop', areas: ['Phòng điều khiển'] }),
  'SC-005': cfg({ target: 85, areas: ['Trạm hóa hơi'] }),
};

/** Setup + bản sao tham số đang lưu của một kịch bản (sửa bản sao không đụng hằng). */
export function scenarioSetupOf(id: string): { setup: ScenarioSetup; config: ScenarioConfig } {
  const setup = SETUPS[id];
  const config = CONFIGS[id];
  if (!setup || !config) throw new Error(`Thiếu cấu hình mock cho ${id}`);
  return { setup, config: { ...config, areas: [...config.areas] } };
}
