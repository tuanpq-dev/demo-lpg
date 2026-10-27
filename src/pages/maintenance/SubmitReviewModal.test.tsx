// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { MaintenanceRecord } from '@/data/maintenance';
import { SubmitReviewModal } from './SubmitReviewModal';

const record = (patch: Partial<MaintenanceRecord> = {}): MaintenanceRecord => ({
  id: 'MT-88',
  code: 'MT-88',
  title: 'Kiểm tra van an toàn PSV-101',
  device: 'P-999', // không có số liệu trực tiếp → ô áp suất/nhiệt độ "—"
  area: 'Khu bồn LPG',
  type: 'inspection',
  priority: 'critical',
  status: 'in-progress',
  assignee: 'Nguyễn Văn A',
  createdAt: '2026-10-26',
  dueAt: '2099-10-26T16:00',
  completedAt: null,
  progress: 100,
  reportedProgress: 80,
  checklist: [
    { id: 'a', text: 'Kiểm tra trực quan', done: true },
    { id: 'b', text: 'Ghi nhận áp suất', done: true },
    { id: 'c', text: 'Ký đóng PTW', done: false, na: true },
  ],
  ...patch,
});

const DRAFT_KEY = 'demo-lpg:mt-submit-draft:MT-88';

function setup(props: Partial<Parameters<typeof SubmitReviewModal>[0]> = {}) {
  const p = { record: record(), onClose: vi.fn(), onSubmit: vi.fn(async () => {}), ...props };
  const utils = render(
    <MemoryRouter>
      <SubmitReviewModal {...p} />
    </MemoryRouter>,
  );
  return { ...p, ...utils, user: userEvent.setup() };
}

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole('textbox', { name: /Tóm tắt công việc/ }), 'Đã kiểm tra');
  await user.type(screen.getByRole('textbox', { name: /Nguyên nhân xác định/ }), 'Bụi bẩn');
  await user.type(screen.getByRole('textbox', { name: /Biện pháp/ }), 'Vệ sinh');
  await user.click(screen.getByRole('button', { name: /Người nghiệm thu/ }));
  await user.click(screen.getByRole('option', { name: 'Trần Hoàng Nam (Quản lý vận hành)' }));
}

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('SubmitReviewModal', () => {
  test('thẻ đầu + checklist chỉ đọc dữ liệu thật (x/y bỏ N/A); thiếu → badge + danh sách thiếu, nút khoá đọc được lý do', async () => {
    const { user, onSubmit } = setup();
    const d = screen.getByRole('dialog', { name: 'Gửi yêu cầu nghiệm thu' });
    expect(within(d).getByText('Kiểm tra van an toàn PSV-101')).toBeInTheDocument();
    expect(within(d).getByText('2/2')).toBeInTheDocument();
    expect(within(d).queryByRole('checkbox')).toBeNull();
    expect(within(d).getByText('Chưa đủ điều kiện')).toBeInTheDocument();
    const send = within(d).getByRole('button', { name: 'Gửi nghiệm thu' });
    expect(send).toHaveAttribute('aria-disabled', 'true');
    expect(send).toHaveAccessibleDescription(/Chưa nhập tóm tắt công việc/);
    await user.click(send);
    send.focus();
    await user.keyboard('{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(send).toHaveFocus(); // vẫn focus được – lý do đọc qua aria-describedby
    expect(d).toBeInTheDocument();
  });

  test('"Thời gian đề nghị" có sẵn mặc định (mốc 15 phút) và sửa được', async () => {
    const { user } = setup();
    const input = screen.getByLabelText('Thời gian đề nghị') as HTMLInputElement;
    expect(input.value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:(00|15|30|45)$/);
    await user.clear(input);
    await user.type(input, '2099-10-26T15:30');
    expect(input).toHaveValue('2099-10-26T15:30');
  });

  test('radiogroup tình trạng có nhãn; "Chưa khắc phục" vẫn gửi được nhưng có cảnh báo', async () => {
    const { user, onSubmit } = setup();
    const group = screen.getByRole('radiogroup', { name: 'Tình trạng thiết bị sau bảo trì' });
    await user.click(within(group).getByRole('radio', { name: 'Chưa khắc phục' }));
    expect(group).toHaveAccessibleDescription(/Thiết bị chưa khắc phục/);
    await fill(user);
    expect(screen.getByText('Đủ điều kiện gửi nghiệm thu')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Gửi nghiệm thu' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ deviceCondition: 'unresolved', reviewer: 'Trần Hoàng Nam', summary: 'Đã kiểm tra', remedy: 'Vệ sinh' }));
  });

  test('người nghiệm thu: không có người thực hiện trong danh sách', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /Người nghiệm thu/ }));
    expect(screen.queryByRole('option', { name: /Nguyễn Văn A/ })).toBeNull();
    expect(screen.getByRole('option', { name: /Trần Văn B/ })).toBeInTheDocument();
  });

  test('checklist chưa xong → không gửi được dù đã điền đủ', async () => {
    const { user, onSubmit } = setup({ record: record({ checklist: [{ id: 'a', text: 'A', done: false }] }) });
    await fill(user);
    expect(screen.getByText('Checklist chưa hoàn thành (0/1)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Gửi nghiệm thu' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('điền sẵn Tóm tắt từ modal tiến độ; Lưu nháp không gửi; mở lại khôi phục; Esc khi đã sửa → hỏi xác nhận', async () => {
    const first = setup({ prefill: { text: 'Đã thay gioăng', files: [] } });
    expect(screen.getByRole('textbox', { name: /Tóm tắt công việc/ })).toHaveValue('Đã thay gioăng');
    await first.user.type(screen.getByRole('textbox', { name: /Biện pháp/ }), 'Thay mới');
    await first.user.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    expect(first.onSubmit).not.toHaveBeenCalled();
    expect(first.onClose).toHaveBeenCalled();
    expect(JSON.parse(sessionStorage.getItem(DRAFT_KEY)!)).toMatchObject({ summary: 'Đã thay gioăng', remedy: 'Thay mới' });
    first.unmount();

    const second = setup();
    expect(screen.getByRole('textbox', { name: /Biện pháp/ })).toHaveValue('Thay mới');
    await second.user.keyboard('{Escape}');
    expect(second.onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Bỏ các thay đổi và xóa bản nháp đã lưu?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tiếp tục sửa' })).toHaveFocus();
  });

  test('chưa sửa gì: Esc đóng ngay', async () => {
    const { user, onClose } = setup();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
