// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import type { AuthService, AuthState } from '@/api/auth';
import { AuthProvider } from '@/app/auth';
import { fetchAlerts } from '@/data/alertStore';
import { liveSimulator } from '@/data/live';
import { SIMULATION_REFERENCE_TAGS, fetchSimulationRuns } from '@/data/simulation';
import SimulationMonitorPage from './SimulationMonitorPage';

/*
 * Theo dõi diễn biến mô phỏng: lượt mẫu SC-001 đang chạy (06:32 lúc nạp) hiển thị như ảnh – KPI, cảnh báo mô phỏng, timeline,
 * gợi ý AI, trạng thái, dữ liệu tham chiếu chụp lúc bắt đầu; "Dừng mô phỏng" → ghi lịch sử, KHÔNG đụng store cảnh báo;
 * kịch bản chưa có lượt → hướng sang cấu hình; mã lạ → không tìm thấy; Người xem không có nút Dừng.
 * Store lượt chạy dùng chung giữa các test → test Dừng đặt cuối.
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
  const router = createMemoryRouter([{ path: '/operations/ai-simulation/:scenarioId/monitor', element: <SimulationMonitorPage /> }], {
    initialEntries: [url],
  });
  render(
    <AuthProvider service={serviceFor(role)}>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

const region = (name: string) => screen.getByRole('region', { name });
const kpiRegion = () => region('Chỉ số mô phỏng');
function kpi(label: string) {
  const r = kpiRegion();
  let el: HTMLElement | null = within(r).getByText(label);
  while (el && el.parentElement !== r) el = el.parentElement;
  return el!.textContent!.replace(label, '');
}
function statusRow(label: string) {
  return within(region('Trạng thái mô phỏng')).getByText(label).nextElementSibling!.textContent;
}

afterEach(() => liveSimulator.restore());

describe('/operations/ai-simulation/:id/monitor', () => {
  test('SC-001 như ảnh: đang chạy, KPI, 2 cảnh báo, timeline, 5 gợi ý, trạng thái, dữ liệu tham chiếu', async () => {
    renderAt('/operations/ai-simulation/SC-001/monitor');
    // Chờ trạng thái đã tải (header lúc đang tải cũng có tiêu đề).
    expect(await screen.findByText('Đang chạy mô phỏng')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Theo dõi diễn biến mô phỏng' })).toBeInTheDocument();
    expect(screen.getByText('Mã kịch bản').nextElementSibling).toHaveTextContent('SC-001');
    expect(screen.getByText('Thời lượng / Mục tiêu').nextElementSibling).toHaveTextContent('10 phút / 35% LEL');
    expect(screen.getByRole('link', { name: 'SC-001' })).toHaveAttribute('href', '/operations/ai-simulation/SC-001/config');

    expect(kpi('Thời gian chạy')).toMatch(/^06:3\d\/ 10:00 \(Đang mô phỏng\)$/);
    expect(kpi('Nồng độ hiện tại')).toMatch(/^2[89]%LEL \(Đang tăng\)/);
    expect(kpi('Ngưỡng cảnh báo PLC')).toBe('20%(Đã vượt)');
    // Đổi 03/11/2026 (màn Kết quả): cảnh báo theo mẫu ảnh Kết quả – lúc 06:32 chỉ có High (SIM-AL-001), ảnh Theo dõi có 2.
    expect(kpi('Cảnh báo mô phỏng')).toBe('1(Đang hoạt động)');
    expect(kpi('Gợi ý AI')).toBe('5(Đã tạo)');

    const alerts = within(region('Cảnh báo mô phỏng')).getAllByRole('listitem');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent('SIM-AL-001: Gas khu vực bồn vượt ngưỡng cảnh báo PLC');
    expect(alerts[0]).toHaveTextContent(/Đang theo dõi\./);
    expect(alerts[0]).toHaveTextContent('Mô phỏng');

    const timeline = within(region('Timeline diễn biến')).getAllByRole('listitem');
    expect(timeline).toHaveLength(5);
    expect(timeline[0]).toHaveTextContent(/06:3\d \(Hiện tại\)Nồng độ đạt 2[89]% LEL/);
    expect(timeline[3]).toHaveTextContent('AI ghi nhận xu hướng tăng (16% LEL)');
    expect(timeline[4]).toHaveTextContent('00:00Bắt đầu mô phỏng sự cố');

    const ai = region('Gợi ý từ AI');
    expect(within(ai).getByText(/đã vượt ngưỡng cảnh báo PLC và tiếp tục tăng/)).toBeInTheDocument();
    expect(within(ai).getAllByRole('listitem')).toHaveLength(5);
    expect(within(ai).getByText('AI chỉ đưa ra gợi ý trong mô phỏng. Không có lệnh điều khiển nào được gửi đến thiết bị thật.')).toBeInTheDocument();

    expect(statusRow('Khu vực:')).toBe('Khu bồn LPG');
    expect(statusRow('Thiết bị:')).toBe('Bồn V-101');
    expect(statusRow('Lệnh điều khiển PLC:')).toBe('Không gửi');
    expect(statusRow('Trạng thái ESD thật:')).toBe('Không kích hoạt');

    const ref = region('Dữ liệu PLC/SCADA tham chiếu');
    expect(within(ref).getByText('Tank_Gas_Detector').nextElementSibling).toHaveTextContent('2.0% LEL');
    expect(within(ref).getByText('Van điều khiển').nextElementSibling).toHaveTextContent('Theo quy trình SOP');
    await waitFor(() => expect(within(ref).getByText('Đã đồng bộ')).toBeInTheDocument(), { timeout: 5000 });
    expect(within(ref).getByText('21/21')).toBeInTheDocument();
    expect(within(ai).getByText(/^Độ tin cậy: \d+%$/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Nồng độ 2[89]% LEL sau 06:3\d trên 10:00/ })).toBeInTheDocument();
  });

  test('dữ liệu thật mất tín hiệu → "Thiếu dữ liệu", bảng tham chiếu vẫn là ảnh chụp lúc bắt đầu', async () => {
    renderAt('/operations/ai-simulation/SC-001/monitor');
    const ref = await screen.findByRole('region', { name: 'Dữ liệu PLC/SCADA tham chiếu' });
    await waitFor(() => expect(within(ref).getByText('Đã đồng bộ')).toBeInTheDocument(), { timeout: 5000 });
    liveSimulator.setBad([SIMULATION_REFERENCE_TAGS[0]!]);
    await waitFor(() => expect(within(ref).getByText('Thiếu dữ liệu')).toBeInTheDocument(), { timeout: 5000 });
    expect(within(ref).getByText('20/21')).toBeInTheDocument();
    expect(within(ref).getByText('Tank_Gas_Detector').nextElementSibling).toHaveTextContent('2.0% LEL');
  });

  test('Người xem: không có nút Dừng', async () => {
    renderAt('/operations/ai-simulation/sc-001/monitor', 'viewer');
    await screen.findByText('Đang chạy mô phỏng');
    expect(screen.queryByRole('button', { name: /Dừng mô phỏng/ })).not.toBeInTheDocument();
  });

  test('kịch bản chưa có lượt → hướng sang màn cấu hình; mã lạ → không tìm thấy', async () => {
    renderAt('/operations/ai-simulation/SC-002/monitor');
    expect(await screen.findByRole('heading', { name: 'Chưa có lượt mô phỏng' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cấu hình và chạy mô phỏng' })).toHaveAttribute('href', '/operations/ai-simulation/SC-002/config');
  });

  test('mã lạ → "Không tìm thấy kịch bản"', async () => {
    renderAt('/operations/ai-simulation/SC-999/monitor');
    expect(await screen.findByRole('heading', { level: 1, name: 'Không tìm thấy kịch bản' })).toBeInTheDocument();
  });

  test('Dừng mô phỏng → "Đã dừng", kết quả vào lịch sử (ghi giờ dừng); store cảnh báo giữ nguyên', async () => {
    const alertsBefore = await fetchAlerts();
    const runsBefore = (await fetchSimulationRuns()).length;
    const user = userEvent.setup();
    renderAt('/operations/ai-simulation/SC-001/monitor');
    await user.click(await screen.findByRole('button', { name: 'Dừng mô phỏng' }));
    expect(await screen.findByText('Đã dừng')).toBeInTheDocument();
    expect(kpi('Thời gian chạy')).toMatch(/\(Đã dừng\)$/);
    expect(screen.getByText(/^Kết quả lượt:/)).toHaveTextContent(/Kết quả lượt: Đạt – Dừng thủ công lúc 06:\d\d\. Phản ứng 38 s, trong mục tiêu 60 s\./);
    expect(within(region('Timeline diễn biến')).getAllByRole('listitem')[0]).toHaveTextContent(/\(Dừng\)Dừng mô phỏng – nồng độ đạt/);
    expect(screen.queryByRole('button', { name: 'Dừng mô phỏng' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cấu hình và chạy lại' })).toHaveAttribute('href', '/operations/ai-simulation/SC-001/config');
    expect(screen.getByRole('link', { name: 'Xem kết quả mô phỏng' })).toHaveAttribute('href', '/operations/ai-simulation/SC-001/result?session=SES-0001');

    const runs = await fetchSimulationRuns();
    expect(runs).toHaveLength(runsBefore + 1);
    expect(runs[0]).toMatchObject({ scenarioId: 'SC-001', result: 'pass', by: 'Nguyễn Văn A' });
    expect(await fetchAlerts()).toEqual(alertsBefore);
  });
});
