// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import type { AuthService, AuthState } from '@/api/auth';
import { AuthProvider } from '@/app/auth';
import { liveSimulator } from '@/data/live';
import AlertsPage from './AlertsPage';

/*
 * Drawer cảnh báo KHÍ GAS (loại `gas-leak`, ảnh ALT-00127): số live + "Lúc cảnh báo", mức theo bands, banner ESD (role="alert"
 * không đọc lặp), cảm biến theo khu, khoá "Đã xử lý" (modal chung), mất tín hiệu, yêu cầu hỗ trợ. Nguồn live mock dùng chung (GS-04 = 25).
 * File riêng → store cảnh báo riêng (không ảnh hưởng AlertsPage.test). Test đổi dữ liệu đặt sau.
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

function renderAt(url: string) {
  const router = createMemoryRouter([{ path: '/alerts', element: <AlertsPage /> }], { initialEntries: [url] });
  render(
    <AuthProvider service={service}>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}
const drawer = () => screen.findByRole('dialog', { name: 'Cảnh báo rò rỉ Gas nhẹ' });
const LONG = { timeout: 6000 };
const GAS_MODAL = 'Cập nhật xử lý cảnh báo rò rỉ khí';
/** Chờ modal lazy (khung chung, nặng) hiện ra: chạy cả bộ song song có lúc > 6 s – vẫn dưới testTimeout 30 s. */
const MODAL_WAIT = { timeout: 20000 };

// Modal "Cập nhật xử lý" là React.lazy (chunk riêng): nạp trước để lần mở đầu trong test không tốn thời gian
// biến đổi/tải module (chạy cả bộ song song có lúc > 6 s → findByRole hết giờ). Không đổi hành vi được kiểm.
beforeAll(async () => {
  await import('./AlertUpdateModal');
});

afterEach(() => {
  liveSimulator.setBase('GS-04', 25);
  liveSimulator.restore();
});

describe('drawer cảnh báo khí gas (ALT-00127)', () => {
  test('dữ liệu thật ALT-00127 (GS-04, Khu nạp xuất), số live + "Lúc cảnh báo", mức cấp 2, 4 chỉ số, cảm biến theo khu, chân theo cấu hình', async () => {
    renderAt('/alerts?alert=ALT-00127');
    const d = await drawer();
    expect(d).toHaveTextContent('Thiết bị: GS-04');
    expect(d).toHaveTextContent('Khu vực: Khu nạp xuất');
    expect(within(d).getByText('Lúc cảnh báo: 25% LEL')).toBeInTheDocument();
    const meter = await within(d).findByRole('meter', { name: 'Nồng độ khí so với các mức cảnh báo' });
    await waitFor(() => expect(meter.getAttribute('aria-valuetext')).toMatch(/^\d+(\.\d)?% LEL – Cảnh báo cấp 2$/));
    expect(meter).toHaveAttribute('aria-valuemax', '100');
    expect(within(d).getAllByText('Cảnh báo cấp 2').length).toBeGreaterThan(0);
    expect(within(d).getByText('40 (ESD)').className).toContain('text-danger-text');
    // 4 chỉ số
    expect(within(d).getByText('Giá trị trước đó').nextElementSibling).toHaveTextContent('14% LEL');
    expect(within(d).getByText('Mức tăng').nextElementSibling!.textContent).toMatch(/^↑\+\d+(\.\d)?% LEL$/);
    const overLabel = within(d).getByText('T/G vượt ngưỡng 20% LEL');
    expect(overLabel).toHaveAttribute('title', 'Thời gian nồng độ còn ≥ 20% LEL (ngưỡng của cảnh báo), tính từ lúc phát sinh.');
    expect(overLabel.nextElementSibling!.textContent).toMatch(/^[67] phút$/);
    expect(within(d).getByText('Trạng thái CB').nextElementSibling).toHaveTextContent('Online');
    // Banner cấp 2 – một vùng role="alert"
    const alerts = within(d).getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent('Quy trình Khẩn cấp (ESD). Nồng độ hiện tại đang ở mức cảnh báo cấp 2. Nếu đạt hoặc vượt 40% LEL');
    // Cảm biến trong khu: 4 dòng, GS-04 nổi, GS-03 8% → Bình thường (theo bands)
    const list = within(d).getByRole('list', { name: 'Cảm biến khí trong Khu nạp xuất' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows.map((r) => r.textContent?.slice(0, 5))).toEqual(['GS-01', 'GS-02', 'GS-03', 'GS-04']);
    expect(rows[2]).toHaveTextContent('Bình thường');
    expect(rows[3]).toHaveTextContent('GS-04 – cảm biến gây cảnh báo');
    // Hướng dẫn 7 mục theo ảnh (đã xác nhận → tick được), {nearbySensor} = GS-03
    expect(within(d).getAllByRole('checkbox')).toHaveLength(7);
    expect(within(d).getByRole('checkbox', { name: 'Đối chiếu với GS-03 và các cảm biến lân cận' })).not.toHaveAttribute('aria-disabled');
    // Tiến trình / Ghi chú thu gọn
    expect(within(d).getByRole('heading', { name: 'Tiến trình' }).closest('details')).not.toHaveAttribute('open');
    expect(within(d).getByRole('heading', { name: 'Ghi chú xử lý (0)' }).closest('details')).not.toHaveAttribute('open');
    // Chân: Cập nhật xử lý (info) + Yêu cầu hỗ trợ + Tạo yêu cầu bảo trì, KHÔNG có Phân công
    expect(within(d).getByRole('button', { name: 'Cập nhật xử lý' }).className).toContain('bg-info');
    expect(within(d).getByRole('button', { name: 'Yêu cầu hỗ trợ' })).toBeInTheDocument();
    expect(within(d).getByRole('button', { name: 'Tạo yêu cầu bảo trì' })).toBeInTheDocument();
    expect(within(d).queryByRole('button', { name: /Phân công|Đổi người/ })).toBeNull();
  });

  test('banner không đọc lặp khi số live đổi; vượt 40 → câu ESD (vùng alert mới)', async () => {
    renderAt('/alerts?alert=ALT-00127');
    const d = await drawer();
    await within(d).findByText(/Online/);
    const first = within(d).getByRole('alert');
    await act(() => new Promise((r) => setTimeout(r, 2300))); // một nhịp live
    expect(within(d).getByRole('alert')).toBe(first);
    act(() => liveSimulator.setBase('GS-04', 45));
    await waitFor(
      () => expect(within(d).getByRole('alert')).toHaveTextContent('Đã vượt ngưỡng ESD (40% LEL), thực hiện quy trình ESD và sơ tán ngay.'),
      LONG,
    );
    expect(within(d).getByRole('alert')).not.toBe(first);
    expect(within(d).getAllByText('ESD').length).toBeGreaterThan(0);
  });

  // Đổi có chủ đích (28/10/2026): modal gọn của gas bỏ – dùng khung chung "Cập nhật xử lý cảnh báo rò rỉ khí" (bám modal áp suất).
  test('"Cập nhật xử lý" (khung chung): thông số GS-04 + cảm biến cùng khu, 4 mục xác minh, mục tiêu 10% LEL; "Đã xử lý" khoá khi còn trên ngưỡng', async () => {
    const user = userEvent.setup();
    renderAt('/alerts?alert=ALT-00127');
    const d = await drawer();
    await within(d).findByText(/Online/);
    await user.click(within(d).getByRole('button', { name: 'Cập nhật xử lý' }));
    const m = await screen.findByRole('dialog', { name: GAS_MODAL }, MODAL_WAIT);
    const done = within(m).getByRole('radio', { name: /^Đã xử lý/ });
    // Vừa mở (chưa có số liệu) cũng khoá; số về → lý do nêu nồng độ hiện tại.
    expect(done).toHaveAttribute('aria-disabled', 'true');
    await waitFor(() => expect(done).toHaveAccessibleDescription(/Nồng độ hiện tại \d+(\.\d)?% LEL vẫn trên ngưỡng \(10% LEL\)/), LONG);
    const readings = within(m).getByRole('group', { name: 'Thông số trước và sau xử lý' });
    expect(readings).toHaveTextContent('Nồng độ GS-04');
    expect(readings).toHaveTextContent('Nồng độ GS-01');
    expect(readings).toHaveTextContent('Giới hạn: 10% LEL');
    const ver = within(m).getByRole('group', { name: 'Kết quả xác minh (Chọn nhiều)' });
    expect(
      within(ver)
        .getAllByRole('checkbox')
        .map((c) => c.closest('label')?.textContent),
    ).toEqual(['Đã xác định nguồn rò rỉ', 'Đã cách ly nguồn rò rỉ', 'Khu vực đã thông gió', 'Cảm biến cùng khu bình thường']);
    expect(within(m).getByRole('textbox', { name: /Giá trị mục tiêu/ })).toHaveValue('10');
    await user.click(done);
    expect(within(m).getByRole('radio', { name: 'Đang kiểm tra' })).toHaveAttribute('aria-checked', 'true');
    await user.click(within(m).getByRole('button', { name: 'Lưu cập nhật' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: GAS_MODAL })).toBeNull());
    expect(within(d).getByRole('heading', { name: 'Ghi chú xử lý (1)' })).toBeInTheDocument();
    expect(d).toHaveTextContent('Đang xử lý');
  });

  test('yêu cầu hỗ trợ: trưởng ca / an toàn từ STAFF, lý do bắt buộc → người phối hợp + lịch sử; không giả vờ đã gửi', async () => {
    const user = userEvent.setup();
    renderAt('/alerts?alert=ALT-00127');
    const d = await drawer();
    await user.click(within(d).getByRole('button', { name: 'Yêu cầu hỗ trợ' }));
    const m = await screen.findByRole('dialog', { name: 'Yêu cầu hỗ trợ' });
    expect(within(m).getByRole('radio', { name: /Trần Thị B/ })).toBeInTheDocument(); // An toàn – HSE
    expect(within(m).getByRole('radio', { name: /Hoàng Minh E/ })).toBeInTheDocument(); // trưởng ca
    expect(within(m).queryByRole('radio', { name: /Lê Thị C/ })).toBeNull();
    expect(m).toHaveTextContent('chưa gửi được – chờ backend');
    await user.click(within(m).getByRole('radio', { name: /Trần Thị B/ }));
    await user.click(within(m).getByRole('button', { name: 'Gửi yêu cầu hỗ trợ' }));
    expect(within(m).getByText('Nhập lý do cần hỗ trợ.')).toBeInTheDocument();
    await user.type(within(m).getByRole('textbox', { name: /Lý do/ }), 'Cần khoanh vùng');
    await user.click(within(m).getByRole('button', { name: 'Gửi yêu cầu hỗ trợ' }));
    expect(screen.queryByRole('dialog', { name: 'Yêu cầu hỗ trợ' })).toBeNull();
    expect(d).toHaveTextContent('Yêu cầu hỗ trợ: Trần Thị B – Cần khoanh vùng');
  });

  // Đổi có chủ đích (28/10/2026): đóng qua khung chung → Đã xử lý (chờ xác nhận đóng), không còn Hoàn thành ngay.
  test('mất tín hiệu: "Mất tín hiệu" (không số cũ), "Đã xử lý" chỉ khi nhập số đo lại < ngưỡng → chờ đóng + nồng độ sau xử lý', async () => {
    const user = userEvent.setup();
    renderAt('/alerts?alert=ALT-00127');
    const d = await drawer();
    await within(d).findByText(/Online/);
    act(() => liveSimulator.setBad(['GS-04']));
    await waitFor(() => expect(within(d).getByText('Trạng thái CB').nextElementSibling).toHaveTextContent('Mất tín hiệu'));
    expect(within(d).getByRole('meter').getAttribute('aria-valuetext')).toBe('Mất tín hiệu, giá trị lúc cảnh báo 25% LEL');
    // Vạch đổi kiểu: nét đứt màu chữ phụ + nhãn "Lúc CB 25%"
    const chip = within(d).getByText('Lúc CB 25%');
    expect(chip.className).toContain('border-dashed');
    expect(chip.previousElementSibling!.className).toContain('border-dashed');
    const row = within(within(d).getByRole('list', { name: /Cảm biến khí/ })).getAllByRole('listitem')[3]!;
    expect(row).toHaveTextContent('Mất tín hiệu');
    expect(row).not.toHaveTextContent('% LEL');

    await user.click(within(d).getByRole('button', { name: 'Cập nhật xử lý' }));
    const m = await screen.findByRole('dialog', { name: GAS_MODAL }, MODAL_WAIT);
    const done = () => within(m).getByRole('radio', { name: /^Đã xử lý/ });
    // Mất tín hiệu → bắt buộc số đo lại (nguồn mặc định "Cả hai" có máy đo cầm tay).
    await waitFor(() => expect(done()).toHaveAccessibleDescription(/nhập nồng độ đo lại tại chỗ \(phải dưới 10% LEL\)/), LONG);
    const after = within(m).getByRole('textbox', { name: 'Nồng độ GS-04 sau xử lý' });
    await user.type(after, '12{Enter}');
    await waitFor(() => expect(done()).toHaveAccessibleDescription(/Nồng độ đo lại 12% LEL vẫn trên ngưỡng \(10% LEL\)/));
    await user.clear(after);
    await user.type(after, '4{Enter}');
    await waitFor(() => expect(done()).not.toHaveAttribute('aria-disabled'));
    await user.click(done());
    await user.type(within(m).getByRole('textbox', { name: /Nguyên nhân xử lý/ }), 'Khớp nối họng nạp lỏng');
    await user.type(within(m).getByRole('textbox', { name: /Nội dung đã xử lý/ }), 'Đo tay tại họng nạp, siết lại khớp nối');
    await user.click(within(m).getByRole('button', { name: 'Lưu cập nhật' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: GAS_MODAL })).toBeNull());
    expect(d).toHaveTextContent('Đã xử lý – nồng độ sau xử lý 4% LEL (Cả hai)');
    expect(d).toHaveTextContent(/Đã xử lý lúc \d{2}:\d{2}, chờ xác nhận đóng\./);
    expect(d).toHaveTextContent(/Đang theo dõi đến \d{2}:\d{2}, mục tiêu < 10% LEL/);
    expect(within(d).queryByRole('button', { name: 'Cập nhật xử lý' })).toBeNull();
    expect(within(d).getByRole('button', { name: 'Xác nhận đóng cảnh báo' })).toBeInTheDocument();
  });
});
