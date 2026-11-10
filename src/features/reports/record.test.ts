import { describe, expect, it } from 'vitest';
import { parsePlantDateTime } from '@/lib/plantTime';
import { DAILY_CHECKPOINTS } from './period';
import {
  allReadings,
  appendRemark,
  applyCheckpointRecord,
  canRecordCheckpoint,
  effectiveValue,
  formatRecordValue,
  inventoryNm3,
  manualForDaily,
  recordBlockers,
  recordGroups,
  recordProgress,
  recordQuality,
  sensorSummary,
  valueSource,
  valueState,
  valueStateLabel,
  type CheckpointSnapshot,
  type RecordReading,
} from './record';
import type { ReportRecord } from './status';

const DAY = '2026-06-24';
const NOW = parsePlantDateTime('2026-06-24T18:30')!;

const rd = (id: string, value: number | null, patch: Partial<RecordReading> = {}): RecordReading => ({
  id,
  label: id,
  tag: id.toUpperCase(),
  unit: 'bar',
  digits: 1,
  limits: { lowWarn: 2, warn: 12, danger: 14 },
  value,
  sensor: value === null ? 'lost' : 'normal',
  ...patch,
});

const snap = (patch: Partial<CheckpointSnapshot> = {}): CheckpointSnapshot => ({
  checkpoint: '18:00',
  tank: [
    rd('level', 76, { unit: '%', dailyItemId: 'v101-level', limits: { lowWarn: 10, warn: 90 } }),
    rd('pressure', 6.8, { dailyItemId: 'v101-pressure' }),
    rd('gas', 2, { unit: '%LEL', digits: 0, limits: { warn: 10, danger: 20 }, safeLabel: true }),
  ],
  vaporizers: [{ id: 'E-101A', state: 'running', readings: [rd('vap-gas', 1, { limits: { warn: 10 } })] }],
  regulators: [rd('reg', 2.4, { limits: {} })],
  flowLines: [{ id: 'l0', label: 'Line 0', sensor: 'normal', readings: [rd('flow', 145, { limits: {} }), rd('total', 2038, { limits: {} })] }],
  gas: [
    { readingId: 'gas', label: 'Gas khu vực bồn' },
    { readingId: 'vap-gas', label: 'Gas KV 1' },
  ],
  fire: [{ id: 'f', label: 'Tín hiệu', ok: true, text: 'Bình thường' }],
  plc: { heartbeat: true, connected: true, scada: true, mode: 'SCADA Remote', estop: false, updatedAt: '18:03:42', delaySec: 18 },
  ...patch,
});

const report = (patch: Partial<ReportRecord> = {}): ReportRecord => ({
  id: 'R',
  code: 'BCVH-N-24062026',
  period: 'daily',
  periodKey: DAY,
  shift: 'Ca 1',
  checkpoints: DAILY_CHECKPOINTS.map((t) => ({
    key: t,
    label: t,
    dueAt: `${DAY}T${t}`,
    done: t !== '18:00',
    ...(t === '14:00' ? { needsVerify: true } : {}),
  })),
  inspector: 'Nguyễn Văn A',
  signature: { status: 'not-sent' },
  updatedAt: `${DAY}T16:05`,
  ...patch,
});

describe('giá trị + trạng thái', () => {
  it('nhập tay ghi đè IoT; nguồn: iot / field (IoT có số) / manual (IoT mất) / missing', () => {
    const ok = rd('p', 6.8);
    const lost = rd('q', null);
    expect(effectiveValue(ok, { p: 7 })).toBe(7);
    expect(valueSource(ok, {})).toBe('iot');
    expect(valueSource(ok, { p: 7 })).toBe('field');
    expect(valueSource(lost, { q: 7 })).toBe('manual');
    expect(valueSource(lost, {})).toBe('missing');
  });

  it('mức theo ngưỡng; gas bình thường đọc "An toàn"; thiếu số → "Chưa có dữ liệu"', () => {
    expect(valueState(rd('p', 12.5), {})).toBe('warning');
    expect(valueState(rd('p', 14.3), {})).toBe('abnormal');
    expect(valueStateLabel(rd('g', 2, { limits: { warn: 10 }, safeLabel: true }), {})).toBe('An toàn');
    expect(valueStateLabel(rd('g', 12, { limits: { warn: 10 }, safeLabel: true }), {})).toBe('Cảnh báo');
    expect(valueStateLabel(rd('q', null), {})).toBe('Chưa có dữ liệu');
  });

  it('định dạng dấu phẩy; tồn kho quy đổi theo hệ số giả định (10,3 m³ → 151,4 Nm³)', () => {
    expect(formatRecordValue(76, 1)).toBe('76,0');
    expect(formatRecordValue(null, 1)).toBe('—');
    expect(formatRecordValue(inventoryNm3(10.3), 1)).toBe('151,4');
  });
});

describe('chất lượng + cảm biến', () => {
  it('đủ IoT: ổn định, 7/7 thông số, 0 bất thường, 0 nhập tay', () => {
    expect(recordQuality(snap(), {})).toEqual({ iotStable: true, verified: 7, total: 7, anomalies: 0, manual: 0 });
  });

  it('cảm biến mất kết nối → gián đoạn, thiếu một giá trị; nhập tay bù lại', () => {
    const s = snap({ regulators: [rd('reg', null, { limits: {} })] });
    expect(recordQuality(s, {})).toMatchObject({ iotStable: false, verified: 6, total: 7 });
    expect(recordQuality(s, { reg: 2.3 })).toMatchObject({ verified: 7, manual: 1 });
  });

  it('bất thường tính cả số nhập tay; PLC mất kết nối → không ổn định', () => {
    expect(recordQuality(snap(), { pressure: 13 }).anomalies).toBe(1);
    expect(recordQuality(snap({ plc: { ...snap().plc, connected: false } }), {}).iotStable).toBe(false);
  });

  it('đếm cảm biến: thông số bồn/máy hóa hơi/điều áp + mỗi đồng hồ đường cấp một cảm biến', () => {
    const s = snap({ regulators: [rd('reg', null, { limits: {} })] });
    expect(sensorSummary(s)).toEqual({ total: 6, normal: 5, fault: 0, lost: 1, stale: 0 });
    expect(allReadings(s)).toHaveLength(7);
  });
});

describe('nhóm + điều kiện xác nhận', () => {
  it('7 nhóm đủ → 100 %; chỉ thiếu nhận xét', () => {
    const groups = recordGroups(snap(), {});
    expect(groups.map((g) => g.id)).toEqual(['tank', 'vaporizer', 'regulator', 'flow', 'gas', 'fire', 'plc']);
    expect(recordProgress(groups)).toBe(100);
    expect(recordBlockers(groups, '  ')).toEqual(['Chưa nhập nhận xét vận hành']);
    expect(recordBlockers(groups, 'Ổn định')).toEqual([]);
  });

  it('thiếu giá trị ở bồn (cả nhóm gas dùng chung thông số) → 2 nhóm chưa xong; nhập tay → đủ', () => {
    const s = snap({ tank: [...snap().tank.slice(0, 2), rd('gas', null, { limits: { warn: 10 } })] });
    const groups = recordGroups(s, {});
    expect(groups.filter((g) => !g.complete).map((g) => g.label)).toEqual(['Bồn chứa LPG', 'Cảm biến rò rỉ LPG']);
    expect(recordProgress(groups)).toBe(71);
    expect(recordBlockers(groups, 'x')).toEqual(['Thiếu dữ liệu nhóm Bồn chứa LPG', 'Thiếu dữ liệu nhóm Cảm biến rò rỉ LPG']);
    expect(recordBlockers(recordGroups(s, { gas: 1 }), 'x')).toEqual([]);
  });

  it('PLC mất kết nối → báo cháy + PLC chưa kiểm tra được', () => {
    const groups = recordGroups(snap({ plc: { ...snap().plc, connected: false } }), {});
    expect(groups.filter((g) => !g.complete).map((g) => g.id)).toEqual(['fire', 'plc']);
  });
});

describe('nhận xét gợi ý', () => {
  it('ô trống → câu gợi ý; có chữ → nối sau dấu chấm; không thêm trùng', () => {
    expect(appendRemark('', 'Hệ thống ổn định')).toBe('Hệ thống ổn định');
    expect(appendRemark('Áp suất ổn', 'Hệ thống ổn định')).toBe('Áp suất ổn. Hệ thống ổn định');
    expect(appendRemark('Đã kiểm tra.', 'Không có bất thường')).toBe('Đã kiểm tra. Không có bất thường');
    expect(appendRemark('hệ thống ổn định', 'Hệ thống ổn định')).toBe('hệ thống ổn định');
  });
});

describe('mở modal + ghi mốc', () => {
  it('chỉ mốc đã tới hạn chưa có dữ liệu của báo cáo ngày', () => {
    expect(canRecordCheckpoint(report(), '18:00', NOW)).toBe(true);
    expect(canRecordCheckpoint(report(), '18:00', parsePlantDateTime('2026-06-24T17:00')!)).toBe(false);
    expect(canRecordCheckpoint(report(), '16:00', NOW)).toBe(false);
    expect(canRecordCheckpoint(report(), '19:00', NOW)).toBe(false);
    expect(canRecordCheckpoint(report({ period: 'monthly', periodKey: '2026-06' }), '18:00', NOW)).toBe(false);
  });

  it('nhập tay theo hạng mục bảng ngày – bỏ thông số không có hạng mục', () => {
    expect(manualForDaily(snap(), { pressure: 7.1, reg: 2 })).toEqual({ 'v101-pressure': 7.1 });
  });

  it('xác nhận: mốc có dữ liệu, giữ cờ mốc khác, giờ cập nhật + nhật ký (nhận xét cắt khoảng trắng)', () => {
    const r = applyCheckpointRecord(report(), '18:00', {
      by: 'Nguyễn Văn A',
      remark: ' Ổn định ',
      manual: { 'v101-pressure': 7.1 },
      files: ['a.jpg'],
      at: NOW,
    });
    expect(r.checkpoints.find((c) => c.key === '18:00')).toEqual({ key: '18:00', label: '18:00', dueAt: `${DAY}T18:00`, done: true });
    expect(r.checkpoints.find((c) => c.key === '14:00')?.needsVerify).toBe(true);
    expect(r.updatedAt).toBe('2026-06-24T18:30');
    expect(r.checkpointLog).toEqual({
      '18:00': { by: 'Nguyễn Văn A', at: '2026-06-24T18:30', remark: 'Ổn định', manual: { 'v101-pressure': 7.1 }, files: ['a.jpg'] },
    });
  });

  it('không nhập tay / không tệp → không lưu trường đó; giữ nhật ký mốc khác', () => {
    const prev = { '16:00': { by: 'B', at: `${DAY}T16:05`, remark: 'x' } };
    const r = applyCheckpointRecord(report({ checkpointLog: prev }), '18:00', { by: 'A', remark: 'y', manual: {}, files: [], at: NOW });
    expect(r.checkpointLog).toEqual({ ...prev, '18:00': { by: 'A', at: '2026-06-24T18:30', remark: 'y' } });
  });
});
