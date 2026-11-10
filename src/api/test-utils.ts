import { vi } from 'vitest';

/** Response JSON giả. */
export const json = (status: number, body?: unknown, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

export const apiError = (status: number, code: string, message = code) => json(status, { error: { code, message } });

export const USER = { id: 'u1', email: 'op@example.com', name: 'Vận hành A', role: 'operator', status: 'active' } as const;

type Handler = Response | Error | (() => Response | Promise<Response>);

/**
 * fetch giả: khoá "METHOD /path" → hàng đợi phản hồi (Response, Error = lỗi mạng, hoặc hàm).
 * Ghi lại mọi lời gọi (url, init) để kiểm tra header/credentials.
 */
export function mockFetch(routes: Record<string, Handler[]>) {
  const calls: { key: string; url: string; init: RequestInit }[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const key = `${init.method ?? 'GET'} ${new URL(url).pathname}`;
    calls.push({ key, url, init });
    const next = routes[key]?.shift();
    if (!next) return json(404, { error: { code: 'NOT_FOUND', message: `không có mock cho ${key}` } });
    if (next instanceof Error) throw next;
    return typeof next === 'function' ? next() : next;
  });
  return { fetch: fn as unknown as typeof fetch, calls };
}

/** JWT giả (không ký) có exp – để test hẹn refresh. */
export const fakeJwt = (exp: number) => `eyJhbGciOiJub25lIn0.${btoa(JSON.stringify({ sub: 'u1', exp })).replace(/=+$/, '')}.x`;
