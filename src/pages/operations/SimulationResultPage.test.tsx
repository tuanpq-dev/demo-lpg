// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import type { AuthService, AuthState } from '@/api/auth';
import { AuthProvider } from '@/app/auth';
import { fetchAlerts } from '@/data/alertStore';
import { liveSimulator } from '@/data/live';
import { fetchSimulationSessions } from '@/data/simulation';
import SimulationResultPage from './SimulationResultPage';

/*
 * Kết quả mô phỏng: lượt mẫu SC-001 đã xong (18:14:00, 6 ngày trước) hiển thị như ảnh – thông tin phiên, KPI, đánh giá, biểu đồ,
 * dòng thời gian, bảng tiêu chí, cảnh báo đã tạo, dữ liệu tham chiếu, báo cáo; "Thêm vào báo cáo" / "Bỏ qua" ghi trạng thái
 * báo cáo; "Xuất Excel" tải CSV; "Xem trước" mở modal qua `?preview=1`; KHÔNG đụng store cảnh báo. Người xem chỉ đọc.
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
      { path: '/operations/ai-simulation/:scenarioId/result', element: <SimulationResultPage /> },
      { path: '/operations/ai-simulation/:scenarioId/monitor', element: <h1>Màn theo dõi</h1> },
    ],
    { initialEntries: [url] },
  );
  render(
    <AuthProvider service={serviceFor(role)}>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
  return router;
}

const region = (name: string) => screen.getByRole('region', { name });
/** Chờ trạng thái đã tải (header lúc đang tải cũng có tiêu đề). */
const loaded = () => screen.findByRole('region', { name: 'Thông tin phiên mô phỏng' }, { timeout: 5000 });
function info(label: string) {
  return within(region('Thông tin phiên mô phỏng')).getByText(label).nextElementSibling!.textContent;
}

beforeAll(() => {
  // jsdom không có createObjectURL (Xuất Excel).
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() });
});
afterEach(() => liveSimulator.restore());

describe('/operations/ai-simulation/:id/result', () => {
  test('SC-001 như ảnh: thông tin phiên, KPI, đánh giá, dòng thời gian, tiêu chí, cảnh báo, dữ liệu nền, báo cáo', async () => {
    renderAt('/operations/ai-simulation/SC-001/result');
    await loaded();
    expect(screen.getByRole('heading', { level: 1, name: 'Kết quả mô phỏng' })).toBeInTheDocument();
    expect(screen.getByText('Tổng kết phiên mô phỏng rò rỉ LPG tại khu vực bồn và đánh giá phản ứng của hệ thống.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Quay lại theo dõi' })).toHaveAttribute(
      'href',
      '/operations/ai-simulation/SC-001/monitor?session=SES-0000',
    );
    expect(info('Mã phiên')).toMatch(/^SIM-RUN-\d{8}-001$/);
    expect(info('Khu vực / Tài sản chính')).toBe('Khu bồn LPG / Bồn V-101');
    expect(info('Người chạy')).toBe('Nguyễn Văn A');
    expect(info('Trạng thái')).toBe('Đã hoàn thành');

    const kpis = region('Chỉ số kết quả');
    for (const t of ['Đạt', '10:00', '35% LEL', 'Hệ thống phản ứng đúng kịch bản', 'Đã tạo đúng ngưỡng'])
      expect(within(kpis).getByText(t)).toBeInTheDocument();

    const overview = region('Đánh giá tổng quan');
    expect(within(overview).getByText('Kết quả : Đạt')).toBeInTheDocument();
    expect(within(overview).getAllByText('Đạt')).toHaveLength(4);

    const events = within(region('Dòng thời gian sự kiện mô phỏng')).getAllByRole('listitem');
    expect(events).toHaveLength(7);
    expect(events[0]).toHaveTextContent('18:14:00Bắt đầu mô phỏng');
    expect(events[2]).toHaveTextContent(/Cảnh báo mô phỏng: SIM-AL-001.*Mô phỏng/);
    expect(events[6]).toHaveTextContent('Hoàn thành mô phỏng theo giá trị mục tiêu');

    expect(within(region('Đánh giá phản ứng hệ thống')).getByText('Nhận diện chính xác xu hướng tăng 15% LEL từ phút thứ 2.')).toBeInTheDocument();

    const alerts = within(region('Cảnh báo mô phỏng đã tạo')).getAllByRole('listitem');
    expect(alerts.map((a) => a.textContent?.slice(0, 10))).toEqual(['SIM-AL-001', 'SIM-AL-002']);
    expect(alerts[1]).toHaveTextContent(/SIM_TIMESTAMP: 18:19:08/);

    const ref = region('Dữ liệu PLC/SCADA tham chiếu');
    expect(within(ref).getByText('Đã đồng bộ dữ liệu thời gian thực làm nền.')).toBeInTheDocument();
    expect(within(ref).getByText('Gas nền (thực tế)').nextElementSibling).toHaveTextContent('0.1% LEL');
    expect(within(ref).getByText('21 Parameters')).toBeInTheDocument();
    await userEvent.click(within(ref).getByRole('button', { name: 'Xem chi tiết dữ liệu nền' }));
    expect(within(ref).getByText('Tank_Pressure_Bar')).toBeInTheDocument();
    expect(within(ref).getByRole('button', { name: 'Thu gọn dữ liệu nền' })).toHaveAttribute('aria-expanded', 'true');

    const report = region('Báo cáo mô phỏng');
    expect(within(report).getByText(/^SIM-RUN-\d{8}-001\.pdf$/)).toBeInTheDocument();
    expect(within(report).getByText('Nháp • Chưa xuất')).toBeInTheDocument();
    expect(within(report).getByRole('button', { name: 'Xuất PDF' })).toHaveAccessibleDescription(/chờ backend/);
    expect(screen.getByRole('img', { name: /Nồng độ gas mô phỏng: 0m 0% LEL, 1m/ })).toBeInTheDocument();
  });

  test('Thêm vào báo cáo → trạng thái tệp đổi, xem trước có gợi ý; Xuất Excel tải CSV; store cảnh báo giữ nguyên', async () => {
    const alertsBefore = await fetchAlerts();
    const user = userEvent.setup();
    const router = renderAt('/operations/ai-simulation/SC-001/result');
    await loaded();
    const ai = region('Gợi ý từ AI');
    await waitFor(() => expect(within(ai).getByText(/^\d+%$/)).toBeInTheDocument(), { timeout: 5000 });
    await user.click(within(ai).getByRole('button', { name: 'Thêm vào báo cáo' }));
    expect(await within(ai).findByText('Đã thêm gợi ý vào báo cáo nháp.')).toBeInTheDocument();
    expect(within(region('Báo cáo mô phỏng')).getByText('Nháp • Đã thêm gợi ý AI • Chưa xuất')).toBeInTheDocument();
    expect((await fetchSimulationSessions()).find((x) => x.id === 'SES-0000')!.report).toMatchObject({ aiIncluded: true });

    await user.click(screen.getByRole('button', { name: 'Xem trước' }));
    expect(router.state.location.search).toContain('preview=1');
    const dialog = await screen.findByRole('dialog', { name: 'Xem trước báo cáo mô phỏng' });
    expect(within(dialog).getByRole('region', { name: 'Gợi ý AI trong báo cáo' })).toHaveTextContent('Kết quả mô phỏng đạt yêu cầu.');
    await user.click(within(dialog).getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Xuất Excel' }));
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(await within(region('Báo cáo mô phỏng')).findByText(/Đã xuất Excel \d\d:\d\d$/)).toBeInTheDocument();

    await user.click(within(ai).getByRole('button', { name: 'Bỏ khỏi báo cáo' }));
    expect(await within(ai).findByRole('button', { name: 'Thêm vào báo cáo' })).toBeInTheDocument();
    expect(await fetchAlerts()).toEqual(alertsBefore);
  });

  test('Người xem: không có Thêm vào báo cáo / Xuất; vẫn Xem trước', async () => {
    renderAt('/operations/ai-simulation/sc-001/result', 'viewer');
    await loaded();
    expect(screen.queryByRole('button', { name: 'Thêm vào báo cáo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xuất Excel' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xem trước' })).toBeInTheDocument();
  });

  test('lượt đang chạy → hướng sang theo dõi; kịch bản chưa có kết quả → cấu hình; mã lạ → không tìm thấy', async () => {
    renderAt('/operations/ai-simulation/SC-001/result?session=SES-0001');
    expect(await screen.findByRole('heading', { name: 'Lượt mô phỏng đang chạy' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Theo dõi lượt đang chạy' })).toBeInTheDocument();
  });

  test('kịch bản chưa có kết quả → link cấu hình', async () => {
    renderAt('/operations/ai-simulation/SC-002/result');
    expect(await screen.findByRole('heading', { name: 'Chưa có kết quả mô phỏng' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cấu hình và chạy mô phỏng' })).toHaveAttribute('href', '/operations/ai-simulation/SC-002/config');
  });

  test('mã lạ → "Không tìm thấy kịch bản"', async () => {
    renderAt('/operations/ai-simulation/SC-999/result');
    expect(await screen.findByRole('heading', { level: 1, name: 'Không tìm thấy kịch bản' })).toBeInTheDocument();
  });
});
