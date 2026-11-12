import { describe, expect, test } from 'vitest';
import { reportCode } from './period';
import { findDailyReport, queryReports, reportSummary, type ReportListQuery } from './query';
import type { ReportRecord } from './status';

// 15:30 ngày 24/06/2026 giờ nhà máy.
const NOW = new Date('2026-06-24T08:30:00Z');

const rec = (period: ReportRecord['period'], key: string, patch: Partial<ReportRecord> = {}): ReportRecord => ({
  id: `${period}-${key}`,
  code: reportCode(period, key),
  period,
  periodKey: key,
  checkpoints: [{ key: 'k', label: 'k', dueAt: '2026-01-01T08:00', done: true }],
  inspector: 'Nguyễn Văn A',
  signature: { status: 'not-sent' },
  updatedAt: '2026-06-01T08:00',
  ...patch,
});

const all = [
  rec('daily', '2026-06-23', { shift: 'Ca 2', signature: { status: 'signed' } }),
  rec('daily', '2026-06-22', { shift: 'Ca 1', approver: 'Trần B' }),
  rec('daily', '2026-06-21', { shift: 'Ca 1', inspector: 'Lê C' }),
  rec('monthly', '2026-05', { signature: { status: 'signed' } }),
  rec('quarterly', '2026-Q1'),
];

const q = (patch: Partial<ReportListQuery> = {}): ReportListQuery => ({
  tab: 'all',
  q: '',
  date: null,
  shift: null,
  completion: null,
  signature: null,
  inspector: null,
  approver: null,
  page: 1,
  pageSize: 2,
  ...patch,
});

describe('GET /reports – lọc, phân trang, đếm tab', () => {
  test('kỳ kết thúc gần nhất trước, cắt đúng trang, kẹp trang vượt', () => {
    expect(queryReports(all, q(), NOW).rows.map((r) => r.periodKey)).toEqual(['2026-06-23', '2026-06-22']);
    const last = queryReports(all, q({ page: 9 }), NOW);
    expect(last.page).toBe(3);
    expect(last.rows.map((r) => r.periodKey)).toEqual(['2026-Q1']);
  });

  test('đếm tab theo bộ lọc CÒN LẠI; "Biểu mẫu đã ký" gồm mọi kỳ', () => {
    const r = queryReports(all, q({ tab: 'signed', shift: 'Ca 1' }), NOW);
    expect(r.total).toBe(0);
    expect(r.tabCounts).toEqual({ all: 2, daily: 2, monthly: 0, quarterly: 0, yearly: 0, signed: 0 });
    expect(queryReports(all, q({ tab: 'signed' }), NOW).tabCounts.signed).toBe(2);
  });

  test('facet lấy từ TOÀN BỘ dữ liệu (không theo bộ lọc), sắp theo tiếng Việt', () => {
    expect(queryReports(all, q({ tab: 'monthly' }), NOW).facets).toEqual({
      shifts: ['Ca 1', 'Ca 2'],
      inspectors: ['Lê C', 'Nguyễn Văn A'],
      approvers: ['Trần B'],
    });
  });
});

describe('GET /reports/summary + /reports/daily/:code', () => {
  test('số liệu tính trên toàn bộ danh sách; việc cần xử lý mang mã báo cáo', () => {
    const s = reportSummary(all, NOW);
    expect(s.kpis.total).toBe(5);
    expect(s.kpis.signed).toBe(2);
    expect(s.monthProgress.total).toBe(3);
  });

  test('báo cáo ngày theo mã: không phân biệt hoa thường; mã báo cáo tháng / mã lạ → null', () => {
    expect(findDailyReport(all, 'bcvh-n-23062026')?.periodKey).toBe('2026-06-23');
    expect(findDailyReport(all, reportCode('monthly', '2026-05'))).toBeNull();
    expect(findDailyReport(all, 'X')).toBeNull();
  });
});
