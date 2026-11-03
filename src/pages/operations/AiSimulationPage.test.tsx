// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import type { AuthService, AuthState } from '@/api/auth';
import { AuthProvider } from '@/app/auth';
import { fetchAlerts } from '@/data/alertStore';
import { liveSimulator } from '@/data/live';
import { fetchSimulationRuns, fetchSimulationSessions } from '@/data/simulation';
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
  const router = createMemoryRouter(
    [
      { path: '/operations/ai-simulation', element: <AiSimulationPage /> },
      { path: '/operations/ai-simulation/:scenarioId/monitor', element: <h1>Màn theo dõi</h1> },
    ],
    { initialEntries: [url] },
  );
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

afterEach(() => liveSimulator.restore());

describe('/operations/ai-simulation', () => {
  // Đổi 03/11/2026 (màn "Theo dõi diễn biến"): chạy = mở lượt theo thời gian thực rồi sang màn theo dõi; lịch sử chỉ ghi khi
  // lượt kết thúc (trước: chạy tức thì, ghi lịch sử ngay).
  test('chạy mô phỏng: nút bận → mở lượt đang chạy + sang màn theo dõi; lịch sử chưa đổi; store cảnh báo giữ nguyên', async () => {
    const alertsBefore = await fetchAlerts();
    const runsBefore = (await fetchSimulationRuns()).length;
    renderAt('/operations/ai-simulation');
    await screen.findByRole('heading', { level: 1, name: 'AI mô phỏng sự cố' });
    expect(kpiValue('Kịch bản khả dụng')).toMatch(/^5/);
    expect(kpiValue('Dữ liệu PLC tham chiếu')).toMatch(/^—|^21\/21/);
    // Lượt mẫu SC-001 đang chạy → link theo dõi thay cho nút chạy.
    expect(within(card('Rò rỉ LPG tại khu vực bồn')).getByRole('link', { name: 'Đang chạy – Theo dõi SC-001' })).toHaveAttribute(
      'href',
      '/operations/ai-simulation/SC-001/monitor',
    );

    // SC-004 (test sau dùng nút chạy SC-003 – store lượt chạy dùng chung giữa các test).
    const run = within(card('Mất kết nối PLC/SCADA')).getByRole('button', { name: 'Chạy mô phỏng SC-004' });
    // Chờ ảnh chụp số liệu đầu tiên (trước đó nút khoá "Đang tải dữ liệu…").
    await waitFor(() => expect(run).not.toHaveAttribute('aria-disabled'), { timeout: 5000 });
    expect(kpiValue('Dữ liệu PLC tham chiếu')).toMatch(/^21\/21Đã đồng bộ/);
    await userEvent.click(run);
    expect(await screen.findByRole('button', { name: 'Đang khởi động… SC-004' })).toHaveAttribute('aria-busy', 'true');
    expect(await screen.findByRole('heading', { level: 1, name: 'Màn theo dõi' }, { timeout: 3000 })).toBeInTheDocument();

    const session = (await fetchSimulationSessions()).find((x) => x.scenarioId === 'SC-004')!;
    expect(session).toMatchObject({ by: 'Kỹ sư A', config: { target: 30, durationMin: 10, endCondition: 'manual-stop' } });
    expect(session.runId).toBeUndefined();
    expect(await fetchSimulationRuns()).toHaveLength(runsBefore);
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
    expect(screen.getByRole('button', { name: 'Chạy mô phỏng SC-002' })).not.toHaveAttribute('aria-disabled');
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
