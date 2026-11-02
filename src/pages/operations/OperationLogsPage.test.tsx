// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { RouterProvider, createMemoryRouter, useLocation } from 'react-router-dom';
import type { AuthService, AuthState } from '@/api/auth';
import { AuthProvider } from '@/app/auth';
import OperationLogsPage from './OperationLogsPage';

/*
 * Nhật ký vận hành: KPI tính từ CÙNG danh sách với bảng (tổng = số dòng; cảnh báo = số dòng loại Cảnh báo), cảnh báo lấy
 * từ store chung (mã là link sang /alerts), lọc qua URL, tìm không dấu.
 * Giờ ghim 18:30 giờ nhà máy TRƯỚC khi nạp mock (giờ cảnh báo mock cố định – không rơi vào tương lai).
 */
vi.hoisted(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-02T11:30:00Z'));
});

const state: AuthState = {
  status: 'authenticated',
  user: { id: 'u1', email: 'op@example.com', name: 'Kỹ sư A', role: 'operator', status: 'active' },
};
const service: AuthService = {
  getState: () => state,
  subscribe: () => () => {},
  init: async () => {},
  login: async () => state.user!,
  register: async () => '',
  logout: async () => {},
  refresh: async () => true,
  expiresAt: () => null,
};

function Where() {
  const l = useLocation();
  return <output data-testid="where">{`${l.pathname}${l.search}`}</output>;
}

function renderAt(url: string) {
  const router = createMemoryRouter(
    [
      { path: '/operations/logs', element: <><OperationLogsPage /><Where /></> },
      { path: '*', element: <Where /> },
    ],
    { initialEntries: [url] },
  );
  render(
    <AuthProvider service={service}>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

const where = () => screen.getByTestId('where').textContent;
const kpis = () => screen.getByRole('region', { name: 'Thống kê nhật ký vận hành' });
/** Thẻ KPI chứa nhãn `label` (phần tử con trực tiếp của vùng KPI). */
function kpi(label: string) {
  const region = kpis();
  let el: HTMLElement | null = within(region).getByText(label);
  while (el && el.parentElement !== region) el = el.parentElement;
  return el!;
}
const kpiNumber = (label: string) => Number(/(\d+)/.exec(kpi(label).textContent!.replace(label, ''))![1]);
const table = () => screen.getByRole('table', { name: 'Nhật ký vận hành' });
const total = () => Number(/của (\d+) sự kiện/.exec(screen.getByText(/của \d+ sự kiện/).textContent!)![1]);

describe('/operations/logs', () => {
  test('KPI khớp bảng: tổng hôm nay = số dòng; "Cảnh báo phát sinh" = số dòng loại Cảnh báo', async () => {
    renderAt('/operations/logs');
    await screen.findByRole('heading', { level: 1, name: 'Nhật ký vận hành' });
    await waitFor(() => expect(within(table()).getAllByRole('row').length).toBeGreaterThan(1));
    const sum = kpiNumber('Tổng sự kiện hôm nay');
    expect(total()).toBe(sum);
    const alerts = kpiNumber('Cảnh báo phát sinh');
    expect(alerts).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: /Loại sự kiện/ }));
    await userEvent.click(screen.getByRole('option', { name: 'Cảnh báo' }));
    expect(where()).toContain('category=alert');
    expect(total()).toBe(alerts);
    // KPI không đổi theo bộ lọc bảng (chỉ theo khoảng thời gian).
    expect(kpiNumber('Tổng sự kiện hôm nay')).toBe(sum);
  });

  test('cảnh báo từ store chung: mã là link mở cảnh báo trên Trung tâm cảnh báo', async () => {
    renderAt('/operations/logs?q=ALT-00128');
    const link = await screen.findByRole('link', { name: 'ALT-00128 – mở cảnh báo' });
    const row = link.closest('tr')!;
    expect(within(row).getByText('Áp suất bồn V-101 vượt ngưỡng')).toBeInTheDocument();
    expect(within(row).getByText('Cao')).toBeInTheDocument();
    expect(within(row).getByText('Chưa xử lý')).toBeInTheDocument();
    await userEvent.click(link);
    expect(where()).toBe('/alerts?alert=ALT-00128');
  });

  test('thiết bị mất kết nối: KPI "Cần kiểm tra" + tìm không dấu ra dòng Chưa xử lý', async () => {
    renderAt('/operations/logs');
    await screen.findByRole('heading', { level: 1, name: 'Nhật ký vận hành' });
    await waitFor(() => expect(kpiNumber('Thiết bị kết nối')).toBe(2));
    expect(within(kpi('Thiết bị kết nối')).getByText('(Cần kiểm tra)')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('searchbox'), 'mat tin hieu luu luong');
    const row = within(table()).getByText('Mất tín hiệu Lưu lượng kế FT-102').closest('tr')!;
    expect(within(row).getByText('Chưa xử lý')).toBeInTheDocument();
    expect(total()).toBe(1);
  });

  test('khoảng 7 ngày từ URL: nhãn đổi, có dòng hôm qua kèm nhãn ngày; Xoá bộ lọc giữ khoảng', async () => {
    renderAt('/operations/logs?range=7d&category=operation');
    expect(await within(kpis()).findByText('Tổng sự kiện 7 ngày qua')).toBeInTheDocument();
    expect(kpiNumber('Tổng sự kiện 7 ngày qua')).toBeGreaterThan(total());
    await userEvent.click(screen.getByRole('button', { name: 'Xoá bộ lọc' }));
    expect(where()).toBe('/operations/logs?range=7d');
    expect(total()).toBe(kpiNumber('Tổng sự kiện 7 ngày qua'));
  });

  test('nút thao tác khác chưa có thiết kế: khoá bằng aria-disabled, đọc được lý do', async () => {
    renderAt('/operations/logs');
    const more = (await screen.findAllByRole('button', { name: /^Thao tác khác / }))[0]!;
    expect(more).toHaveAttribute('aria-disabled', 'true');
    expect(more).toHaveAccessibleDescription(/chờ thiết kế/);
  });
});
