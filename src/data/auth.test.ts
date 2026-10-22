import { describe, expect, test, vi } from 'vitest';
import type { AuthSession } from '@demo-lpg/shared/auth';
import { AuthError, createAuthClient } from './auth';

const USER = { id: 'u1', email: 'op@example.com', name: 'Op', role: 'operator' } as const;
const session = (token: string, expiresIn = 900): AuthSession => ({ accessToken: token, expiresIn, user: { ...USER } });
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

/** fetch giả: map "METHOD path" → hàng đợi response (hoặc hàm). */
function fakeFetch(routes: Record<string, Array<Response | (() => Response | Promise<Response>)>>) {
  const calls: { key: string; init?: RequestInit }[] = [];
  const fn = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(url).replace('/api', '')}`;
    calls.push({ key, init });
    const q = routes[key];
    const next = q?.length ? q.shift()! : json(404, {});
    return typeof next === 'function' ? next() : next;
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

const make = (routes: Parameters<typeof fakeFetch>[0], now = () => 0) => {
  const f = fakeFetch(routes);
  return { client: createAuthClient({ baseUrl: '/api', fetch: f.fn, now }), ...f };
};

describe('createAuthClient', () => {
  test('init: refresh bằng cookie thành công → authenticated', async () => {
    const { client, calls } = make({ 'POST /auth/refresh': [json(200, session('a1'))] });
    expect(client.getState().status).toBe('loading');
    await client.init();
    expect(client.getState()).toEqual({ status: 'authenticated', user: USER });
    expect(calls[0].init?.credentials).toBe('include');
    expect(client.expiresAt()).toBe(900_000);
  });

  test('init: không có phiên → anonymous; gọi init 2 lần chỉ 1 request', async () => {
    const { client, calls } = make({ 'POST /auth/refresh': [json(401, {})] });
    await Promise.all([client.init(), client.init()]);
    expect(client.getState().status).toBe('anonymous');
    expect(calls).toHaveLength(1);
  });

  test('init: mất mạng → anonymous (không treo ở loading)', async () => {
    const { client } = make({
      'POST /auth/refresh': [
        () => {
          throw new TypeError('Failed to fetch');
        },
      ],
    });
    await client.init();
    expect(client.getState().status).toBe('anonymous');
  });

  test('host tĩnh trả index.html cho /api/* (200, không phải JSON) → anonymous, login báo lỗi máy chủ', async () => {
    const html = () => new Response('<!doctype html><html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } });
    const { client } = make({ 'POST /auth/refresh': [html()], 'POST /auth/login': [html()] });
    await client.init();
    expect(client.getState().status).toBe('anonymous');
    await expect(client.login('a', 'b')).rejects.toMatchObject({ kind: 'server' });
  });

  test('login: thành công → access token chỉ trong bộ nhớ, gửi kèm Bearer', async () => {
    const { client, calls } = make({
      'POST /auth/login': [json(200, session('tok-1'))],
      'GET /alerts': [json(200, [])],
    });
    await expect(client.login('op@example.com', 'pw')).resolves.toEqual(USER);
    await client.apiFetch('/alerts');
    expect(new Headers(calls[1].init?.headers).get('Authorization')).toBe('Bearer tok-1');
  });

  test('login: 401 → AuthError invalid với thông báo của server', async () => {
    const { client } = make({ 'POST /auth/login': [json(401, { message: 'Email hoặc mật khẩu không đúng' })] });
    const err = await client.login('x', 'y').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect(err).toMatchObject({ kind: 'invalid', message: 'Email hoặc mật khẩu không đúng' });
  });

  test('login: 429 tạm khoá → kind locked + retryAfter', async () => {
    const { client } = make({
      'POST /auth/login': [json(429, { message: 'Đăng nhập tạm khoá do nhập sai nhiều lần.' }, { 'Retry-After': '900' })],
    });
    await expect(client.login('x', 'y')).rejects.toMatchObject({ kind: 'locked', retryAfter: 900 });
  });

  test('login: lỗi mạng → kind network', async () => {
    const { client } = make({
      'POST /auth/login': [
        () => {
          throw new TypeError('Failed to fetch');
        },
      ],
    });
    await expect(client.login('x', 'y')).rejects.toMatchObject({ kind: 'network' });
  });

  test('refresh đồng thời → chỉ MỘT request (backend coi dùng lại token là bị đánh cắp)', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { client, calls } = make({
      'POST /auth/refresh': [
        async () => {
          await gate;
          return json(200, session('a2'));
        },
      ],
    });
    const all = Promise.all([client.refresh(), client.refresh(), client.refresh()]);
    release();
    expect(await all).toEqual([true, true, true]);
    expect(calls.filter((c) => c.key === 'POST /auth/refresh')).toHaveLength(1);
  });

  test('apiFetch: 401 (token hết hạn) → refresh 1 lần → gọi lại với token mới', async () => {
    const { client, calls } = make({
      'POST /auth/login': [json(200, session('old'))],
      'GET /alerts': [json(401, {}), json(200, ['ok'])],
      'POST /auth/refresh': [json(200, session('new'))],
    });
    await client.login('a', 'b');
    const res = await client.apiFetch('/alerts');
    expect(await res.json()).toEqual(['ok']);
    const gets = calls.filter((c) => c.key === 'GET /alerts');
    expect(new Headers(gets[1].init?.headers).get('Authorization')).toBe('Bearer new');
  });

  test('apiFetch: refresh thất bại → anonymous, trả 401 gốc, không lặp', async () => {
    const { client, calls } = make({
      'POST /auth/login': [json(200, session('old'))],
      'GET /alerts': [json(401, {})],
      'POST /auth/refresh': [json(401, {})],
    });
    await client.login('a', 'b');
    const res = await client.apiFetch('/alerts');
    expect(res.status).toBe(401);
    expect(client.getState().status).toBe('anonymous');
    expect(calls.filter((c) => c.key === 'GET /alerts')).toHaveLength(1);
  });

  test('apiFetch: token sắp hết hạn → refresh TRƯỚC khi gọi', async () => {
    let t = 0;
    const { client, calls } = make(
      {
        'POST /auth/login': [json(200, session('old', 10))],
        'POST /auth/refresh': [json(200, session('new'))],
        'GET /x': [json(200, {})],
      },
      () => t,
    );
    await client.login('a', 'b');
    t = 6_000;
    await client.apiFetch('/x');
    expect(calls.map((c) => c.key)).toEqual(['POST /auth/login', 'POST /auth/refresh', 'GET /x']);
  });

  test('logout: gọi server, xoá phiên kể cả khi server lỗi', async () => {
    const { client } = make({
      'POST /auth/login': [json(200, session('a'))],
      'POST /auth/logout': [
        () => {
          throw new TypeError('offline');
        },
      ],
    });
    await client.login('a', 'b');
    await client.logout();
    expect(client.getState()).toEqual({ status: 'anonymous', user: null });
    expect(client.expiresAt()).toBeNull();
  });

  test('đồng bộ giữa tab: tab khác đăng xuất → tab này về anonymous', async () => {
    const channel = { postMessage: vi.fn(), onmessage: null as ((e: MessageEvent) => void) | null };
    const f = fakeFetch({ 'POST /auth/login': [json(200, session('a'))] });
    const client = createAuthClient({ baseUrl: '/api', fetch: f.fn, now: () => 0, channel });
    await client.login('a', 'b');
    expect(channel.postMessage).toHaveBeenCalledWith('login');
    channel.onmessage!(new MessageEvent('message', { data: 'logout' }));
    expect(client.getState().status).toBe('anonymous');
  });

  test('subscribe nhận thông báo khi đổi trạng thái', async () => {
    const { client } = make({ 'POST /auth/refresh': [json(200, session('a'))] });
    const cb = vi.fn();
    const off = client.subscribe(cb);
    await client.init();
    expect(cb).toHaveBeenCalledTimes(1);
    off();
  });
});
