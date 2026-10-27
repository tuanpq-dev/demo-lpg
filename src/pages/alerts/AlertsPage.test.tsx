// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { RouterProvider, createMemoryRouter, useLocation } from 'react-router-dom';
import type { AuthService, AuthState } from '@/api/auth';
import { AuthProvider } from '@/app/auth';
import AlertsPage from './AlertsPage';

/*
 * Drawer chi tiết cảnh báo trên trang /alerts: `?alert=` mở thẳng (F5 giữ), Esc đóng + trả focus, thanh đo a11y,
 * quy trình chỉ đi tiến (xác nhận → đánh dấu đã xử lý cần ghi chú), hướng dẫn tick được, bảng/tab/KPI cập nhật theo,
 * tạo yêu cầu bảo trì mở TRÊN drawer + không tạo trùng.
 * Store cảnh báo/bảo trì là module dùng chung → test đọc trước, test thay đổi dữ liệu đặt sau và dùng cảnh báo khác nhau.
 */

const state: AuthState = {
  status: 'authenticated',
  user: { id: 'u1', email: 'op@example.com', name: 'Vận hành A', role: 'operator', status: 'active' },
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
      { path: '/alerts', element: <><AlertsPage /><Where /></> },
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
const where = () => screen.getByTestId('where').textContent ?? '';
const kpis = () => screen.getByRole('region', { name: 'Thống kê cảnh báo' }).textContent;

describe('drawer chi tiết cảnh báo', () => {
  test('?alert=ALT-00128 mở thẳng drawer: header, thông số, thanh đo role=meter, đã có MT-00128 → không có nút tạo', async () => {
    renderAt('/alerts?alert=ALT-00128');
    const d = await screen.findByRole('dialog', { name: 'Áp suất bồn V-101 vượt ngưỡng' });
    expect(within(d).getByText('ALT-00128')).toBeInTheDocument();
    expect(within(d).getByText('Khu bồn LPG')).toBeInTheDocument();
    expect(within(d).getByRole('link', { name: 'V-101' })).toHaveAttribute('href', '/map/V-101');
    expect(within(d).getByText('Giá trị lúc cảnh báo')).toBeInTheDocument();
    expect(within(d).getByText('Ngưỡng cho phép').parentElement).toHaveTextContent('10.5bar');
    const meter = within(d).getByRole('meter', { name: 'Giá trị lúc cảnh báo so với ngưỡng' });
    expect(meter).toHaveAttribute('aria-valuenow', '11.8');
    expect(meter).toHaveAttribute('aria-valuemin', '0');
    expect(meter).toHaveAttribute('aria-valuemax', '14.4');
    expect(meter).toHaveAttribute('aria-valuetext', '11.8 bar, vượt ngưỡng 10.5 bar');
    // Playbook theo loại
    expect(within(d).getByText('Van an toàn kẹt')).toBeInTheDocument();
    const locked = within(d).getByRole('checkbox', { name: 'Xác minh trạng thái van PSV-101' });
    expect(locked).toHaveAttribute('aria-disabled', 'true');
    expect(locked).toHaveAccessibleDescription('Xác nhận cảnh báo để bắt đầu xử lý.');
    // Tiến trình
    const steps = within(d).getByRole('navigation', { name: 'Tiến trình xử lý ALT-00128' });
    expect(within(steps).getByText(/Chưa xác nhận/).closest('li')).toHaveAttribute('aria-current', 'step');
    expect(steps).toHaveTextContent('Đã phát hiện (10:45:22)');
    expect(steps).toHaveTextContent('Đã gửi thông báo (10:45:25)');
    // Footer
    expect(within(d).getByRole('button', { name: 'Xác nhận cảnh báo' }).className).toContain('bg-danger-solid');
    expect(within(d).getByRole('link', { name: 'Xem MT-00128' })).toHaveAttribute('href', '/maintenance/MT-00128');
    expect(within(d).queryByRole('button', { name: 'Tạo yêu cầu bảo trì' })).toBeNull();
    expect(within(d).getByRole('button', { name: 'Đóng' })).toHaveFocus();
  });

  test('mở từ bảng → ?alert= trên URL; Esc đóng, bỏ ?alert=, trả focus nút "Xem chi tiết"', async () => {
    const user = userEvent.setup();
    renderAt('/alerts');
    const open = await screen.findByRole('button', { name: 'Xem chi tiết ALT-00127' });
    await user.click(open);
    expect(await screen.findByRole('dialog', { name: 'Cảnh báo rò rỉ Gas nhẹ' })).toBeInTheDocument();
    expect(where()).toContain('alert=ALT-00127');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(where()).not.toContain('alert=');
    expect(screen.getByRole('button', { name: 'Xem chi tiết ALT-00127' })).toHaveFocus();
  });

  test('cảnh báo không có tag, chiều "dưới ngưỡng": thang 0 → ngưỡng × 1.2, chữ đọc "dưới ngưỡng", khối thiết bị không có số trực tiếp', async () => {
    renderAt('/alerts?alert=ALT-00126');
    const d = await screen.findByRole('dialog', { name: 'Nhiệt độ máy hóa hơi thấp' });
    const meter = within(d).getByRole('meter');
    expect(meter).toHaveAttribute('aria-valuemax', '60');
    expect(meter).toHaveAttribute('aria-valuetext', '45°C, dưới ngưỡng 50°C');
    expect(within(d).getByText('Ngưỡng tối thiểu')).toBeInTheDocument();
    expect(within(d).queryByText(/Hiện tại:/)).toBeNull();
    expect(within(d).getByText('Chưa có số liệu trực tiếp')).toBeInTheDocument();
  });

  test('ALT-00112 (mức giảm nhanh – cấu hình gauge: false): không có thanh đo, chỉ hai ô số + câu giải thích', async () => {
    renderAt('/alerts?alert=ALT-00112&range=30d');
    const d = await screen.findByRole('dialog', { name: 'Mức bồn V-101 giảm nhanh bất thường' });
    expect(within(d).queryByRole('meter')).toBeNull();
    expect(within(d).getByText('Cảnh báo tốc độ thay đổi – không dùng thang đo ngưỡng.')).toBeInTheDocument();
    expect(within(d).getByText('-4.2')).toBeInTheDocument();
  });

  test('phân công từ drawer: KHÔNG tự xác nhận, ghi người phụ trách + nhật ký', async () => {
    const user = userEvent.setup();
    renderAt('/alerts?alert=ALT-00119');
    const d = await screen.findByRole('dialog', { name: 'Chênh áp lọc F-202 tăng dần' });
    await user.click(within(d).getByRole('button', { name: 'Phân công xử lý' }));
    const m = await screen.findByRole('dialog', { name: 'Phân công xử lý' });
    // Toàn bộ STAFF – kể cả trưởng ca (manager)
    expect(within(m).getByRole('radio', { name: /Hoàng Minh E/ })).toBeInTheDocument();
    await user.click(within(m).getByRole('radio', { name: /Trần Bình/ }));
    await user.click(within(m).getByRole('button', { name: 'Phân công' }));
    expect(screen.queryByRole('dialog', { name: 'Phân công xử lý' })).toBeNull();
    expect(within(d).getByText('Trần Bình')).toBeInTheDocument();
    expect(within(d).getByRole('button', { name: 'Xác nhận cảnh báo' })).toBeInTheDocument();
    expect(within(d).getByText(/Nhật ký \(3\)/)).toBeInTheDocument();
    expect(d).toHaveTextContent('Phân công xử lý cho Trần Bình – Vận hành A');
  });

  test('quy trình: xác nhận → tick hướng dẫn → đánh dấu đã xử lý bắt buộc ghi chú → Hoàn thành; tab + KPI cập nhật', async () => {
    const user = userEvent.setup();
    renderAt('/alerts?alert=ALT-00126');
    const d = await screen.findByRole('dialog', { name: 'Nhiệt độ máy hóa hơi thấp' });
    const tab = (name: RegExp) => screen.getByRole('tab', { name });
    const unackBefore = tab(/Chưa xác nhận/).textContent;
    const kpiBefore = kpis();

    await user.click(within(d).getByRole('button', { name: 'Xác nhận cảnh báo' }));
    expect(within(d).getByRole('button', { name: 'Đánh dấu đã xử lý' })).toBeInTheDocument();
    expect(within(d).queryByRole('button', { name: 'Xác nhận cảnh báo' })).toBeNull();
    expect(tab(/Chưa xác nhận/).textContent).not.toBe(unackBefore);
    const steps = within(d).getByRole('navigation', { name: 'Tiến trình xử lý ALT-00126' });
    expect(within(steps).getByText(/^Đang xử lý/).closest('li')).toHaveAttribute('aria-current', 'step');
    expect(steps).toHaveTextContent('Đã xác nhận');

    // Hướng dẫn mở khoá, tick lưu theo cảnh báo + lịch sử
    const step = within(d).getByRole('checkbox', { name: 'Kiểm tra nguồn nhiệt cấp cho E-101A' });
    await user.click(step);
    expect(step).toBeChecked();
    expect(d).toHaveTextContent('Đã làm: Kiểm tra nguồn nhiệt cấp cho E-101A');

    // Bắt buộc ghi chú
    await user.click(within(d).getByRole('button', { name: 'Đánh dấu đã xử lý' }));
    const note = within(d).getByRole('textbox', { name: 'Ghi chú xử lý' });
    expect(note).toHaveFocus();
    expect(note).toHaveAccessibleDescription(/Nhập ghi chú kết quả xử lý/);
    expect(within(d).getByRole('button', { name: 'Đánh dấu đã xử lý' })).toBeInTheDocument();

    // Ô có nội dung → dùng luôn khi đánh dấu
    await user.type(note, 'Đã tăng nhiệt cấp, nhiệt độ về 52 °C');
    await user.click(within(d).getByRole('button', { name: 'Đánh dấu đã xử lý' }));
    await waitFor(() => expect(within(d).getByText(/Cảnh báo đã xử lý xong/)).toBeInTheDocument());
    expect(within(d).getByText('Đã tăng nhiệt cấp, nhiệt độ về 52 °C')).toBeInTheDocument();
    expect(within(d).queryByRole('textbox')).toBeNull();
    expect(within(d).queryByRole('button', { name: /Phân công|Đổi người/ })).toBeNull();
    expect(kpis()).not.toBe(kpiBefore);
  });

  test('tạo yêu cầu bảo trì: modal mở TRÊN drawer, Esc chỉ đóng modal; tạo xong → "Xem MT-…" thay nút, không tạo trùng', async () => {
    const user = userEvent.setup();
    renderAt('/alerts?alert=ALT-00127');
    const d = await screen.findByRole('dialog', { name: 'Cảnh báo rò rỉ Gas nhẹ' });
    const createBtn = within(d).getByRole('button', { name: 'Tạo yêu cầu bảo trì' });
    await user.click(createBtn);
    expect(await screen.findByRole('dialog', { name: 'Tạo yêu cầu bảo trì' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Tạo yêu cầu bảo trì' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Cảnh báo rò rỉ Gas nhẹ' })).toBeInTheDocument();
    expect(createBtn).toHaveFocus();

    await user.click(createBtn);
    const m = await screen.findByRole('dialog', { name: 'Tạo yêu cầu bảo trì' });
    await user.click(within(m).getByRole('button', { name: /Tạo yêu cầu/ }));
    const link = await within(d).findByRole('link', { name: /^Xem MT-\d{5}$/ });
    expect(screen.queryByRole('dialog', { name: 'Tạo yêu cầu bảo trì' })).toBeNull();
    expect(link).toHaveFocus();
    expect(within(d).queryByRole('button', { name: 'Tạo yêu cầu bảo trì' })).toBeNull();
    expect(d).toHaveTextContent(`Tạo yêu cầu bảo trì ${link.textContent!.replace('Xem ', '')}`);
  });
});
