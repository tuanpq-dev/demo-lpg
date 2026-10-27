// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import type { AuthService, AuthState } from '@/api/auth';
import { AuthProvider } from '@/app/auth';
import { liveSimulator } from '@/data/live';
import { VAPORIZER_AREA_TAGS as T } from '@/features/live/tags';
import AlertsPage from './AlertsPage';

/*
 * Drawer BÁO CHÁY (loại `fire`, ảnh FIR-00018): panel (đầu báo tách thiết bị/báo động, tín hiệu liên quan, thiết bị trong khu),
 * xác nhận chéo, quy trình khẩn cấp (modal trên drawer), "Cập nhật xử lý" 3 kết quả + khoá đóng khi còn báo động, mất tín hiệu →
 * kiểm tra tại chỗ, báo động giả → resolution + "Tạo yêu cầu bảo trì" điền sẵn. File riêng → store cảnh báo riêng.
 * Các test dùng chung store theo thứ tự (Chưa xác nhận → Đang xử lý → Hoàn thành).
 */

const state: AuthState = { status: 'authenticated', user: { id: 'u1', email: 'op@example.com', name: 'Vận hành A', role: 'operator', status: 'active' } };
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
const TITLE = 'Phát hiện tín hiệu báo cháy tại trạm hóa hơi';
const drawer = () => screen.findByRole('dialog', { name: TITLE });
const LONG = { timeout: 6000 };

afterEach(() => {
  liveSimulator.setBase(T.heatAlarm, 'alarm');
  liveSimulator.setBase(T.smokeAlarm, 'normal');
  liveSimulator.setBase(T.callPoint, 'idle');
  liveSimulator.setBase(T.gas, 6);
  liveSimulator.restore();
});

describe('drawer báo cháy (FIR-00018)', () => {
  test('panel theo ảnh: đầu báo tách báo động/thiết bị, tín hiệu liên quan, thiết bị trong khu (không lặp GS), chân đúng ảnh', async () => {
    renderAt('/alerts?alert=FIR-00018');
    const d = await drawer();
    expect(d).toHaveTextContent('Khu vực: Trạm hóa hơi (FZ-02)');
    expect(d).toHaveTextContent('Người phụ trách: Trực ca (chưa phân công cá nhân)');
    const info = within(d).getByRole('heading', { name: 'Thông tin báo cháy' }).parentElement!;
    await waitFor(() => expect(within(info).getByText('Nhiệt độ ghi nhận').nextElementSibling!.textContent).toMatch(/^6[78](\.\d)?°CLúc cảnh báo: 68°C$/));
    expect(within(info).getByText('Loại tín hiệu').nextElementSibling).toHaveTextContent('Đầu báo nhiệt');
    expect(within(info).getByText('Trạng thái đầu báo').nextElementSibling).toHaveTextContent('Đang báo độngThiết bị:Trực tuyến');
    expect(within(info).getByText('Cập nhật cuối').nextElementSibling!.textContent).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(within(d).queryByText('Hoạt động')).toBeNull();
    // Tín hiệu liên quan: GS-05 (khu hóa hơi), khói, nút nhấn
    const sig = within(d).getByRole('heading', { name: 'Tín hiệu liên quan' }).parentElement!;
    expect(within(sig).getByText('GS-05 (Gas Sensor)').nextElementSibling!.textContent).toMatch(/^[56](\.\d)?% LEL - Bình thường$/);
    expect(within(sig).getByText('Đầu báo khói SD-02').nextElementSibling).toHaveTextContent('Bình thường');
    expect(within(sig).getByText('Nút nhấn khẩn cấp').nextElementSibling).toHaveTextContent('Chưa kích hoạt');
    // Thiết bị liên quan: chỉ máy hóa hơi; nhiệt độ máy (TT-201) ≠ nhiệt độ đầu báo; không có cảm biến gas
    const eq = within(d).getByRole('list', { name: 'Thiết bị trong Trạm hóa hơi' });
    const rows = within(eq).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toMatch(/^Máy hóa hơi E-101A4\d(\.\d)?°CĐang hoạt động$/);
    expect(rows[1]).toHaveTextContent('Máy hóa hơi E-101BSẵn sàngDự phòng');
    expect(within(eq).queryByText(/GS-0/)).toBeNull();
    // Không banner khi chỉ có đầu báo nhiệt
    expect(within(d).queryByRole('alert')).toBeNull();
    // 5 bước hướng dẫn theo ảnh, khoá tới khi xác nhận
    const boxes = within(d).getAllByRole('checkbox');
    expect(boxes).toHaveLength(5);
    expect(within(d).getByRole('checkbox', { name: 'Xác minh vị trí cháy qua camera và trực tiếp' })).toHaveAttribute('aria-disabled', 'true');
    // Tiến trình + Ghi chú mở như ảnh (không thu gọn)
    expect(within(d).getByRole('heading', { name: 'Tiến trình' }).closest('details')).toBeNull();
    // Chân: Xác nhận (danger-solid) + Phân công + Xem quy trình; KHÔNG Tạo yêu cầu bảo trì
    expect(within(d).getByRole('button', { name: 'Xác nhận cảnh báo' }).className).toContain('bg-danger-solid');
    expect(within(d).getByRole('button', { name: 'Phân công xử lý' })).toBeInTheDocument();
    expect(within(d).getByRole('button', { name: 'Xem quy trình khẩn cấp' })).toBeInTheDocument();
    expect(within(d).queryByRole('button', { name: 'Tạo yêu cầu bảo trì' })).toBeNull();
  });

  test('"Xem quy trình khẩn cấp": modal trên drawer, nhãn bản nháp, 114 + danh bạ chờ khách cung cấp; Esc trả focus', async () => {
    const user = userEvent.setup();
    renderAt('/alerts?alert=FIR-00018');
    const d = await drawer();
    const btn = within(d).getByRole('button', { name: 'Xem quy trình khẩn cấp' });
    await user.click(btn);
    const m = await screen.findByRole('dialog', { name: 'Quy trình ứng phó cháy' });
    expect(m).toHaveTextContent('Bản nháp, cần bộ phận An toàn duyệt');
    expect(within(m).getByRole('link', { name: 'Gọi Cứu hỏa 114' })).toHaveAttribute('href', 'tel:114');
    expect(within(m).getAllByText('Chờ khách cung cấp')).toHaveLength(3);
    expect(within(m).getAllByRole('link')).toHaveLength(1);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Quy trình ứng phó cháy' })).toBeNull());
    expect(screen.getByRole('dialog', { name: TITLE })).toBeInTheDocument();
    expect(btn).toHaveFocus();
  });

  test('xác nhận chéo: khói báo động → banner role="alert"; nút nhấn kích hoạt → ghi rõ', async () => {
    renderAt('/alerts?alert=FIR-00018');
    const d = await drawer();
    liveSimulator.setBase(T.smokeAlarm, 'alarm');
    const banner = await within(d).findByRole('alert', {}, LONG);
    expect(banner).toHaveTextContent('Nhiều tín hiệu cùng báo, nguy cơ cháy cao. Đầu báo khói SD-02 đang báo động.');
    liveSimulator.setBase(T.callPoint, 'activated');
    await waitFor(() => expect(within(d).getByRole('alert')).toHaveTextContent('Nút nhấn khẩn cấp đã được kích hoạt · Đầu báo khói SD-02 đang báo động'), LONG);
    expect(within(d).getAllByRole('alert')).toHaveLength(1);
  }, 15_000);

  test('Cập nhật xử lý: 3 kết quả, ghi chú bắt buộc, khoá đóng khi còn báo động, mất tín hiệu → kiểm tra tại chỗ, báo động giả → resolution + tạo yêu cầu điền sẵn', async () => {
    const user = userEvent.setup();
    renderAt('/alerts?alert=FIR-00018');
    let d = await drawer();
    await user.click(within(d).getByRole('button', { name: 'Xác nhận cảnh báo' }));
    d = await drawer();
    await user.click(await within(d).findByRole('button', { name: 'Cập nhật xử lý' }));
    let m = await screen.findByRole('dialog', { name: 'Cập nhật xử lý' });
    const group = within(m).getByRole('radiogroup', { name: 'Kết quả xử lý' });
    expect(within(group).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Tiếp tục xử lý', 'Đã xử lý sự cố', 'Báo động giả']);
    // Còn báo động → 2 ô đóng khoá + lý do
    await waitFor(() => expect(within(group).getByRole('radio', { name: 'Đã xử lý sự cố' })).toHaveAccessibleDescription('Đầu báo HD-02 vẫn đang báo động – chỉ đóng khi đầu báo đã phục hồi.'));
    expect(within(group).getByRole('radio', { name: 'Báo động giả' })).toHaveAttribute('aria-disabled', 'true');
    // Tiếp tục: ghi chú bắt buộc
    await user.click(within(m).getByRole('button', { name: 'Lưu cập nhật' }));
    expect(within(m).getByText('Nhập ghi chú cập nhật xử lý.')).toBeInTheDocument();
    await user.type(within(m).getByRole('textbox', { name: /Ghi chú/ }), 'Đã cử người kiểm tra');
    await user.click(within(m).getByRole('button', { name: 'Lưu cập nhật' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Cập nhật xử lý' })).toBeNull());
    d = await drawer();
    expect(d).toHaveTextContent('Đã cử người kiểm tra');
    expect(d).toHaveTextContent('Đang xử lý');

    // Mất tín hiệu đầu báo → đóng được nhưng phải xác nhận kiểm tra tại chỗ
    liveSimulator.setBad([T.heatAlarm]);
    await user.click(within(d).getByRole('button', { name: 'Cập nhật xử lý' }));
    m = await screen.findByRole('dialog', { name: 'Cập nhật xử lý' });
    await waitFor(() => expect(within(m).getByRole('radio', { name: 'Báo động giả' })).not.toHaveAttribute('aria-disabled'), LONG);
    await user.click(within(m).getByRole('radio', { name: 'Báo động giả' }));
    await user.type(within(m).getByRole('textbox', { name: /Ghi chú/ }), 'Camera không thấy khói, hơi nóng từ ống xả');
    const submit = within(m).getByRole('button', { name: 'Xác nhận báo động giả' });
    expect(submit).toHaveAttribute('aria-disabled', 'true');
    expect(submit).toHaveAccessibleDescription('Đầu báo HD-02 mất tín hiệu – xác nhận đã kiểm tra tại chỗ trước khi đóng.');
    await user.click(submit);
    expect(screen.getByRole('dialog', { name: 'Cập nhật xử lý' })).toBeInTheDocument();
    await user.click(within(m).getByRole('checkbox', { name: 'Đã kiểm tra tại chỗ: không còn cháy, đầu báo HD-02 đã phục hồi' }));
    await user.click(within(m).getByRole('button', { name: 'Xác nhận báo động giả' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Cập nhật xử lý' })).toBeNull());

    // Hoàn thành – báo động giả: nhật ký ghi căn cứ; nút tạo yêu cầu kiểm tra đầu báo
    d = await drawer();
    expect(d).toHaveTextContent(/Đã đóng – báo động giả lúc \d{2}:\d{2}\./);
    expect(d).toHaveTextContent('Báo động giả (đầu báo HD-02 mất tín hiệu – đã kiểm tra tại chỗ): Camera không thấy khói');
    await user.click(within(d).getByRole('button', { name: 'Tạo yêu cầu bảo trì' }));
    const create = await screen.findByRole('dialog', { name: 'Tạo yêu cầu bảo trì' });
    expect(within(create).getByRole('textbox', { name: /Tên yêu cầu/ })).toHaveValue('Kiểm tra đầu báo HD-02');
  }, 30_000);
});
