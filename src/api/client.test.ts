import { describe, expect, test } from 'vitest';
import { ApiError, createApiClient, isAbortError } from './client';

const USER = { id: 'u1', email: 'a@b.c', name: 'A', role: 'admin', status: 'active' };
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

/** fetch giả: mỗi "METHOD /path" có hàng đợi phản hồi; `hang` = không bao giờ trả (chỉ dừng khi signal huỷ). */
type Reply = Response | Error | 'hang';
function make(routes: Record<string, Reply[]>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    const key = `${init.method ?? 'GET'} ${String(url).replace('http://api', '')}`;
    const next = routes[key]?.shift();
    if (!next) return Promise.reject(new Error(`không có route ${key}`));
    // Như fetch thật: signal đã huỷ → reject ngay.
    if (init.signal?.aborted) return Promise.reject(new DOMException('aborted', 'AbortError'));
    if (next === 'hang')
      return new Promise<Response>((_, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  };
  return { client: createApiClient({ baseUrl: 'http://api', fetch: fetch, retryDelaysMs: [1, 1] }), calls };
}

describe('api client', () => {
  test('Bearer + credentials, validate bằng schema tải lười', async () => {
    const { client, calls } = make({ 'GET /auth/me': [json(200, USER)] });
    client.setAccessToken('tok');
    await expect(client.request('/auth/me', { schema: (s) => s.UserSchema })).resolves.toEqual(USER);
    expect(calls[0]!.init.credentials).toBe('include');
    expect(new Headers(calls[0]!.init.headers).get('Authorization')).toBe('Bearer tok');
  });

  test('sai hợp đồng → CONTRACT_ERROR nêu trường sai', async () => {
    const { client } = make({ 'GET /auth/me': [json(200, { ...USER, role: 'hacker' })] });
    const err = await client.request('/auth/me', { schema: (s) => s.UserSchema }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: 'CONTRACT_ERROR' });
    expect((err as Error).message).toMatch(/role/);
  });

  test('lỗi backend {error:{code,message,details}} + Retry-After; lỗi lạ suy theo status', async () => {
    const { client } = make({
      'POST /a': [json(400, { error: { code: 'VALIDATION_ERROR', message: 'x', details: ['email: sai'] } })],
      'POST /b': [json(429, { message: 'Too Many' }, { 'Retry-After': '900' })],
      'POST /c': [new Response('<html>', { status: 500 })],
    });
    await expect(client.request('/a', { method: 'POST', auth: false })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', details: ['email: sai'] });
    await expect(client.request('/b', { method: 'POST', auth: false })).rejects.toMatchObject({ code: 'RATE_LIMITED', retryAfter: 900 });
    await expect(client.request('/c', { method: 'POST', auth: false })).rejects.toMatchObject({ code: 'UNKNOWN', status: 500 });
  });

  test('mất mạng → NETWORK_ERROR; quá thời gian → TIMEOUT (không thử lại)', async () => {
    const { client, calls } = make({ 'GET /x': [new TypeError('Failed to fetch')], 'GET /y': ['hang', json(200, {})] });
    await expect(client.request('/x', { retry: 0 })).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    await expect(client.request('/y', { timeoutMs: 20 })).rejects.toMatchObject({ code: 'TIMEOUT' });
    expect(calls.filter((c) => c.url.endsWith('/y'))).toHaveLength(1);
  });

  test('GET tự thử lại lỗi tạm thời (mất mạng, 503) tối đa 2 lần; 4xx và POST không thử lại', async () => {
    const down = () => new TypeError('Failed to fetch');
    const { client, calls } = make({
      'GET /flaky': [down(), new Response('', { status: 503 }), json(200, { ok: 1 })],
      'GET /dead': [down(), down(), down(), json(200, {})],
      'GET /missing': [json(404, {}), json(200, {})],
      'POST /write': [down(), json(200, {})],
    });
    const count = (path: string) => calls.filter((c) => c.url.endsWith(path)).length;
    await expect(client.request('/flaky')).resolves.toBeUndefined();
    expect(count('/flaky')).toBe(3);
    await expect(client.request('/dead')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(count('/dead')).toBe(3);
    await expect(client.request('/missing')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(count('/missing')).toBe(1);
    await expect(client.request('/write', { method: 'POST', body: {}, auth: false })).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(count('/write')).toBe(1);
  });

  test('huỷ trong lúc chờ thử lại → AbortError, không gọi thêm', async () => {
    let n = 0;
    const fetch = () => {
      n += 1;
      return Promise.reject(new TypeError('Failed to fetch'));
    };
    const client = createApiClient({ baseUrl: 'http://api', fetch, retryDelaysMs: [200, 200] });
    const ctrl = new AbortController();
    const p = client.request('/x', { signal: ctrl.signal }).catch((e: unknown) => e);
    await new Promise((r) => setTimeout(r, 20));
    ctrl.abort();
    expect(isAbortError(await p)).toBe(true);
    expect(n).toBe(1);
  });

  test('nơi gọi huỷ → AbortError (không phải ApiError), kể cả huỷ trước khi gửi', async () => {
    const { client } = make({ 'GET /y': ['hang'], 'GET /z': [json(200, {})] });
    const ctrl = new AbortController();
    const p = client.request('/y', { signal: ctrl.signal }).catch((e: unknown) => e);
    ctrl.abort();
    expect(isAbortError(await p)).toBe(true);
    const pre = new AbortController();
    pre.abort();
    expect(isAbortError(await client.request('/z', { signal: pre.signal }).catch((e: unknown) => e))).toBe(true);
  });

  test('401 → refresh MỘT lần cho nhiều request đồng thời → gọi lại với token mới', async () => {
    const { client, calls } = make({
      'GET /a': [json(401, {}), json(200, { ok: 1 })],
      'GET /b': [json(401, {}), json(200, { ok: 2 })],
      'POST /auth/refresh': [json(200, { accessToken: 'T2' })],
    });
    client.setAccessToken('old');
    await Promise.all([client.request('/a'), client.request('/b')]);
    expect(calls.filter((c) => c.url.endsWith('/auth/refresh'))).toHaveLength(1);
    expect(client.getAccessToken()).toBe('T2');
  });

  test('refresh bị từ chối → onSessionLost, xoá token, ném lỗi gốc của backend', async () => {
    const { client } = make({
      'GET /a': [json(401, { error: { code: 'TOKEN_EXPIRED', message: 'hết hạn' } })],
      'POST /auth/refresh': [json(401, {})],
    });
    let lost = 0;
    client.onSessionLost(() => lost++);
    client.setAccessToken('old');
    await expect(client.request('/a')).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' });
    expect(lost).toBe(1);
    expect(client.getAccessToken()).toBeNull();
  });
});
