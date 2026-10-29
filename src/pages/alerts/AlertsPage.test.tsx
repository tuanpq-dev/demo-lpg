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
    // Hướng dẫn = hạng mục kiểm tra dùng chung modal cập nhật xử lý (28/10/2026): chữ theo ảnh modal ("Kiểm tra van an toàn PSV-101").
    const locked = within(d).getByRole('checkbox', { name: 'Kiểm tra van an toàn PSV-101' });
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
    // Đổi có chủ đích: modal mới "Phân công xử lý cảnh báo" (ảnh thiết kế), nút "Xác nhận phân công".
    const m = await screen.findByRole('dialog', { name: 'Phân công xử lý cảnh báo' });
    // Toàn bộ STAFF – kể cả trưởng ca (manager)
    expect(within(m).getByRole('radio', { name: /Hoàng Minh E/ })).toBeInTheDocument();
    await user.click(within(m).getByRole('radio', { name: /Trần Bình/ }));
    await user.click(within(m).getByRole('button', { name: 'Xác nhận phân công' }));
    expect(screen.queryByRole('dialog', { name: 'Phân công xử lý cảnh báo' })).toBeNull();
    expect(within(d).getByText('Trần Bình')).toBeInTheDocument();
    expect(within(d).getByRole('button', { name: 'Xác nhận cảnh báo' })).toBeInTheDocument();
    expect(within(d).getByText(/Nhật ký \(3\)/)).toBeInTheDocument();
    expect(d).toHaveTextContent('Phân công xử lý cho Trần Bình – Vận hành A');
  });

  test('phân công hàng loạt qua modal: bỏ qua dòng Hoàn thành, dòng của người khác = đổi người cần lý do chung, liệt kê mã trước khi xác nhận', async () => {
    const user = userEvent.setup();
    // Lọc cho 3 dòng nằm cùng trang 1: ALT-00128 chưa giao · ALT-00125 đang giao Trần Văn B · ALT-00124 đã hoàn thành
    renderAt('/alerts?q=ALT-0012');
    for (const id of ['ALT-00128', 'ALT-00125', 'ALT-00124']) await user.click(await screen.findByRole('checkbox', { name: `Chọn hàng ${id}` }));
    await user.click(screen.getByRole('button', { name: 'Phân công… (2)' }));
    const m = await screen.findByRole('dialog', { name: 'Phân công xử lý cảnh báo' });
    expect(within(m).getByText('Đã chọn 3 cảnh báo')).toBeInTheDocument();
    expect(within(m).queryByRole('button', { name: 'Nháp' })).toBeNull();
    await user.click(within(m).getByRole('radio', { name: /Võ Thị F/ }));
    expect(within(m).getByRole('list', { name: 'Cảnh báo sẽ đổi người' })).toHaveTextContent('ALT-00125: Trần Văn B → Võ Thị F');
    expect(m).toHaveTextContent('ALT-00124 (đã hoàn thành)');
    const confirm = within(m).getByRole('button', { name: 'Xác nhận phân công' });
    expect(confirm).toHaveAttribute('aria-disabled', 'true');
    await user.click(confirm);
    expect(screen.getByRole('dialog', { name: 'Phân công xử lý cảnh báo' })).toBeInTheDocument();
    await user.type(within(m).getByRole('textbox', { name: /Lý do đổi người \(chung\)/ }), 'Gom việc khu lọc');
    await user.click(confirm);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Phân công xử lý cảnh báo' })).toBeNull());
    expect(await screen.findByText(/^Đã phân công 2/)).toHaveTextContent('Đã phân công 2 (đổi người 1) · bỏ qua 1 (1 đã hoàn thành) – người phụ trách: Võ Thị F.');
    // Không tự xác nhận: ALT-00128 vẫn Chưa xác nhận.
    await user.click(screen.getByRole('button', { name: 'Xem chi tiết ALT-00128' }));
    const d = await screen.findByRole('dialog', { name: 'Áp suất bồn V-101 vượt ngưỡng' });
    expect(within(d).getByRole('button', { name: 'Xác nhận cảnh báo' })).toBeInTheDocument();
    expect(d).toHaveTextContent('Võ Thị F');
  });

  // Đổi có chủ đích (28/10/2026): "Đánh dấu đã xử lý" → Đã xử lý (tab "Chờ đóng"); Hoàn thành chỉ qua "Xác nhận đóng cảnh báo".
  test('quy trình: xác nhận → tick hướng dẫn → đánh dấu đã xử lý bắt buộc ghi chú → Chờ đóng; đóng bị chặn khi còn cảnh báo mở cùng khu → tiếp tục theo dõi', async () => {
    const user = userEvent.setup();
    renderAt('/alerts?alert=ALT-00126');
    const d = await screen.findByRole('dialog', { name: 'Nhiệt độ máy hóa hơi thấp' });
    const tab = (name: RegExp) => screen.getByRole('tab', { name });
    const unackBefore = tab(/Chưa xác nhận/).textContent;
    const pendingClose = () => Number(tab(/Chờ đóng/).textContent!.replace(/\D/g, ''));
    const pendingBefore = pendingClose();
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
    await waitFor(() => expect(within(d).getByText(/Đã xử lý lúc \d{2}:\d{2}, chờ xác nhận đóng/)).toBeInTheDocument());
    expect(within(d).getByText('Đã tăng nhiệt cấp, nhiệt độ về 52 °C')).toBeInTheDocument();
    expect(within(steps).getByText(/^Hoàn thành/).closest('li')).toHaveAttribute('aria-current', 'step');
    expect(pendingClose()).toBe(pendingBefore + 1);
    expect(kpis()).not.toBe(kpiBefore);

    // Xác nhận đóng: Trạm hóa hơi còn FIR-00018 (Chưa xác nhận) → điều kiện 3 sai, có link; nút đóng khoá
    await user.click(within(d).getByRole('button', { name: 'Xác nhận đóng cảnh báo' }));
    const m = await screen.findByRole('dialog', { name: 'Xác nhận đóng cảnh báo' }, { timeout: 6000 });
    const related = within(m).getByRole('checkbox', { name: /Không còn cảnh báo liên quan đang hoạt động/ });
    expect(related).not.toBeChecked();
    expect(related).toHaveAttribute('aria-disabled', 'true');
    expect(related).toHaveAccessibleDescription(/FIR-00018/);
    expect(within(m).getByRole('link', { name: 'FIR-00018' })).toHaveAttribute('href', '/alerts?alert=FIR-00018');
    await user.type(within(m).getByRole('textbox', { name: /Ghi chú kết luận/ }), 'Ổn định');
    const closeBtn = within(m).getByRole('button', { name: 'Xác nhận đóng cảnh báo' });
    expect(closeBtn).toHaveAttribute('aria-disabled', 'true');
    await user.click(closeBtn);
    expect(screen.getByRole('dialog', { name: 'Xác nhận đóng cảnh báo' })).toBeInTheDocument();
    // Loại không có modal cập nhật → mặc định "Không theo dõi": Tiếp tục theo dõi khoá đến khi chọn thời gian
    expect(within(m).getByRole('button', { name: 'Tiếp tục theo dõi' })).toHaveAttribute('aria-disabled', 'true');
    await user.click(within(m).getByRole('button', { name: /Thời gian theo dõi sau xử lý/ }));
    await user.click(screen.getByRole('option', { name: '30 phút' }));
    await user.click(within(m).getByRole('button', { name: 'Tiếp tục theo dõi' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Xác nhận đóng cảnh báo' })).toBeNull());
    expect(within(d).getByText(/^Đang theo dõi đến \d{2}:\d{2}\.$/)).toBeInTheDocument();
    expect(d).toHaveTextContent('Tiếp tục theo dõi đến');
    expect(screen.getByRole('table', { name: /cảnh báo/i })).toHaveTextContent(/Đang theo dõi đến \d{2}:\d{2}/);
  });

  test('đóng hàng loạt: chỉ dòng Đã xử lý đủ 3 điều kiện, ghi chú chung, báo "Đã đóng X · bỏ qua N (lý do)"; không còn "Đánh dấu hoàn thành"', async () => {
    const user = userEvent.setup();
    renderAt('/alerts?range=7d&tab=resolved');
    // Tab "Chờ đóng": ALT-00120 (Khu bơm – không còn cảnh báo mở) + ALT-00116 (Khu bồn LPG – còn ALT-00128… đang mở)
    expect(screen.getByRole('tab', { name: /Chờ đóng/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('table', { name: /cảnh báo/i })).toHaveTextContent('Đến giờ kiểm tra lại'); // ALT-00116 hết giờ theo dõi
    await user.click(await screen.findByRole('checkbox', { name: 'Chọn hàng ALT-00120' }));
    await user.click(screen.getByRole('checkbox', { name: 'Chọn hàng ALT-00116' }));
    expect(screen.queryByRole('button', { name: /Đánh dấu hoàn thành/ })).toBeNull();
    const bulk = await screen.findByRole('button', { name: 'Đóng cảnh báo (1)' }, { timeout: 6000 });
    await user.click(bulk);
    const m = await screen.findByRole('dialog', { name: 'Đóng cảnh báo' });
    expect(m).toHaveTextContent('Sẽ bỏ qua 1 (1 chưa đủ điều kiện hệ thống).');
    await user.click(within(m).getByRole('button', { name: 'Đóng 1 cảnh báo' }));
    expect(within(m).getByText('Nhập ghi chú kết luận chung cho cả lô.')).toBeInTheDocument();
    await user.type(within(m).getByRole('textbox', { name: /Ghi chú kết luận/ }), 'Đã kiểm tra ổn định');
    await user.click(within(m).getByRole('button', { name: 'Đóng 1 cảnh báo' }));
    expect(await screen.findByText('Đã đóng 1 · bỏ qua 1 (1 chưa đủ điều kiện hệ thống)')).toBeInTheDocument();
    // ALT-00120 rời tab Chờ đóng → mở từ tab Đã hoàn thành
    await user.click(screen.getByRole('tab', { name: /Đã hoàn thành/ }));
    await user.click(await screen.findByRole('button', { name: 'Xem chi tiết ALT-00120' }));
    const d = await screen.findByRole('dialog', { name: 'Rung động bơm P-101A vượt mức' });
    expect(d).toHaveTextContent('Hoàn thành');
    expect(d).toHaveTextContent('Xác nhận đóng cảnh báo: Đã kiểm tra ổn định');
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
