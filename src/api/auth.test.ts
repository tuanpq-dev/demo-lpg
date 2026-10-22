import { describe, expect, test, vi } from 'vitest';
import { createAuthService } from './auth';
import { createApiClient } from './client';
import { apiError, fakeJwt, json, mockFetch, USER } from './test-utils';

const make = (routes: Parameters<typeof mockFetch>[0]) => {
  const m = mockFetch(routes);
  const client = createApiClient({ baseUrl: 'http://localhost:3000', fetch: m.fetch });
  return { client, service: createAuthService(client), ...m };
};

describe('createAuthService', () => {
  test('mở app: refresh (cookie) + /auth/me → authenticated', async () => {
    const { service, calls } = make({
      'POST /auth/refresh': [json(200, { accessToken: 'a1' })],
      'GET /auth/me': [json(200, USER)],
    });
    expect(service.getState().status).toBe('loading');
    await service.init();
    expect(service.getState()).toEqual({ status: 'authenticated', user: USER });
    expect(new Headers(calls[1].init.headers).get('Authorization')).toBe('Bearer a1');
  });

  test('mở app không có phiên / mất mạng → anonymous; init 2 lần chỉ 1 request', async () => {
    const a = make({ 'POST /auth/refresh': [apiError(401, 'UNAUTHORIZED')] });
    await Promise.all([a.service.init(), a.service.init()]);
    expect(a.service.getState().status).toBe('anonymous');
    expect(a.calls).toHaveLength(1);

    const b = make({ 'POST /auth/refresh': [new TypeError('Failed to fetch')] });
    await b.service.init();
    expect(b.service.getState().status).toBe('anonymous');
  });

  test('đăng nhập thành công → token trong bộ nhớ + user', async () => {
    const { service, client } = make({ 'POST /auth/login': [json(200, { accessToken: 'tok', user: USER })] });
    await expect(service.login({ email: 'op@example.com', password: 'pw' })).resolves.toEqual(USER);
    expect(service.getState()).toEqual({ status: 'authenticated', user: USER });
    expect(client.getAccessToken()).toBe('tok');
  });

  test.each([
    ['INVALID_CREDENTIALS', 401],
    ['ACCOUNT_PENDING', 403],
    ['RATE_LIMITED', 429],
    ['VALIDATION_ERROR', 400],
  ])('đăng nhập thất bại %s → ném ApiError, vẫn anonymous', async (code, status) => {
    const { service, calls } = make({ 'POST /auth/login': [apiError(status, code)] });
    await service.init().catch(() => {});
    await expect(service.login({ email: 'a', password: 'b' })).rejects.toMatchObject({ code });
    expect(service.getState().user).toBeNull();
    expect(calls.filter((c) => c.key === 'POST /auth/refresh')).toHaveLength(1); // chỉ lần init, login sai không refresh
  });

  test('đăng ký → trả message, không đăng nhập', async () => {
    const { service, calls } = make({ 'POST /auth/register': [json(201, { message: 'Chờ duyệt' })] });
    await expect(service.register({ email: 'n@example.com', name: 'N', password: 'pw' })).resolves.toBe('Chờ duyệt');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ email: 'n@example.com', name: 'N', password: 'pw' });
    expect(service.getState().user).toBeNull();
  });

  test('đăng xuất → xoá token + user (kể cả khi máy chủ lỗi)', async () => {
    for (const logoutRes of [new Response(null, { status: 204 }), new TypeError('offline')]) {
      const { service, client } = make({
        'POST /auth/login': [json(200, { accessToken: 'tok', user: USER })],
        'POST /auth/logout': [logoutRes],
      });
      await service.login({ email: 'a', password: 'b' });
      await service.logout();
      expect(service.getState()).toEqual({ status: 'anonymous', user: null });
      expect(client.getAccessToken()).toBeNull();
    }
  });

  test('API trả 401 và refresh thất bại → tự về anonymous', async () => {
    const { service, client } = make({
      'POST /auth/login': [json(200, { accessToken: 'tok', user: USER })],
      'GET /alerts': [apiError(401, 'UNAUTHORIZED')],
      'POST /auth/refresh': [apiError(401, 'UNAUTHORIZED')],
    });
    await service.login({ email: 'a', password: 'b' });
    await expect(client.request('/alerts')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(service.getState().status).toBe('anonymous');
  });

  test('expiresAt đọc exp của JWT', async () => {
    const { service } = make({ 'POST /auth/login': [json(200, { accessToken: fakeJwt(2_000_000_000), user: USER })] });
    expect(service.expiresAt()).toBeNull();
    await service.login({ email: 'a', password: 'b' });
    expect(service.expiresAt()).toBe(2_000_000_000_000);
  });

  test('đồng bộ tab: tab khác đăng xuất → tab này anonymous', async () => {
    const channel = { postMessage: vi.fn(), onmessage: null as ((e: MessageEvent) => void) | null };
    const m = mockFetch({ 'POST /auth/login': [json(200, { accessToken: 'tok', user: USER })] });
    const service = createAuthService(createApiClient({ baseUrl: 'http://x', fetch: m.fetch }), channel);
    await service.login({ email: 'a', password: 'b' });
    expect(channel.postMessage).toHaveBeenCalledWith('login');
    channel.onmessage!(new MessageEvent('message', { data: 'logout' }));
    expect(service.getState().status).toBe('anonymous');
  });
});
