/*
 * Dữ liệu mẫu CHỈ cho test logic mô phỏng (không import từ `src/mocks` để test hàm thuần độc lập mock trang).
 */
import type { ScenarioConfig, ScenarioSetup } from './config';

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
};

export const GAS_CONFIG: ScenarioConfig = { target: 35, durationMin: 10, rate: 'fast', endCondition: 'duration', areas: ['Khu bồn LPG'] };
