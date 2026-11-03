// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import type { AuthService, AuthState } from '@/api/auth';
import { AuthProvider } from '@/app/auth';
import { fetchAlerts } from '@/data/alertStore';
import { liveSimulator } from '@/data/live';
import { VAPORIZER_TAGS } from '@/features/live/tags';
import AiSimulationPage from './AiSimulationPage';

/*
 * AI mô phỏng sự cố: KPI + danh sách kịch bản + cột phải; chạy mô phỏng → lịch sử + KPI cập nhật, KHÔNG đụng store cảnh báo
 * (quy tắc an toàn); kịch bản thiếu mapping / tag mất tín hiệu → nút khoá kèm lý do; vai trò Người xem không có nút chạy.
 */

function serviceFor(role: 'viewer' | 'operator'): AuthService {
  const state: AuthState = {
    status: 'authenticated',
    user: { id: 'u1', email: 'op@example.com', name: 'Kỹ sư A', role, status: 'active' },
  };
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
  const router = createMemoryRouter([{ path: '/operations/ai-simulation', element: <AiSimulationPage /> }], { initialEntries: [url] });
  render(
    <AuthProvider service={serviceFor(role)}>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

const kpiRegion = () => screen.getByRole('region', { name: 'Thống kê mô phỏng' });
function kpiValue(label: string) {
  const region = kpiRegion();
  let el: HTMLElement | null = within(region).getByText(label);
  while (el && el.parentElement !== region) el = el.parentElement;
  return el!.textContent!.replace(label, '');
}
const card = (title: string) => screen.getByRole('article', { name: title });
const history = () => screen.getByRole('region', { name: 'Lịch sử gần đây' });

afterEach(() => liveSimulator.restore());

describe('/operations/ai-simulation', () => {
  test('chạy mô phỏng: nút bận → kết quả vào lịch sử + "Đã chạy hôm nay" +1; store cảnh báo giữ nguyên', async () => {
    const alertsBefore = await fetchAlerts();
    renderAt('/operations/ai-simulation');
    await screen.findByRole('heading', { level: 1, name: 'AI mô phỏng sự cố' });
    expect(kpiValue('Kịch bản khả dụng')).toMatch(/^5/);
    expect(kpiValue('Dữ liệu PLC tham chiếu')).toMatch(/^—|^21\/21/);
    const runsBefore = Number(/^(\d+)/.exec(kpiValue('Đã chạy hôm nay'))![1]);

    const run = within(card('Máy hóa hơi E-101A bất thường')).getByRole('button', { name: 'Chạy mô phỏng SC-003' });
    // Chờ ảnh chụp số liệu đầu tiên (trước đó nút khoá "Đang tải dữ liệu…").
    await waitFor(() => expect(run).not.toHaveAttribute('aria-disabled'), { timeout: 5000 });
    expect(kpiValue('Dữ liệu PLC tham chiếu')).toMatch(/^21\/21Đã đồng bộ/);
    await userEvent.click(run);
    expect(await screen.findByRole('button', { name: 'Đang mô phỏng… SC-003' })).toHaveAttribute('aria-busy', 'true');
    await screen.findByRole('button', { name: 'Chạy mô phỏng SC-003' }, { timeout: 3000 });

    const first = within(history()).getAllByRole('listitem')[0]!;
    expect(first).toHaveTextContent('SC-003 (Hóa hơi)');
    expect(first).toHaveTextContent('Đạt');
    expect(within(card('Máy hóa hơi E-101A bất thường')).getByText(/Đạt \(45 s \/ mục tiêu 90 s\)/)).toBeInTheDocument();
    expect(Number(/^(\d+)/.exec(kpiValue('Đã chạy hôm nay'))![1])).toBe(runsBefore + 1);
    expect(await fetchAlerts()).toEqual(alertsBefore);
  });

  // Đổi 03/11/2026: có màn cấu hình → "Cấu hình trước khi chạy" là link sang màn đó (trước là nút khoá "chờ thiết kế").
  test('thiếu mapping: "Cấu hình trước khi chạy" mở màn cấu hình, đọc được ánh xạ thiếu', async () => {
    renderAt('/operations/ai-simulation?status=needs-config');
    const c = await screen.findByRole('article', { name: 'Tín hiệu báo cháy bất thường' });
    expect(screen.getAllByRole('article')).toHaveLength(1);
    const link = within(c).getByRole('link', { name: 'Cấu hình trước khi chạy SC-005' });
    expect(link).toHaveAttribute('href', '/operations/ai-simulation/SC-005/config');
    expect(link).toHaveAccessibleDescription(/SD-02 chưa gán biến PLC/);
    // Nút header mở cấu hình kịch bản đầu danh sách đang lọc.
    expect(screen.getByRole('link', { name: 'Cấu hình kịch bản' })).toHaveAttribute('href', '/operations/ai-simulation/SC-005/config');
    expect(within(c).queryByRole('button', { name: /Chạy mô phỏng/ })).not.toBeInTheDocument();
  });

  test('tag tham chiếu mất tín hiệu → nút chạy khoá kèm tên tag; khối PLC/SCADA báo thiếu dữ liệu', async () => {
    renderAt('/operations/ai-simulation');
    const run = await screen.findByRole('button', { name: 'Chạy mô phỏng SC-003' });
    await waitFor(() => expect(run).not.toHaveAttribute('aria-disabled'), { timeout: 5000 });
    liveSimulator.setBad([VAPORIZER_TAGS.inletPressure]);
    await waitFor(() => expect(run).toHaveAttribute('aria-disabled', 'true'), { timeout: 5000 });
    expect(run).toHaveAccessibleDescription(`Thiếu dữ liệu tham chiếu: ${VAPORIZER_TAGS.inletPressure} mất tín hiệu.`);
    expect(screen.getByRole('heading', { name: 'Dữ liệu PLC/SCADA: Thiếu dữ liệu' })).toBeInTheDocument();
    expect(kpiValue('Dữ liệu PLC tham chiếu')).toMatch(/^20\/21Thiếu 1 thông số/);
    // Kịch bản không dùng tag đó vẫn chạy được.
    expect(screen.getByRole('button', { name: 'Chạy mô phỏng SC-004' })).not.toHaveAttribute('aria-disabled');
  });

  test('Người xem: không có nút chạy; "Chi tiết kịch bản" mở/đóng lưới thông tin', async () => {
    renderAt('/operations/ai-simulation', 'viewer');
    const c = await screen.findByRole('article', { name: 'Áp suất bồn V-101 tăng cao' });
    expect(screen.queryByRole('button', { name: /^Chạy mô phỏng/ })).not.toBeInTheDocument();
    const toggle = within(c).getByRole('button', { name: 'Chi tiết kịch bản SC-002' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(within(c).getByRole('button', { name: 'Thu gọn chi tiết SC-002' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(c).getByText('Áp suất vượt 10.5 bar')).toBeInTheDocument();
  });

  test('"Lịch sử mô phỏng" ở header đưa focus tới khối Lịch sử gần đây; tìm không dấu lọc kịch bản', async () => {
    renderAt('/operations/ai-simulation');
    await screen.findByRole('heading', { level: 1, name: 'AI mô phỏng sự cố' });
    await userEvent.click(screen.getByRole('button', { name: 'Lịch sử mô phỏng' }));
    expect(screen.getByRole('heading', { name: 'Lịch sử gần đây' })).toHaveFocus();
    await userEvent.type(screen.getByRole('searchbox'), 'ap suat');
    expect(screen.getAllByRole('article').map((a) => a.getAttribute('aria-labelledby') && within(a).getByRole('heading').textContent)).toEqual([
      'Áp suất bồn V-101 tăng cao',
    ]);
  });
});
