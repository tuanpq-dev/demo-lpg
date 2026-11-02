// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { RouterProvider, createMemoryRouter, useLocation } from 'react-router-dom';
import type { AuthService, AuthState } from '@/api/auth';
import { AuthProvider } from '@/app/auth';
import { dayFromNumber, reportCode } from '@/features/reports';
import { dayNumber, plantDayKey } from '@/lib/plantTime';
import DailyReportDetailPage from '../DailyReportDetailPage';

/*
 * Modal "Ghi nhận mốc kiểm tra" trên chi tiết báo cáo ngày (?record=<mốc>). Kịch bản mock lùi 3 ngày (giờ thật): thiếu mốc
 * 16:00 + 18:00, cảm biến áp suất bồn mất kết nối → phải nhập đồng hồ cơ. Store báo cáo dùng chung giữa các test – test
 * xác nhận mốc để CUỐI.
 */

const userOf = (role: 'viewer' | 'operator'): AuthState => ({
  status: 'authenticated',
  user: { id: 'u1', email: 'op@example.com', name: 'Kỹ sư A', role, status: 'active' },
});
const serviceOf = (state: AuthState): AuthService => ({
  getState: () => state,
  subscribe: () => () => {},
  init: async () => {},
  login: async () => state.user!,
  register: async () => '',
  logout: async () => {},
  refresh: async () => true,
  expiresAt: () => null,
});

function Where() {
  const l = useLocation();
  return <output data-testid="where">{`${l.pathname}${l.search}`}</output>;
}

function renderAt(url: string, role: 'viewer' | 'operator' = 'operator') {
  const router = createMemoryRouter(
    [
      {
        path: '/reports/daily/:code',
        element: (
          <>
            <DailyReportDetailPage />
            <Where />
          </>
        ),
      },
    ],
    { initialEntries: [url] },
  );
  render(
    <AuthProvider service={serviceOf(userOf(role))}>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

const CODE = reportCode('daily', dayFromNumber(dayNumber(plantDayKey(new Date())) - 3));
const where = () => screen.getByTestId('where').textContent ?? '';
const dialog = (key = '16:00') => screen.findByRole('dialog', { name: `Ghi nhận mốc kiểm tra ${key}` });
const confirmBtn = (d: HTMLElement, key = '16:00') => within(d).getByRole('button', { name: `Xác nhận mốc ${key}` });
const timeline = () => screen.getByRole('heading', { level: 3, name: 'Mốc kiểm tra trong ngày' }).closest('section')!;

describe('CheckpointRecordModal', () => {
  test('nút header "Ghi nhận mốc 16:00" → ?record; 8 tab; cảm biến mất kết nối + chưa nhận xét → khoá', async () => {
    const user = userEvent.setup();
    renderAt(`/reports/daily/${CODE}`);
    // Nút ở header (nút trên dải mốc cùng tên – cùng thao tác).
    const [headerBtn, timelineBtn] = await screen.findAllByRole('button', { name: 'Ghi nhận mốc 16:00' });
    expect(timeline()).toContainElement(timelineBtn!);
    await user.click(headerBtn!);
    expect(where()).toContain('record=16%3A00');
    const d = await dialog();
    const nav = within(d).getByRole('navigation', { name: 'Mục của biểu mẫu ghi nhận' });
    expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Tổng quan',
      'Bồn chứa LPG',
      'Máy hóa hơi',
      'Bộ điều áp',
      'Lưu lượng',
      'Gas & Báo cháy',
      'PLC/SCADA',
      'Nhận xét',
    ]);
    expect(within(nav).getByRole('button', { name: 'Tổng quan' })).toHaveAttribute('aria-current', 'location');
    expect(within(d).getByText('Gián đoạn')).toBeInTheDocument();
    expect(within(d).getByText('Mất kết nối', { selector: 'span' })).toBeInTheDocument();
    expect(confirmBtn(d)).toHaveAttribute('aria-disabled', 'true');
    expect(confirmBtn(d)).toHaveAccessibleDescription(/Thiếu dữ liệu nhóm Bồn chứa LPG; Chưa nhập nhận xét vận hành/);
    expect(within(d).getByRole('textbox', { name: /Nhận xét của người vận hành/ })).toHaveAccessibleDescription(/Cần nhập nhận xét vận hành/);
    await user.click(within(nav).getByRole('button', { name: 'Nhận xét' }));
    expect(within(nav).getByRole('button', { name: 'Nhận xét' })).toHaveAttribute('aria-current', 'location');
  });

  test('không mở: mốc đã có dữ liệu; viewer không có nút ghi nhận', async () => {
    renderAt(`/reports/daily/${CODE}?record=08:00`);
    await screen.findByRole('heading', { level: 1, name: 'Chi tiết báo cáo ngày' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('viewer: không có nút ghi nhận, ?record bị bỏ qua', async () => {
    renderAt(`/reports/daily/${CODE}?record=16:00`, 'viewer');
    await screen.findByRole('heading', { level: 1, name: 'Chi tiết báo cáo ngày' });
    expect(screen.queryByRole('button', { name: /Ghi nhận mốc/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('nháp: "Lưu và tiếp tục sau" đóng, mở lại khôi phục nhận xét; "Hủy" khi có thay đổi → hỏi bỏ + xóa nháp', async () => {
    const user = userEvent.setup();
    renderAt(`/reports/daily/${CODE}?record=18:00`);
    let d = await dialog('18:00');
    await user.click(within(d).getByRole('button', { name: 'Không có bất thường' }));
    await user.click(within(d).getByRole('button', { name: 'Lưu và tiếp tục sau' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(where()).not.toContain('record=');

    await user.click(within(timeline()).getByRole('button', { name: 'Ghi nhận mốc 18:00' }));
    d = await dialog('18:00');
    expect(within(d).getByText('Đang mở bản nháp đã lưu.')).toBeInTheDocument();
    expect(within(d).getByRole('textbox', { name: /Nhận xét của người vận hành/ })).toHaveValue('Không có bất thường');
    await user.click(within(d).getByRole('button', { name: 'Hủy' }));
    expect(within(d).getByRole('alert')).toHaveTextContent('Bỏ các thay đổi và xóa bản nháp đã lưu?');
    await user.click(within(d).getByRole('button', { name: 'Bỏ thay đổi và xóa nháp' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  test('nhập đồng hồ cơ + nhận xét gợi ý → xác nhận → mốc 16:00 có dữ liệu, bảng dùng số nhập tay', async () => {
    const user = userEvent.setup();
    renderAt(`/reports/daily/${CODE}?record=16:00`);
    const d = await dialog();
    expect(within(d).queryByText('Đang mở bản nháp đã lưu.')).not.toBeInTheDocument();
    const gauge = within(d).getByRole('textbox', { name: /Giá trị đồng hồ cơ – Áp suất bồn/ });
    await user.type(gauge, '7.2{Enter}');
    await user.click(within(d).getByRole('button', { name: 'Hệ thống ổn định' }));
    expect(within(d).getByRole('textbox', { name: /Nhận xét của người vận hành/ })).toHaveValue('Hệ thống ổn định');
    expect(within(d).getByText('Trạng thái: Đủ điều kiện xác nhận')).toBeInTheDocument();
    expect(confirmBtn(d)).not.toHaveAttribute('aria-disabled');

    await user.click(confirmBtn(d));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(where()).not.toContain('record=');
    const items = within(timeline()).getAllByRole('listitem');
    expect(items[4]).toHaveTextContent('16:00Đã xác nhận');
    expect(within(items[5]!).getByRole('button', { name: 'Ghi nhận mốc 18:00' })).toBeInTheDocument();
    const row = screen.getByRole('row', { name: /PT-101 \/ V-101/ });
    expect(within(row).getByText('7,2')).toBeInTheDocument();
  });
});
