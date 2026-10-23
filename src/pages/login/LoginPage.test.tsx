// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import { createAuthService } from '@/api/auth';
import { createApiClient } from '@/api/client';
import { apiError, json, mockFetch, USER } from '@/api/test-utils';
import { AuthProvider, RequireAuth, useAuth } from '@/app/auth';
import LoginPage from './LoginPage';
import PendingPage from './PendingPage';
import RegisterPage from './RegisterPage';

function Where() {
  const l = useLocation();
  const { logout } = useAuth();
  return (
    <>
      <p data-testid="where">{l.pathname + l.search}</p>
      <button type="button" onClick={() => void logout()}>
        Đăng xuất
      </button>
    </>
  );
}

function setup(initial: string, routes: Parameters<typeof mockFetch>[0] = {}) {
  const m = mockFetch({ 'POST /auth/refresh': [apiError(401, 'UNAUTHORIZED')], ...routes });
  const service = createAuthService(createApiClient({ baseUrl: 'http://localhost:3000', fetch: m.fetch }));
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/pending', element: <PendingPage /> },
      { element: <RequireAuth />, children: [{ path: '*', element: <Where /> }] },
    ],
    { initialEntries: [initial] },
  );
  render(
    <AuthProvider service={service}>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
  return { router, ...m };
}

async function submitLogin(email = 'op@example.com', password = 'pw') {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(/Email/), email);
  await user.type(screen.getByLabelText(/Mật khẩu/), password);
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
}

const loginOk = () => json(200, { accessToken: 'tok', user: USER });

describe('route bảo vệ + /login', () => {
  test('chưa đăng nhập → /login nhớ trang; đăng nhập xong quay lại đúng trang', async () => {
    const { router } = setup('/alerts?tab=done', { 'POST /auth/login': [loginOk()] });
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe('?next=%2Falerts%3Ftab%3Ddone');
    await waitFor(() => expect(screen.getByLabelText(/Email/)).toHaveFocus());
    await submitLogin();
    expect(await screen.findByTestId('where')).toHaveTextContent('/alerts?tab=done');
  });

  test('F5 còn cookie refresh → khôi phục phiên (refresh + me), vào thẳng trang', async () => {
    const { calls } = setup('/maintenance', {
      'POST /auth/refresh': [json(200, { accessToken: 'a1' })],
      'GET /auth/me': [json(200, USER)],
    });
    expect(await screen.findByTestId('where')).toHaveTextContent('/maintenance');
    expect(calls.map((c) => c.key)).toEqual(['POST /auth/refresh', 'GET /auth/me']);
  });

  test('đăng xuất → về /login (route bảo vệ chặn lại)', async () => {
    const user = userEvent.setup();
    const { router } = setup('/overview', {
      'POST /auth/refresh': [json(200, { accessToken: 'a1' })],
      'GET /auth/me': [json(200, USER)],
      'POST /auth/logout': [new Response(null, { status: 204 })],
    });
    await user.click(await screen.findByRole('button', { name: 'Đăng xuất' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  test.each([
    ['INVALID_CREDENTIALS', apiError(401, 'INVALID_CREDENTIALS', 'Invalid credentials'), 'Email hoặc mật khẩu không đúng'],
    ['RATE_LIMITED', apiError(429, 'RATE_LIMITED', 'Too many'), 'quá nhiều lần'],
    ['mất kết nối', new TypeError('Failed to fetch'), 'Không kết nối được máy chủ'],
    ['sai hợp đồng', json(200, { token: 'x' }), 'không đúng định dạng'],
  ])('lỗi %s → thông báo đúng (role=alert, nhận focus), xoá ô mật khẩu', async (_, res, text) => {
    setup('/login', { 'POST /auth/login': [res] });
    await submitLogin();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(text);
    await waitFor(() => expect(alert).toHaveFocus());
    expect(screen.getByLabelText(/Mật khẩu/)).toHaveValue('');
  });

  test('ACCOUNT_PENDING → báo chờ duyệt + liên kết màn trạng thái', async () => {
    setup('/login', { 'POST /auth/login': [apiError(403, 'ACCOUNT_PENDING', 'Pending')] });
    await submitLogin();
    expect(await screen.findByRole('alert')).toHaveTextContent('chờ quản trị viên duyệt');
    expect(screen.getByRole('link', { name: 'Xem trạng thái' })).toHaveAttribute('href', '/pending');
  });

  test('bỏ trống → báo lỗi, không gọi /auth/login', async () => {
    const user = userEvent.setup();
    const { calls } = setup('/login');
    await user.click(await screen.findByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nhập email và mật khẩu');
    expect(calls.map((c) => c.key)).toEqual(['POST /auth/refresh']);
  });

  test('next ngoài site bị bỏ qua → /overview', async () => {
    setup('/login?next=%2F%2Fevil.com', { 'POST /auth/login': [loginOk()] });
    await submitLogin();
    expect(await screen.findByTestId('where')).toHaveTextContent('/overview');
  });
});

describe('/register → /pending', () => {
  async function fillRegister() {
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/Họ tên/), 'Người Mới');
    await user.type(screen.getByLabelText(/Email/), 'new@example.com');
    await user.type(screen.getByLabelText(/Mật khẩu/), 'a-long-password');
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
  }

  test('đăng ký thành công → màn "Tài khoản đang chờ duyệt" kèm thông báo của máy chủ', async () => {
    const { calls } = setup('/register', { 'POST /auth/register': [json(201, { message: 'Đã gửi yêu cầu, chờ duyệt' })] });
    await fillRegister();
    expect(await screen.findByRole('heading', { name: 'Tài khoản đang chờ duyệt' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Đã gửi yêu cầu, chờ duyệt');
    expect(screen.getByText('new@example.com')).toBeInTheDocument();
    const body = JSON.parse(String(calls.find((c) => c.key === 'POST /auth/register')!.init.body));
    expect(body).toEqual({ email: 'new@example.com', name: 'Người Mới', password: 'a-long-password' });
  });

  test('VALIDATION_ERROR → hiện thông báo của máy chủ', async () => {
    setup('/register', { 'POST /auth/register': [apiError(400, 'VALIDATION_ERROR', 'Mật khẩu tối thiểu 12 ký tự')] });
    await fillRegister();
    expect(await screen.findByRole('alert')).toHaveTextContent('Mật khẩu tối thiểu 12 ký tự');
  });
});
