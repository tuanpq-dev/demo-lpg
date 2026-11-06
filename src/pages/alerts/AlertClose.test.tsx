// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router-dom';
import type { AuthService, AuthState } from '@/api/auth';
import { AuthProvider } from '@/app/auth';
import { liveSimulator } from '@/data/live';
import { alertRecords } from '@/mocks/alerts';
import type { AlertRecord } from '@/features/alerts/types';
import AlertsPage from './AlertsPage';
import AlertCloseModal from './AlertCloseModal';

/*
 * Modal "Xác nhận đóng cảnh báo" (ảnh scratch/figma-ref/alert-close-modal-*.png, 28/10/2026): mở từ drawer khi Đã xử lý,
 * kết quả kỹ thuật chỉ đọc, 3 điều kiện hệ thống tự tick / khoá kèm lý do, ghi chú kết luận bắt buộc khi đóng, người đóng mức
 * Nghiêm trọng, tiếp tục theo dõi + hết giờ. File riêng → store cảnh báo riêng.
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
const MODAL = 'Xác nhận đóng cảnh báo';
const LONG = { timeout: 6000 };

afterEach(() => {
  liveSimulator.setBase('PT-101', 9.2);
  liveSimulator.restore();
});

describe('xác nhận đóng cảnh báo từ drawer', () => {
  test('ALT-00120 (Chờ đóng): kết quả kỹ thuật chỉ đọc, 3 điều kiện hệ thống tự tick, ghi chú bắt buộc → Hoàn thành + người đóng', async () => {
    const user = userEvent.setup();
    renderAt('/alerts?tab=resolved&alert=ALT-00120');
    const d = await screen.findByRole('dialog', { name: 'Rung động bơm P-101A vượt mức' });
    expect(d).toHaveTextContent(/Đã xử lý lúc \d{2}:\d{2}, chờ xác nhận đóng/);
    const steps = within(d).getByRole('navigation', { name: 'Tiến trình xử lý ALT-00120' });
    expect(steps).toHaveTextContent('Đã xử lý');
    expect(within(steps).getByText(/^Hoàn thành/).closest('li')).toHaveAttribute('aria-current', 'step');
    await user.click(within(d).getByRole('button', { name: MODAL }));
    const m = await screen.findByRole('dialog', { name: MODAL }, LONG);
    expect(m).toHaveAccessibleDescription('Kiểm tra kết quả xử lý và xác nhận kết thúc cảnh báo ALT-00120');
    expect(m).toHaveTextContent('ALT-00120: Rung động bơm P-101A vượt mức');
    expect(m).toHaveTextContent('Người xử lý' + 'Nguyễn Văn A');
    expect(within(m).getByRole('region', { name: 'Kết quả kỹ thuật' })).toHaveTextContent('Nguyên nhân:Bu lông chân đế lỏng');
    // 3 điều kiện hệ thống: đạt → tick sẵn, chỉ đọc (bấm không bỏ được)
    const sys = within(m).getAllByRole('checkbox', { name: /hệ thống kiểm tra/ });
    expect(sys).toHaveLength(3);
    for (const c of sys) {
      expect(c).toBeChecked();
      expect(c).toHaveAttribute('aria-readonly', 'true');
    }
    await user.click(sys[0]!);
    expect(sys[0]).toBeChecked();
    // 2 mục tick tay, không bắt buộc
    const manual = within(m).getByRole('checkbox', { name: 'Nhật ký vận hành đã được cập nhật' });
    expect(manual).not.toBeChecked();
    await user.click(manual);
    expect(manual).toBeChecked();
    // Ghi chú kết luận bắt buộc khi đóng
    const closeBtn = within(m).getByRole('button', { name: MODAL });
    expect(closeBtn).toHaveAttribute('aria-disabled', 'true');
    expect(closeBtn).toHaveAccessibleDescription(/Nhập ghi chú kết luận/);
    await user.click(closeBtn); // khoá: không đóng
    expect(screen.getByRole('dialog', { name: MODAL })).toBeInTheDocument();
    await user.type(within(m).getByRole('textbox', { name: /Ghi chú kết luận/ }), 'Rung ổn định 3.2 mm/s');
    expect(closeBtn).not.toHaveAttribute('aria-disabled');
    await user.click(closeBtn);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: MODAL })).toBeNull());
    expect(d).toHaveTextContent(/Cảnh báo đã hoàn thành lúc \d{2}:\d{2} – Vận hành A\./);
    expect(d).toHaveTextContent('Xác nhận đóng cảnh báo: Rung ổn định 3.2 mm/s');
    expect(within(d).queryByRole('button', { name: MODAL })).toBeNull();
  });

  test('ALT-00116 (Nghiêm trọng, hết giờ theo dõi): chip "Đến giờ kiểm tra lại"; còn cảnh báo mở cùng khu → khoá + link; Tiếp tục theo dõi (điền sẵn 60 phút) → hết chip', async () => {
    const user = userEvent.setup();
    renderAt('/alerts?range=7d&tab=resolved&alert=ALT-00116');
    const d = await screen.findByRole('dialog', { name: 'Van an toàn PSV-101 kích hoạt' });
    expect(within(d).getAllByText('Đến giờ kiểm tra lại').length).toBeGreaterThan(0);
    await user.click(within(d).getByRole('button', { name: MODAL }));
    const m = await screen.findByRole('dialog', { name: MODAL }, LONG);
    const related = within(m).getByRole('checkbox', { name: /Không còn cảnh báo liên quan đang hoạt động/ });
    expect(related).toHaveAttribute('aria-disabled', 'true');
    expect(within(m).getByRole('link', { name: 'ALT-00128' })).toBeInTheDocument();
    // Người xử lý Phạm Văn D ≠ người đóng → không có cảnh báo người đóng
    expect(m).not.toHaveTextContent('người đóng phải khác người xử lý');
    // Thời gian theo dõi điền sẵn từ dữ liệu (60 phút), một giá trị
    expect(within(m).getByRole('button', { name: /Thời gian theo dõi sau xử lý/ })).toHaveTextContent('1 Giờ');
    // Ghi chú không bắt buộc khi Tiếp tục theo dõi
    await user.click(within(m).getByRole('button', { name: 'Tiếp tục theo dõi' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: MODAL })).toBeNull());
    expect(within(d).queryByText('Đến giờ kiểm tra lại')).toBeNull();
    expect(within(d).getByText(/^Đang theo dõi đến \d{2}:\d{2}\.$/)).toBeInTheDocument();
    expect(d).toHaveTextContent('Đã xử lý'); // vẫn chờ đóng
  });
});

describe('modal đóng – người đóng mức Nghiêm trọng', () => {
  const rec: AlertRecord = {
    ...alertRecords.find((a) => a.id === 'ALT-00128')!,
    status: 'resolved',
    assignee: 'Vận hành A',
    resolvedBy: 'Vận hành A',
    resolvedAt: new Date().toISOString(),
    cause: 'Trôi cảm biến',
    actionTaken: 'Đã vệ sinh cảm biến và xác minh thủ công.',
    readings: { source: 'both', at: new Date().toISOString(), rows: [{ id: 'pressure', before: 11.8, after: 9.8 }] },
    followUp: { minutes: 120, until: new Date(Date.now() + 7_200_000).toISOString(), target: 10, unit: 'bar', owner: 'Vận hành A' },
  };
  const renderModal = (actor: string, onConfirmClose = vi.fn(() => ({ ok: true as const, record: rec }))) => {
    render(
      <MemoryRouter>
        <AlertCloseModal alert={rec} allAlerts={[rec]} actor={actor} onClose={() => {}} onConfirmClose={onConfirmClose} onMonitor={() => ({ ok: true, record: rec })} />
      </MemoryRouter>,
    );
    return { m: screen.getByRole('dialog', { name: MODAL }), onConfirmClose };
  };

  test('như ảnh: 11.8 → 9.8 bar, ngưỡng < 10.5 bar, theo dõi "2 Giờ"; người đóng = người xử lý → khoá kể cả đủ điều kiện + ghi chú', async () => {
    const user = userEvent.setup();
    const { m } = renderModal('Vận hành A');
    const result = within(m).getByRole('region', { name: 'Kết quả kỹ thuật' });
    expect(result).toHaveTextContent('Áp suất trước11.8 bar');
    expect(result).toHaveTextContent('Áp suất sau9.8 bar');
    expect(result).toHaveTextContent('Ngưỡng cho phép< 10.5 bar');
    expect(within(m).getByRole('button', { name: /Thời gian theo dõi sau xử lý/ })).toHaveTextContent('2 Giờ');
    expect(m).toHaveTextContent('Cảnh báo Nghiêm trọng: người đóng phải khác người xử lý (Vận hành A).');
    await waitFor(() => expect(within(m).getByRole('checkbox', { name: /Giá trị cảm biến đã nằm trong ngưỡng/ })).toBeChecked(), LONG);
    await user.type(within(m).getByRole('textbox', { name: /Ghi chú kết luận/ }), 'Ổn định');
    expect(within(m).getByRole('button', { name: MODAL })).toHaveAttribute('aria-disabled', 'true');
  });

  test('người khác đóng: đủ 3 điều kiện + ghi chú → gửi kèm mục tick tay + thời gian theo dõi; live vượt ngưỡng → điều kiện sai', async () => {
    const user = userEvent.setup();
    const { m, onConfirmClose } = renderModal('Trưởng ca');
    const inRange = () => within(m).getByRole('checkbox', { name: /Giá trị cảm biến đã nằm trong ngưỡng/ });
    await waitFor(() => expect(inRange()).toBeChecked(), LONG);
    await user.click(within(m).getByRole('checkbox', { name: 'Kết quả xử lý đã được ghi nhận đầy đủ' }));
    await user.type(within(m).getByRole('textbox', { name: /Ghi chú kết luận/ }), 'Ổn định');
    await user.click(within(m).getByRole('button', { name: MODAL }));
    expect(onConfirmClose).toHaveBeenCalledWith({ note: 'Ổn định', followUpMinutes: 120, manualChecks: ['result-recorded'] }, expect.any(Array));
    // Live vượt ngưỡng → điều kiện "trong ngưỡng" sai, có lý do
    liveSimulator.setBase('PT-101', 11.2);
    await waitFor(() => expect(inRange()).not.toBeChecked(), LONG);
    expect(inRange()).toHaveAttribute('aria-disabled', 'true');
    expect(inRange()).toHaveAccessibleDescription(/chưa dưới ngưỡng 10.5 bar/);
    expect(within(m).getByRole('button', { name: MODAL })).toHaveAttribute('aria-disabled', 'true');
  });
});
