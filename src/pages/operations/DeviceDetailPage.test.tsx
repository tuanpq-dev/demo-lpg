// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test } from 'vitest';
import { RouterProvider, createMemoryRouter, useLocation } from 'react-router-dom';
import type { AuthService, AuthState } from '@/api/auth';
import { AuthProvider } from '@/app/auth';
import { liveSimulator } from '@/data/live';
import { VAPORIZER_TAGS } from '@/features/live/tags';
import DeviceDetailPage from './DeviceDetailPage';

/*
 * Màn Vận hành – chi tiết thiết bị: routing (mã khác kiểu chữ, mã lạ), số đo trực tiếp vào KPI/bảng/sơ đồ,
 * cảnh báo liên quan từ store chung (bấm → /alerts), mất tín hiệu → không hiện số cũ.
 */

const state: AuthState = {
  status: 'authenticated',
  user: { id: 'u1', email: 'op@example.com', name: 'Kỹ sư A', role: 'operator', status: 'active' },
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
      { path: '/operations/devices/:deviceId', element: <><DeviceDetailPage /><Where /></> },
      { path: '*', element: <Where /> },
    ],
    { initialEntries: [url] },
  );
  render(
    <AuthProvider service={service}>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}
const where = () => screen.getByTestId('where').textContent;
const table = () => screen.getByRole('table', { name: 'Thông số vận hành chi tiết' });
const rowOf = (label: string) => within(table()).getByRole('row', { name: new RegExp(`^${label}`) });

afterEach(() => liveSimulator.restore());

describe('routing /operations/devices/:deviceId', () => {
  test('mã khác kiểu chữ → mã chuẩn, giữ query', async () => {
    renderAt('/operations/devices/e-101a?x=1');
    await waitFor(() => expect(where()).toBe('/operations/devices/E-101A?x=1'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Chi tiết thiết bị' })).toBeInTheDocument();
    expect(screen.getByText('Chi tiết thiết bị - E-101A')).toHaveAttribute('aria-current', 'page');
  });

  test('mã lạ → "Không tìm thấy thiết bị" + nút mở E-101A', async () => {
    const user = userEvent.setup();
    renderAt('/operations/devices/XYZ');
    expect(screen.getByRole('heading', { level: 1, name: 'Không tìm thấy thiết bị' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mở E-101A' }));
    expect(where()).toBe('/operations/devices/E-101A');
  });
});

describe('nội dung', () => {
  test('bảng 6 tham số có ngưỡng; số đo trực tiếp + trạng thái theo ngưỡng', async () => {
    renderAt('/operations/devices/E-101A');
    await waitFor(() => expect(within(rowOf('Hiệu suất')).getByText('Tốt')).toBeInTheDocument(), { timeout: 4000 });
    expect(within(table()).getAllByRole('row')).toHaveLength(7);
    expect(within(rowOf('Nhiệt độ vào')).getByText('0 - 35')).toBeInTheDocument();
    expect(within(rowOf('Áp suất ra')).getByText('2.0 - 5.0')).toBeInTheDocument();
    expect(within(rowOf('Hiệu suất')).getByText('> 85')).toBeInTheDocument();
    expect(within(rowOf('Lưu lượng khí ra')).getByText('Theo dõi')).toBeInTheDocument();
    // TT-201 ~45,6 °C < biên dưới 50 (cùng ngưỡng cảnh báo ALT-00126) → "Thấp".
    expect(within(rowOf('Nhiệt độ ra')).getByText('Thấp')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Sơ đồ Máy hóa hơi LPG E-101A.*áp suất đầu ra \d+\.\d bar/ })).toBeInTheDocument();
    expect(screen.getByText('Trạng thái: Đang hoạt động')).toBeInTheDocument();
    expect(screen.getByText('E-101B dự phòng')).toBeInTheDocument();
  });

  test('cảnh báo liên quan từ store chung; bấm một mục → drawer ở /alerts', async () => {
    const user = userEvent.setup();
    renderAt('/operations/devices/E-101A');
    const item = await screen.findByRole('button', { name: /ALT-00126: Nhiệt độ máy hóa hơi thấp/ });
    expect(item).toHaveTextContent('Chưa xác nhận');
    await user.click(item);
    expect(where()).toBe('/alerts?alert=ALT-00126&range=30d');
  });

  test('mất tín hiệu → "Mất tín hiệu", không hiện số cũ; tín hiệu PLC chuyển trạng thái', async () => {
    renderAt('/operations/devices/E-101A');
    await waitFor(() => expect(within(rowOf('Áp suất ra')).getByText('Ổn định')).toBeInTheDocument(), { timeout: 4000 });
    liveSimulator.setBad([VAPORIZER_TAGS.outletPressure]);
    await waitFor(() => expect(within(rowOf('Áp suất ra')).getAllByText('Mất tín hiệu').length).toBeGreaterThan(0), { timeout: 4000 });
    expect(within(rowOf('Áp suất ra')).queryByText(/^\d+\.\d$/)).toBeNull();
    const plc = screen.getByRole('list', { name: 'Tín hiệu PLC/SCADA' });
    expect(within(plc).getByText('Vaporizer_Outlet_Pressure').closest('li')).toHaveTextContent('Mất tín hiệu');
    expect(screen.getByRole('img', { name: /áp suất đầu ra Mất tín hiệu/ })).toBeInTheDocument();
  });
});
