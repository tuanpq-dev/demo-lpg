// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { RouterProvider, createMemoryRouter, useLocation } from 'react-router-dom';
import type { AuthService, AuthState } from '@/api/auth';
import { AuthProvider } from '@/app/auth';
import { dayFromNumber, reportCode } from '@/features/reports';
import { dayNumber, plantDayKey } from '@/lib/plantTime';
import ReportsPage from '../ReportsPage';

/*
 * Modal "Hoàn thành nhận xét & ký xác nhận" trên màn Báo cáo (?sign=<mã>). Kịch bản mock (lùi từ hôm nay, giờ thật):
 * lùi 26 ngày = chờ Người kiểm tra, đủ điều kiện dữ liệu · lùi 4 ngày = bị trả lại, GS-03 10:00 chưa ghi chú ·
 * lùi 1 ngày = chờ Người duyệt (không ký được ở bước này). Store báo cáo dùng chung giữa các test (ký ở test cuối).
 */

const userOf = (role: 'viewer' | 'operator'): AuthState => ({
  status: 'authenticated',
  user: { id: 'u1', email: 'op@example.com', name: 'Kỹ sư A', role, status: 'active' },
});
const serviceOf = (state: AuthState): AuthService => ({
  getState: () => state,
  subscribe: () => () => {},
  init: async () => {},
  login: async () => state.user!,
  register: async () => '',
  logout: async () => {},
  refresh: async () => true,
  expiresAt: () => null,
});

function Where() {
  const l = useLocation();
  return <output data-testid="where">{`${l.pathname}${l.search}`}</output>;
}

function renderAt(url: string, role: 'viewer' | 'operator' = 'operator') {
  const router = createMemoryRouter(
    [
      {
        path: '/reports',
        element: (
          <>
            <ReportsPage />
            <Where />
          </>
        ),
      },
      { path: '*', element: <Where /> },
    ],
    { initialEntries: [url] },
  );
  render(
    <AuthProvider service={serviceOf(userOf(role))}>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

const codeBack = (n: number) => reportCode('daily', dayFromNumber(dayNumber(plantDayKey(new Date())) - n));
const where = () => screen.getByTestId('where').textContent ?? '';
const dialog = () => screen.findByRole('dialog', { name: 'Hoàn thành nhận xét & ký xác nhận' });
const conditions = (d: HTMLElement) => within(within(d).getByRole('heading', { name: 'Điều kiện ký xác nhận' }).closest('section')!).getAllByRole('listitem');
const signButton = (d: HTMLElement) => within(d).getByRole('button', { name: 'Ký xác nhận báo cáo' });

describe('ReportSignModal', () => {
  test('nút bút ký ở dòng chờ Người kiểm tra → mở modal qua ?sign; "Hủy" đóng', async () => {
    const user = userEvent.setup();
    const code = codeBack(26);
    renderAt(`/reports?tab=all&q=${code}`);
    await user.click(await screen.findByRole('button', { name: `Ký xác nhận ${code}` }));
    expect(where()).toContain(`sign=${code}`);
    const d = await dialog();
    expect(within(d).getByText(code)).toBeInTheDocument();
    await user.click(within(d).getByRole('button', { name: 'Hủy' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(where()).not.toContain('sign=');
  });

  test('không mở: báo cáo đã qua bước Người kiểm tra; vai trò không có quyền ký → không có nút', async () => {
    renderAt(`/reports?tab=all&q=${codeBack(1)}&sign=${codeBack(1)}`);
    await screen.findByRole('table', { name: 'Danh sách báo cáo vận hành' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `Ký xác nhận ${codeBack(1)}` })).not.toBeInTheDocument();
  });

  test('viewer: không có nút ký, ?sign bị bỏ qua', async () => {
    const code = codeBack(26);
    renderAt(`/reports?tab=all&q=${code}&sign=${code}`, 'viewer');
    await screen.findByRole('table', { name: 'Danh sách báo cáo vận hành' });
    expect(screen.queryByRole('button', { name: `Ký xác nhận ${code}` })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('bị trả lại: lý do + "bất thường chưa ghi chú" → vẫn khoá sau khi xem trước + tick', async () => {
    const user = userEvent.setup();
    const code = codeBack(4);
    renderAt(`/reports?tab=all&sign=${code}`);
    const d = await dialog();
    expect(within(d).getByText(/Chưa ghi chú nồng độ khí GS-03/)).toBeInTheDocument();
    expect(within(d).getAllByText('Bị trả lại – chờ ký lại')).toHaveLength(2); // badge + thẻ biểu mẫu
    await user.click(within(d).getByRole('link', { name: /Xem trước biểu mẫu/ }));
    await user.click(within(d).getByRole('checkbox', { name: /Tôi xác nhận đã kiểm tra dữ liệu vận hành/ }));
    const unmet = conditions(d).filter((li) => li.textContent?.startsWith('Chưa đạt'));
    expect(unmet.map((li) => li.textContent)).toEqual(['Chưa đạt: Còn 1 bất thường chưa ghi chú: GS-03 lúc 10:00']);
    expect(signButton(d)).toHaveAttribute('aria-disabled', 'true');
    expect(signButton(d)).toHaveAccessibleDescription(/Còn 1 bất thường chưa ghi chú/);
    await user.click(signButton(d));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  test('"Quay lại chỉnh sửa" → trang chi tiết báo cáo ngày', async () => {
    const user = userEvent.setup();
    const code = codeBack(26);
    renderAt(`/reports?sign=${code}`);
    await user.click(within(await dialog()).getByRole('button', { name: 'Quay lại chỉnh sửa' }));
    await waitFor(() => expect(where()).toBe(`/reports/daily/${code}`));
  });

  test('chờ Người kiểm tra: khoá tới khi xem trước biểu mẫu + xác nhận trách nhiệm → ký → chờ Người duyệt', async () => {
    const user = userEvent.setup();
    const code = codeBack(26);
    renderAt(`/reports?tab=all&q=${code}&sign=${code}`);
    const d = await dialog();
    expect(within(d).getAllByText('Chờ người kiểm tra ký')).toHaveLength(2); // badge + thẻ biểu mẫu
    const flow = within(d).getByRole('navigation', { name: `Luồng phê duyệt ${code}` });
    expect(within(flow).getByRole('listitem', { current: 'step' })).toHaveTextContent('1. Người kiểm tra ký');

    expect(conditions(d)).toHaveLength(8);
    expect(conditions(d).filter((li) => li.textContent?.startsWith('Chưa đạt')).map((li) => li.textContent)).toEqual([
      'Chưa đạt: Chưa xem trước biểu mẫu bản nháp',
      'Chưa đạt: Người kiểm tra chưa xác nhận trách nhiệm',
    ]);
    expect(signButton(d)).toHaveAttribute('aria-disabled', 'true');

    await user.click(within(d).getByRole('link', { name: /Xem trước biểu mẫu/ }));
    await user.click(within(d).getByRole('checkbox', { name: /Tôi xác nhận đã kiểm tra dữ liệu vận hành/ }));
    await user.type(within(d).getByRole('textbox', { name: 'Ghi chú khi ký' }), 'Đã rà soát');
    expect(conditions(d).every((li) => li.textContent?.startsWith('Đạt'))).toBe(true);
    expect(signButton(d)).not.toHaveAttribute('aria-disabled');

    await user.click(signButton(d));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(where()).not.toContain('sign=');
    // Đã qua bước Người kiểm tra → dòng không còn nút ký; mở lại link ?sign cũ cũng không hiện modal.
    expect(screen.queryByRole('button', { name: `Ký xác nhận ${code}` })).not.toBeInTheDocument();
  });
});
