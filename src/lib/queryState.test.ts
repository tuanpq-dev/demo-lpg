import { describe, expect, test } from 'vitest';
import { settleSnapshot, startSnapshot, viewOf, type Snapshot } from './queryState';
import { combineQueries } from './useQuery';

const ok = (data: number, key = 'a', attempt = 0): Snapshot<number> => ({ status: 'success', data, key, attempt });
const loading = (key = 'a', attempt = 0): Snapshot<number> => ({ status: 'loading', key, attempt });
const fail = { status: 'error' as const, error: new Error('hỏng') };

describe('useQuery – bắt đầu lượt tải', () => {
  test('key mới → loading (không giữ dữ liệu key cũ)', () => {
    expect(startSnapshot(ok(1), 'b', 0, { background: false, keepPrevious: false })).toEqual(loading('b'));
  });
  test('tải ngầm (chỉ revision đổi) → giữ nguyên dữ liệu đang hiện', () => {
    const cur = ok(1);
    expect(startSnapshot(cur, 'a', 0, { background: true, keepPrevious: false })).toBe(cur);
  });
  test('keepPrevious: giữ kết quả cũ khi có; chưa có kết quả → loading', () => {
    const cur = ok(1);
    expect(startSnapshot(cur, 'b', 0, { background: false, keepPrevious: true })).toBe(cur);
    expect(startSnapshot<number>({ ...fail, key: 'a', attempt: 0 }, 'b', 0, { background: false, keepPrevious: true })).toEqual(loading('b'));
  });
});

describe('useQuery – lượt tải xong', () => {
  test('gắn kết quả với key + lượt tạo ra nó', () => {
    expect(settleSnapshot(loading(), { status: 'success', data: 2 }, 'a', 1, false)).toEqual(ok(2, 'a', 1));
  });
  test('tải ngầm lỗi → giữ dữ liệu cũ; tải thường lỗi → trạng thái lỗi', () => {
    const cur = ok(1);
    expect(settleSnapshot(cur, fail, 'a', 0, true)).toBe(cur);
    expect(settleSnapshot(cur, fail, 'a', 0, false)).toMatchObject({ status: 'error' });
  });
});

describe('useQuery – trạng thái trả cho render', () => {
  test('cùng key + lượt → trả nguyên, không pending', () => {
    expect(viewOf(ok(1), 'a', 0, false)).toEqual({ status: 'success', data: 1, pending: false });
  });
  test('kết quả của key cũ không bao giờ lộ ra như của key mới', () => {
    expect(viewOf(ok(1), 'b', 0, false)).toEqual({ status: 'loading', pending: true });
    expect(viewOf<number>({ ...fail, key: 'a', attempt: 0 }, 'b', 0, true)).toEqual({ status: 'loading', pending: true });
  });
  test('refetch (lượt mới, cùng key) → loading; keepPrevious → dữ liệu cũ + pending', () => {
    expect(viewOf(ok(1), 'a', 1, false).status).toBe('loading');
    expect(viewOf(ok(1), 'b', 0, true)).toEqual({ status: 'success', data: 1, pending: true });
  });
});

describe('combineQueries', () => {
  const q = (status: 'loading' | 'error' | 'success') => ({ status, error: status === 'error' ? new Error(status) : undefined, refetch: () => {} });
  test('lỗi thắng loading; loading khi còn truy vấn chưa xong; refetch gọi tất cả', () => {
    expect(combineQueries(q('loading'), q('error')).status).toBe('error');
    expect(combineQueries(q('success'), q('loading')).status).toBe('loading');
    expect(combineQueries(q('success'), q('success')).status).toBe('success');
    let n = 0;
    const r = { status: 'success' as const, refetch: () => (n += 1) };
    combineQueries(r, r).refetch();
    expect(n).toBe(2);
  });
});
