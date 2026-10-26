// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { RouterProvider, createMemoryRouter, useLocation } from 'react-router-dom';
import type { AuthService, AuthState } from '@/api/auth';
import { AuthProvider } from '@/app/auth';
import MaintenancePage from './MaintenancePage';
import MaintenanceDetailPage from './MaintenanceDetailPage';

/*
 * Trang chi tiết yêu cầu bảo trì: routing (vào thẳng URL, mã khác kiểu chữ, mã sai, `?open=` cũ), quay lại đúng bộ lọc,
 * và luồng chính trên mock (Tiếp nhận → tick checklist → ghi chú → hủy). Thay cho test drawer cũ (drawer đã bỏ):
 * cùng các ý – mở bản ghi từ bảng, chuyển bước, phân công – nay chạy trên trang riêng.
 * Store bảo trì là module dùng chung → các test đọc trước, test thay đổi dữ liệu đặt cuối.
 */

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
      { path: '/maintenance', element: <><MaintenancePage /><Where /></> },
      { path: '/maintenance/:id', element: <><MaintenanceDetailPage /><Where /></> },
      { path: '*', element: <Where /> },
    ],
    { initialEntries: [url] },
  );
  render(
    <AuthProvider service={service}>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
  return router;
}
const where = () => screen.getByTestId('where').textContent;

describe('routing /maintenance/:id', () => {
  test('vào thẳng /maintenance/MT-00128: tiêu đề, 3 badge, stepper ở bước "Tiếp nhận", checklist khoá', async () => {
    renderAt('/maintenance/MT-00128');
    expect(await screen.findByRole('heading', { level: 1, name: 'Kiểm tra van an toàn V-101' })).toBeInTheDocument();
    expect(screen.getByText('Bảo trì khẩn cấp')).toBeInTheDocument();
    const stepper = screen.getByRole('navigation', { name: 'Tiến trình xử lý MT-00128' });
    expect(within(stepper).getByText(/Tiếp nhận/).closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('2/6 công việc hoàn thành · 33%')).toBeInTheDocument();
    for (const cb of screen.getAllByRole('checkbox')) expect(cb).toBeDisabled();
    expect(screen.getByText('Tiếp nhận yêu cầu trước khi cập nhật checklist.')).toBeInTheDocument();
    const bar = screen.getByRole('region', { name: 'Thao tác yêu cầu MT-00128' });
    expect(within(bar).getByRole('button', { name: 'Tiếp nhận ngay' })).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'Hủy yêu cầu' })).toBeInTheDocument();
    // Cảnh báo gốc + link thiết bị
    expect(screen.getByRole('article', { name: 'Cảnh báo ALT-00128' })).toHaveTextContent('Lúc cảnh báo');
    expect(screen.getByRole('link', { name: 'Xem chi tiết cảnh báo →' })).toHaveAttribute('href', '/alerts?alert=ALT-00128&range=30d');
    expect(screen.getByRole('link', { name: /V-101.*mở trang chi tiết thiết bị/ })).toHaveAttribute('href', '/map/V-101');
  });

  test('mã khác kiểu chữ → chuyển sang mã chuẩn', async () => {
    renderAt('/maintenance/mt-00128?x=1');
    await screen.findByRole('heading', { level: 1, name: 'Kiểm tra van an toàn V-101' });
    expect(where()).toBe('/maintenance/MT-00128?x=1');
  });

  test('mã sai → "Không tìm thấy yêu cầu", URL giữ nguyên', async () => {
    renderAt('/maintenance/MT-99999');
    expect(await screen.findByRole('heading', { level: 1, name: 'Không tìm thấy yêu cầu' })).toBeInTheDocument();
    expect(screen.getByText('MT-99999', { selector: 'code' })).toBeInTheDocument();
    expect(where()).toBe('/maintenance/MT-99999');
  });

  test('link cũ /maintenance?open=<id> → trang chi tiết; "Quay lại danh sách" về danh sách giữ bộ lọc, bỏ open', async () => {
    const user = userEvent.setup();
    renderAt('/maintenance?tab=pending&open=MT-00127');
    await screen.findByRole('heading', { level: 1, name: 'Kiểm tra cảm biến gas GS-01' });
    expect(where()).toBe('/maintenance/MT-00127');
    await user.click(screen.getByRole('button', { name: '← Quay lại danh sách' }));
    await screen.findByRole('heading', { level: 1, name: 'Quản lý bảo trì' });
    expect(where()).toBe('/maintenance?tab=pending');
  });

  test('bảng → "Xem chi tiết" → trang chi tiết; breadcrumb "Quản lý bảo trì" về đúng bộ lọc', async () => {
    const user = userEvent.setup();
    renderAt('/maintenance?tab=pending&q=V-101');
    await user.click(await screen.findByRole('button', { name: 'Xem chi tiết MT-00128' }));
    await screen.findByRole('heading', { level: 1, name: 'Kiểm tra van an toàn V-101' });
    expect(where()).toBe('/maintenance/MT-00128');
    await user.click(screen.getByRole('link', { name: 'Quản lý bảo trì' }));
    await screen.findByRole('heading', { level: 1, name: 'Quản lý bảo trì' });
    expect(where()).toBe('/maintenance?tab=pending&q=V-101');
  });
});

describe('luồng xử lý trên trang chi tiết (đổi dữ liệu – để cuối)', () => {
  test('Tiếp nhận ngay → bước 2 + lịch sử; tick checklist; thêm ghi chú; hủy có lý do', async () => {
    const user = userEvent.setup();
    renderAt('/maintenance/MT-00128');
    await screen.findByRole('heading', { level: 1, name: 'Kiểm tra van an toàn V-101' });

    // Tiếp nhận: không nhảy bước (pending → assigned), người nhận = người đăng nhập, thêm 1 dòng lịch sử
    await user.click(screen.getByRole('button', { name: 'Tiếp nhận ngay' }));
    const stepper = screen.getByRole('navigation', { name: 'Tiến trình xử lý MT-00128' });
    await waitFor(() => expect(within(stepper).getByText(/Đang thực hiện/).closest('li')).toHaveAttribute('aria-current', 'step'));
    expect(screen.getByText('Tiếp nhận yêu cầu – phụ trách: Kỹ sư A')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bắt đầu thực hiện' })).toBeInTheDocument();

    // Checklist mở khoá (Đã phân công) – tick → tiến độ 3/6 · 50%
    const box = screen.getByRole('checkbox', { name: 'Kiểm tra cáp tín hiệu cảm biến hành trình ZSO/ZSC' });
    expect(box).toBeEnabled();
    await user.click(box);
    expect(await screen.findByText('3/6 công việc hoàn thành · 50%')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Trả lại mặt bằng/ })).toBeDisabled();

    // Ghi chú mới hiện ngay
    await user.type(screen.getByRole('textbox', { name: 'Ghi chú mới' }), 'Siêu âm không phát hiện rò rỉ.');
    await user.click(screen.getByRole('button', { name: 'Thêm ghi chú' }));
    expect(await screen.findByText('Siêu âm không phát hiện rò rỉ.')).toBeInTheDocument();

    // Hủy: hộp xác nhận + lý do → "Đã hủy", thanh hành động biến mất, lịch sử có lý do
    await user.click(screen.getByRole('button', { name: 'Hủy yêu cầu' }));
    const dialog = screen.getByRole('dialog', { name: 'Hủy yêu cầu MT-00128?' });
    await user.type(within(dialog).getByRole('textbox', { name: /Lý do hủy/ }), 'Trùng yêu cầu');
    await act(async () => {
      await user.click(within(dialog).getByRole('button', { name: 'Xác nhận hủy' }));
    });
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Thao tác yêu cầu MT-00128' })).toBeNull());
    expect(screen.getByText('Hủy yêu cầu – lý do: Trùng yêu cầu')).toBeInTheDocument();
    expect(screen.getAllByText('Đã hủy').length).toBeGreaterThan(0);
    expect(screen.getByRole('navigation', { name: 'Tiến trình xử lý MT-00128' }).querySelector('[aria-current]')).toBeNull();
  });
});
