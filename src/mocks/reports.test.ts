import { describe, expect, it } from 'vitest';
import {
  completionOf,
  deriveAwaitingByStep,
  deriveMonthProgress,
  deriveReportKpis,
  deriveTodayActions,
  missingText,
  progressText,
  signatureOf,
} from '@/features/reports';
import { parsePlantDateTime } from '@/lib/plantTime';
import { buildReports } from './reports';

// Mốc giờ của ảnh thiết kế: `?now=2026-06-24T18:30`.
const now = parsePlantDateTime('2026-06-24T18:30')!;
const rows = buildReports(now);
const byCode = (code: string) => rows.find((r) => r.code === code)!;

describe('buildReports – kịch bản ảnh thiết kế (24/06/2026)', () => {
  it('số báo cáo theo kỳ: 175 ngày (1/1 → 24/6; ảnh ghi 176), 6 tháng, 2 quý, 1 năm', () => {
    const count = (p: string) => rows.filter((r) => r.period === p).length;
    expect([count('daily'), count('monthly'), count('quarterly'), count('yearly')]).toEqual([175, 6, 2, 1]);
  });

  it('KPI như ảnh (trừ tổng/đã ký – ảnh tự mâu thuẫn, xem figma-diffs)', () => {
    expect(deriveReportKpis(rows, now)).toEqual({ total: 184, 'in-progress': 4, awaiting: 6, 'missing-data': 8, signed: 166 });
    expect(deriveAwaitingByStep(rows, now)).toEqual({ inspector: 2, approver: 2, tap: 2 });
  });

  it('Tiến độ tháng 06: 19/24, đang 1, thiếu 2, chờ ký 2', () => {
    expect(deriveMonthProgress(rows, now)).toEqual({ month: '06', total: 24, done: 19, inProgress: 1, missing: 2, awaiting: 2 });
  });

  it('các dòng bảng 18–24/06 khớp ảnh', () => {
    const view = (code: string) => {
      const r = byCode(code);
      return [progressText(r), missingText(r, now), completionOf(r, now), signatureOf(r, now)];
    };
    expect(view('BCVH-N-24062026')).toEqual(['5/6 mốc (83%)', '18:00', 'in-progress', 'not-sent']);
    expect(view('BCVH-N-23062026')).toEqual(['6/6 mốc (100%)', 'Không có', 'done', 'pending']);
    expect(view('BCVH-N-22062026')).toEqual(['6/6 mốc (100%)', 'Không có', 'done', 'signed']);
    expect(view('BCVH-N-21062026')).toEqual(['4/6 mốc (67%)', '16:00, 18:00', 'missing-data', 'not-sent']);
    expect(view('BCVH-N-20062026')).toEqual(['6/6 mốc (100%)', 'Không có', 'done', 'rejected']);
    expect(byCode('BCVH-N-24062026').inspector).toBe('Nguyễn Văn A');
    expect(byCode('BCVH-N-23062026').inspector).toBe('Lê Thị B');
    expect(byCode('BCVH-N-21062026').approver).toBeUndefined();
  });

  it('Cần xử lý hôm nay như ảnh', () => {
    expect(deriveTodayActions(rows, now).map((a) => `${a.subject}: ${a.message}`)).toEqual([
      'BCVH-N-24062026: Thiếu mốc 18:00',
      'BCVH-N-20062026: Bị trả lại',
      'Dữ liệu 14:00: Cần xác minh',
    ]);
  });

  it('báo cáo tháng 05 thiếu dữ liệu vì có ngày thiếu mốc; quý 1 đã ký', () => {
    expect(completionOf(byCode('BCVH-T-052026'), now)).toBe('missing-data');
    expect(signatureOf(byCode('BCVH-Q-12026'), now)).toBe('signed');
  });

  it('đầu năm (1/1 07:00): chỉ 1 báo cáo mỗi kỳ, không ném lỗi', () => {
    const early = buildReports(parsePlantDateTime('2027-01-01T07:00')!);
    expect(early.map((r) => r.code)).toEqual(['BCVH-N-01012027', 'BCVH-T-012027', 'BCVH-Q-12027', 'BCVH-NAM-2027']);
  });

  it('mã báo cáo không trùng', () => {
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  });
});
