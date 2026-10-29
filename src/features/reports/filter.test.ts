import { describe, expect, it } from 'vitest';
import { parsePlantDateTime } from '@/lib/plantTime';
import { DAILY_CHECKPOINTS } from './period';
import { distinctOptions, matchQuery, matchReport, sortReports, type ReportFilterValues } from './filter';
import type { ReportRecord } from './status';

const now = parsePlantDateTime('2026-06-24T18:30')!;
const base: ReportFilterValues = { tab: 'all', q: '', date: null, shift: null, completion: null, signature: null, inspector: null, approver: null };

function rec(over: Partial<ReportRecord> & Pick<ReportRecord, 'period' | 'periodKey'>): ReportRecord {
  return {
    id: `${over.period}-${over.periodKey}`,
    code: `C-${over.periodKey}`,
    checkpoints: DAILY_CHECKPOINTS.map((t) => ({ key: t, label: t, dueAt: `2026-01-01T${t}`, done: true })),
    inspector: 'Nguyễn Văn A',
    approver: 'Trần Văn C',
    signature: { status: 'signed' },
    updatedAt: '2026-06-24T09:00',
    ...over,
  };
}

const d23 = rec({ period: 'daily', periodKey: '2026-06-23', shift: 'Ca 1', signature: { status: 'pending', step: 'approver' } });
const d20 = rec({ period: 'daily', periodKey: '2026-06-20', shift: 'Ca 1', signature: { status: 'rejected' }, inspector: 'Lê Thị B' });
const m05 = rec({ period: 'monthly', periodKey: '2026-05' });
const q2 = rec({ period: 'quarterly', periodKey: '2026-Q2', approver: undefined, signature: { status: 'not-sent' } });

describe('matchReport', () => {
  it('tab theo kỳ + "Biểu mẫu đã ký"', () => {
    expect(matchReport(d23, { ...base, tab: 'daily' }, now)).toBe(true);
    expect(matchReport(m05, { ...base, tab: 'daily' }, now)).toBe(false);
    expect(matchReport(m05, { ...base, tab: 'signed' }, now)).toBe(true);
    expect(matchReport(d23, { ...base, tab: 'signed' }, now)).toBe(false);
  });
  it('ngày: báo cáo tháng/quý chứa ngày đó cũng khớp', () => {
    const v = { ...base, date: '2026-05-15' };
    expect(matchReport(m05, v, now)).toBe(true);
    expect(matchReport(q2, v, now)).toBe(true);
    expect(matchReport(d23, v, now)).toBe(false);
  });
  it('chữ ký: "awaiting" = chờ duyệt + bị trả lại; kỳ chưa xong → Chưa gửi ký', () => {
    expect([d23, d20, m05, q2].filter((r) => matchReport(r, { ...base, signature: 'awaiting' }, now))).toEqual([d23, d20]);
    expect(matchReport(q2, { ...base, signature: 'not-sent' }, now)).toBe(true);
    expect(matchReport(q2, { ...base, completion: 'in-progress' }, now)).toBe(true);
  });
  it('người kiểm tra / duyệt / ca', () => {
    expect(matchReport(d20, { ...base, inspector: 'Lê Thị B' }, now)).toBe(true);
    expect(matchReport(q2, { ...base, approver: 'Trần Văn C' }, now)).toBe(false);
    expect(matchReport(m05, { ...base, shift: 'Ca 1' }, now)).toBe(false);
  });
});

describe('matchQuery', () => {
  it('không dấu, không phân biệt hoa thường; tìm cả kỳ dạng hiển thị', () => {
    expect(matchQuery(d20, 'le thi')).toBe(true);
    expect(matchQuery(d23, '23/06/2026')).toBe(true);
    expect(matchQuery(m05, 'tháng 05')).toBe(true);
    expect(matchQuery(d23, '   ')).toBe(true);
    expect(matchQuery(d23, 'Hoàng')).toBe(false);
  });
});

describe('sortReports', () => {
  it('kỳ kết thúc gần nhất trước; cùng ngày cuối → ngày trước tháng trước quý', () => {
    const m06 = rec({ period: 'monthly', periodKey: '2026-06' });
    const d30 = rec({ period: 'daily', periodKey: '2026-06-30' });
    expect([m05, q2, d23, m06, d30].sort(sortReports).map((r) => r.id)).toEqual([
      'daily-2026-06-30',
      'monthly-2026-06',
      'quarterly-2026-Q2',
      'daily-2026-06-23',
      'monthly-2026-05',
    ]);
  });
});

it('distinctOptions bỏ rỗng, bỏ trùng, sắp theo tiếng Việt', () => {
  expect(distinctOptions(['Phạm Văn D', undefined, 'Lê Thị B', 'Phạm Văn D']).map((o) => o.value)).toEqual(['Lê Thị B', 'Phạm Văn D']);
});
