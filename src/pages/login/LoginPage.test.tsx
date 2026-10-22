// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import { AuthProvider, RequireAuth } from '@/app/auth';
import { createAuthClient } from '@/data/auth';
import LoginPage from './LoginPage';

const USER = { id: 'u1', email: 'eng@example.com', name: 'Kỹ sư A', role: 'engineer' };
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}

function setup(initial: string, responses: { refresh?: Response; login?: Response[] } = {}) {
  const logins = [...(responses.login ?? [])];
  const fetch = vi.fn(async (url: RequestInfo | URL) => {
    const u = String(url);
    if (u.endsWith('/auth/refresh')) return responses.refresh ?? json(401, {});
    if (u.endsWith('/auth/login')) return logins.shift() ?? json(500, {});
    return json(404, {});
  }) as unknown as typeof globalThis.fetch;
  const client = createAuthClient({ baseUrl: '/api', fetch, now: () => Date.now() });
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { element: <RequireAuth />, children: [{ path: '*', element: <Where /> }] },
    ],
    { initialEntries: [initial] },
  );
  render(
    <AuthProvider client={client}>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
  return { router, fetch };
}

describe('route bảo vệ + /login', () => {
  test('chưa đăng nhập → /login nhớ trang định vào; đăng nhập xong quay lại đúng trang', async () => {
    const user = userEvent.setup();
    const { router } = setup('/alerts?tab=done', { login: [json(200, { accessToken: 't', expiresIn: 900, user: USER })] });
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?next=%2Falerts%3Ftab%3Ddone');
    // Focus đặt trong effect (sau lần vẽ) → chờ thay vì kiểm tra ngay.
    await waitFor(() => expect(screen.getByLabelText(/Email/)).toHaveFocus());

    await user.type(screen.getByLabelText(/Email/), 'eng@example.com');
    await user.type(screen.getByLabelText(/Mật khẩu/), 'pw');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByTestId('where')).toHaveTextContent('/alerts?tab=done');
  });

  test('có phiên (cookie refresh còn) → vào thẳng trang, không qua /login', async () => {
    setup('/maintenance', { refresh: json(200, { accessToken: 't', expiresIn: 900, user: USER }) });
    expect(await screen.findByTestId('where')).toHaveTextContent('/maintenance');
  });

  test('sai mật khẩu → thông báo chung (role=alert, nhận focus), xoá ô mật khẩu', async () => {
    const user = userEvent.setup();
    setup('/login', { login: [json(401, { message: 'Email hoặc mật khẩu không đúng' })] });
    await user.type(await screen.findByLabelText(/Email/), 'x@example.com');
    await user.type(screen.getByLabelText(/Mật khẩu/), 'bad');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Email hoặc mật khẩu không đúng');
    expect(alert).toHaveFocus();
    expect(screen.getByLabelText(/Mật khẩu/)).toHaveValue('');
  });

  test('bị khoá tạm → báo số phút chờ', async () => {
    const user = userEvent.setup();
    setup('/login', {
      login: [json(429, { message: 'Đăng nhập tạm khoá do nhập sai nhiều lần. Vui lòng thử lại sau.' }, { 'Retry-After': '840' })],
    });
    await user.type(await screen.findByLabelText(/Email/), 'x@example.com');
    await user.type(screen.getByLabelText(/Mật khẩu/), 'bad');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('khoảng 14 phút');
  });

  test('bỏ trống → báo lỗi, không gọi server', async () => {
    const user = userEvent.setup();
    const { fetch } = setup('/login');
    await user.click(await screen.findByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nhập email và mật khẩu');
    expect(fetch).toHaveBeenCalledTimes(1); // chỉ lần refresh khi khởi động
  });

  test('next ngoài site bị bỏ qua → về /overview', async () => {
    const user = userEvent.setup();
    setup('/login?next=%2F%2Fevil.com', { login: [json(200, { accessToken: 't', expiresIn: 900, user: USER })] });
    await user.type(await screen.findByLabelText(/Email/), 'eng@example.com');
    await user.type(screen.getByLabelText(/Mật khẩu/), 'pw');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByTestId('where')).toHaveTextContent('/overview');
  });
});
