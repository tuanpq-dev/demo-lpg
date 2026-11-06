// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import type { AuthService, AuthState } from '@/api/auth';
import { AuthProvider } from '@/app/auth';
import type { Role } from '@/features/auth/permissions';
import { resetToasts } from '@/lib/toast';
import MaintenanceDetailPage from './MaintenanceDetailPage';

/*
 * Trang chi tiết bảo trì – hành vi trước khi tách thành khối (06/11/2026), bổ sung cho MaintenanceDetailPage.test.tsx:
 * thao tác ghi (Tiếp nhận, tick checklist, thêm ghi chú, hủy) cả ca LỖI (máy chủ từ chối → toast lỗi / lỗi trong hộp thoại,
 * dữ liệu không đổi) lẫn ca thành công; quyền chỉ xem; các khối; tệp; #checklist; lỗi tải.
 * Lỗi giả lập bằng cách bọc `useMaintenance`: `fail.op` = tên thao tác sẽ ném lỗi ở lần gọi tới.
 * Store dùng chung trong file → các test đổi dữ liệu nối tiếp nhau trên MT-00128 (đang Chờ tiếp nhận).
 */

type Op = 'advance' | 'toggleChecklist' | 'addNote' | 'cancel';
const fail = vi.hoisted(() => ({ op: null as Op | null, load: false }));

vi.mock('@/data/maintenance', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/data/maintenance')>();
  return {
    ...mod,
    useMaintenance: () => {
      const m = mod.useMaintenance();
      if (fail.load) return { ...m, status: 'error' as const, data: undefined, error: new Error('máy chủ bận') };
      const wrap =
        <K extends Op>(k: K) =>
        (...args: Parameters<(typeof m)[K]>) => {
          if (fail.op === k) {
            fail.op = null;
            return Promise.reject(new Error('lỗi mạng'));
          }
          return (m[k] as (...a: unknown[]) => unknown)(...args);
        };
      return { ...m, advance: wrap('advance'), toggleChecklist: wrap('toggleChecklist'), addNote: wrap('addNote'), cancel: wrap('cancel') };
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

function renderAt(url: string, role: Role = 'operator') {
  const router = createMemoryRouter([{ path: '/maintenance/:id', element: <MaintenanceDetailPage /> }], { initialEntries: [url] });
  render(
    <AuthProvider service={service(role)}>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
  return router;
}
const TITLE = 'Kiểm tra van an toàn V-101';
const ERR = 'Không thực hiện được thao tác: lỗi mạng';
const stepper = () => screen.getByRole('navigation', { name: 'Tiến trình xử lý MT-00128' });
const bar = () => screen.getByRole('region', { name: 'Thao tác yêu cầu MT-00128' });

afterEach(() => {
  fail.op = null;
  fail.load = false;
  resetToasts();
});
/** Toast lỗi (khung toast + thông báo đọc màn hình có thể cùng chữ). */
const toastShown = async () => expect((await screen.findAllByText(ERR)).length).toBeGreaterThan(0);

describe('chi tiết bảo trì – chỉ đọc', () => {
  test('lỗi tải danh sách → thẻ lỗi + "Thử lại", breadcrumb giữ mã', async () => {
    fail.load = true;
    renderAt('/maintenance/MT-00128');
    expect(await screen.findByText('Không tải được yêu cầu bảo trì')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'MT-00128' })).toBeInTheDocument();
  });

  test('các khối: thông tin chung, nội dung, ghi chú, tệp, lịch sử, kết quả; cột phải: hạn chót, phân công, cảnh báo, thiết bị', async () => {
    renderAt('/maintenance/MT-00128');
    await screen.findByRole('heading', { level: 1, name: TITLE });
    for (const t of ['Thông tin chung', 'Nội dung công việc', 'Checklist công việc', 'Ghi chú kỹ thuật', 'Ảnh và tài liệu', 'Lịch sử xử lý', 'Kết quả bảo trì']) {
      expect(screen.getByText(t)).toBeInTheDocument();
    }
    expect(screen.getByText('Mã yêu cầu').parentElement).toHaveTextContent('MT-00128');
    expect(screen.getByText('Nguồn tạo').parentElement).toHaveTextContent('Cảnh báo ALT-00128');
    expect(screen.getByText('Người phụ trách').parentElement).toHaveTextContent('Chưa phân công');
    expect(screen.getByText('Kết quả bảo trì sẽ được cập nhật sau khi công việc hoàn thành.')).toBeInTheDocument();
    expect(screen.getByText('Tạo yêu cầu (Auto-Trigger)')).toBeInTheDocument();
    const aside = screen.getByRole('complementary', { name: 'Phân công và liên quan' });
    expect(within(aside).getByRole('button', { name: 'Phân công người xử lý' })).toBeInTheDocument();
    expect(within(aside).getByText('Thiết bị liên quan')).toBeInTheDocument();
    expect(within(aside).getByRole('link', { name: 'Xem chi tiết thiết bị →' })).toHaveAttribute('href', '/map/V-101');
  });

  test('tệp mẫu: "Xem" → hộp thoại Dữ liệu mẫu + tải bản .txt; Đóng', async () => {
    const user = userEvent.setup();
    renderAt('/maintenance/MT-00128');
    await screen.findByRole('heading', { level: 1, name: TITLE });
    await user.click(screen.getByRole('button', { name: 'Xem bao-cao-kiem-dinh.pdf' }));
    const dlg = screen.getByRole('dialog', { name: 'bao-cao-kiem-dinh.pdf' });
    expect(dlg).toHaveTextContent('Dữ liệu mẫu');
    expect(within(dlg).getByRole('button', { name: 'Tải bản mẫu (.txt)' })).toBeInTheDocument();
    await user.click(within(dlg).getAllByRole('button', { name: 'Đóng' }).find((b) => b.textContent === 'Đóng')!);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('#checklist → focus khối Checklist', async () => {
    renderAt('/maintenance/MT-00128#checklist');
    await screen.findByRole('heading', { level: 1, name: TITLE });
    await waitFor(() => expect(document.activeElement).toHaveAttribute('id', 'checklist'));
  });

  test('người xem: không có thanh thao tác, không thêm ghi chú, không phân công, checklist chỉ xem', async () => {
    renderAt('/maintenance/MT-00128', 'viewer');
    await screen.findByRole('heading', { level: 1, name: TITLE });
    expect(screen.queryByRole('region', { name: 'Thao tác yêu cầu MT-00128' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Ghi chú mới' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Phân công người xử lý' })).toBeNull();
    expect(screen.getByText('Bạn chỉ có quyền xem checklist.')).toBeInTheDocument();
    for (const cb of screen.getAllByRole('checkbox')) expect(cb).toBeDisabled();
  });
});

describe('chi tiết bảo trì – thao tác ghi: lỗi rồi thành công (đổi dữ liệu, nối tiếp)', () => {
  test('"Tiếp nhận ngay": lỗi → toast lỗi, vẫn bước Tiếp nhận; thử lại → Đã phân công', async () => {
    const user = userEvent.setup();
    renderAt('/maintenance/MT-00128');
    await screen.findByRole('heading', { level: 1, name: TITLE });
    fail.op = 'advance';
    await user.click(within(bar()).getByRole('button', { name: 'Tiếp nhận ngay' }));
    await toastShown();
    expect(within(stepper()).getByText(/Tiếp nhận/).closest('li')).toHaveAttribute('aria-current', 'step');
    expect(within(bar()).getByRole('button', { name: 'Tiếp nhận ngay' })).toBeInTheDocument();

    await user.click(within(bar()).getByRole('button', { name: 'Tiếp nhận ngay' }));
    await waitFor(() => expect(within(stepper()).getByText(/Đang thực hiện/).closest('li')).toHaveAttribute('aria-current', 'step'));
    expect(screen.getByText('Tiếp nhận yêu cầu – phụ trách: Kỹ sư A')).toBeInTheDocument();
  });

  test('tick checklist: lỗi → toast lỗi, ô không đổi, tiến độ giữ 2/6; thử lại → 3/6', async () => {
    const user = userEvent.setup();
    renderAt('/maintenance/MT-00128');
    await screen.findByRole('heading', { level: 1, name: TITLE });
    const name = 'Kiểm tra cáp tín hiệu cảm biến hành trình ZSO/ZSC';
    fail.op = 'toggleChecklist';
    await user.click(screen.getByRole('checkbox', { name }));
    await toastShown();
    expect(screen.getByRole('checkbox', { name })).not.toBeChecked();
    expect(screen.getByText('2/6 công việc hoàn thành · 33%')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name }));
    expect(await screen.findByText('3/6 công việc hoàn thành · 50%')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name })).toBeChecked();
  });

  test('thêm ghi chú: lỗi → toast lỗi, ghi chú không vào danh sách; lần sau → hiện trong luồng', async () => {
    const user = userEvent.setup();
    renderAt('/maintenance/MT-00128');
    await screen.findByRole('heading', { level: 1, name: TITLE });
    const notes = () => screen.getByRole('list', { name: 'Ghi chú kỹ thuật' });
    fail.op = 'addNote';
    await user.type(screen.getByRole('textbox', { name: 'Ghi chú mới' }), 'Ghi chú lỗi');
    await user.click(screen.getByRole('button', { name: 'Thêm ghi chú' }));
    await toastShown();
    expect(within(notes()).queryByText('Ghi chú lỗi')).toBeNull();

    await user.clear(screen.getByRole('textbox', { name: 'Ghi chú mới' }));
    await user.type(screen.getByRole('textbox', { name: 'Ghi chú mới' }), 'Đã siêu âm xong.');
    await user.click(screen.getByRole('button', { name: 'Thêm ghi chú' }));
    expect(await within(notes()).findByText('Đã siêu âm xong.')).toBeInTheDocument();
  });

  test('hủy: lỗi → câu lỗi trong hộp thoại, hộp thoại giữ mở, thanh thao tác còn; thử lại → Đã hủy', async () => {
    const user = userEvent.setup();
    renderAt('/maintenance/MT-00128');
    await screen.findByRole('heading', { level: 1, name: TITLE });
    await user.click(within(bar()).getByRole('button', { name: 'Hủy yêu cầu' }));
    const dlg = screen.getByRole('dialog', { name: 'Hủy yêu cầu MT-00128?' });
    fail.op = 'cancel';
    await user.click(within(dlg).getByRole('button', { name: 'Xác nhận hủy' }));
    expect(await within(dlg).findByRole('alert')).toHaveTextContent(ERR);
    expect(bar()).toBeInTheDocument();

    await act(async () => {
      await user.click(within(dlg).getByRole('button', { name: 'Xác nhận hủy' }));
    });
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Thao tác yêu cầu MT-00128' })).toBeNull());
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
