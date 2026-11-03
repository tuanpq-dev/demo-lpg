/*
 * Dữ liệu mẫu CHỈ cho test logic mô phỏng (không import từ `src/mocks` để test hàm thuần độc lập mock trang).
 */
import type { ScenarioConfig, ScenarioSetup } from './config';
import type { Scenario } from './scenarios';

export const GAS_SETUP: ScenarioSetup = {
  incidentType: 'Rò rỉ LPG',
  equipment: 'Bồn V-101',
  description: 'Mô phỏng nồng độ gas tăng.',
  variable: {
    noun: 'nồng độ gas',
    startLabel: 'Nồng độ bắt đầu (Thực tế hiện tại)',
    targetLabel: 'Nồng độ mục tiêu mô phỏng',
    rateLabel: 'Tốc độ rò rỉ',
    tag: 'GS-06',
    plcTag: 'Tank_Gas_Detector',
    unit: '%',
    qualifier: 'LEL',
    digits: 0,
    min: 0,
    max: 50,
    step: 1,
    threshold: 20,
    thresholdLabel: 'Ngưỡng cảnh báo PLC',
    direction: 'above',
  },
  referenceRows: [
    { id: 'gas', label: 'Gas khu vực bồn', plcTag: 'Tank_Gas_Detector', tag: 'GS-06', unit: '%LEL', digits: 1, limits: { warn: 10, danger: 20 } },
    { id: 'hb', label: 'PLC heartbeat', plcTag: 'PLC_Heartbeat', tag: 'PLC-01.HEARTBEAT', unit: '—', digits: 0, kind: 'heartbeat' },
  ],
  areaOptions: ['Khu bồn LPG', 'Đường cấp LPG'],
  expectedOutcomes: ['Phát hiện nồng độ gas vượt ngưỡng mô phỏng'],
  suggestion: { target: 35, durationMin: 10, purpose: 'phù hợp để kiểm tra', goal: 'đánh giá cảnh báo', refs: ['Tank_Gas_Detector', 'PLC/SCADA'] },
  monitor: {
    subject: 'Nồng độ',
    signal: 'tín hiệu gas',
    alertSubject: 'Nồng độ Gas khu vực V-101',
    alertTitle: 'Gas khu vực bồn vượt ngưỡng cảnh báo PLC',
    peakTitle: 'Gas khu vực bồn chạm ngưỡng nguy hiểm mô phỏng',
    peakAdvice: 'Gợi ý rà soát quy trình ESD mô phỏng nếu vượt mức nguy hiểm.',
    watchAdvice: 'Gợi ý kiểm tra van xả mô phỏng.',
    aiAction: '[Mô phỏng] Gợi ý thực hiện quy trình cô lập khu vực theo SOP',
    aiDetail: 'AI gợi ý rà soát quy trình cô lập khu vực theo SOP mô phỏng.',
    recoveryTitle: 'Nồng độ gas bắt đầu giảm',
    recoveryDetail: 'Nhờ đóng van ESD ảo, lượng rò rỉ giảm dần. Xu hướng giảm được AI ghi nhận.',
    recoveredTitle: 'Nồng độ dưới ngưỡng nguy hiểm',
    reviewArea: 'khu vực bồn LPG',
    recommendations: ['[Mô phỏng] Hạn chế tiếp cận khu vực bồn theo quy trình an toàn', '[Mô phỏng] Gợi ý quy trình ESD mô phỏng nếu vượt mức nguy hiểm'],
    result: {
      peakLabel: 'Gas cao nhất',
      aiCriterion: 'Gợi ý AI (Virtual ESD)',
      next: 'Nên tiếp tục chạy thêm kịch bản mất kết nối PLC/SCADA trong 2 phút.',
      strengths: ['Cách ly dữ liệu mô phỏng.'],
      improvements: ['Bổ sung biến hướng gió.'],
    },
  },
};

export const GAS_CONFIG: ScenarioConfig = { target: 35, durationMin: 10, rate: 'fast', endCondition: 'duration', areas: ['Khu bồn LPG'] };

/** SC-001 rút gọn (bước phản ứng 5 + 3 + 10 + 20 s, mục tiêu 60 s). */
export const GAS_SCENARIO: Scenario = {
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
  plcVariables: ['Tank_Gas_Detector'],
  tags: ['GS-06'],
  threshold: 'Gas vượt 20% LEL',
  outcome: 'Gợi ý quy trình ESD mô phỏng',
  steps: [
    { id: 'detect', label: 'Phát hiện', seconds: 5 },
    { id: 'alarm', label: 'SCADA phát cảnh báo', seconds: 3 },
    { id: 'esd', label: 'Đề xuất ESD', seconds: 10 },
    { id: 'confirm', label: 'Xác nhận', seconds: 20 },
  ],
  targetSeconds: 60,
  updatedAt: '2026-11-02T09:00:00Z',
  setup: GAS_SETUP,
  config: GAS_CONFIG,
};
