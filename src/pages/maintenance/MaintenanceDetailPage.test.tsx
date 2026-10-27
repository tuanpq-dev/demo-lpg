// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { RouterProvider, createMemoryRouter, useLocation } from 'react-router-dom';
import type { AuthService, AuthState } from '@/api/auth';
import { AuthProvider } from '@/app/auth';
import MaintenancePage from './MaintenancePage';
import MaintenanceDetailPage from './MaintenanceDetailPage';

/*
 * Trang chi tiết yêu cầu bảo trì: routing (vào thẳng URL, mã khác kiểu chữ, mã sai, `?open=` cũ), quay lại đúng bộ lọc,
 * và luồng chính trên mock (Tiếp nhận → tick checklist → ghi chú → hủy). Thay cho test drawer cũ (drawer đã bỏ):
 * cùng các ý – mở bản ghi từ bảng, chuyển bước, phân công – nay chạy trên trang riêng.
 * Store bảo trì là module dùng chung → các test đọc trước, test thay đổi dữ liệu đặt cuối.
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
      { path: '/maintenance', element: <><MaintenancePage /><Where /></> },
      { path: '/maintenance/:id', element: <><MaintenanceDetailPage /><Where /></> },
      { path: '*', element: <Where /> },
    ],
    { initialEntries: [url] },
  );
  render(
    <AuthProvider service={service}>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
  return router;
}
const where = () => screen.getByTestId('where').textContent;

describe('routing /maintenance/:id', () => {
  test('vào thẳng /maintenance/MT-00128: tiêu đề, 3 badge, stepper ở bước "Tiếp nhận", checklist khoá', async () => {
    renderAt('/maintenance/MT-00128');
    expect(await screen.findByRole('heading', { level: 1, name: 'Kiểm tra van an toàn V-101' })).toBeInTheDocument();
    expect(screen.getByText('Bảo trì khẩn cấp')).toBeInTheDocument();
    const stepper = screen.getByRole('navigation', { name: 'Tiến trình xử lý MT-00128' });
    expect(within(stepper).getByText(/Tiếp nhận/).closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('2/6 công việc hoàn thành · 33%')).toBeInTheDocument();
    for (const cb of screen.getAllByRole('checkbox')) expect(cb).toBeDisabled();
    expect(screen.getByText('Tiếp nhận yêu cầu trước khi cập nhật checklist.')).toBeInTheDocument();
    const bar = screen.getByRole('region', { name: 'Thao tác yêu cầu MT-00128' });
    expect(within(bar).getByRole('button', { name: 'Tiếp nhận ngay' })).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'Hủy yêu cầu' })).toBeInTheDocument();
    // Cảnh báo gốc + link thiết bị
    expect(screen.getByRole('article', { name: 'Cảnh báo ALT-00128' })).toHaveTextContent('Lúc cảnh báo');
    expect(screen.getByRole('link', { name: 'Xem chi tiết cảnh báo →' })).toHaveAttribute('href', '/alerts?alert=ALT-00128&range=30d');
    expect(screen.getByRole('link', { name: /V-101.*mở trang chi tiết thiết bị/ })).toHaveAttribute('href', '/map/V-101');
  });

  test('mã khác kiểu chữ → chuyển sang mã chuẩn', async () => {
    renderAt('/maintenance/mt-00128?x=1');
    await screen.findByRole('heading', { level: 1, name: 'Kiểm tra van an toàn V-101' });
    expect(where()).toBe('/maintenance/MT-00128?x=1');
  });

  test('mã sai → "Không tìm thấy yêu cầu", URL giữ nguyên', async () => {
    renderAt('/maintenance/MT-99999');
    expect(await screen.findByRole('heading', { level: 1, name: 'Không tìm thấy yêu cầu' })).toBeInTheDocument();
    expect(screen.getByText('MT-99999', { selector: 'code' })).toBeInTheDocument();
    expect(where()).toBe('/maintenance/MT-99999');
  });

  test('link cũ /maintenance?open=<id> → trang chi tiết; "Quay lại danh sách" về danh sách giữ bộ lọc, bỏ open', async () => {
    const user = userEvent.setup();
    renderAt('/maintenance?tab=pending&open=MT-00127');
    await screen.findByRole('heading', { level: 1, name: 'Kiểm tra cảm biến gas GS-01' });
    expect(where()).toBe('/maintenance/MT-00127');
    await user.click(screen.getByRole('button', { name: '← Quay lại danh sách' }));
    await screen.findByRole('heading', { level: 1, name: 'Quản lý bảo trì' });
    expect(where()).toBe('/maintenance?tab=pending');
  });

  test('bảng → "Xem chi tiết" → trang chi tiết; breadcrumb "Quản lý bảo trì" về đúng bộ lọc', async () => {
    const user = userEvent.setup();
    renderAt('/maintenance?tab=pending&q=V-101');
    await user.click(await screen.findByRole('button', { name: 'Xem chi tiết MT-00128' }));
    await screen.findByRole('heading', { level: 1, name: 'Kiểm tra van an toàn V-101' });
    expect(where()).toBe('/maintenance/MT-00128');
    await user.click(screen.getByRole('link', { name: 'Quản lý bảo trì' }));
    await screen.findByRole('heading', { level: 1, name: 'Quản lý bảo trì' });
    expect(where()).toBe('/maintenance?tab=pending&q=V-101');
  });
});

describe('luồng xử lý trên trang chi tiết (đổi dữ liệu – để cuối)', () => {
  test('Tiếp nhận ngay → bước 2 + lịch sử; tick checklist; thêm ghi chú; hủy có lý do', async () => {
    const user = userEvent.setup();
    renderAt('/maintenance/MT-00128');
    await screen.findByRole('heading', { level: 1, name: 'Kiểm tra van an toàn V-101' });

    // Tiếp nhận: không nhảy bước (pending → assigned), người nhận = người đăng nhập, thêm 1 dòng lịch sử
    await user.click(screen.getByRole('button', { name: 'Tiếp nhận ngay' }));
    const stepper = screen.getByRole('navigation', { name: 'Tiến trình xử lý MT-00128' });
    await waitFor(() => expect(within(stepper).getByText(/Đang thực hiện/).closest('li')).toHaveAttribute('aria-current', 'step'));
    expect(screen.getByText('Tiếp nhận yêu cầu – phụ trách: Kỹ sư A')).toBeInTheDocument();
    // Đã phân công: nút bước kế tiếp nay là "Cập nhật tiến độ" (modal) – không còn "Bắt đầu thực hiện"
    expect(screen.getByRole('button', { name: 'Cập nhật tiến độ' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bắt đầu thực hiện' })).toBeNull();

    // Checklist mở khoá (Đã phân công) – tick → tiến độ 3/6 · 50%
    const box = screen.getByRole('checkbox', { name: 'Kiểm tra cáp tín hiệu cảm biến hành trình ZSO/ZSC' });
    expect(box).toBeEnabled();
    await user.click(box);
    expect(await screen.findByText('3/6 công việc hoàn thành · 50%')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Trả lại mặt bằng/ })).toBeDisabled();

    // Ghi chú mới hiện ngay
    await user.type(screen.getByRole('textbox', { name: 'Ghi chú mới' }), 'Siêu âm không phát hiện rò rỉ.');
    await user.click(screen.getByRole('button', { name: 'Thêm ghi chú' }));
    expect(await screen.findByText('Siêu âm không phát hiện rò rỉ.')).toBeInTheDocument();

    // Hủy: hộp xác nhận + lý do → "Đã hủy", thanh hành động biến mất, lịch sử có lý do
    await user.click(screen.getByRole('button', { name: 'Hủy yêu cầu' }));
    const dialog = screen.getByRole('dialog', { name: 'Hủy yêu cầu MT-00128?' });
    await user.type(within(dialog).getByRole('textbox', { name: /Lý do hủy/ }), 'Trùng yêu cầu');
    await act(async () => {
      await user.click(within(dialog).getByRole('button', { name: 'Xác nhận hủy' }));
    });
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Thao tác yêu cầu MT-00128' })).toBeNull());
    expect(screen.getByText('Hủy yêu cầu – lý do: Trùng yêu cầu')).toBeInTheDocument();
    expect(screen.getAllByText('Đã hủy').length).toBeGreaterThan(0);
    expect(screen.getByRole('navigation', { name: 'Tiến trình xử lý MT-00128' }).querySelector('[aria-current]')).toBeNull();
  });
});

describe('cập nhật tiến độ + nghiệm thu (đổi dữ liệu – để cuối)', () => {
  test('danh sách: badge trạng thái mở modal qua ?progress=; Hủy đóng + bỏ query; dòng Chờ tiếp nhận không mở được', async () => {
    const user = userEvent.setup();
    renderAt('/maintenance');
    await user.click(await screen.findByRole('button', { name: 'Cập nhật tiến độ MT-00125 – trạng thái: Đang thực hiện' }));
    expect(where()).toBe('/maintenance?progress=MT-00125');
    const dialog = screen.getByRole('dialog', { name: 'Cập nhật tiến độ bảo trì' });
    expect(within(dialog).getByText('Ghi nhận tình trạng thực hiện và cập nhật tiến độ công việc MT-00125')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Hủy' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(where()).toBe('/maintenance');
    expect(screen.queryByRole('button', { name: /Cập nhật tiến độ MT-00122/ })).toBeNull();
  });

  test('danh sách: không còn "Chuyển nghiệm thu" hàng loạt (mỗi yêu cầu cần hồ sơ riêng)', async () => {
    const user = userEvent.setup();
    renderAt('/maintenance');
    await user.click(await screen.findByRole('checkbox', { name: 'Chọn hàng MT-00125' }));
    expect(screen.getByRole('toolbar', { name: 'Thao tác hàng loạt' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chuyển nghiệm thu' })).toBeNull();
  });

  test('chi tiết: bắt đầu (qua modal) → Tạm dừng → Hoàn thành = Chờ nghiệm thu (không done); vận hành không thấy nút nghiệm thu', async () => {
    const user = userEvent.setup();
    renderAt('/maintenance/MT-00126');
    await screen.findByRole('heading', { level: 1, name: 'Bảo dưỡng máy hóa hơi E-101A' });
    const bar = () => screen.getByRole('region', { name: 'Thao tác yêu cầu MT-00126' });
    const stepper = () => screen.getByRole('navigation', { name: 'Tiến trình xử lý MT-00126' });
    const openModal = async () => {
      await user.click(within(bar()).getByRole('button', { name: 'Cập nhật tiến độ' }));
      return screen.getByRole('dialog', { name: 'Cập nhật tiến độ bảo trì' });
    };

    // 1. Đã phân công: chưa báo hoàn thành được; cập nhật = bắt đầu (một bước), tiến độ 0 → 10
    let d = await openModal();
    expect(within(d).getByRole('radio', { name: /Hoàn thành/ })).toHaveAttribute('aria-disabled', 'true');
    within(d).getByRole('slider').focus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    await user.click(within(d).getByRole('button', { name: 'Cập nhật tiến độ' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(within(stepper()).getByText(/Chờ nghiệm thu/).closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Bắt đầu thực hiện · 0% → 10%')).toBeInTheDocument();

    // 2. Tạm dừng (lý do bắt buộc) → vẫn bước 3, nhãn phụ ở stepper
    d = await openModal();
    await user.click(within(d).getByRole('radio', { name: 'Tạm dừng' }));
    await user.click(within(d).getByRole('button', { name: 'Cập nhật tiến độ' }));
    expect(within(d).getByText('Nhập lý do tạm dừng.')).toBeInTheDocument();
    await user.type(within(d).getByRole('textbox', { name: /Lý do tạm dừng/ }), 'Chờ nước nóng');
    await user.click(within(d).getByRole('button', { name: 'Cập nhật tiến độ' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(within(stepper()).getByText('Tạm dừng')).toBeInTheDocument();
    expect(within(stepper()).getByText(/Chờ nghiệm thu/).closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Tạm dừng – lý do: Chờ nước nóng · tiến độ 10%')).toBeInTheDocument();

    // 3. Hoàn thành → "Tiếp tục gửi nghiệm thu" → modal Gửi (nội dung điền sẵn vào Tóm tắt); chưa đủ điều kiện → nút khoá có lý do
    d = await openModal();
    await user.click(within(d).getByRole('radio', { name: 'Hoàn thành' }));
    await user.type(within(d).getByRole('textbox', { name: /Nội dung đã hoàn thành/ }), 'Đã vệ sinh bộ trao đổi nhiệt');
    await user.click(within(d).getByRole('button', { name: 'Tiếp tục gửi nghiệm thu' }));
    d = await screen.findByRole('dialog', { name: 'Gửi yêu cầu nghiệm thu' });
    expect(within(stepper()).getByText(/Chờ nghiệm thu/).closest('li')).toHaveAttribute('aria-current', 'step'); // chưa đổi trạng thái
    expect(within(d).getByRole('textbox', { name: /Tóm tắt công việc/ })).toHaveValue('Đã vệ sinh bộ trao đổi nhiệt');
    expect(within(d).getByText('Chưa đủ điều kiện')).toBeInTheDocument();
    const send = within(d).getByRole('button', { name: 'Gửi nghiệm thu' });
    expect(send).toHaveAttribute('aria-disabled', 'true');
    expect(send).toHaveAccessibleDescription(/Chưa nhập nguyên nhân xác định.*Chưa nhập biện pháp.*Chưa chọn người nghiệm thu/);
    await user.click(send); // nút khoá: không gửi, modal vẫn mở, trạng thái chưa đổi
    expect(screen.getByRole('dialog', { name: 'Gửi yêu cầu nghiệm thu' })).toBeInTheDocument();
    expect(within(stepper()).getByText(/Chờ nghiệm thu/).closest('li')).toHaveAttribute('aria-current', 'step');

    await user.type(within(d).getByRole('textbox', { name: /Nguyên nhân xác định/ }), 'Cặn bám');
    await user.type(within(d).getByRole('textbox', { name: /Biện pháp/ }), 'Súc rửa hóa chất');
    await user.click(within(d).getByRole('button', { name: /Người nghiệm thu/ }));
    // người thực hiện (Lê Thị C) không có trong danh sách
    expect(screen.queryByRole('option', { name: /Lê Thị C/ })).toBeNull();
    await user.click(screen.getByRole('option', { name: 'Trần Hoàng Nam (Quản lý vận hành)' }));
    expect(within(d).getByText('Đủ điều kiện gửi nghiệm thu')).toBeInTheDocument();
    await act(async () => {
      await user.click(within(d).getByRole('button', { name: 'Gửi nghiệm thu' }));
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Gửi nghiệm thu – người nghiệm thu: Trần Hoàng Nam · 10% → 100%')).toBeInTheDocument();
    expect(within(stepper()).getAllByRole('listitem').at(-1)).toHaveAttribute('aria-current', 'step');
    // vận hành: không thấy nút Nghiệm thu, không còn Cập nhật tiến độ
    expect(within(bar()).queryByRole('button', { name: 'Nghiệm thu' })).toBeNull();
    expect(within(bar()).queryByRole('button', { name: 'Cập nhật tiến độ' })).toBeNull();
  });

  test('kỹ sư/quản trị: Cần bổ sung → Không đạt (cờ, ghi chú) → gửi lại → Đạt → khối Kết quả bảo trì', async () => {
    const role = state.user!.role;
    state.user!.role = 'admin';
    try {
      const user = userEvent.setup();
      renderAt('/maintenance/MT-00126');
      await screen.findByRole('heading', { level: 1, name: 'Bảo dưỡng máy hóa hơi E-101A' });
      const bar = () => screen.getByRole('region', { name: 'Thao tác yêu cầu MT-00126' });
      const openReview = async () => {
        await user.click(await within(bar()).findByRole('button', { name: 'Nghiệm thu' }));
        return screen.getByRole('dialog', { name: 'Nghiệm thu yêu cầu bảo trì' });
      };
      const resubmit = async () => {
        await user.click(await within(bar()).findByRole('button', { name: 'Gửi nghiệm thu' }));
        const d = screen.getByRole('dialog', { name: 'Gửi yêu cầu nghiệm thu' });
        await user.type(within(d).getByRole('textbox', { name: /Tóm tắt công việc/ }), 'Đã bổ sung');
        await user.type(within(d).getByRole('textbox', { name: /Nguyên nhân xác định/ }), 'Cặn bám');
        await user.type(within(d).getByRole('textbox', { name: /Biện pháp/ }), 'Súc rửa');
        await user.click(within(d).getByRole('button', { name: /Người nghiệm thu/ }));
        await user.click(screen.getByRole('option', { name: /Trần Hoàng Nam/ }));
        await act(async () => {
          await user.click(within(d).getByRole('button', { name: 'Gửi nghiệm thu' }));
        });
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      };

      // Hồ sơ gửi hiện trong modal; người nghiệm thu = người đăng nhập (chỉ đọc)
      let d = await openReview();
      expect(within(d).getByText('Cặn bám')).toBeInTheDocument();
      expect(within(d).getByRole('textbox', { name: /Người nghiệm thu/ })).toHaveValue('Kỹ sư A');
      expect(within(d).getByRole('radiogroup', { name: 'Kết quả nghiệm thu' })).toBeInTheDocument();

      // Cần bổ sung: ý kiến bắt buộc → ghi chú của người nghiệm thu; lịch sử chỉ trỏ tới ghi chú
      await user.click(within(d).getByRole('radio', { name: 'Cần bổ sung' }));
      await user.click(within(d).getByRole('button', { name: 'Yêu cầu bổ sung' }));
      expect(within(d).getByText('Nhập nội dung cần bổ sung.')).toBeInTheDocument();
      await user.type(within(d).getByRole('textbox', { name: /Ý kiến đánh giá/ }), 'Thiếu ảnh tấm số 3');
      await act(async () => {
        await user.click(within(d).getByRole('button', { name: 'Yêu cầu bổ sung' }));
      });
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(screen.getByText('Nghiệm thu: Cần bổ sung – Thiếu ảnh tấm số 3')).toBeInTheDocument();
      expect(screen.getByText('Nghiệm thu: Cần bổ sung – xem ghi chú kỹ thuật')).toBeInTheDocument();
      expect(within(bar()).getByRole('button', { name: 'Cập nhật tiến độ' })).toBeInTheDocument();

      // Gửi lại → Không đạt: cờ "Không đạt nghiệm thu"
      await resubmit();
      d = await openReview();
      await user.click(within(d).getByRole('radio', { name: 'Không đạt' }));
      await user.type(within(d).getByRole('textbox', { name: /Ý kiến đánh giá/ }), 'Còn rò rỉ');
      await act(async () => {
        await user.click(within(d).getByRole('button', { name: 'Xác nhận không đạt' }));
      });
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(screen.getAllByText('Không đạt nghiệm thu').length).toBeGreaterThan(0);
      expect(screen.getByText('Nghiệm thu: Không đạt – Còn rò rỉ')).toBeInTheDocument();

      // Gửi lại → Đạt (theo dõi 2 giờ mặc định) → Hoàn thành + khối Kết quả bảo trì
      await resubmit();
      expect(screen.queryByText('Không đạt nghiệm thu')).toBeNull();
      d = await openReview();
      await act(async () => {
        await user.click(within(d).getByRole('button', { name: 'Xác nhận hoàn thành' }));
      });
      await waitFor(() => expect(screen.queryByRole('region', { name: 'Thao tác yêu cầu MT-00126' })).toBeNull());
      expect(screen.getByText(/Nghiệm thu đạt – hoàn thành · theo dõi thêm 2 giờ/)).toBeInTheDocument();
      const result = screen.getByText('Kết quả nghiệm thu').closest('dl')!;
      expect(within(result).getByText('Đạt yêu cầu')).toBeInTheDocument();
      expect(within(result).getByText('Kỹ sư A')).toBeInTheDocument();
      expect(within(result).getByText(/^2 giờ – đến \d{2}:\d{2}/)).toBeInTheDocument();
      expect(within(result).getByText('Súc rửa')).toBeInTheDocument();
    } finally {
      state.user!.role = role;
    }
  });

  test('chặn tự nghiệm thu: người đăng nhập = người thực hiện → nút khoá, đọc được lý do (mở qua ?review=1)', async () => {
    const saved = { ...state.user! };
    Object.assign(state.user!, { role: 'admin', name: 'Lê Thị C' });
    try {
      const user = userEvent.setup();
      renderAt('/maintenance/MT-00115?review=1');
      const d = await screen.findByRole('dialog', { name: 'Nghiệm thu yêu cầu bảo trì' });
      await waitFor(() => expect(where()).toBe('/maintenance/MT-00115'));
      const ok = within(d).getByRole('button', { name: 'Xác nhận hoàn thành' });
      expect(ok).toHaveAttribute('aria-disabled', 'true');
      expect(ok).toHaveAccessibleDescription(/Người thực hiện không được tự nghiệm thu/);
      await user.click(ok);
      expect(screen.getByRole('dialog', { name: 'Nghiệm thu yêu cầu bảo trì' })).toBeInTheDocument();
      expect(screen.getAllByText('Chờ nghiệm thu').length).toBeGreaterThan(0);
    } finally {
      Object.assign(state.user!, saved);
    }
  });

  test('phân công: badge "Chờ tiếp nhận" ở danh sách mở modal qua ?assign=; xác nhận → ở lại danh sách, dòng cập nhật', async () => {
    const user = userEvent.setup();
    renderAt('/maintenance');
    await user.click(await screen.findByRole('button', { name: 'Phân công MT-00122 – trạng thái: Chờ tiếp nhận' }));
    expect(where()).toBe('/maintenance?assign=MT-00122');
    const d = screen.getByRole('dialog', { name: 'Phân công người xử lý' });
    await user.click(within(d).getByRole('radio', { name: /Phạm Văn D/ }));
    await act(async () => {
      await user.click(within(d).getByRole('button', { name: 'Xác nhận phân công' }));
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(where()).toBe('/maintenance');
    expect(screen.getByText('Đã phân công MT-00122 cho Phạm Văn D.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Phân công MT-00122/ })).toBeNull();
  });

  test('phân công hàng loạt: chỉ dòng Chờ tiếp nhận, báo "đã phân công X, bỏ qua N"', async () => {
    const user = userEvent.setup();
    renderAt('/maintenance');
    await user.click(await screen.findByRole('checkbox', { name: 'Chọn hàng MT-00121' }));
    await user.click(screen.getByRole('checkbox', { name: 'Chọn hàng MT-00125' }));
    await user.click(screen.getByRole('button', { name: /Phân công \(chỉ Chờ tiếp nhận\)/ }));
    await act(async () => {
      await user.click(screen.getByRole('option', { name: 'Võ Thị F' }));
    });
    expect(await screen.findByText(/^Đã phân công 1 · bỏ qua 1 \(1 không ở Chờ tiếp nhận\)/)).toBeInTheDocument();
  });

  test('chi tiết: nút "Phân công người xử lý" (Chờ tiếp nhận) → modal → Đã phân công, ở lại trang, lịch sử', async () => {
    const user = userEvent.setup();
    renderAt('/maintenance/MT-00127');
    await screen.findByRole('heading', { level: 1, name: 'Kiểm tra cảm biến gas GS-01' });
    await user.click(screen.getByRole('button', { name: 'Phân công người xử lý' }));
    const d = screen.getByRole('dialog', { name: 'Phân công người xử lý' });
    expect(within(d).getAllByRole('radio').every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true);
    await user.click(within(d).getByRole('radio', { name: /Lê Thị C/ }));
    await user.type(within(d).getByRole('textbox', { name: /Ghi chú phân công/ }), 'Mang máy đo cầm tay');
    await act(async () => {
      await user.click(within(d).getByRole('button', { name: 'Xác nhận phân công' }));
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(where()).toBe('/maintenance/MT-00127');
    expect(screen.getByText('Phân công: Lê Thị C')).toBeInTheDocument();
    expect(screen.getByText('Phân công: Mang máy đo cầm tay')).toBeInTheDocument();
    expect(screen.getAllByText('Đã phân công').length).toBeGreaterThan(0);
  });

  test('đổi người (?assign=1, Đã phân công): lý do bắt buộc → lịch sử "Đổi người xử lý: A → B", xoá nháp tiến độ người cũ', async () => {
    const user = userEvent.setup();
    // Nháp tiến độ của người cũ trên trình duyệt này – không được chuyển sang người mới.
    sessionStorage.setItem('demo-lpg:mt-progress-draft:MT-00124', JSON.stringify({ state: 'working', progress: 40, text: 'nháp cũ', savedAt: '' }));
    renderAt('/maintenance/MT-00124?assign=1');
    const d = await screen.findByRole('dialog', { name: 'Đổi người xử lý' });
    await waitFor(() => expect(where()).toBe('/maintenance/MT-00124'));
    await user.click(within(d).getByRole('radio', { name: /Nguyễn Văn A/ }));
    const ok = within(d).getByRole('button', { name: 'Xác nhận đổi người' });
    expect(ok).toHaveAttribute('aria-disabled', 'true');
    await user.type(within(d).getByRole('textbox', { name: /Lý do đổi người xử lý/ }), 'Cần kỹ sư van');
    await act(async () => {
      await user.click(ok);
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Đổi người xử lý: Phạm Văn D → Nguyễn Văn A – lý do: Cần kỹ sư van')).toBeInTheDocument();
    expect(sessionStorage.getItem('demo-lpg:mt-progress-draft:MT-00124')).toBeNull();
  });

  test('Chờ nghiệm thu: không có nút phân công / đổi người', async () => {
    renderAt('/maintenance/MT-00114');
    await screen.findByRole('heading', { level: 1, name: 'Kiểm tra họng nạp số 2' });
    expect(screen.queryByRole('button', { name: /Đổi người xử lý|Phân công người xử lý/ })).toBeNull();
  });
});
