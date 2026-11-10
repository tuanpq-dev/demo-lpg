import { describe, expect, it } from 'vitest';
import { parsePlantDateTime } from '@/lib/plantTime';
import {
  cellState,
  checkpointStates,
  deriveDailyCards,
  flaggedReadings,
  formatReading,
  matchReadingRow,
  readingLevel,
  rowResult,
  signedSteps,
  standardText,
  type DailyReadingRow,
} from './daily';
import { DAILY_CHECKPOINTS } from './period';
import type { ReportCheckpoint, ReportRecord } from './status';

const at = (s: string) => parsePlantDateTime(s)!;
const DAY = '2026-06-24';

function report(
  done: readonly string[],
  opts: { signature?: ReportRecord['signature']; verify?: readonly string[]; day?: string } = {},
): ReportRecord {
  const day = opts.day ?? DAY;
  return {
    id: 'r',
    code: 'BCVH-N-24062026',
    period: 'daily',
    periodKey: day,
    shift: 'Ca 1',
    checkpoints: DAILY_CHECKPOINTS.map(
      (t): ReportCheckpoint => ({ key: t, label: t, dueAt: `${day}T${t}`, done: done.includes(t), needsVerify: opts.verify?.includes(t) }),
    ),
    inspector: 'Nguyễn Văn A',
    signature: opts.signature ?? { status: 'not-sent' },
    updatedAt: `${day}T16:05`,
  };
}

const values = (v: Partial<Record<string, number | null>>) => Object.fromEntries(DAILY_CHECKPOINTS.map((t) => [t, v[t] ?? null]));

function row(over: Partial<DailyReadingRow> = {}): DailyReadingRow {
  return {
    id: 'level',
    groupId: 'V-101',
    label: 'Mức bồn',
    device: 'LT-101 / V-101',
    unit: '%',
    digits: 1,
    limits: { lowDanger: 5, lowWarn: 10, warn: 90, danger: 95 },
    source: 'auto',
    values: values({ '08:00': 77.1, '10:00': 76.9 }),
    ...over,
  };
}

const FIVE = DAILY_CHECKPOINTS.slice(0, 5);

describe('checkpointStates', () => {
  it('ảnh thiết kế lúc 18:30: 5 mốc có dữ liệu, 18:00 tới hạn chưa nhập → missing', () => {
    const s = checkpointStates(report(FIVE), at(`${DAY}T18:30`));
    expect(s.map((c) => c.state)).toEqual(['confirmed', 'confirmed', 'confirmed', 'confirmed', 'confirmed', 'missing']);
  });

  it('mốc chưa tới hạn → upcoming; có dữ liệu cần xác minh → needs-verify', () => {
    const s = checkpointStates(report(['08:00', '10:00'], { verify: ['10:00'] }), at(`${DAY}T11:00`));
    expect(s.slice(0, 3).map((c) => c.state)).toEqual(['confirmed', 'needs-verify', 'upcoming']);
  });

  it('đúng giờ hạn (12:00) đã tính là tới hạn', () => {
    const s = checkpointStates(report(['08:00', '10:00']), at(`${DAY}T12:00`));
    expect(s[2]!.state).toBe('missing');
  });

  it('ngày đã qua → mọi mốc chưa có dữ liệu là missing', () => {
    const s = checkpointStates(report(['08:00']), at('2026-06-25T07:00'));
    expect(s.filter((c) => c.state === 'missing')).toHaveLength(5);
  });
});

describe('readingLevel / cellState / rowResult', () => {
  const limits = { lowDanger: 5, lowWarn: 10, warn: 90, danger: 95 };

  it('biên: = warn → Cảnh báo, = danger → Bất thường, = lowWarn → Cảnh báo', () => {
    expect(readingLevel(89.9, limits)).toBe('normal');
    expect(readingLevel(90, limits)).toBe('warning');
    expect(readingLevel(95, limits)).toBe('abnormal');
    expect(readingLevel(10, limits)).toBe('warning');
    expect(readingLevel(5, limits)).toBe('abnormal');
  });

  it('không có ngưỡng → luôn bình thường', () => {
    expect(readingLevel(999, {})).toBe('normal');
  });

  it('ô trống theo trạng thái mốc', () => {
    expect(cellState(null, limits, 'missing')).toBe('missing');
    expect(cellState(undefined, limits, 'upcoming')).toBe('upcoming');
    expect(cellState(0, { lowWarn: 10 }, 'confirmed')).toBe('warning');
  });

  it('kết quả = mức xấu nhất; ô thiếu không đổi kết quả (ảnh: 18:00 "—" vẫn Bình thường)', () => {
    expect(rowResult(row())).toBe('normal');
    expect(rowResult(row({ values: values({ '08:00': 77, '10:00': 91 }) }))).toBe('warning');
    expect(rowResult(row({ values: values({ '08:00': 91, '10:00': 96 }) }))).toBe('abnormal');
    expect(rowResult(row({ values: values({}) }))).toBe('no-data');
  });
});

describe('định dạng', () => {
  it('formatReading dùng dấu phẩy thập phân', () => {
    expect(formatReading(77.1, 1)).toBe('77,1');
    expect(formatReading(203, 0)).toBe('203');
    expect(formatReading(4.25, 1)).toMatch(/^4,[23]$/);
  });

  it('standardText theo dạng ngưỡng', () => {
    expect(standardText({ lowWarn: 10, warn: 90 }, '%')).toBe('10–90%');
    expect(standardText({ lowWarn: 2, warn: 5, danger: 6 }, 'bar')).toBe('2–5 bar');
    expect(standardText({ warn: 10, danger: 20 }, '%LEL')).toBe('< 10 %LEL');
    expect(standardText({ lowWarn: 15 }, 'm³/h')).toBe('> 15 m³/h');
    expect(standardText({ warn: 40 }, '°C')).toBe('< 40°C');
    expect(standardText({ lowWarn: 0.5, warn: 2.5 }, 'bar')).toBe('0,5–2,5 bar');
    expect(standardText({}, 'bar')).toBe('—');
  });
});

describe('signedSteps', () => {
  const closed = at('2026-06-25T09:00');
  const done = DAILY_CHECKPOINTS;
  it.each([
    [{ status: 'not-sent' } as const, 0],
    [{ status: 'pending', step: 'inspector' } as const, 0],
    [{ status: 'pending', step: 'approver' } as const, 1],
    [{ status: 'pending', step: 'tap' } as const, 2],
    [{ status: 'signed' } as const, 3],
    [{ status: 'rejected' } as const, 0],
  ])('%o → %i/3', (signature, n) => {
    expect(signedSteps(report(done, { signature }), closed)).toBe(n);
  });

  it('chưa hoàn thành thì chữ ký lưu không tính (0/3)', () => {
    expect(signedSteps(report(FIVE, { signature: { status: 'signed' } }), closed)).toBe(0);
  });
});

describe('deriveDailyCards', () => {
  it('khớp ảnh 117:4367 (24/06 lúc 18:30, thiếu 18:00, không bất thường, chưa ký)', () => {
    const cards = deriveDailyCards(report(FIVE), [row()], at(`${DAY}T18:30`));
    expect(cards.map((c) => [c.id, c.value, c.sub, c.tone])).toEqual([
      ['progress', '5/6 mốc', 'Còn thiếu mốc 18:00', 'primary'],
      ['confirmed', '5 mốc', 'Toàn bộ dữ liệu hiện có đã được xác nhận', 'success'],
      ['abnormal', '0', 'Chưa phát hiện bất thường trong ngày', 'success'],
      ['missing', '1 mốc', 'Chưa có dữ liệu lúc 18:00', 'warning'],
      ['signature', '0/3', 'Chưa bắt đầu quy trình ký', 'neutral'],
    ]);
    expect(cards[0]!.percent).toBe(83);
  });

  it('cần xác minh, ngoài ngưỡng, chưa tới hạn', () => {
    const r = report(['08:00', '10:00'], { verify: ['10:00'] });
    const rows = [
      row({ values: values({ '08:00': 91, '10:00': 96 }) }),
      row({ id: 'gas', device: 'GS-02 / Khu nạp xuất', limits: { warn: 10, danger: 20 }, values: values({ '10:00': 12 }) }),
    ];
    const cards = deriveDailyCards(r, rows, at(`${DAY}T11:00`));
    const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
    expect(byId.progress!.sub).toBe('Còn 4 mốc chưa tới hạn');
    expect(byId.confirmed).toMatchObject({ value: '1 mốc', sub: 'Mốc 10:00 cần xác minh lại', tone: 'warning' });
    expect(byId.abnormal).toMatchObject({ value: '3', sub: 'LT-101 lúc 08:00, LT-101 lúc 10:00 +1', tone: 'danger' });
    expect(byId.missing).toMatchObject({ value: '0 mốc', sub: 'Không thiếu dữ liệu', tone: 'success' });
  });

  it('chỉ có Cảnh báo (không Bất thường) → thẻ vàng', () => {
    const cards = deriveDailyCards(report(['08:00']), [row({ values: values({ '08:00': 91 }) })], at(`${DAY}T09:00`));
    expect(cards.find((c) => c.id === 'abnormal')!.tone).toBe('warning');
  });

  it('chữ ký: chờ duyệt / bị trả lại / đủ chữ ký', () => {
    const closed = at('2026-06-25T09:00');
    const card = (signature: ReportRecord['signature']) =>
      deriveDailyCards(report(DAILY_CHECKPOINTS, { signature }), [], closed).find((c) => c.id === 'signature')!;
    expect(card({ status: 'pending', step: 'approver' })).toMatchObject({ value: '1/3', sub: 'Chờ Người duyệt (Approver)', tone: 'warning' });
    expect(card({ status: 'rejected' })).toMatchObject({ value: '0/3', tone: 'danger' });
    expect(card({ status: 'signed' })).toMatchObject({ value: '3/3', sub: 'Đã đủ chữ ký', tone: 'success' });
  });

  it('chưa có mốc nào có dữ liệu', () => {
    const cards = deriveDailyCards(report([]), [], at(`${DAY}T07:00`));
    expect(cards.find((c) => c.id === 'confirmed')!.sub).toBe('Chưa có dữ liệu được xác nhận');
    expect(cards[0]!.percent).toBe(0);
  });
});

describe('flaggedReadings', () => {
  it('liệt kê ô ngoài ngưỡng theo mã thiết bị (trước " / ")', () => {
    const f = flaggedReadings([row({ values: values({ '12:00': 96 }) })], DAILY_CHECKPOINTS);
    expect(f).toEqual([{ rowId: 'level', device: 'LT-101', checkpoint: '12:00', level: 'abnormal' }]);
  });
});

describe('matchReadingRow', () => {
  const r = row();
  it('tìm không dấu theo hạng mục + thiết bị', () => {
    expect(matchReadingRow(r, { q: 'muc bon', group: null, result: null })).toBe(true);
    expect(matchReadingRow(r, { q: 'lt-101', group: null, result: null })).toBe(true);
    expect(matchReadingRow(r, { q: 'GS-01', group: null, result: null })).toBe(false);
  });
  it('lọc nhóm + kết quả', () => {
    expect(matchReadingRow(r, { q: null, group: 'GS', result: null })).toBe(false);
    expect(matchReadingRow(r, { q: null, group: 'V-101', result: 'normal' })).toBe(true);
    expect(matchReadingRow(r, { q: null, group: null, result: 'abnormal' })).toBe(false);
  });
});
