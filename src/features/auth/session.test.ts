import { describe, expect, test } from 'vitest';
import { isExpiring, loginUrl, refreshDelayMs, safeRedirect } from './session';

describe('refreshDelayMs', () => {
  test('refresh trước hạn 60 s', () => expect(refreshDelayMs(900_000, 0)).toBe(840_000));
  test('đã quá hạn / TTL ngắn → tối thiểu 5 s (không lặp dồn dập)', () => {
    expect(refreshDelayMs(1_000, 0)).toBe(5_000);
    expect(refreshDelayMs(0, 10_000)).toBe(5_000);
  });
  test('lead tuỳ chỉnh', () => expect(refreshDelayMs(100_000, 0, 10_000)).toBe(90_000));
});

describe('isExpiring', () => {
  test('ranh giới 5 s', () => {
    expect(isExpiring(10_000, 4_999)).toBe(false);
    expect(isExpiring(10_000, 5_000)).toBe(true);
    expect(isExpiring(10_000, 20_000)).toBe(true);
  });
});

describe('safeRedirect', () => {
  test('đường dẫn nội bộ giữ nguyên (kể cả query/hash)', () => {
    expect(safeRedirect('/alerts?tab=unacknowledged#x')).toBe('/alerts?tab=unacknowledged#x');
    expect(safeRedirect('/editor?edit=1')).toBe('/editor?edit=1');
  });
  test('chặn chuyển hướng mở + rỗng', () => {
    for (const bad of [null, undefined, '', 'https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', 'alerts', '/\t/evil.com', '/\n/evil.com']) {
      expect(safeRedirect(bad)).toBe('/overview');
    }
  });
  test('không quay lại /login (tránh vòng lặp)', () => {
    expect(safeRedirect('/login')).toBe('/overview');
    expect(safeRedirect('/login?next=/alerts')).toBe('/overview');
    expect(safeRedirect('/loginx')).toBe('/loginx');
  });
});

describe('loginUrl', () => {
  test('nhớ trang định vào', () => {
    expect(loginUrl({ pathname: '/alerts', search: '?tab=done', hash: '' })).toBe('/login?next=%2Falerts%3Ftab%3Ddone');
  });
  test('trang mặc định / trang đăng nhập → không kèm next', () => {
    expect(loginUrl({ pathname: '/overview' })).toBe('/login');
    expect(loginUrl({ pathname: '/login' })).toBe('/login');
  });
});
