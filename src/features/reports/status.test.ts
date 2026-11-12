import { describe, expect, test } from 'vitest';
import { deriveAwaitingByStep, deriveMonthProgress, deriveReportKpis, deriveTodayActions } from './derive';
import { matchReport, sortReports, type ReportFilterValues } from './filter';
import { periodContains, periodRange, reportCode } from './period';
import {
  awaitingStep,
  completionOf,
  missingCheckpoints,
  missingText,
  progressText,
  reportState,
  signatureOf,
  type ReportCheckpoint,
  type ReportRecord,
} from './status';

// 15:30 ngày 24/06/2026 giờ nhà máy.
const NOW = new Date('2026-06-24T08:30:00Z');

const cps = (day: string, done: number, extra: Partial<ReportCheckpoint> = {}): ReportCheckpoint[] =>
  ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'].map((t, i) => ({ key: t, label: t, dueAt: `${day}T${t}`, done: i < done, ...extra }));

const daily = (day: string, patch: Partial<ReportRecord> = {}): ReportRecord => ({
  id: `d-${day}`,
  code: reportCode('daily', day),
  period: 'daily',
  periodKey: day,
  shift: 'Ca 1',
  checkpoints: cps(day, 6),
  inspector: 'Nguyễn Văn A',
  signature: { status: 'not-sent' },
  updatedAt: `${day}T18:05`,
  ...patch,
});

describe('trạng thái suy dẫn', () => {
  test('kỳ chưa kết thúc → Đang thực hiện, chữ ký luôn "Chưa gửi ký" dù bản ghi ghi gì', () => {
    const r = daily('2026-06-24', { checkpoints: cps('2026-06-24', 3), signature: { status: 'signed' } });
    expect(completionOf(r, NOW)).toBe('in-progress');
    expect(signatureOf(r, NOW)).toBe('not-sent');
    expect(reportState(r, NOW)).toBe('in-progress');
  });

  test('kỳ đã qua: thiếu mốc → Thiếu dữ liệu; đủ mốc → theo chữ ký', () => {
    expect(completionOf(daily('2026-06-23', { checkpoints: cps('2026-06-23', 5) }), NOW)).toBe('missing-data');
    expect(reportState(daily('2026-06-23', { signature: { status: 'signed' } }), NOW)).toBe('signed');
    expect(reportState(daily('2026-06-23', { signature: { status: 'pending', step: 'approver' } }), NOW)).toBe('awaiting');
  });

  test('bước chờ ký: đang chờ → đúng bước; bị trả lại / chưa gửi → về Người kiểm tra', () => {
    expect(awaitingStep(daily('2026-06-23', { signature: { status: 'pending', step: 'tap' } }), NOW)).toBe('tap');
    expect(awaitingStep(daily('2026-06-23', { signature: { status: 'rejected', reason: 'Sai số' } }), NOW)).toBe('inspector');
    expect(awaitingStep(daily('2026-06-23', { signature: { status: 'not-sent' } }), NOW)).toBe('inspector');
    expect(awaitingStep(daily('2026-06-23', { signature: { status: 'signed' } }), NOW)).toBeUndefined();
  });

  test('mốc thiếu: hôm nay chỉ tính mốc đã tới hạn; kỳ đã qua tính mọi mốc chưa có', () => {
    const today = daily('2026-06-24', { checkpoints: cps('2026-06-24', 2) });
    expect(missingCheckpoints(today, NOW).map((c) => c.key)).toEqual(['12:00', '14:00']);
    expect(missingText(daily('2026-06-23', { checkpoints: cps('2026-06-23', 1) }), NOW)).toBe('10:00, 12:00, 14:00 +2');
    expect(missingText(daily('2026-06-23'), NOW)).toBe('Không có');
    expect(progressText(today)).toBe('2/6 mốc (33%)');
  });

  test('kỳ tháng / quý / năm: khoảng ngày + mã; mã kỳ sai → ném lỗi (không im lặng)', () => {
    expect(periodRange('monthly', '2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(periodRange('quarterly', '2026-Q2')).toEqual({ start: '2026-04-01', end: '2026-06-30' });
    expect(periodContains('yearly', '2026', '2026-06-24')).toBe(true);
    expect(reportCode('daily', '2026-06-24')).toBe('BCVH-N-24062026');
    expect(() => periodRange('monthly', '2026-6')).toThrow();
  });
});

describe('số liệu màn báo cáo', () => {
  const rows = [
    daily('2026-06-24', { checkpoints: cps('2026-06-24', 2, {}) }),
    daily('2026-06-23', { checkpoints: cps('2026-06-23', 5) }),
    daily('2026-06-22', { signature: { status: 'rejected' }, updatedAt: '2026-06-23T09:00' }),
    daily('2026-06-21', { signature: { status: 'pending', step: 'approver' } }),
    daily('2026-06-20', { signature: { status: 'signed' } }),
    daily('2026-05-31', { signature: { status: 'signed' } }),
  ];

  test('KPI: mỗi báo cáo đúng một nhóm, tổng khớp', () => {
    const k = deriveReportKpis(rows, NOW);
    expect(k).toEqual({ total: 6, 'in-progress': 1, 'missing-data': 1, awaiting: 2, signed: 2 });
    expect(deriveAwaitingByStep(rows, NOW)).toEqual({ inspector: 1, approver: 1, tap: 0 });
  });

  test('tiến độ tháng chỉ tính báo cáo ngày của tháng hiện tại tới hôm nay', () => {
    expect(deriveMonthProgress(rows, NOW)).toEqual({ month: '06', total: 5, done: 1, inProgress: 1, missing: 1, awaiting: 2 });
  });

  test('việc cần xử lý hôm nay: thiếu mốc → bị trả lại → cần xác minh', () => {
    const today = daily('2026-06-24', {
      checkpoints: cps('2026-06-24', 2).map((c, i) => (i === 1 ? { ...c, needsVerify: true } : c)),
    });
    const items = deriveTodayActions([today, ...rows.slice(1)], NOW);
    expect(items.map((i) => `${i.subject}: ${i.message}`)).toEqual([
      'BCVH-N-24062026: Thiếu mốc 12:00, 14:00',
      'BCVH-N-22062026: Bị trả lại',
      'Dữ liệu 10:00: Cần xác minh',
    ]);
  });

  test('lọc: tab "Biểu mẫu đã ký", tìm không dấu theo người kiểm tra, ngày nằm trong kỳ; sắp kỳ kết thúc gần nhất trước', () => {
    const v = (patch: Partial<ReportFilterValues>): ReportFilterValues => ({
      tab: 'all',
      q: '',
      date: null,
      shift: null,
      completion: null,
      signature: null,
      inspector: null,
      approver: null,
      ...patch,
    });
    expect(rows.filter((r) => matchReport(r, v({ tab: 'signed' }), NOW)).map((r) => r.periodKey)).toEqual(['2026-06-20', '2026-05-31']);
    expect(rows.filter((r) => matchReport(r, v({ q: 'nguyen van a' }), NOW))).toHaveLength(6);
    expect(rows.filter((r) => matchReport(r, v({ signature: 'awaiting' }), NOW))).toHaveLength(2);
    expect([...rows].reverse().sort(sortReports)[0]!.periodKey).toBe('2026-06-24');
  });
});
