import { describe, expect, test } from 'vitest';
import type { TagValue } from '@/features/live/types';
import { parsePlantDateTime } from '@/lib/plantTime';
import {
  ageText,
  connectionView,
  limitText,
  logTimeLabel,
  lostSensorCount,
  mockHistory,
  paramStatus,
  readParam,
  runState,
  standbyReadiness,
  tagSeed,
  trendTicks,
} from './device';

const NOW = 1_800_000_000_000;
const tv = (value: TagValue['value'], ageMs = 1000, quality: TagValue['quality'] = 'good'): TagValue => ({ value, ts: NOW - ageMs, quality });

describe('paramStatus', () => {
  const l = { lowWarn: 2, warn: 5, danger: 6 };
  test('trong khoảng / chạm biên / nguy hiểm', () => {
    expect(paramStatus(3.8, l)).toBe('normal');
    expect(paramStatus(5, l)).toBe('high');
    expect(paramStatus(2, l)).toBe('low');
    expect(paramStatus(6, l)).toBe('danger');
    expect(paramStatus(-1, { lowDanger: 0, lowWarn: 2 })).toBe('danger');
  });
  test('không có ngưỡng → luôn normal', () => {
    expect(paramStatus(1e6, {})).toBe('normal');
  });
});

describe('limitText', () => {
  test('khoảng, chỉ trên, chỉ dưới, không có', () => {
    expect(limitText({ lowWarn: 2, warn: 6, danger: 7 }, 1)).toBe('2.0 - 6.0');
    expect(limitText({ lowWarn: 0, warn: 35 }, 0)).toBe('0 - 35');
    expect(limitText({ warn: 75 }, 0)).toBe('< 75');
    expect(limitText({ lowWarn: 85 }, 0)).toBe('> 85');
    expect(limitText({}, 0)).toBe('-');
  });
});

describe('ageText', () => {
  test('giây / phút / giờ; ts tương lai → 0s', () => {
    expect(ageText(NOW - 1400, NOW)).toBe('1s trước');
    expect(ageText(NOW - 59_999, NOW)).toBe('59s trước');
    expect(ageText(NOW - 180_000, NOW)).toBe('3 phút trước');
    expect(ageText(NOW - 7_200_000, NOW)).toBe('2 giờ trước');
    expect(ageText(NOW + 5000, NOW)).toBe('0s trước');
  });
});

describe('readParam', () => {
  const p = { limits: { lowWarn: 50, warn: 75 }, okLabel: 'Bình thường', okTone: 'success' as const };
  test('chưa có số liệu → pending "—"', () => {
    expect(readParam(p, undefined, false, NOW)).toEqual({ state: 'pending', label: '—', tone: 'neutral' });
  });
  test('trong ngưỡng → okLabel; thấp/cao → vàng; nguy hiểm → đỏ', () => {
    expect(readParam(p, tv(58.4), true, NOW)).toMatchObject({ state: 'ok', value: 58.4, label: 'Bình thường', tone: 'success', updated: '1s trước' });
    expect(readParam(p, tv(45.6), true, NOW)).toMatchObject({ status: 'low', label: 'Thấp', tone: 'warning' });
    expect(readParam(p, tv(80), true, NOW)).toMatchObject({ status: 'high', label: 'Cao', tone: 'warning' });
    expect(readParam({ ...p, limits: { danger: 70 } }, tv(80), true, NOW)).toMatchObject({ label: 'Nguy hiểm', tone: 'danger' });
  });
  test('mất tín hiệu (bad / quá 10 s / thiếu tag / không phải số) → không có value', () => {
    for (const t of [tv(58, 1000, 'bad'), tv(58, 10_000), undefined, tv('running')]) {
      const r = readParam(p, t, true, NOW);
      expect(r.state).toBe('lost');
      expect(r.label).toBe('Mất tín hiệu');
      expect(r).not.toHaveProperty('value');
    }
  });
});

describe('lostSensorCount', () => {
  test('đếm tag mất tín hiệu, không trùng; chưa có dữ liệu → undefined', () => {
    const live = { A: tv(1), B: tv(1, 20_000), C: tv(1, 1000, 'bad') };
    expect(lostSensorCount(['A', 'B', 'C', 'D', 'B'], live, NOW)).toBe(3);
    expect(lostSensorCount(['A'], live, NOW)).toBe(0);
    expect(lostSensorCount(['A'], undefined, NOW)).toBeUndefined();
  });
});

describe('runState / standbyReadiness / connectionView', () => {
  test('trạng thái chạy theo tag chuỗi', () => {
    expect(runState(tv('running'), true, NOW)).toMatchObject({ label: 'Đang hoạt động', tone: 'success' });
    expect(runState(tv('fault'), true, NOW)).toMatchObject({ label: 'Sự cố', tone: 'danger' });
    expect(runState(tv('xyz'), true, NOW).label).toBe('Không xác định');
    expect(runState(tv('running', 11_000), true, NOW).label).toBe('Mất tín hiệu');
    expect(runState(undefined, false, NOW).label).toBe('—');
  });
  test('máy dự phòng: standby → "Sẵn sàng", còn lại theo trạng thái chạy', () => {
    const raw = tv('standby');
    expect(standbyReadiness(runState(raw, true, NOW), raw)).toEqual({ label: 'Sẵn sàng', tone: 'neutral' });
    const run = tv('running');
    expect(standbyReadiness(runState(run, true, NOW), run).label).toBe('Đang hoạt động');
    const old = tv('standby', 20_000);
    expect(standbyReadiness(runState(old, true, NOW), old).label).toBe('Mất tín hiệu');
  });
  test('kết nối', () => {
    expect(connectionView('connected')).toEqual({ scada: 'Trực tuyến', plc: 'Online', tone: 'success' });
    expect(connectionView('connecting').tone).toBe('warning');
    expect(connectionView('disconnected').plc).toBe('Offline');
  });
});

describe('xu hướng', () => {
  test('mốc trục X như ảnh', () => {
    expect(trendTicks(60)).toEqual(['-60m', '-45m', '-30m', '-15m', 'Bây giờ']);
  });
  test('lịch sử: đủ điểm, trong biên độ, xác định trong cùng phút, trôi khi sang phút mới', () => {
    const a = mockHistory(58, 2, tagSeed('TT-201'), 60, NOW);
    expect(a).toHaveLength(61);
    expect(a.every((v) => v >= 56 && v <= 60)).toBe(true);
    expect(mockHistory(58, 2, tagSeed('TT-201'), 60, NOW + 30_000)).toEqual(a);
    const next = mockHistory(58, 2, tagSeed('TT-201'), 60, NOW + 60_000);
    expect(next.slice(0, 60)).toEqual(a.slice(1));
  });
  test('hạt giống khác nhau theo tag', () => {
    expect(tagSeed('TT-201')).not.toBe(tagSeed('PT-202'));
  });
});

describe('logTimeLabel', () => {
  const now = parsePlantDateTime('2026-10-31T18:05:00')!;
  test('hôm nay / hôm qua / ngày cũ theo giờ nhà máy', () => {
    expect(logTimeLabel({ minutesAgo: 1 }, now)).toBe('18:04:00 - Hôm nay');
    expect(logTimeLabel({ minutesAgo: 18 * 60 + 10 }, now)).toBe('23:55:00 - Hôm qua');
    expect(logTimeLabel({ minutesAgo: 3 * 24 * 60 }, now)).toBe('18:05:00 - 28/10/2026');
  });
});
