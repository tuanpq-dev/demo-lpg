// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { RouterProvider, createMemoryRouter, useLocation } from 'react-router-dom';
import type { AuthService, AuthState } from '@/api/auth';
import { AuthProvider } from '@/app/auth';
import { liveSimulator } from '@/data/live';
import type { Role } from '@/features/auth/permissions';
import AssetDetailRoute from './AssetDetailPage';

/*
 * Chi tiết tài sản /map/:assetId – hành vi trước khi tách thành khối (06/11/2026): chuẩn hoá mã / không tìm thấy, lỗi tải,
 * tiêu đề + nút, 6 KPI, tồn chứa (mặt cắt + lớp), cột phải (tình trạng, cảnh báo liên quan, bảo trì), sự kiện (lọc loại
 * qua ?hide=), mất tín hiệu, tạo yêu cầu bảo trì (?create=1 → thông báo + link), quyền người xem.
 * Mô hình 3D (SceneViewer, cần WebGL) thay bằng khung rỗng; lỗi tải giả lập bằng cờ `fail.load`.
 */
vi.mock('@/app/AssetModelPanel', () => ({
  AssetModelPanel: ({ description }: { description: string }) => <div data-testid="model">{description}</div>,
}));
const fail = vi.hoisted(() => ({ load: false }));
vi.mock('@/data/assetDetail', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/data/assetDetail')>();
  return {
    ...mod,
    useAssetDetail: (id: string) => {
      const s = mod.useAssetDetail(id);
      return fail.load ? { ...s, status: 'error' as const, data: undefined, error: new Error('máy chủ bận') } : s;
    },
  };
});

function service(role: Role): AuthService {
  const state: AuthState = { status: 'authenticated', user: { id: 'u1', email: 'x@example.com', name: 'Kỹ sư A', role, status: 'active' } };
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
function Where() {
  const l = useLocation();
  return <output data-testid="where">{`${l.pathname}${l.search}`}</output>;
}
function renderAt(url: string, role: Role = 'operator') {
  const router = createMemoryRouter(
    [
      {
        path: '/map/:assetId',
        element: (
          <>
            <AssetDetailRoute />
            <Where />
          </>
        ),
      },
      { path: '*', element: <Where /> },
    ],
    { initialEntries: [url] },
  );
  render(
    <AuthProvider service={service(role)}>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}
const where = () => screen.getByTestId('where').textContent ?? '';
const ready = () => screen.findByRole('region', { name: 'Chỉ số bồn' }, { timeout: 5000 });

afterEach(() => {
  fail.load = false;
  liveSimulator.restore();
});

describe('AssetDetailPage – route', () => {
  test('mã khác kiểu chữ → mã chuẩn (giữ query)', async () => {
    renderAt('/map/v-101?hide=system');
    await waitFor(() => expect(where()).toBe('/map/V-101?hide=system'));
  });
  test('mã lạ → "Không tìm thấy tài sản" + nút mở V-101', async () => {
    const user = userEvent.setup();
    renderAt('/map/XYZ-9');
    expect(await screen.findByRole('heading', { level: 1, name: 'Không tìm thấy tài sản' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mở V-101' }));
    expect(where()).toBe('/map/V-101');
  });
  test('lỗi tải → thẻ lỗi + "Thử lại" + "Về Tổng quan"', async () => {
    fail.load = true;
    renderAt('/map/V-101');
    expect(await screen.findByText('Không tải được tài sản')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Về Tổng quan' })).toBeInTheDocument();
  });
});

describe('AssetDetailPage – nội dung', () => {
  test('tiêu đề, 6 KPI, tồn chứa (mặt cắt + 5 dòng), 3 thẻ cột phải, mô tả mô hình', async () => {
    renderAt('/map/V-101');
    const kpi = await ready();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('V-101');
    for (const l of ['Mức bồn', 'Thể tích', 'Áp suất', 'Nhiệt độ', 'Tồn kho', 'Sức khỏe thiết bị']) expect(kpi).toHaveTextContent(l);
    expect(screen.getByText('Trạng thái tồn chứa trong bồn')).toBeInTheDocument();
    for (const l of ['LPG lỏng', 'Pha hơi / khí gas', 'Nước đáy bồn', 'Cảnh báo nước đáy']) expect(screen.getAllByText(l).length).toBeGreaterThan(0);
    const aside = screen.getByRole('complementary', { name: 'Tình trạng, cảnh báo và bảo trì' });
    expect(within(aside).getByText('Tình trạng tài sản')).toBeInTheDocument();
    expect(within(aside).getByText('Cảnh báo liên quan')).toBeInTheDocument();
    expect(screen.getByTestId('model')).toHaveTextContent(/: mức bồn .+, áp suất .+, nhiệt độ .+, trạng thái tồn chứa .+\./);
  });

  test('"Xem trên bản đồ" → Tổng quan 3D, focus tài sản', async () => {
    const user = userEvent.setup();
    renderAt('/map/V-101');
    await ready();
    await user.click(screen.getByRole('button', { name: 'Xem trên bản đồ' }));
    expect(where()).toBe('/overview?map=3d&focus=V-101');
  });

  test.each(['Lịch sử cảnh báo', 'Xem tất cả'])('"%s" → /alerts?q=V-101&range=30d', async (name) => {
    const user = userEvent.setup();
    renderAt('/map/V-101');
    await ready();
    await user.click(screen.getByRole('button', { name }));
    expect(where()).toBe('/alerts?q=V-101&range=30d');
  });

  test('sự kiện: bảng 5 dòng mỗi trang; bỏ loại ở chú thích → ?hide= (aria-pressed); "Xem toàn bộ nhật ký" khoá', async () => {
    const user = userEvent.setup();
    renderAt('/map/V-101');
    await ready();
    const table = screen.getByRole('table', { name: 'Sự kiện gần đây của V-101' });
    expect(within(table).getAllByRole('row').length).toBeLessThanOrEqual(6);
    const legend = screen.getByRole('group', { name: 'Lọc theo loại sự kiện' });
    const sys = within(legend).getByRole('button', { name: 'Hệ thống' });
    expect(sys).toHaveAttribute('aria-pressed', 'true');
    await user.click(sys);
    expect(sys).toHaveAttribute('aria-pressed', 'false');
    expect(where()).toContain('hide=system');
    expect(screen.getByRole('button', { name: 'Xem toàn bộ nhật ký của V-101' })).toBeDisabled();
  });

  test('mất tín hiệu áp suất → KPI + dòng tồn chứa "Mất tín hiệu", không số cũ', async () => {
    renderAt('/map/V-101');
    await ready();
    act(() => liveSimulator.setBad(['PT-101'], true));
    await waitFor(() => expect(screen.getByText('Áp suất bồn').nextElementSibling).toHaveTextContent('Mất tín hiệu'));
  });
});

describe('AssetDetailPage – tạo yêu cầu bảo trì', () => {
  test('người xem: không có nút tạo, ?create=1 bị bỏ qua', async () => {
    renderAt('/map/V-101?create=1', 'viewer');
    await ready();
    expect(screen.queryByRole('button', { name: 'Tạo yêu cầu bảo trì' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('nút tạo → ?create=1 + thiết bị điền sẵn; tạo xong → đóng, thông báo + link "Xem trong Bảo trì", × đóng thông báo', async () => {
    const user = userEvent.setup();
    renderAt('/map/V-101');
    await ready();
    await user.click(screen.getByRole('button', { name: 'Tạo yêu cầu bảo trì' }));
    expect(where()).toContain('create=1');
    const dlg = await screen.findByRole('dialog', { name: 'Tạo yêu cầu bảo trì' });
    expect(within(dlg).getByLabelText('Khu vực')).not.toHaveValue('');
    await user.type(within(dlg).getByLabelText(/Tên yêu cầu/), 'Kiểm tra bồn V-101');
    await user.click(within(dlg).getByRole('button', { name: 'Tạo yêu cầu' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(where()).not.toContain('create=');
    const done = screen.getByText(/^Đã tạo yêu cầu MT-\d+\.$/, { selector: 'span' });
    expect(screen.getByRole('link', { name: 'Xem trong Bảo trì' })).toHaveAttribute('href', expect.stringMatching(/^\/maintenance\//));
    await user.click(screen.getByRole('button', { name: 'Đóng thông báo' }));
    expect(done).not.toBeInTheDocument();
  });
});
