import { describe, expect, test } from 'vitest';
import { objectStatus, formatField } from '@/features/scene/fields';
import type { SceneObject } from '@/features/scene/types';
import { freshNumber, nextExpiry, SIGNAL_LOST_LABEL, STALE_MS, tagSignal } from './signal';
import type { TagValue } from './types';

const T0 = 1_000_000;
const tv = (value: number | string, ts = T0, quality: TagValue['quality'] = 'good'): TagValue => ({ value, ts, quality });

describe('tagSignal – mất tín hiệu (thời gian truyền vào)', () => {
  test('bad / không có tag / ≥ 10 s không cập nhật → lost; uncertain vẫn hiển thị', () => {
    expect(tagSignal(undefined, T0)).toBe('lost');
    expect(tagSignal(tv(1, T0, 'bad'), T0)).toBe('lost');
    expect(tagSignal(tv(1), T0 + STALE_MS - 1)).toBe('ok');
    expect(tagSignal(tv(1), T0 + STALE_MS)).toBe('lost');
    expect(tagSignal(tv(1, T0, 'uncertain'), T0 + 5)).toBe('uncertain');
  });
  test('freshNumber: không trả số cũ khi đã mất tín hiệu', () => {
    expect(freshNumber(tv(42), T0 + 1)).toBe(42);
    expect(freshNumber(tv(42), T0 + STALE_MS)).toBeUndefined();
    expect(freshNumber(tv('running'), T0)).toBeUndefined();
  });
  test('nextExpiry: mốc sớm nhất của tag còn tươi, bỏ tag bad, nhất quán với tagSignal', () => {
    const data = { a: tv(1, 1000), b: tv(1, 3000), c: tv(1, 0, 'bad') };
    expect(nextExpiry(data, 5000)).toBe(1000 + STALE_MS);
    expect(tagSignal(data.a, 1000 + STALE_MS)).toBe('lost');
    expect(nextExpiry(data, 1000 + STALE_MS)).toBe(3000 + STALE_MS);
    expect(nextExpiry({}, 0)).toBeUndefined();
  });
});

describe('hiển thị theo quy tắc mất tín hiệu', () => {
  const tank = { id: 'V-101', asset: 'tank-horizontal', bindings: { level: 'LT-101', pressure: 'PT-101' } } as SceneObject;
  test('formatField: "Mất tín hiệu" thay cho số cũ', () => {
    expect(formatField('level', tv(72.4), T0 + 1)).toBe('72.4%');
    expect(formatField('level', tv(72.4), T0 + STALE_MS)).toBe(SIGNAL_LOST_LABEL);
    expect(formatField('level', tv(72.4, T0, 'bad'), T0)).toBe(SIGNAL_LOST_LABEL);
  });
  test('objectStatus: một binding mất tín hiệu → offline; cảnh báo binding khác vẫn ưu tiên', () => {
    const live = { 'LT-101': tv(50), 'PT-101': tv(10, T0, 'bad') };
    expect(objectStatus(tank, live, {}, T0)).toBe('offline');
    expect(objectStatus(tank, { ...live, 'LT-101': tv(99) }, { level: { danger: 95 } }, T0)).toBe('danger');
    expect(objectStatus(tank, undefined, {}, T0)).toBe('normal');
  });
});
