import { describe, expect, it } from 'vitest';
import { parsePlantDateTime } from '@/lib/plantTime';
import { DAILY_CHECKPOINTS } from './period';
import { deriveAwaitingByStep, deriveMonthProgress, deriveReportKpis, deriveTodayActions, deriveUpcomingDeadlines } from './derive';
import type { ReportRecord } from './status';

const at = (s: string) => parsePlantDateTime(s)!;

function daily(day: string, done: readonly string[], signature: ReportRecord['signature'] = { status: 'signed' }, verify?: string): ReportRecord {
  return {
    id: day,
    code: `R-${day}`,
    period: 'daily',
    periodKey: day,
    checkpoints: DAILY_CHECKPOINTS.map((t) => ({
      key: t,
      label: t,
      dueAt: `${day}T${t}`,
      done: done.includes(t),
      needsVerify: t === verify || undefined,
    })),
    inspector: 'A',
    signature,
    updatedAt: `${day}T18:10`,
  };
}
const ALL = DAILY_CHECKPOINTS;

describe('deriveReportKpis', () => {
  it('rỗng → toàn 0', () => {
    expect(deriveReportKpis([], at('2026-06-24T09:00'))).toEqual({ total: 0, 'in-progress': 0, 'missing-data': 0, awaiting: 0, signed: 0 });
  });
  it('tổng = tổng 4 nhóm', () => {
    const now = at('2026-06-24T09:00');
    const rows = [
      daily('2026-06-24', []),
      daily('2026-06-23', ALL),
      daily('2026-06-22', ['08:00']),
      daily('2026-06-21', ALL, { status: 'rejected' }),
    ];
    const k = deriveReportKpis(rows, now);
    expect(k).toEqual({ total: 4, 'in-progress': 1, 'missing-data': 1, awaiting: 1, signed: 1 });
  });
});

describe('deriveAwaitingByStep', () => {
  it('đếm theo bước ký; bị trả lại tính cho người kiểm tra', () => {
    const now = at('2026-06-24T09:00');
    const rows = [
      daily('2026-06-23', ALL, { status: 'pending', step: 'approver' }),
      daily('2026-06-22', ALL, { status: 'rejected' }),
      daily('2026-06-21', ALL, { status: 'pending', step: 'tap' }),
      daily('2026-06-20', ALL),
    ];
    expect(deriveAwaitingByStep(rows, now)).toEqual({ inspector: 1, approver: 1, tap: 1 });
  });
});

describe('deriveMonthProgress', () => {
  it('chỉ báo cáo ngày của tháng hiện tại tới hôm nay', () => {
    const now = at('2026-06-03T10:00');
    const rows = [
      daily('2026-05-31', ALL),
      daily('2026-06-01', ALL),
      daily('2026-06-02', ['08:00']),
      daily('2026-06-03', []),
      daily('2026-06-04', []),
    ];
    expect(deriveMonthProgress(rows, now)).toEqual({ month: '06', total: 3, done: 1, inProgress: 1, missing: 1, awaiting: 0 });
  });
});

describe('deriveUpcomingDeadlines', () => {
  it('như ảnh (24/06/2026): tuần 4 thứ Sáu 26, tháng 6 & quý 2 ngày 30', () => {
    const d = deriveUpcomingDeadlines(at('2026-06-24T18:30'));
    expect(d.map((x) => [x.title, x.day, x.time])).toEqual([
      ['Báo cáo tuần 4 - Tháng 6', '2026-06-26', '17:00'],
      ['Báo cáo tháng 6', '2026-06-30', '12:00'],
      ['Báo cáo quý 2', '2026-06-30', '17:00'],
    ]);
  });
  it('thứ Sáu đã quá 17:00 → tuần sau; đúng 17:00 vẫn còn', () => {
    expect(deriveUpcomingDeadlines(at('2026-06-26T17:00'))[0]!.day).toBe('2026-06-26');
    expect(deriveUpcomingDeadlines(at('2026-06-26T17:01'), 4).find((x) => x.kind === 'weekly')!.day).toBe('2026-07-03');
  });
  it('quá hạn tháng/quý/năm cuối năm → sang năm sau', () => {
    const d = deriveUpcomingDeadlines(at('2026-12-31T17:30'), 4);
    expect(d.find((x) => x.kind === 'monthly')).toMatchObject({ day: '2027-01-31', title: 'Báo cáo tháng 1' });
    expect(d.find((x) => x.kind === 'quarterly')).toMatchObject({ day: '2027-03-31', title: 'Báo cáo quý 1' });
    expect(d.find((x) => x.kind === 'yearly')).toMatchObject({ day: '2027-12-31', title: 'Báo cáo năm 2027' });
  });
});

describe('deriveTodayActions', () => {
  it('thiếu mốc hôm nay → bị trả lại → cần xác minh (đúng thứ tự, đúng tone)', () => {
    const now = at('2026-06-24T18:30');
    const rows = [
      daily('2026-06-24', ['08:00', '10:00', '12:00', '14:00', '16:00'], { status: 'not-sent' }, '14:00'),
      daily('2026-06-20', ALL, { status: 'rejected' }),
      daily('2026-06-19', ALL),
    ];
    expect(deriveTodayActions(rows, now).map((a) => [a.tone, a.subject, a.message])).toEqual([
      ['danger', 'R-2026-06-24', 'Thiếu mốc 18:00'],
      ['danger', 'R-2026-06-20', 'Bị trả lại'],
      ['warning', 'Dữ liệu 14:00', 'Cần xác minh'],
    ]);
  });
  it('chưa có mốc nào tới hạn → không báo thiếu', () => {
    expect(deriveTodayActions([daily('2026-06-24', [])], at('2026-06-24T07:59'))).toEqual([]);
  });
});
