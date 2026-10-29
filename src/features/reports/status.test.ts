import { describe, expect, it } from 'vitest';
import { parsePlantDateTime } from '@/lib/plantTime';
import {
  awaitingStep,
  checkpointProgress,
  completionOf,
  formatUpdatedAt,
  missingCheckpoints,
  missingText,
  progressText,
  reportState,
  signatureOf,
  type ReportRecord,
} from './status';
import { DAILY_CHECKPOINTS } from './period';

const at = (s: string) => parsePlantDateTime(s)!;

function daily(day: string, done: readonly string[], signature: ReportRecord['signature'] = { status: 'signed' }): ReportRecord {
  return {
    id: day,
    code: day,
    period: 'daily',
    periodKey: day,
    checkpoints: DAILY_CHECKPOINTS.map((t) => ({ key: t, label: t, dueAt: `${day}T${t}`, done: done.includes(t) })),
    inspector: 'A',
    signature,
    updatedAt: `${day}T18:10`,
  };
}
const ALL = DAILY_CHECKPOINTS;

describe('completionOf', () => {
  it('kỳ chưa hết (kể cả 23:59 hôm đó) → Đang thực hiện', () => {
    expect(completionOf(daily('2026-06-24', ALL), at('2026-06-24T23:59'))).toBe('in-progress');
  });
  it('sang ngày hôm sau (giờ nhà máy) → Hoàn thành / Thiếu dữ liệu', () => {
    expect(completionOf(daily('2026-06-24', ALL), at('2026-06-25T00:00'))).toBe('done');
    expect(completionOf(daily('2026-06-24', ALL.slice(0, 4)), at('2026-06-25T00:00'))).toBe('missing-data');
  });
  it('dùng giờ nhà máy, không phải UTC: 00:30 sáng 25/06 (= 17:30Z 24/06) đã sang ngày mới', () => {
    expect(completionOf(daily('2026-06-24', ALL), new Date('2026-06-24T17:30:00Z'))).toBe('done');
  });
  it('báo cáo không có mốc + kỳ đã qua → Hoàn thành (every của mảng rỗng)', () => {
    expect(completionOf({ ...daily('2026-06-01', []), checkpoints: [] }, at('2026-06-02T08:00'))).toBe('done');
  });
});

describe('chữ ký + nhóm', () => {
  const now = at('2026-06-25T09:00');
  it('chưa hoàn thành → luôn "Chưa gửi ký" dù bản ghi ghi khác', () => {
    expect(signatureOf(daily('2026-06-24', ALL.slice(0, 3), { status: 'signed' }), now)).toBe('not-sent');
  });
  it('reportState tách rời 4 nhóm', () => {
    expect(reportState(daily('2026-06-25', []), now)).toBe('in-progress');
    expect(reportState(daily('2026-06-24', ['08:00']), now)).toBe('missing-data');
    expect(reportState(daily('2026-06-24', ALL, { status: 'pending', step: 'approver' }), now)).toBe('awaiting');
    expect(reportState(daily('2026-06-24', ALL, { status: 'rejected' }), now)).toBe('awaiting');
    expect(reportState(daily('2026-06-24', ALL, { status: 'not-sent' }), now)).toBe('awaiting');
    expect(reportState(daily('2026-06-24', ALL), now)).toBe('signed');
  });
  it('awaitingStep: chờ bước nào; bị trả lại / chưa gửi → người kiểm tra', () => {
    expect(awaitingStep(daily('2026-06-24', ALL, { status: 'pending', step: 'tap' }), now)).toBe('tap');
    expect(awaitingStep(daily('2026-06-24', ALL, { status: 'rejected' }), now)).toBe('inspector');
    expect(awaitingStep(daily('2026-06-24', ALL, { status: 'not-sent' }), now)).toBe('inspector');
    expect(awaitingStep(daily('2026-06-24', ALL), now)).toBeUndefined();
  });
});

describe('mốc thiếu + tiến độ', () => {
  it('trong ngày: chỉ mốc đã tới hạn mới tính là thiếu (đúng giờ hạn = tới hạn)', () => {
    const r = daily('2026-06-24', ['08:00', '10:00', '12:00', '14:00', '16:00']);
    expect(missingCheckpoints(r, at('2026-06-24T17:59')).map((c) => c.key)).toEqual([]);
    expect(missingCheckpoints(r, at('2026-06-24T18:00')).map((c) => c.key)).toEqual(['18:00']);
  });
  it('kỳ đã qua: mọi mốc chưa có dữ liệu', () => {
    const r = daily('2026-06-21', ['08:00', '10:00', '12:00', '14:00']);
    expect(missingText(r, at('2026-06-24T09:00'))).toBe('16:00, 18:00');
  });
  it('missingText: rút gọn "+n" và "Không có"', () => {
    expect(missingText(daily('2026-06-21', []), at('2026-06-24T09:00'), 2)).toBe('08:00, 10:00 +4');
    expect(missingText(daily('2026-06-21', ALL), at('2026-06-24T09:00'))).toBe('Không có');
  });
  it('progressText theo đơn vị của kỳ, làm tròn %', () => {
    expect(progressText(daily('2026-06-24', ALL.slice(0, 5)))).toBe('5/6 mốc (83%)');
    expect(progressText(daily('2026-06-21', ALL.slice(0, 4)))).toBe('4/6 mốc (67%)');
    expect(checkpointProgress({ ...daily('2026-06-21', []), checkpoints: [] })).toEqual({ done: 0, total: 0, percent: 0 });
  });
  it('formatUpdatedAt', () => {
    expect(formatUpdatedAt('2026-06-24T14:05')).toBe('14:05 24/06');
  });
});
