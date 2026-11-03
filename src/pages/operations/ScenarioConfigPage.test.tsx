// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import type { AuthService, AuthState } from '@/api/auth';
import { AuthProvider } from '@/app/auth';
import { fetchAlerts } from '@/data/alertStore';
import { liveSimulator } from '@/data/live';
import { fetchScenarios } from '@/data/simulation';
import { TANK_AREA_TAGS } from '@/features/live/tags';
import ScenarioConfigPage from './ScenarioConfigPage';

/*
 * Cấu hình kịch bản mô phỏng: hiển thị theo ảnh (SC-001), sửa tham số → tóm tắt cập nhật ngay; lưu → store kịch bản;
 * cấu hình sai → Lưu/Chạy khoá kèm lý do; gợi ý AI áp dụng / bỏ qua (trả focus); chạy → lịch sử kịch bản, KHÔNG đụng
 * store cảnh báo; thiếu mapping (SC-005) / mất tín hiệu → khoá chạy; Người xem chỉ đọc; mã lạ → không tìm thấy.
 * Store kịch bản dùng chung giữa các test → test lưu dùng SC-002, các test khác không lưu SC-001.
 */

function serviceFor(role: 'viewer' | 'operator'): AuthService {
  const state: AuthState = { status: 'authenticated', user: { id: 'u1', email: 'op@example.com', name: 'Kỹ sư A', role, status: 'active' } };
  return {
    getState: () => state,
    subscribe: () => () => {},
    init: async () => {},
    login: async () => state.user!,
    register: async () => '',
    logout: async () => {},
    refresh: async () => true,
    expiresAt: () => null,
  };
}

function renderAt(url: string, role: 'viewer' | 'operator' = 'operator') {
  const router = createMemoryRouter(
    [
      { path: '/operations/ai-simulation/:scenarioId/config', element: <ScenarioConfigPage /> },
      { path: '/operations/ai-simulation', element: <p>Danh sách</p> },
    ],
    { initialEntries: [url] },
  );
  render(
    <AuthProvider service={serviceFor(role)}>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

const region = (name: string) => screen.getByRole('region', { name });
function summary(label: string) {
  const dt = within(region('Tóm tắt cấu hình')).getByText(label);
  return dt.nextElementSibling!.textContent;
}
const runButton = () => screen.getByRole('button', { name: /Bắt đầu chạy mô phỏng|Đang mô phỏng…/ });
/** Chờ ảnh chụp số liệu đầu tiên (trước đó nút chạy khoá "Đang tải dữ liệu…"). */
const waitReady = () => waitFor(() => expect(runButton()).not.toHaveAttribute('aria-disabled'), { timeout: 5000 });

afterEach(() => liveSimulator.restore());

describe('/operations/ai-simulation/:id/config', () => {
  test('SC-001 như ảnh: thông tin, tham số, bảng tham chiếu, tóm tắt, sẵn sàng 21/21, lịch sử 3 lượt', async () => {
    renderAt('/operations/ai-simulation/SC-001/config');
    await screen.findByRole('heading', { level: 1, name: 'Cấu hình kịch bản mô phỏng' });
    await waitReady();
    const info = region('Thông tin kịch bản');
    expect(within(info).getByText('Rò rỉ LPG tại khu vực bồn')).toBeInTheDocument();
    expect(within(info).getByText('Nghiêm trọng')).toBeInTheDocument();
    expect(within(info).getByText('Sẵn sàng mô phỏng')).toBeInTheDocument();

    expect(screen.getByRole('slider', { name: 'Nồng độ mục tiêu mô phỏng' })).toHaveAttribute('aria-valuetext', '35% LEL – vượt ngưỡng cảnh báo PLC');
    expect(screen.getByRole('radio', { name: 'Kết thúc khi hết thời lượng mô phỏng' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('checkbox', { name: 'Khu bồn LPG' })).toBeChecked();

    const table = screen.getByRole('table', { name: 'Dữ liệu PLC/SCADA tham chiếu' });
    expect(within(table).getAllByRole('row')).toHaveLength(6);
    expect(within(table).getByText('Trực tuyến')).toBeInTheDocument();

    expect(summary('Giá trị mục tiêu:')).toBe('35% LEL');
    expect(summary('Thời lượng:')).toBe('10 phút');
    expect(summary('Trạng thái:')).toBe('Sẵn sàng');
    expect(within(region('Trạng thái sẵn sàng')).getByText('21/21')).toBeInTheDocument();
    expect(within(region('Gợi ý từ AI')).getByText(/Nên chạy với mức/)).toHaveTextContent('35% LEL trong 10 phút');

    const history = screen.getByRole('region', { name: 'Lịch sử kịch bản này' });
    const items = within(history).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Ghi chú: Phát hiện cảnh báo đúng thời điểm.');
    expect(items[2]).toHaveTextContent('Kết quả: Cần cải thiện');
    expect(screen.getByRole('button', { name: 'Xem toàn bộ lịch sử' })).toHaveAccessibleDescription(/chờ thiết kế/);
  });

  test('sửa tham số → tóm tắt đổi ngay; áp dụng gợi ý đưa về 35% / 10 phút; bỏ qua → focus "Xem lại gợi ý"', async () => {
    const user = userEvent.setup();
    renderAt('/operations/ai-simulation/SC-001/config');
    await waitReady();
    const slider = screen.getByRole('slider', { name: 'Nồng độ mục tiêu mô phỏng' });
    slider.focus();
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(summary('Giá trị mục tiêu:')).toBe('33% LEL');
    await user.keyboard('{Home}');
    expect(screen.getByText(/Mục tiêu chưa vượt ngưỡng cảnh báo PLC/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Thời lượng mô phỏng 10 phút' }));
    await user.click(screen.getByRole('option', { name: '20 phút' }));
    expect(summary('Thời lượng:')).toBe('20 phút');

    await user.click(screen.getByRole('button', { name: 'Áp dụng gợi ý' }));
    expect(summary('Giá trị mục tiêu:')).toBe('35% LEL');
    expect(summary('Thời lượng:')).toBe('10 phút');

    await user.click(screen.getByRole('button', { name: 'Bỏ qua' }));
    expect(screen.getByRole('button', { name: 'Xem lại gợi ý' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Xem lại gợi ý' }));
    expect(screen.getByRole('button', { name: 'Bỏ qua' })).toHaveFocus();
  });

  test('bỏ hết khu vực ảnh hưởng → lỗi; Lưu + Bắt đầu chạy khoá kèm lý do', async () => {
    const user = userEvent.setup();
    renderAt('/operations/ai-simulation/SC-001/config');
    await waitReady();
    await user.click(screen.getByRole('checkbox', { name: 'Khu bồn LPG' }));
    expect(screen.getByText('Chọn ít nhất một khu vực ảnh hưởng.')).toBeInTheDocument();
    expect(summary('Khu vực:')).toBe('—');
    expect(summary('Trạng thái:')).toBe('Chưa hợp lệ');
    for (const name of ['Lưu cấu hình', 'Bắt đầu chạy mô phỏng']) {
      const b = screen.getByRole('button', { name });
      expect(b).toHaveAttribute('aria-disabled', 'true');
      expect(b).toHaveAccessibleDescription(/Chọn ít nhất một khu vực ảnh hưởng/);
    }
  });

  test('lưu cấu hình SC-002 → store kịch bản có tham số mới (khu vực theo thứ tự danh sách)', async () => {
    const user = userEvent.setup();
    renderAt('/operations/ai-simulation/SC-002/config');
    await waitReady();
    await user.click(screen.getByRole('checkbox', { name: 'Đường cấp LPG' }));
    await user.click(screen.getByRole('radio', { name: 'Kết thúc khi người dùng dừng mô phỏng' }));
    await user.click(screen.getByRole('button', { name: 'Lưu cấu hình' }));
    expect(await screen.findByRole('button', { name: 'Đang lưu…' })).toHaveAttribute('aria-busy', 'true');
    await screen.findByRole('button', { name: 'Lưu cấu hình' }, { timeout: 3000 });
    const saved = (await fetchScenarios()).find((s) => s.id === 'SC-002')!;
    expect(saved.config).toMatchObject({ endCondition: 'manual-stop', areas: ['Khu bồn LPG', 'Đường cấp LPG'] });
  });

  test('bắt đầu chạy → lượt mới đầu "Lịch sử kịch bản này"; store cảnh báo giữ nguyên', async () => {
    const alertsBefore = await fetchAlerts();
    const user = userEvent.setup();
    renderAt('/operations/ai-simulation/SC-001/config');
    await waitReady();
    await user.click(runButton());
    expect(await screen.findByRole('button', { name: /Đang mô phỏng…/ })).toHaveAttribute('aria-busy', 'true');
    await screen.findByRole('button', { name: /Bắt đầu chạy mô phỏng/ }, { timeout: 3000 });
    const first = within(screen.getByRole('region', { name: 'Lịch sử kịch bản này' })).getAllByRole('listitem')[0]!;
    expect(first).toHaveTextContent('Kết quả: Đạt');
    expect(first).toHaveTextContent('Ghi chú: Phản ứng 38 s, trong mục tiêu 60 s.');
    expect(await fetchAlerts()).toEqual(alertsBefore);
  });

  test('tag biến chính mất tín hiệu → ô bắt đầu "Mất tín hiệu", chạy khoá kèm tên tag', async () => {
    renderAt('/operations/ai-simulation/SC-001/config');
    await waitReady();
    liveSimulator.setBad([TANK_AREA_TAGS.gas]);
    await waitFor(() => expect(runButton()).toHaveAttribute('aria-disabled', 'true'), { timeout: 3000 });
    expect(runButton()).toHaveAccessibleDescription(new RegExp(`${TANK_AREA_TAGS.gas} mất tín hiệu`));
    expect(within(region('Tham số đầu vào')).getByText('Mất tín hiệu')).toBeInTheDocument();
    expect(summary('Dữ liệu đầu vào:')).toBe('Thiếu dữ liệu');
  });

  test('SC-005 (mã chữ thường) thiếu mapping → "Cần cấu hình mapping", chạy khoá kèm ánh xạ thiếu', async () => {
    renderAt('/operations/ai-simulation/sc-005/config');
    await screen.findByRole('heading', { level: 1, name: 'Cấu hình kịch bản mô phỏng' });
    expect(within(region('Thông tin kịch bản')).getByText('Cần cấu hình mapping')).toBeInTheDocument();
    expect(runButton()).toHaveAttribute('aria-disabled', 'true');
    expect(runButton()).toHaveAccessibleDescription(/SD-02 chưa gán biến PLC/);
  });

  test('Người xem: không có Lưu / Bắt đầu chạy / Áp dụng gợi ý, ô nhập bị khoá', async () => {
    renderAt('/operations/ai-simulation/SC-001/config', 'viewer');
    await screen.findByRole('heading', { level: 1, name: 'Cấu hình kịch bản mô phỏng' });
    expect(screen.queryByRole('button', { name: 'Lưu cấu hình' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Bắt đầu chạy/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Áp dụng gợi ý' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Khu bồn LPG' })).toBeDisabled();
    expect(screen.getByRole('slider', { name: 'Nồng độ mục tiêu mô phỏng' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('link', { name: 'Quay lại danh sách' })).toHaveAttribute('href', '/operations/ai-simulation');
  });

  test('mã lạ → "Không tìm thấy kịch bản" kèm danh sách mã', async () => {
    renderAt('/operations/ai-simulation/SC-999/config');
    expect(await screen.findByRole('heading', { level: 1, name: 'Không tìm thấy kịch bản' })).toBeInTheDocument();
    expect(screen.getByText(/SC-001, SC-002, SC-003, SC-004, SC-005/)).toBeInTheDocument();
  });
});
