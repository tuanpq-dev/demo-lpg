// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import type { AuthService, AuthState } from '@/api/auth';
import { AuthProvider } from '@/app/auth';
import { dayFromNumber, reportCode } from '@/features/reports';
import { dayNumber, plantDayKey } from '@/lib/plantTime';
import DailyReportDetailPage from '../DailyReportDetailPage';

/*
 * Modal "Ghi nhận mốc kiểm tra" – hành vi form chưa phủ ở CheckpointRecordModal.test.tsx, viết trước khi tách modal thành
 * khối + useCheckpointRecordForm (06/11/2026): thông tin đầu, tóm tắt, công tắc đồng hồ cơ, "Lưu bản nháp" ở lại, lưu nháp
 * thất bại, lỗi khi xác nhận (ném lỗi / { ok: false }) + sửa thì bỏ lỗi, bấm xác nhận khi chưa đủ điều kiện, tệp = đã sửa,
 * tab theo vị trí cuộn. Lỗi giả lập bằng cách bọc `data/checkpointRecord` (cờ `fail`). Không xác nhận mốc thật (dữ liệu giữ nguyên).
 */

const fail = vi.hoisted(() => ({ draft: false, submit: null as null | 'throw' | 'reject' }));
vi.mock('@/data/checkpointRecord', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/data/checkpointRecord')>();
  return {
    ...mod,
    saveRecordDraft: (...a: Parameters<typeof mod.saveRecordDraft>) => (fail.draft ? false : mod.saveRecordDraft(...a)),
    recordCheckpoint: async (...a: Parameters<typeof mod.recordCheckpoint>) => {
      if (fail.submit === 'throw') throw new Error('mất kết nối');
      if (fail.submit === 'reject') return { ok: false as const, error: 'Mốc đã được người khác xác nhận.' };
      return mod.recordCheckpoint(...a);
    },
  };
});

const state: AuthState = { status: 'authenticated', user: { id: 'u1', email: 'op@example.com', name: 'Kỹ sư A', role: 'operator', status: 'active' } };
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

const CODE = reportCode('daily', dayFromNumber(dayNumber(plantDayKey(new Date())) - 3));
async function open(key = '16:00') {
  const router = createMemoryRouter([{ path: '/reports/daily/:code', element: <DailyReportDetailPage /> }], { initialEntries: [`/reports/daily/${CODE}?record=${key}`] });
  render(
    <AuthProvider service={service}>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
  return screen.findByRole('dialog', { name: `Ghi nhận mốc kiểm tra ${key}` });
}
const confirmBtn = (d: HTMLElement) => within(d).getByRole('button', { name: 'Xác nhận mốc 16:00' });
const remark = (d: HTMLElement) => within(d).getByRole('textbox', { name: /Nhận xét của người vận hành/ });
/** Nhập đồng hồ cơ áp suất bồn (cảm biến mất kết nối) + nhận xét → đủ điều kiện xác nhận. */
async function fillReady(user: ReturnType<typeof userEvent.setup>, d: HTMLElement) {
  await user.type(within(d).getByRole('textbox', { name: /Giá trị đồng hồ cơ – Áp suất bồn/ }), '7.2{Enter}');
  await user.click(within(d).getByRole('button', { name: 'Hệ thống ổn định' }));
}

afterEach(() => {
  fail.draft = false;
  fail.submit = null;
  sessionStorage.clear();
});

describe('CheckpointRecordModal – form', () => {
  test('thông tin đầu (mã, mốc, người kiểm tra), tóm tắt "Chưa nhập" → "Đã nhập"; công tắc đồng hồ cơ', async () => {
    const user = userEvent.setup();
    const d = await open();
    expect(within(d).getByText('Mã BC:').parentElement).toHaveTextContent(CODE);
    expect(within(d).getByText('Mốc:').parentElement).toHaveTextContent('16:00');
    const summary = within(d).getByRole('region', { name: 'Tóm tắt ghi nhận' });
    expect(summary).toHaveTextContent(/Nhóm đã kiểm tra\d+\/\d+/);
    expect(summary).toHaveTextContent('Chưa nhập');
    expect(summary).toHaveTextContent('Trạng thái: Chưa đủ điều kiện xác nhận');

    const toggle = within(d).getByRole('button', { name: 'Nhập giá trị đồng hồ cơ' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    expect(within(d).getByRole('button', { name: 'Xong nhập đồng hồ cơ' })).toHaveAttribute('aria-pressed', 'true');

    await fillReady(user, d);
    expect(summary).toHaveTextContent('Đã nhập');
    expect(summary).toHaveTextContent('Trạng thái: Đủ điều kiện xác nhận');
  });

  test('chưa đủ điều kiện: bấm xác nhận không gửi, modal giữ nguyên', async () => {
    const user = userEvent.setup();
    const d = await open();
    await user.click(confirmBtn(d));
    expect(screen.getByRole('dialog', { name: 'Ghi nhận mốc kiểm tra 16:00' })).toBeInTheDocument();
    expect(within(d).queryByRole('alert')).toBeNull();
  });

  test('"Lưu bản nháp" ở lại modal; "Hủy" sau đó vẫn hỏi (nhận xét còn) → "Tiếp tục nhập" quay lại form', async () => {
    const user = userEvent.setup();
    const d = await open();
    await user.click(within(d).getByRole('button', { name: 'Hệ thống ổn định' }));
    await user.click(within(d).getByRole('button', { name: 'Lưu bản nháp' }));
    expect(screen.getByRole('dialog', { name: 'Ghi nhận mốc kiểm tra 16:00' })).toBeInTheDocument();
    expect(sessionStorage.length).toBeGreaterThan(0);
    await user.click(within(d).getByRole('button', { name: 'Hủy' }));
    expect(within(d).getByRole('alert')).toHaveTextContent('Bỏ các thay đổi và xóa bản nháp đã lưu?');
    await user.click(within(d).getByRole('button', { name: 'Tiếp tục nhập' }));
    expect(within(d).getByRole('button', { name: 'Lưu bản nháp' })).toBeInTheDocument();
  });

  test('lưu nháp thất bại → câu lỗi, không đóng', async () => {
    const user = userEvent.setup();
    fail.draft = true;
    const d = await open();
    await user.click(within(d).getByRole('button', { name: 'Lưu và tiếp tục sau' }));
    expect(within(d).getByRole('alert')).toHaveTextContent('Không lưu được nháp (bộ nhớ trình duyệt không khả dụng).');
    expect(screen.getByRole('dialog', { name: 'Ghi nhận mốc kiểm tra 16:00' })).toBeInTheDocument();
  });

  test('xác nhận lỗi mạng → câu lỗi; { ok: false } → lỗi trả về; sửa nhận xét → lỗi biến mất; modal giữ mở', async () => {
    const user = userEvent.setup();
    const d = await open();
    await fillReady(user, d);
    fail.submit = 'throw';
    await user.click(confirmBtn(d));
    expect(await within(d).findByRole('alert')).toHaveTextContent('Không thực hiện được thao tác: mất kết nối');

    fail.submit = 'reject';
    await user.click(confirmBtn(d));
    expect(await within(d).findByText('Mốc đã được người khác xác nhận.')).toBeInTheDocument();
    await user.type(remark(d), '.');
    expect(within(d).queryByRole('alert')).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Ghi nhận mốc kiểm tra 16:00' })).toBeInTheDocument();
  });

  test('chỉ thêm tệp = đã sửa: Hủy → hỏi "Bỏ thay đổi" (không có nháp); Bỏ thay đổi → đóng', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const d = await open();
    const input = d.querySelector<HTMLInputElement>('input[type="file"]')!;
    await user.upload(input, new File(['x'], 'hien-truong.jpg', { type: 'image/jpeg' }));
    await user.click(within(d).getByRole('button', { name: 'Hủy' }));
    expect(within(d).getByRole('alert')).toHaveTextContent('Bỏ các thay đổi chưa lưu?');
    await user.click(within(d).getByRole('button', { name: 'Bỏ thay đổi' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  test('cuộn tới cuối thân modal → tab "Nhận xét" là mục đang xem', async () => {
    const d = await open();
    const nav = within(d).getByRole('navigation', { name: 'Mục của biểu mẫu ghi nhận' });
    expect(within(nav).getByRole('button', { name: 'Tổng quan' })).toHaveAttribute('aria-current', 'location');
    // jsdom không có bố cục: scrollHeight = clientHeight = 0 → coi như đã cuộn hết.
    // Thân cuộn của Modal = phần tử ngay sau thanh tab (`beforeBody`).
    const body = nav.nextElementSibling!;
    fireEvent.scroll(body);
    await waitFor(() => expect(within(nav).getByRole('button', { name: 'Nhận xét' })).toHaveAttribute('aria-current', 'location'));
  });
});
