// Quy tắc mất tín hiệu (npm test).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { freshNumber, nextExpiry, STALE_MS, tagSignal } from './signal.ts';
import type { TagValue } from './types.ts';

const tv = (ts: number, quality: TagValue['quality'] = 'good'): TagValue => ({ value: 1, ts, quality });

test('bad / không có tag / quá 10 s → lost; uncertain vẫn hiển thị', () => {
  assert.equal(tagSignal(undefined, 0), 'lost');
  assert.equal(tagSignal(tv(0, 'bad'), 0), 'lost');
  assert.equal(tagSignal(tv(0), STALE_MS - 1), 'ok');
  assert.equal(tagSignal(tv(0), STALE_MS), 'lost');
  assert.equal(tagSignal(tv(0, 'uncertain'), 5), 'uncertain');
  assert.equal(freshNumber(tv(0), STALE_MS), undefined);
  assert.equal(freshNumber(tv(0), 1), 1);
});

test('nextExpiry: mốc sớm nhất của tag còn tươi, nhất quán với tagSignal', () => {
  const data = { a: tv(1000), b: tv(3000), c: tv(0, 'bad') };
  assert.equal(nextExpiry(data, 5000), 1000 + STALE_MS);
  // Ở đúng mốc hết hạn: tag a đã lost, mốc kế tiếp là b.
  assert.equal(tagSignal(data.a, 1000 + STALE_MS), 'lost');
  assert.equal(nextExpiry(data, 1000 + STALE_MS), 3000 + STALE_MS);
  assert.equal(nextExpiry({}, 0), undefined);
});
