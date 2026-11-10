// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { RouterProvider, createMemoryRouter, useLocation } from 'react-router-dom';
import type { AuthService, AuthState } from '@/api/auth';
import { AuthProvider } from '@/app/auth';
import type { Role } from '@/features/auth/permissions';
import MaintenancePage from './MaintenancePage';

/*
 * Trang danh sách bảo trì (/maintenance): các khối và điều khiển chưa phủ ở MaintenanceDetailPage.test.tsx – KPI, công việc
 * ưu tiên, lịch sắp tới ("Xem lịch"), tab + tìm kiếm đồng bộ URL, xuất CSV, modal tạo qua ?create=1 (cảnh báo đã có yêu cầu
 * → chuyển sang yêu cầu đó), quyền người xem. Viết trước khi tách trang thành khối (06/11/2026). Chỉ đọc dữ liệu.
 */

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
        path: '/maintenance',
        element: (
          <>
            <MaintenancePage />
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
  return router;
}
const where = () => screen.getByTestId('where').textContent ?? '';
const table = () => screen.findByRole('table', { name: 'Danh sách yêu cầu bảo trì' });

describe('MaintenancePage – khối và điều khiển', () => {
  test('ba khối: 6 KPI, "Công việc cần ưu tiên", danh sách + "Lịch sắp tới"; tiêu đề + breadcrumb', async () => {
    renderAt('/maintenance');
    await table();
    expect(screen.getByRole('heading', { level: 1, name: 'Quản lý bảo trì' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Thống kê bảo trì' }).children).toHaveLength(6);
    expect(screen.getByRole('region', { name: 'Công việc cần ưu tiên' })).toBeInTheDocument();
    const list = screen.getByRole('region', { name: 'Danh sách yêu cầu bảo trì' });
    expect(within(list).getByRole('tablist', { name: 'Lọc theo trạng thái' })).toBeInTheDocument();
    expect(within(list).getByText('Lịch sắp tới')).toBeInTheDocument();
    expect(within(list).getByText(/^Hiển thị 1-\d+ của \d+ yêu cầu$/)).toBeInTheDocument();
  });

  test('tab + tìm kiếm ghi vào URL; "Xoá bộ lọc" bỏ lọc (giữ khoảng ngày)', async () => {
    const user = userEvent.setup();
    renderAt('/maintenance');
    await table();
    await user.click(screen.getByRole('tab', { name: /Quá hạn/ }));
    expect(where()).toContain('tab=overdue');
    await user.type(screen.getByPlaceholderText('Tìm kiếm mã yêu cầu, thiết bị, nội dung...'), 'V-101');
    await waitFor(() => expect(where()).toContain('q=V-101'));
    await user.click(screen.getByRole('button', { name: 'Xoá bộ lọc' }));
    await waitFor(() => expect(where()).not.toContain('q='));
    expect(where()).not.toContain('tab=');
  });

  test('"Xem lịch" → lọc bảo trì định kỳ, sắp theo hạn, tab Tất cả', async () => {
    const user = userEvent.setup();
    renderAt('/maintenance?tab=overdue');
    await table();
    await user.click(screen.getByRole('button', { name: 'Xem lịch' }));
    expect(where()).toContain('type=periodic');
    expect(where()).toContain('sort=due');
    expect(where()).not.toContain('tab=');
  });

  test('"Xuất báo cáo" → tải CSV bao-tri-<ngày nhà máy>.csv', async () => {
    const user = userEvent.setup();
    let blob: Blob | undefined;
    Object.assign(URL, { createObjectURL: vi.fn((b: Blob) => ((blob = b), 'blob:x')), revokeObjectURL: vi.fn() });
    let download = '';
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      download = this.download;
    });
    renderAt('/maintenance');
    await table();
    await user.click(screen.getByRole('button', { name: 'Xuất báo cáo' }));
    expect(download).toMatch(/^bao-tri-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(blob?.type).toBe('text/csv;charset=utf-8');
    click.mockRestore();
  });

  test('"Tạo yêu cầu bảo trì" → ?create=1 mở modal; đóng → bỏ query', async () => {
    const user = userEvent.setup();
    renderAt('/maintenance');
    await table();
    await user.click(screen.getByRole('button', { name: 'Tạo yêu cầu bảo trì' }));
    expect(where()).toContain('create=1');
    const dlg = await screen.findByRole('dialog', { name: /Tạo yêu cầu bảo trì/ });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(dlg).not.toBeInTheDocument());
    expect(where()).not.toContain('create=');
  });

  test('?create=1&from=<cảnh báo đã có yêu cầu> → chuyển sang yêu cầu đó, không mở form', async () => {
    renderAt('/maintenance?create=1&from=ALT-00128');
    await waitFor(() => expect(where()).toBe('/maintenance/MT-00128'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('người xem: không có nút tạo, badge trạng thái không bấm được, ?create=1 không mở form', async () => {
    renderAt('/maintenance?create=1', 'viewer');
    const t = await table();
    expect(screen.queryByRole('button', { name: 'Tạo yêu cầu bảo trì' })).toBeNull();
    expect(within(t).queryByRole('button', { name: /^(Phân công|Cập nhật tiến độ|Nghiệm thu) MT-/ })).toBeNull();
    await act(async () => {});
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
