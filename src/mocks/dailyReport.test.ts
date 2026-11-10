import { describe, expect, it } from 'vitest';
import { flaggedReadings, rowResult } from '@/features/reports';
import { parsePlantDateTime } from '@/lib/plantTime';
import { DAILY_ITEMS, buildDailyReadings } from './dailyReport';
import { buildReports } from './reports';

/* Khoá kịch bản số đo mẫu của chi tiết báo cáo ngày (cùng mốc thời gian với ảnh: 24/06/2026 18:30). */
const NOW = parsePlantDateTime('2026-06-24T18:30')!;
const reports = buildReports(NOW);
const daily = (day: string) => reports.find((r) => r.period === 'daily' && r.periodKey === day)!;

describe('buildDailyReadings', () => {
  it('đủ 5 nhóm, 14 hạng mục, mỗi dòng 6 mốc', () => {
    const rows = buildDailyReadings(daily('2026-06-24'), NOW);
    expect(rows).toHaveLength(DAILY_ITEMS.length);
    expect(new Set(rows.map((r) => r.groupId))).toEqual(new Set(['V-101', 'E-101', 'PR-101', 'FT-101', 'GS']));
    rows.forEach((r) => expect(Object.keys(r.values)).toHaveLength(6));
  });

  it('hôm nay: mốc chưa có dữ liệu (18:00) → null ở mọi dòng; mức bồn giảm dần quanh 77 %', () => {
    const rows = buildDailyReadings(daily('2026-06-24'), NOW);
    rows.forEach((r) => expect(r.values['18:00']).toBeNull());
    const level = rows.find((r) => r.id === 'v101-level')!;
    const v = ['08:00', '10:00', '12:00', '14:00', '16:00'].map((k) => level.values[k]!);
    expect(v[0]).toBeGreaterThan(76.5);
    expect(v[0]).toBeLessThan(77.5);
    expect(v[4]).toBeLessThan(v[0]!);
  });

  // 02/11/2026: bỏ 20/06 khỏi danh sách – lùi 4 ngày giờ có kịch bản GS-03 chưa ghi chú (modal ký báo cáo).
  it('ngày thường: không ô nào ngoài ngưỡng (thẻ "Dữ liệu bất thường" = 0)', () => {
    for (const day of ['2026-06-24', '2026-06-23', '2026-06-19', '2026-06-10']) {
      const r = daily(day);
      expect(
        flaggedReadings(
          buildDailyReadings(r, NOW),
          r.checkpoints.map((c) => c.key),
        ),
      ).toEqual([]);
    }
  });

  it('kịch bản: lùi 2 ngày GS-02 12:00 Cảnh báo; lùi 9 ngày áp suất bồn 14:00 Bất thường', () => {
    const d2 = daily('2026-06-22');
    const rows2 = buildDailyReadings(d2, NOW);
    expect(
      flaggedReadings(
        rows2,
        d2.checkpoints.map((c) => c.key),
      ),
    ).toEqual([{ rowId: 'gas-gs-02', device: 'GS-02', checkpoint: '12:00', level: 'warning' }]);
    const d9 = daily('2026-06-15');
    const pressure = buildDailyReadings(d9, NOW).find((r) => r.id === 'v101-pressure')!;
    expect(rowResult(pressure)).toBe('abnormal');
    expect(pressure.notes?.['14:00']).toBeTruthy();
  });

  it('kịch bản ký: lùi 4 ngày (bị trả lại) GS-03 10:00 Cảnh báo, chưa ghi chú', () => {
    const d4 = daily('2026-06-20');
    const rows = buildDailyReadings(d4, NOW);
    expect(
      flaggedReadings(
        rows,
        d4.checkpoints.map((c) => c.key),
      ),
    ).toEqual([{ rowId: 'gas-gs-03', device: 'GS-03', checkpoint: '10:00', level: 'warning' }]);
    expect(rows.find((r) => r.id === 'gas-gs-03')!.notes).toBeUndefined();
  });

  it('ổn định: cùng báo cáo → cùng số (F5 không đổi)', () => {
    const r = daily('2026-06-20');
    expect(buildDailyReadings(r, NOW)).toEqual(buildDailyReadings(r, NOW));
  });

  it('số đọc tại chỗ: E-101B và đồng hồ PR-101', () => {
    const field = buildDailyReadings(daily('2026-06-24'), NOW)
      .filter((r) => r.source === 'field')
      .map((r) => r.id);
    expect(field).toEqual(['e101b-temp', 'pr101-gauge']);
  });
});
