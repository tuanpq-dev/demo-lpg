// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test } from 'vitest';
import { RouterProvider, createMemoryRouter, useLocation } from 'react-router-dom';
import type { AuthService, AuthState } from '@/api/auth';
import { AuthProvider } from '@/app/auth';
import { liveSimulator } from '@/data/live';
import { PLC_SCADA_TAGS, VAPORIZER_TAGS, V101_TAGS } from '@/features/live/tags';
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

describe('hệ thống PLC/SCADA (/operations/devices/PLC-SCADA)', () => {
  test('mã viết thường → PLC-SCADA; KPI, sơ đồ 6 nhóm nguồn, bảng 9 thông số', async () => {
    renderAt('/operations/devices/plc-scada');
    await waitFor(() => expect(where()).toBe('/operations/devices/PLC-SCADA'));
    expect(screen.getByText('Chi tiết thiết bị - PLC-SCADA')).toHaveAttribute('aria-current', 'page');
    await waitFor(() => expect(within(rowOf('Tag khả dụng')).getByText('21/21')).toBeInTheDocument(), { timeout: 4000 });
    const kpis = screen.getByRole('region', { name: 'Chỉ số chính' });
    expect(within(kpis).getByText('Trực tuyến')).toBeInTheDocument();
    expect(within(kpis).getByText('Đã kết nối')).toBeInTheDocument();
    expect(within(kpis).getByText('Siemens S7-1200 ổn định')).toBeInTheDocument();
    expect(screen.getByText('Trạng thái: Đang hoạt động')).toBeInTheDocument();
    expect(within(table()).getAllByRole('row')).toHaveLength(10);
    expect(within(rowOf('Độ trễ dữ liệu')).getByText('> 3.0 giây')).toBeInTheDocument();
    expect(within(rowOf('Chế độ vận hành')).getByText('Thông tin')).toBeInTheDocument();
    const diagram = screen.getByRole('group', { name: /Sơ đồ kết nối: 6 nhóm thiết bị.*PLC Siemens S7-1200 \(Trực tuyến\).*Tag đồng bộ 21\/21/ });
    expect(within(within(diagram).getByRole('list', { name: 'Nhóm thiết bị gửi dữ liệu' })).getAllByRole('listitem')).toHaveLength(6);
  });

  test('cảnh báo liên quan = cảnh báo mất tín hiệu cảm biến (store chung)', async () => {
    renderAt('/operations/devices/PLC-SCADA');
    expect(await screen.findByRole('button', { name: /ALT-00122: Mất tín hiệu cảm biến áp suất PT-102/ })).toBeInTheDocument();
  });

  test('mất tín hiệu tag bồn → tag khả dụng giảm, nút "Bồn LPG V-101" mất tín hiệu; mất heartbeat → PLC xám', async () => {
    renderAt('/operations/devices/PLC-SCADA');
    await waitFor(() => expect(within(rowOf('Tag khả dụng')).getByText('21/21')).toBeInTheDocument(), { timeout: 4000 });
    liveSimulator.setBad([V101_TAGS.pressure, PLC_SCADA_TAGS.heartbeat]);
    await waitFor(() => expect(within(rowOf('Tag khả dụng')).getByText('20/21')).toBeInTheDocument(), { timeout: 4000 });
    expect(within(rowOf('Tag lỗi')).getByText('Cảnh báo')).toBeInTheDocument();
    expect(within(rowOf('PLC Heartbeat')).getAllByText('Mất tín hiệu').length).toBeGreaterThan(0);
    expect(screen.getByText(/Bồn LPG V-101/).closest('li')).toHaveTextContent('mất tín hiệu');
    expect(screen.getByRole('group', { name: /Nhóm mất tín hiệu: Bồn LPG V-101/ })).toBeInTheDocument();
  });
});

describe('đổi thiết bị ở header', () => {
  test('ô "Thiết bị" liệt kê mọi thiết bị; chọn PLC-SCADA → chuyển trang, giữ query', async () => {
    const user = userEvent.setup();
    renderAt('/operations/devices/E-101A?x=1');
    const picker = await screen.findByRole('button', { name: /^Thiết bị/ });
    expect(picker).toHaveTextContent('E-101A');
    await user.click(picker);
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['E-101A', 'PLC-SCADA']);
    await user.click(screen.getByRole('option', { name: 'PLC-SCADA' }));
    await waitFor(() => expect(where()).toBe('/operations/devices/PLC-SCADA?x=1'));
    expect(await screen.findByText('Chi tiết thiết bị - PLC-SCADA')).toHaveAttribute('aria-current', 'page');
  });
});

