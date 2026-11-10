import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { ApiError, createApiClient } from './client';
import { apiError, json, mockFetch, USER } from './test-utils';
import { UserSchema } from './types';

const BASE = 'http://localhost:3000';
const make = (routes: Parameters<typeof mockFetch>[0]) => {
  const m = mockFetch(routes);
  return { client: createApiClient({ baseUrl: BASE, fetch: m.fetch }), ...m };
};

describe('createApiClient', () => {
  test('baseURL + credentials include + Bearer khi có token', async () => {
    const { client, calls } = make({ 'GET /auth/me': [json(200, USER)] });
    client.setAccessToken('tok');
    await expect(client.request('/auth/me', { schema: UserSchema })).resolves.toEqual(USER);
    expect(calls[0].url).toBe('http://localhost:3000/auth/me');
    expect(calls[0].init.credentials).toBe('include');
    expect(new Headers(calls[0].init.headers).get('Authorization')).toBe('Bearer tok');
  });

  test('auth:false → không gửi Bearer; body JSON + Content-Type', async () => {
    const { client, calls } = make({ 'POST /auth/login': [json(200, {})] });
    client.setAccessToken('tok');
    await client.request('/auth/login', { method: 'POST', body: { a: 1 }, auth: false });
    const h = new Headers(calls[0].init.headers);
    expect(h.get('Authorization')).toBeNull();
    expect(h.get('Content-Type')).toBe('application/json');
    expect(calls[0].init.body).toBe('{"a":1}');
  });

  test('lỗi {error:{code,message}} → ApiError đúng code/message/status', async () => {
    const { client } = make({ 'POST /auth/login': [apiError(401, 'INVALID_CREDENTIALS', 'Sai')] });
    const err = await client.request('/auth/login', { method: 'POST', body: {}, auth: false }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: 'INVALID_CREDENTIALS', message: 'Sai', status: 401 });
  });

  test('error.details (tuỳ chọn) → ApiError.details', async () => {
    const { client } = make({
      'POST /auth/register': [json(400, { error: { code: 'VALIDATION_ERROR', message: 'x', details: ['password: ngắn'] } })],
    });
    await expect(client.request('/auth/register', { method: 'POST', auth: false })).rejects.toMatchObject({ details: ['password: ngắn'] });
  });

  test('Retry-After → retryAfter (giây)', async () => {
    const { client } = make({ 'POST /auth/login': [json(429, { error: { code: 'RATE_LIMITED', message: 'x' } }, { 'Retry-After': '900' })] });
    await expect(client.request('/auth/login', { method: 'POST', auth: false })).rejects.toMatchObject({ code: 'RATE_LIMITED', retryAfter: 900 });
  });

  test('lỗi không đúng định dạng → suy theo status (429 → RATE_LIMITED, 500 → UNKNOWN)', async () => {
    const { client } = make({
      'POST /a': [json(429, { message: 'Too Many' })],
      'POST /b': [new Response('<html>', { status: 500 })],
    });
    await expect(client.request('/a', { method: 'POST', auth: false })).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    await expect(client.request('/b', { method: 'POST', auth: false })).rejects.toMatchObject({ code: 'UNKNOWN', status: 500 });
  });

  test('mất mạng → NETWORK_ERROR "Không kết nối được máy chủ"', async () => {
    const { client } = make({ 'GET /auth/me': [new TypeError('Failed to fetch')] });
    await expect(client.request('/auth/me')).rejects.toMatchObject({ code: 'NETWORK_ERROR', message: 'Không kết nối được máy chủ', status: 0 });
  });

  test('thiếu VITE_API_URL → CONFIG_ERROR, không gọi fetch', async () => {
    const m = mockFetch({});
    const client = createApiClient({ baseUrl: '', fetch: m.fetch });
    await expect(client.request('/auth/me')).rejects.toMatchObject({ code: 'CONFIG_ERROR' });
    expect(m.calls).toHaveLength(0);
  });

  test('response sai hợp đồng → CONTRACT_ERROR nêu trường sai', async () => {
    const { client } = make({
      'GET /auth/me': [json(200, { ...USER, role: 'root' })],
      'GET /x': [new Response('<!doctype html>', { status: 200 })],
    });
    const err = await client.request('/auth/me', { schema: UserSchema }).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: 'CONTRACT_ERROR' });
    expect((err as Error).message).toContain('role');
    await expect(client.request('/x', { schema: z.object({}) })).rejects.toMatchObject({ code: 'CONTRACT_ERROR' });
  });

  test('204 → undefined', async () => {
    const { client } = make({ 'POST /auth/logout': [new Response(null, { status: 204 })] });
    await expect(client.request('/auth/logout', { method: 'POST', auth: false })).resolves.toBeUndefined();
  });

  test('401 → refresh một lần → gọi lại với token mới', async () => {
    const { client, calls } = make({
      'GET /auth/me': [apiError(401, 'UNAUTHORIZED'), json(200, USER)],
      'POST /auth/refresh': [json(200, { accessToken: 'new' })],
    });
    client.setAccessToken('old');
    await expect(client.request('/auth/me', { schema: UserSchema })).resolves.toEqual(USER);
    expect(calls.map((c) => c.key)).toEqual(['GET /auth/me', 'POST /auth/refresh', 'GET /auth/me']);
    expect(new Headers(calls[2].init.headers).get('Authorization')).toBe('Bearer new');
    expect(client.getAccessToken()).toBe('new');
  });

  test('nhiều request cùng 401 → chỉ MỘT lần /auth/refresh', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { client, calls } = make({
      'GET /a': [apiError(401, 'UNAUTHORIZED'), json(200, {})],
      'GET /b': [apiError(401, 'UNAUTHORIZED'), json(200, {})],
      'GET /c': [apiError(401, 'UNAUTHORIZED'), json(200, {})],
      'POST /auth/refresh': [
        async () => {
          await gate;
          return json(200, { accessToken: 'new' });
        },
      ],
    });
    client.setAccessToken('old');
    const all = Promise.all(['/a', '/b', '/c'].map((p) => client.request(p, { schema: z.object({}) })));
    await new Promise((r) => setTimeout(r, 0));
    release();
    await all;
    expect(calls.filter((c) => c.key === 'POST /auth/refresh')).toHaveLength(1);
  });

  test('refresh bị từ chối → báo mất phiên, xoá token, ném UNAUTHORIZED, không lặp', async () => {
    const { client, calls } = make({
      'GET /auth/me': [apiError(401, 'UNAUTHORIZED', 'Hết phiên')],
      'POST /auth/refresh': [apiError(401, 'UNAUTHORIZED')],
    });
    let lost = 0;
    client.onSessionLost(() => lost++);
    client.setAccessToken('old');
    await expect(client.request('/auth/me')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(lost).toBe(1);
    expect(client.getAccessToken()).toBeNull();
    expect(calls).toHaveLength(2);
  });

  test('refresh xong mà vẫn 401 → mất phiên (không refresh lần 2)', async () => {
    const { client, calls } = make({
      'GET /x': [apiError(401, 'UNAUTHORIZED'), apiError(401, 'UNAUTHORIZED')],
      'POST /auth/refresh': [json(200, { accessToken: 'new' })],
    });
    let lost = 0;
    client.onSessionLost(() => lost++);
    await expect(client.request('/x')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(lost).toBe(1);
    expect(calls.filter((c) => c.key === 'POST /auth/refresh')).toHaveLength(1);
  });

  test('401 nhưng mất mạng khi refresh → NETWORK_ERROR, KHÔNG đăng xuất', async () => {
    const { client } = make({
      'GET /x': [apiError(401, 'UNAUTHORIZED')],
      'POST /auth/refresh': [new TypeError('offline')],
    });
    let lost = 0;
    client.onSessionLost(() => lost++);
    client.setAccessToken('old');
    await expect(client.request('/x')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(lost).toBe(0);
  });

  test('401 ở endpoint auth:false (vd login sai) → không refresh', async () => {
    const { client, calls } = make({ 'POST /auth/login': [apiError(401, 'INVALID_CREDENTIALS')] });
    await expect(client.request('/auth/login', { method: 'POST', body: {}, auth: false })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
    expect(calls).toHaveLength(1);
  });

  test('refresh trả sai hợp đồng → CONTRACT_ERROR', async () => {
    const { client } = make({ 'POST /auth/refresh': [json(200, { token: 'x' })] });
    await expect(client.refresh()).rejects.toMatchObject({ code: 'CONTRACT_ERROR' });
  });
});
