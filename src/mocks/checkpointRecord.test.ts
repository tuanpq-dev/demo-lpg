import { describe, expect, it } from 'vitest';
import { allReadings, applyCheckpointRecord, recordGroups, recordQuality, sensorSummary } from '@/features/reports';
import { parsePlantDateTime } from '@/lib/plantTime';
import { buildCheckpointSnapshot } from './checkpointRecord';
import { buildDailyReadings } from './dailyReport';
import { buildReports } from './reports';

/* Khoá ảnh chụp mốc của modal "Ghi nhận mốc kiểm tra" (cùng mốc thời gian với ảnh: 24/06/2026 18:30). */
const NOW = parsePlantDateTime('2026-06-24T18:30')!;
const reports = buildReports(NOW);
const daily = (day: string) => reports.find((r) => r.period === 'daily' && r.periodKey === day)!;

describe('buildCheckpointSnapshot', () => {
  it('mốc 18:00 hôm nay: đủ IoT, 7/7 nhóm, 16 cảm biến bình thường, đúng bố cục ảnh', () => {
    const s = buildCheckpointSnapshot(daily('2026-06-24'), '18:00', NOW);
    expect(s.tank.map((r) => r.label)).toEqual(['Mức chất lỏng', 'Thể tích chất lỏng', 'Áp suất bồn', 'Nhiệt độ bồn', 'Nhiệt độ khu vực bồn', 'Gas khu vực bồn']);
    expect(s.vaporizers.map((v) => `${v.id}:${v.state}`)).toEqual(['E-101A:running', 'E-101B:standby']);
    expect(s.flowLines.map((l) => l.label)).toEqual(['Line 0', 'Line 1', 'Line 2']);
    expect(recordGroups(s, {}).every((g) => g.complete)).toBe(true);
    expect(recordQuality(s, {})).toMatchObject({ iotStable: true, anomalies: 0, manual: 0 });
    expect(sensorSummary(s)).toMatchObject({ total: 16, normal: 16 });
    // Thể tích theo dung tích V-101 (~13,6 m³) – ảnh 76 % → 10,3 m³.
    const volume = s.tank.find((r) => r.id === 'tank-volume')!.value!;
    expect(volume).toBeGreaterThan(9.5);
    expect(volume).toBeLessThan(12);
  });

  it('mức / áp suất / nhiệt độ bồn trùng số bảng báo cáo ngày khi mốc đã xác nhận', () => {
    const r = daily('2026-06-23');
    const s = buildCheckpointSnapshot(r, '12:00', NOW);
    const rows = buildDailyReadings(r, NOW);
    for (const t of s.tank.filter((x) => x.dailyItemId)) {
      expect(t.value).toBe(rows.find((x) => x.id === t.dailyItemId)!.values['12:00']);
    }
  });

  it('kịch bản lùi 3 ngày: áp suất bồn mất kết nối → không có số, nhóm bồn chưa xong', () => {
    const s = buildCheckpointSnapshot(daily('2026-06-21'), '16:00', NOW);
    const p = allReadings(s).find((x) => x.id === 'tank-pressure')!;
    expect(p).toMatchObject({ value: null, sensor: 'lost' });
    expect(recordGroups(s, {}).find((g) => g.id === 'tank')!.complete).toBe(false);
    expect(recordQuality(s, {}).iotStable).toBe(false);
  });

  it('ổn định: cùng (ngày, mốc) → cùng số', () => {
    const r = daily('2026-06-20');
    expect(buildCheckpointSnapshot(r, '10:00', NOW)).toEqual(buildCheckpointSnapshot(r, '10:00', NOW));
  });

  it('nhập tay khi xác nhận → bảng ngày dùng số nhập tay ở đúng mốc', () => {
    const r = applyCheckpointRecord(daily('2026-06-21'), '16:00', { by: 'A', remark: 'x', manual: { 'v101-pressure': 7.2 }, files: [], at: NOW });
    const row = buildDailyReadings(r, NOW).find((x) => x.id === 'v101-pressure')!;
    expect(row.values['16:00']).toBe(7.2);
    expect(row.values['18:00']).toBeNull();
  });
});
