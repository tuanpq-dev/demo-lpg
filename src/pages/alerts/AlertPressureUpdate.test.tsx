// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import type { AuthService, AuthState } from '@/api/auth';
import { AuthProvider } from '@/app/auth';
import { liveSimulator } from '@/data/live';
import { alertRecords } from '@/mocks/alerts';
import AlertsPage from './AlertsPage';
import AlertUpdateModal from './AlertUpdateModal';

/*
 * Modal "Cập nhật xử lý cảnh báo áp suất" (loại tank-overpressure, ALT-00128 – ảnh 28/10/2026): mở từ drawer (Đang xử lý),
 * hạng mục kiểm tra dùng chung drawer ↔ modal, điều kiện "Đã xử lý" theo live / sau xử lý / mất tín hiệu, xác minh mâu thuẫn,
 * cảnh báo nêu tên hạng mục "Có vấn đề", theo dõi sau xử lý, nháp. Từ 28/10/2026 modal là khung chung `AlertUpdateModal`
 * (gas / cháy: AlertGasDrawer.test.tsx, AlertFireDrawer.test.tsx); "Đã xử lý" → chờ xác nhận đóng (AlertClose.test.tsx).
 * File riêng → store cảnh báo riêng. Live mock PT-101 = 9.2 bar (dưới ngưỡng 10.5). Test đổi dữ liệu nối tiếp nhau trên ALT-00128.
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
const MODAL = 'Cập nhật xử lý cảnh báo áp suất';
const drawer = () => screen.findByRole('dialog', { name: 'Áp suất bồn V-101 vượt ngưỡng' });
const LONG = { timeout: 6000 };
/** Chờ modal lazy (khung chung, nặng) hiện ra: chạy cả bộ song song có lúc > 6 s – vẫn dưới testTimeout 30 s. */
const MODAL_WAIT = { timeout: 20000 };

async function openModal(user: ReturnType<typeof userEvent.setup>) {
  const d = await drawer();
  const ack = within(d).queryByRole('button', { name: 'Xác nhận cảnh báo' });
  if (ack) await user.click(ack);
  const btn = await within(d).findByRole('button', { name: 'Cập nhật xử lý' });
  await user.click(btn);
  const m = await screen.findByRole('dialog', { name: MODAL }, MODAL_WAIT);
  return { d, m, btn };
}
async function pick(user: ReturnType<typeof userEvent.setup>, m: HTMLElement, trigger: RegExp, option: string) {
  await user.click(within(m).getByRole('button', { name: trigger }));
  await user.click(screen.getByRole('option', { name: option }));
}
const radio = (m: HTMLElement, name: string) => within(m).getByRole('radio', { name: new RegExp(`^${name}`) });

// Modal "Cập nhật xử lý" là React.lazy (chunk riêng): nạp trước để lần mở đầu trong test không tốn thời gian
// biến đổi/tải module (chạy cả bộ song song có lúc > 6 s → findByRole hết giờ). Không đổi hành vi được kiểm.
beforeAll(async () => {
  await import('./AlertUpdateModal');
});

afterEach(() => {
  liveSimulator.setBase('PT-101', 9.2);
  liveSimulator.restore();
  sessionStorage.clear();
});

describe('modal cập nhật xử lý cảnh báo áp suất (ALT-00128)', () => {
  test('mở từ drawer khi Đang xử lý: phase mặc định Đang kiểm tra, bảng có caption/scope, ô chọn có nhãn theo hạng mục; Esc trả focus', async () => {
    const user = userEvent.setup();
    renderAt('/alerts?alert=ALT-00128');
    const { d, m, btn } = await openModal(user);
    expect(within(m).getByText('Ghi nhận kết quả kiểm tra và tình trạng xử lý cảnh báo ALT-00128')).toBeInTheDocument();
    expect(radio(m, 'Đang kiểm tra')).toHaveAttribute('aria-checked', 'true');
    const table = within(m).getByRole('table', { name: 'Kết quả kiểm tra thiết bị ALT-00128' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Hạng mục kiểm tra', 'Trạng thái', 'Người kiểm tra', 'Thời gian', 'Ghi chú']);
    expect(within(table).getAllByRole('rowheader')).toHaveLength(6);
    expect(within(table).queryByRole('checkbox')).toBeNull(); // bỏ cột checkbox của ảnh
    expect(within(m).getByRole('button', { name: /^Trạng thái: Kiểm tra bộ điều áp PR-101 Chưa kiểm tra$/ })).toBeInTheDocument();
    expect(within(m).getByRole('textbox', { name: 'Ghi chú: Kiểm tra bộ điều áp PR-101' })).toBeInTheDocument();
    // 5 mục xác minh; "Vấn đề phát sinh" không trùng ô
    expect(within(m).getByRole('group', { name: 'Kết quả xác minh (Chọn nhiều)' })).toBeInTheDocument();
    expect(within(m).getAllByRole('radio', { name: 'Không có vấn đề phát sinh' })).toHaveLength(1);
    // Esc (chưa sửa) → đóng, drawer còn, focus về nút mở
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: MODAL })).toBeNull();
    expect(d).toBeInTheDocument();
    expect(btn).toHaveFocus();
  });

  test('hạng mục dùng chung drawer ↔ modal: "Có vấn đề" bắt buộc ghi chú, tự điền người kiểm tra; drawer hiện chip + khoá', async () => {
    const user = userEvent.setup();
    renderAt('/alerts?alert=ALT-00128');
    const { d, m } = await openModal(user);
    await pick(user, m, /^Trạng thái: Kiểm tra bộ điều áp PR-101/, 'Có vấn đề');
    const row = within(m).getByRole('rowheader', { name: 'Kiểm tra bộ điều áp PR-101' }).closest('tr')!;
    expect(row).toHaveTextContent('Vận hành A'); // người kiểm tra tự điền
    expect(row.textContent).toMatch(/\d{2}:\d{2}/);
    await user.click(within(m).getByRole('button', { name: 'Lưu cập nhật' }));
    const note = within(m).getByRole('textbox', { name: 'Ghi chú: Kiểm tra bộ điều áp PR-101' });
    expect(note).toHaveAccessibleDescription('Nhập ghi chú cho hạng mục có vấn đề.');
    expect(screen.getByRole('dialog', { name: MODAL })).toBeInTheDocument();
    await user.type(note, 'Kẹt cơ cấu');
    await user.click(within(m).getByRole('button', { name: 'Lưu cập nhật' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: MODAL })).toBeNull());
    // Drawer: cùng hạng mục, chip "Có vấn đề", khoá tick
    const item = within(d).getByRole('checkbox', { name: 'Kiểm tra bộ điều áp PR-101' });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).toHaveAccessibleDescription(/Có vấn đề/);
    // Tick ở drawer → modal đọc lại là Đạt
    await user.click(within(d).getByRole('checkbox', { name: 'Đối chiếu PT-101 với đồng hồ cơ' }));
    await user.click(within(d).getByRole('button', { name: 'Cập nhật xử lý' }));
    const m2 = await screen.findByRole('dialog', { name: MODAL }, MODAL_WAIT);
    expect(within(m2).getByRole('button', { name: /^Trạng thái: Đối chiếu PT-101 với đồng hồ cơ Đạt$/ })).toBeInTheDocument();
    expect(within(m2).getByRole('button', { name: /^Trạng thái: Kiểm tra bộ điều áp PR-101 Có vấn đề$/ })).toBeInTheDocument();
    await user.keyboard('{Escape}');
  });

  test('"Đã xử lý" khoá khi live ≥ ngưỡng; mất tín hiệu → bắt buộc đồng hồ cơ + số đo tay', async () => {
    const user = userEvent.setup();
    liveSimulator.setBase('PT-101', 11.2);
    renderAt('/alerts?alert=ALT-00128');
    const { m } = await openModal(user);
    await waitFor(() => expect(radio(m, 'Đã xử lý')).toHaveAccessibleDescription(/vẫn chưa dưới ngưỡng cảnh báo 10.5 bar/), LONG);
    expect(radio(m, 'Đã xử lý')).toHaveAttribute('aria-disabled', 'true');
    // "Hệ thống đã trở về bình thường" cũng khoá
    expect(within(m).getByRole('checkbox', { name: 'Hệ thống đã trở về bình thường' })).toHaveAttribute('aria-disabled', 'true');

    // Mất tín hiệu, nguồn chỉ cảm biến → khoá với lý do đồng hồ cơ
    liveSimulator.setBad(['PT-101'], true);
    await pick(user, m, /Nguồn xác minh/, 'Cảm biến (SCADA)');
    await waitFor(() => expect(radio(m, 'Đã xử lý')).toHaveAccessibleDescription(/Đồng hồ cơ/), LONG);
    // Đồng hồ cơ + nhập 9.8 → mở khoá
    await pick(user, m, /Nguồn xác minh/, 'Đồng hồ cơ');
    expect(radio(m, 'Đã xử lý')).toHaveAccessibleDescription(/Nhập áp suất sau xử lý đo bằng đồng hồ cơ/);
    const after = within(m).getByRole('textbox', { name: 'Áp suất V-101 sau xử lý' });
    await user.type(after, '9.8{Enter}');
    await waitFor(() => expect(radio(m, 'Đã xử lý')).not.toHaveAttribute('aria-disabled'));
  });

  test('Đã xử lý: chặn khi thiếu nguyên nhân/nội dung/xác minh; mâu thuẫn bị chặn; cảnh báo nêu tên hạng mục "Có vấn đề"; lưu → theo dõi', async () => {
    const user = userEvent.setup();
    renderAt('/alerts?alert=ALT-00128');
    const { d, m } = await openModal(user);
    await waitFor(() => expect(radio(m, 'Đã xử lý')).not.toHaveAttribute('aria-disabled'), LONG);
    await user.click(radio(m, 'Đã xử lý'));
    // Cảnh báo không chặn – hạng mục "Có vấn đề" từ test trước (cùng store)
    expect(within(m).getByRole('list', { name: 'Cảnh báo phân công' })).toHaveTextContent('Còn hạng mục "Có vấn đề": Kiểm tra bộ điều áp PR-101');
    // Thời điểm kiểm tra lại tự tính (30 phút mặc định)
    expect((within(m).getByRole('textbox', { name: /Thời điểm kiểm tra lại/ }) as HTMLInputElement).value).toMatch(/^\d{2}:\d{2}$/);
    await user.click(within(m).getByRole('button', { name: 'Lưu cập nhật' }));
    const save = within(m).getByRole('button', { name: 'Lưu cập nhật' });
    expect(save).toHaveAttribute('aria-disabled', 'true');
    expect(save).toHaveAccessibleDescription(/Nhập nguyên nhân.*Nhập nội dung đã xử lý|Chọn "Hệ thống đã trở về bình thường"/);
    // Mâu thuẫn
    await user.click(within(m).getByRole('checkbox', { name: 'Xác nhận áp suất thực tế vượt ngưỡng' }));
    await user.click(within(m).getByRole('checkbox', { name: 'Hệ thống đã trở về bình thường' }));
    expect(within(m).getByRole('alert')).toHaveTextContent('mâu thuẫn');
    await user.click(within(m).getByRole('checkbox', { name: 'Xác nhận áp suất thực tế vượt ngưỡng' }));
    expect(within(m).queryByText(/mâu thuẫn/)).toBeNull();
    await user.type(within(m).getByRole('textbox', { name: /Nguyên nhân xử lý/ }), 'Bộ điều áp PR-101 kẹt');
    await user.type(within(m).getByRole('textbox', { name: /Nội dung đã xử lý/ }), 'Vệ sinh, chỉnh lại PR-101');
    await user.click(within(m).getByRole('button', { name: 'Lưu cập nhật' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: MODAL })).toBeNull());
    // Đổi có chủ đích (28/10/2026): Đã xử lý = chờ xác nhận đóng (không còn "Cảnh báo đã xử lý xong" ngay).
    expect(within(d).getByText(/Đã xử lý lúc \d{2}:\d{2}, chờ xác nhận đóng/)).toBeInTheDocument();
    expect(within(d).getByRole('button', { name: 'Xác nhận đóng cảnh báo' })).toBeInTheDocument();
    expect(within(d).getByText(/^Đang theo dõi đến \d{2}:\d{2}, mục tiêu < 10 bar\.$/)).toBeInTheDocument();
    // Bảng cũng hiện theo dõi
    expect(screen.getByRole('table', { name: /cảnh báo/i })).toHaveTextContent(/Đang theo dõi đến \d{2}:\d{2}/);
  }, 15_000);
});

describe('nháp + loại khác', () => {
  test('Lưu nháp (sessionStorage theo mã) → Esc đóng không hỏi lại → mở lại khôi phục; sửa tiếp rồi Esc → hỏi "Bỏ thay đổi"', async () => {
    const user = userEvent.setup();
    const rec = { ...alertRecords.find((x) => x.id === 'ALT-00128')!, status: 'in-progress' as const, phase: 'inspecting' as const, assignee: 'Nguyễn Văn A' };
    const onClose = vi.fn();
    const first = render(<AlertUpdateModal alert={rec} actor="Vận hành A" onClose={onClose} onSubmit={() => ({ ok: true, record: rec })} />);
    const m = screen.getByRole('dialog', { name: MODAL });
    await user.type(within(m).getByRole('textbox', { name: /Nguyên nhân xử lý/ }), 'Bộ điều áp kẹt');
    await user.click(within(m).getByRole('button', { name: 'Lưu nháp' }));
    expect(sessionStorage.getItem('demo-lpg:alert-update-draft:ALT-00128')).toContain('Bộ điều áp kẹt');
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    first.unmount();

    render(<AlertUpdateModal alert={rec} actor="Vận hành A" onClose={onClose} onSubmit={() => ({ ok: true, record: rec })} />);
    const m2 = screen.getByRole('dialog', { name: MODAL });
    expect(within(m2).getByText('Bản nháp đã được khôi phục.')).toBeInTheDocument();
    expect(within(m2).getByRole('textbox', { name: /Nguyên nhân xử lý/ })).toHaveValue('Bộ điều áp kẹt');
    await user.type(within(m2).getByRole('textbox', { name: /Nội dung đã xử lý/ }), 'x');
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(within(m2).getByRole('button', { name: 'Tiếp tục sửa' })).toHaveFocus();
    expect(within(m2).getByRole('button', { name: 'Bỏ thay đổi (giữ bản nháp đã lưu)' })).toBeInTheDocument();
  });

  test('nháp hỏng (sai dạng) → bỏ qua, mở form mặc định', () => {
    sessionStorage.setItem('demo-lpg:alert-update-draft:ALT-00128', '{"state":"xyz"}');
    const rec = { ...alertRecords.find((x) => x.id === 'ALT-00128')!, status: 'in-progress' as const, assignee: 'Nguyễn Văn A' };
    render(<AlertUpdateModal alert={rec} actor="A" onClose={() => {}} onSubmit={() => ({ ok: true, record: rec })} />);
    expect(screen.queryByText('Bản nháp đã được khôi phục.')).toBeNull();
    expect(radio(screen.getByRole('dialog', { name: MODAL }), 'Đang kiểm tra')).toHaveAttribute('aria-checked', 'true');
  });
  // Đổi có chủ đích (28/10/2026): gas không còn modal gọn – mở khung chung với tiêu đề theo loại.
  test('gas (ALT-00127) mở khung chung với tiêu đề theo loại, không phải tiêu đề áp suất', async () => {
    const user = userEvent.setup();
    renderAt('/alerts?alert=ALT-00127');
    const d = await screen.findByRole('dialog', { name: 'Cảnh báo rò rỉ Gas nhẹ' });
    await user.click(within(d).getByRole('button', { name: 'Cập nhật xử lý' }));
    expect(await screen.findByRole('dialog', { name: 'Cập nhật xử lý cảnh báo rò rỉ khí' }, MODAL_WAIT)).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: MODAL })).toBeNull();
  });
});
