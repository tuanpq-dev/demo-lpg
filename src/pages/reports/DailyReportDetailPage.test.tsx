// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { RouterProvider, createMemoryRouter, useLocation } from 'react-router-dom';
import type { AuthService, AuthState } from '@/api/auth';
import { AuthProvider } from '@/app/auth';
import { dayFromNumber, reportCode } from '@/features/reports';
import { dayNumber, plantDayKey } from '@/lib/plantTime';
import DailyReportDetailPage from './DailyReportDetailPage';

/*
 * Chi tiết báo cáo ngày: mã lạ, 5 thẻ theo kịch bản mock (lùi 1 ngày = chờ Người duyệt, lùi 2 ngày = GS-02 ngoài ngưỡng),
 * bảng nhóm theo thiết bị + lọc đồng bộ URL, đổi ngày → báo cáo khác. Ngày tính theo giờ thật (mock sinh theo hôm nay,
 * từ 01/01) – chạy trong 3 ngày đầu năm thì các ca "lùi 2–3 ngày" rơi sang năm trước (không có báo cáo).
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
      {
        path: '/reports/daily/:code',
        element: (
          <>
            <DailyReportDetailPage />
            <Where />
          </>
        ),
      },
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

const daysBack = (n: number) => dayFromNumber(dayNumber(plantDayKey(new Date())) - n);
const codeBack = (n: number) => reportCode('daily', daysBack(n));
const where = () => screen.getByTestId('where').textContent;
const cards = () => screen.getByRole('region', { name: /^Tóm tắt báo cáo/ });
const cardOf = (title: string) => within(cards()).getByRole('heading', { level: 3, name: title }).closest('section')!;
const table = () => screen.getByRole('table', { name: /^Số liệu kiểm tra/ });

describe('DailyReportDetailPage', () => {
  test('mã lạ → "Không tìm thấy báo cáo" + về danh sách', async () => {
    const user = userEvent.setup();
    renderAt('/reports/daily/BCVH-N-01011999');
    expect(await screen.findByRole('heading', { level: 1, name: 'Không tìm thấy báo cáo' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Về danh sách báo cáo' }));
    expect(where()).toBe('/reports');
  });

  test('báo cáo hôm qua: đủ 6 mốc, chờ Người duyệt (1/3), mã viết thường vẫn mở được', async () => {
    renderAt(`/reports/daily/${codeBack(1).toLowerCase()}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Chi tiết báo cáo ngày' })).toBeInTheDocument();
    expect(screen.getByText(codeBack(1), { selector: '[aria-current="page"]' })).toBeInTheDocument();
    expect(within(cardOf('Tiến độ kiểm tra')).getByText('6/6 mốc')).toBeInTheDocument();
    expect(within(cardOf('Tiến độ kiểm tra')).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    expect(within(cardOf('Dữ liệu còn thiếu')).getByText('0 mốc')).toBeInTheDocument();
    expect(within(cardOf('Xác nhận báo cáo')).getByText('1/3')).toBeInTheDocument();
    expect(within(cardOf('Xác nhận báo cáo')).getByText('Chờ Người duyệt (Approver)')).toBeInTheDocument();
    const timeline = screen.getByRole('heading', { level: 3, name: 'Mốc kiểm tra trong ngày' }).closest('section')!;
    expect(within(timeline).getAllByRole('listitem')).toHaveLength(6);
    expect(within(timeline).getAllByText('Đã xác nhận')).toHaveLength(6);
  });

  test('lùi 2 ngày: GS-02 lúc 12:00 ngoài ngưỡng → thẻ bất thường + kết quả dòng "Cảnh báo"', async () => {
    renderAt(`/reports/daily/${codeBack(2)}`);
    expect(await within(await screen.findByRole('region', { name: /^Tóm tắt báo cáo/ })).findByText('GS-02 lúc 12:00')).toBeInTheDocument();
    expect(within(cardOf('Dữ liệu bất thường')).getByText('1')).toBeInTheDocument();
    const gsRow = within(table()).getByRole('row', { name: /GS-02 \/ Khu nạp xuất/ });
    expect(within(gsRow).getByText('Cảnh báo')).toBeInTheDocument();
    expect(within(gsRow).getByText('13')).toBeInTheDocument();
  });

  test('bảng: 5 nhóm thiết bị, thu gọn nhóm; số đọc tại chỗ có ghi chú "XM hiện trường"', async () => {
    const user = userEvent.setup();
    renderAt(`/reports/daily/${codeBack(1)}`);
    await screen.findByRole('heading', { level: 1, name: 'Chi tiết báo cáo ngày' });
    const groups = within(table()).getAllByRole('button');
    expect(groups.map((b) => b.textContent)).toEqual([
      'Bồn chứa LPG – V-101',
      'Thiết bị hóa hơi – E-101A/B',
      'Cụm điều áp – PR-101',
      'Lưu lượng khí cấp – FT-101',
      'Đầu dò khí gas – GS-01…GS-04',
    ]);
    const e101b = within(table()).getByRole('row', { name: /E-101B/ });
    expect(within(e101b).getAllByText('XM hiện trường')).toHaveLength(6);
    await user.click(groups[0]!);
    expect(within(table()).queryByRole('row', { name: /LT-101/ })).not.toBeInTheDocument();
  });

  test('lọc nhóm + tìm kiếm ghi lên URL; "Xóa bộ lọc" trả lại đủ dòng', async () => {
    const user = userEvent.setup();
    renderAt(`/reports/daily/${codeBack(1)}`);
    await screen.findByRole('heading', { level: 1, name: 'Chi tiết báo cáo ngày' });
    await user.type(screen.getByRole('searchbox'), 'gs-03');
    await waitFor(() => expect(where()).toContain('q=gs-03'));
    const dataRows = () =>
      within(table())
        .getAllByRole('row')
        .filter((r) => within(r).queryAllByRole('cell').length > 0);
    expect(dataRows()).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
    await waitFor(() => expect(dataRows()).toHaveLength(14));
  });

  test('đổi "Ngày báo cáo" → mở báo cáo ngày đó, giữ bộ lọc', async () => {
    const { fireEvent } = await import('@testing-library/react');
    renderAt(`/reports/daily/${codeBack(1)}?group=GS`);
    const date = await screen.findByLabelText('Ngày báo cáo');
    fireEvent.change(date, { target: { value: daysBack(3) } });
    await waitFor(() => expect(where()).toBe(`/reports/daily/${codeBack(3)}?group=GS`));
    expect(
      await within(await screen.findByRole('region', { name: /^Tóm tắt báo cáo/ })).findByText('Còn thiếu mốc 16:00, 18:00'),
    ).toBeInTheDocument();
  });
});
