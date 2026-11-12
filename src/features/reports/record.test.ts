import { describe, expect, test } from 'vitest';
import {
  appendRemark,
  applyCheckpointRecord,
  canRecordCheckpoint,
  manualForDaily,
  recordBlockers,
  recordGroups,
  recordProgress,
  recordQuality,
  sensorSummary,
  valueSource,
  valueState,
  type CheckpointSnapshot,
  type RecordReading,
} from './record';
import type { ReportRecord } from './status';

// 18:30 ngày 24/06/2026 giờ nhà máy.
const NOW = new Date('2026-06-24T11:30:00Z');

const reading = (id: string, value: number | null, patch: Partial<RecordReading> = {}): RecordReading => ({
  id,
  label: id,
  tag: id.toUpperCase(),
  unit: 'bar',
  digits: 1,
  limits: { warn: 10, danger: 12 },
  value,
  sensor: value === null ? 'lost' : 'normal',
  ...patch,
});

const snapshot = (patch: Partial<CheckpointSnapshot> = {}): CheckpointSnapshot => ({
  checkpoint: '18:00',
  tank: [reading('tank-p', 9.2, { dailyItemId: 'tank-pressure' }), reading('tank-gas', 0.1, { unit: '%LEL', safeLabel: true })],
  vaporizers: [{ id: 'E-101A', state: 'running', readings: [reading('vap-t', 60, { limits: {} })] }],
  regulators: [reading('pr-out', null, { dailyItemId: 'pr-out' })],
  flowLines: [{ id: 'L1', label: 'Đường 1', sensor: 'normal', readings: [reading('flow-1', 120, { limits: {} })] }],
  gas: [{ readingId: 'tank-gas', label: 'Khu bồn' }],
  fire: [],
  plc: { heartbeat: true, connected: true, scada: true, mode: 'SCADA Remote', estop: false, updatedAt: '18:00:02', delaySec: 2 },
  ...patch,
});

describe('giá trị + nguồn', () => {
  test('nhập tay ghi đè IoT; nguồn: IoT · hiện trường (IoT vẫn có số) · thủ công (IoT mất) · thiếu', () => {
    const s = snapshot();
    const [tankP] = s.tank;
    const pr = s.regulators[0]!;
    expect(valueSource(tankP!, {})).toBe('iot');
    expect(valueSource(tankP!, { 'tank-p': 9 })).toBe('field');
    expect(valueSource(pr, { 'pr-out': 3.4 })).toBe('manual');
    expect(valueSource(pr, {})).toBe('missing');
    expect(valueState(tankP!, { 'tank-p': 12.5 })).toBe('abnormal');
    expect(valueState(pr, {})).toBe('missing');
  });

  test('chất lượng dữ liệu: cảm biến mất kết nối → IoT không ổn định; đếm đã có số / ngoài ngưỡng / nhập tay', () => {
    const s = snapshot();
    expect(recordQuality(s, {})).toEqual({ iotStable: false, verified: 4, total: 5, anomalies: 0, manual: 0 });
    expect(recordQuality(s, { 'pr-out': 3.4, 'tank-p': 10.5 })).toEqual({ iotStable: false, verified: 5, total: 5, anomalies: 1, manual: 2 });
    expect(sensorSummary(s)).toEqual({ total: 5, normal: 4, fault: 0, lost: 1, stale: 0 });
  });
});

describe('điều kiện xác nhận mốc', () => {
  test('thiếu số nhóm Bộ điều áp + chưa nhận xét → chặn; nhập tay đủ + có nhận xét → được', () => {
    const s = snapshot();
    const groups = recordGroups(s, {});
    expect(groups.filter((g) => !g.complete).map((g) => g.id)).toEqual(['regulator']);
    expect(recordProgress(groups)).toBe(86);
    expect(recordBlockers(groups, '  ')).toEqual(['Thiếu dữ liệu nhóm Bộ điều áp', 'Chưa nhập nhận xét vận hành']);
    expect(recordBlockers(recordGroups(s, { 'pr-out': 3.4 }), 'Ổn định')).toEqual([]);
  });

  test('PLC mất kết nối → nhóm Báo cháy + PLC chưa kiểm tra', () => {
    const groups = recordGroups(snapshot({ plc: { ...snapshot().plc, connected: false } }), { 'pr-out': 3 });
    expect(groups.filter((g) => !g.complete).map((g) => g.id)).toEqual(['fire', 'plc']);
  });

  test('chỉ ghi mốc của báo cáo NGÀY, mốc đã tới hạn còn thiếu', () => {
    const r: ReportRecord = {
      id: 'r1',
      code: 'BCVH-N-24062026',
      period: 'daily',
      periodKey: '2026-06-24',
      checkpoints: [
        { key: '16:00', label: '16:00', dueAt: '2026-06-24T16:00', done: true },
        { key: '18:00', label: '18:00', dueAt: '2026-06-24T18:00', done: false, needsVerify: true },
      ],
      inspector: 'A',
      signature: { status: 'not-sent' },
      updatedAt: '2026-06-24T16:05',
    };
    expect(canRecordCheckpoint(r, '18:00', NOW)).toBe(true);
    expect(canRecordCheckpoint(r, '16:00', NOW)).toBe(false);
    expect(canRecordCheckpoint({ ...r, period: 'monthly', periodKey: '2026-06' }, '18:00', NOW)).toBe(false);

    const s = snapshot();
    const next = applyCheckpointRecord(r, '18:00', {
      by: 'A',
      remark: '  Ổn định ',
      manual: manualForDaily(s, { 'pr-out': 3.4, 'vap-t': 61 }),
      files: [],
      at: NOW,
    });
    expect(next.checkpoints[1]).toEqual({ key: '18:00', label: '18:00', dueAt: '2026-06-24T18:00', done: true });
    expect(next.updatedAt).toBe('2026-06-24T18:30');
    // Chỉ thông số có hạng mục bảng ngày được lưu; không có tệp → không lưu trường `files`.
    expect(next.checkpointLog?.['18:00']).toEqual({ by: 'A', at: '2026-06-24T18:30', remark: 'Ổn định', manual: { 'pr-out': 3.4 } });
  });

  test('gợi ý nhận xét: thêm cuối câu, không thêm trùng', () => {
    expect(appendRemark('', 'Hệ thống ổn định')).toBe('Hệ thống ổn định');
    expect(appendRemark('Áp suất bình thường', 'Hệ thống ổn định')).toBe('Áp suất bình thường. Hệ thống ổn định');
    expect(appendRemark('hệ thống ổn định.', 'Hệ thống ổn định')).toBe('hệ thống ổn định.');
  });
});
