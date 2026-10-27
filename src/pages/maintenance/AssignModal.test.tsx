// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { MaintenanceRecord } from '@/data/maintenance';
import { AssignModal } from './AssignModal';

const rec = (patch: Partial<MaintenanceRecord> = {}): MaintenanceRecord => ({
  id: 'MT-77',
  code: 'MT-77',
  title: 'Kiểm tra van an toàn PSV-101',
  device: 'V-101',
  area: 'Khu bồn LPG',
  type: 'inspection',
  priority: 'critical',
  status: 'pending',
  assignee: null,
  createdAt: '2026-10-26',
  dueAt: '2099-10-26T16:00',
  completedAt: null,
  progress: 0,
  ...patch,
});

// Trần Bình đang Bận (3 việc, 1 quá hạn); Nguyễn Văn A 1 việc.
const busy = (i: number, due = '2099-01-01T08:00') => rec({ id: `w${i}`, code: `W${i}`, status: 'in-progress', assignee: 'Trần Bình', dueAt: due });
const records = [busy(1, '2020-01-01T08:00'), busy(2), busy(3), rec({ id: 'w4', status: 'assigned', assignee: 'Nguyễn Văn A' })];
const DRAFT_KEY = 'demo-lpg:mt-assign-draft:MT-77';

function setup(patch: Partial<MaintenanceRecord> = {}, onSubmit = vi.fn(async () => {})) {
  const onClose = vi.fn();
  const utils = render(
    <MemoryRouter>
      <AssignModal record={rec(patch)} records={records} onClose={onClose} onSubmit={onSubmit} />
    </MemoryRouter>,
  );
  return { ...utils, onClose, onSubmit, user: userEvent.setup() };
}

beforeEach(() => sessionStorage.clear());
/** Khối cảnh báo nhìn thấy (vùng aria-live ẩn lặp lại cùng câu chữ). */
const warnList = () => screen.getByRole('list', { name: 'Cảnh báo phân công' });

describe('AssignModal', () => {
  test('header (mã, tiêu đề, thiết bị, khu vực, mức độ, trạng thái hiện tại); KHÔNG chọn sẵn ai; nút xác nhận khoá có lý do', async () => {
    const { user, onSubmit } = setup();
    const d = screen.getByRole('dialog', { name: 'Phân công người xử lý' });
    expect(within(d).getByText('MT-77')).toBeInTheDocument();
    expect(within(d).getByText('Kiểm tra van an toàn PSV-101')).toBeInTheDocument();
    expect(within(d).getByText('Chờ tiếp nhận')).toBeInTheDocument();
    const list = within(d).getByRole('radiogroup', { name: 'Danh sách nhân sự' });
    expect(within(list).getAllByRole('radio').every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true);
    expect(within(list).queryByRole('radio', { name: /Hoàng Minh E/ })).toBeNull(); // trưởng ca không còn chọn được
    const ok = within(d).getByRole('button', { name: 'Xác nhận phân công' });
    expect(ok).toHaveAttribute('aria-disabled', 'true');
    expect(ok).toHaveAccessibleDescription(/Chưa chọn người xử lý chính/);
    await user.click(ok);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('chọn thẻ bằng bàn phím ↔ ô Người xử lý chính đồng bộ; nút xoá có nhãn; ca điền theo người', async () => {
    const { user } = setup();
    const list = screen.getByRole('radiogroup', { name: 'Danh sách nhân sự' });
    within(list).getAllByRole('radio')[0]!.focus();
    await user.keyboard(' ');
    expect(within(list).getByRole('radio', { name: /Nguyễn Văn A/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'Bỏ chọn Nguyễn Văn A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ca làm việc/ })).toHaveTextContent('Ca 2'); // ca mặc định của Nguyễn Văn A
    await user.click(screen.getByRole('button', { name: 'Bỏ chọn Nguyễn Văn A' }));
    expect(within(list).getAllByRole('radio').every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true);
  });

  test('người phối hợp không gồm người chính; xác nhận gửi đủ trường', async () => {
    const { user, onSubmit } = setup();
    await user.click(screen.getByRole('radio', { name: /Lê Thị C/ }));
    await user.click(screen.getByRole('combobox', { name: 'Người phối hợp' }));
    expect(screen.queryByRole('option', { name: /Lê Thị C/ })).toBeNull();
    await user.click(screen.getByRole('option', { name: /Võ Thị F/ }));
    await user.type(screen.getByRole('textbox', { name: /Ghi chú phân công/ }), 'Lưu ý cô lập áp suất');
    await user.click(screen.getByRole('button', { name: 'Xác nhận phân công' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ assignee: 'Lê Thị C', collaborators: ['Võ Thị F'], dueAt: '2099-10-26T16:00', shift: 'shift-2', note: 'Lưu ý cô lập áp suất', notify: true }),
    );
  });

  test('cảnh báo không chặn (Bận, quá hạn) đọc qua aria-live; hạn < bắt đầu thì chặn', async () => {
    const { user, onSubmit } = setup();
    await user.click(screen.getByRole('radio', { name: /Trần Bình/ }));
    expect(screen.getByRole('radio', { name: /Trần Bình/ })).toHaveAccessibleDescription(/Bận.*3 đang làm.*1 quá hạn/);
    const live = document.querySelector('[aria-live="polite"].sr-only');
    expect(live).toHaveTextContent(/Cảnh báo: Trần Bình đang Bận/);
    expect(live?.querySelector('button')).toBeNull(); // không có nút trong vùng live
    expect(within(warnList()).getByText(/đang có 1 việc quá hạn/)).toBeInTheDocument();
    const start = screen.getByLabelText('Bắt đầu dự kiến');
    await user.type(start, '2099-10-26T18:00');
    expect(screen.getByText('Hạn chót sớm hơn thời gian bắt đầu dự kiến')).toBeInTheDocument();
    expect(within(warnList()).getByText(/Giờ bắt đầu 18:00 không thuộc Ca 1/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Xác nhận phân công' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('lệch ca: giữ ca bản ghi, nút "Đổi sang Ca <ca mặc định của người>" đổi ngay và hết cảnh báo', async () => {
    const { user, onSubmit } = setup({ shift: 'shift-1', startAt: '2099-10-26T14:00' });
    expect(screen.getByRole('button', { name: /Ca làm việc/ })).toHaveTextContent('Ca 1'); // ca của bản ghi
    await user.click(screen.getByRole('radio', { name: /Nguyễn Văn A/ })); // ca mặc định: Ca 2
    expect(screen.getByRole('button', { name: /Ca làm việc/ })).toHaveTextContent('Ca 1'); // không tự đổi
    expect(within(warnList()).getByText(/Giờ bắt đầu 14:00 không thuộc Ca 1/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Đổi sang Ca 2' }));
    expect(screen.getByRole('button', { name: /Ca làm việc/ })).toHaveTextContent('Ca 2');
    expect(screen.queryByRole('list', { name: 'Cảnh báo phân công' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Đổi sang Ca/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Xác nhận phân công' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ shift: 'shift-2' }));
  });

  test('lệch ca nhưng ca mặc định của người trùng ca đang chọn → không có nút đổi ca', async () => {
    const { user } = setup({ shift: 'shift-2', startAt: '2099-10-26T08:00' });
    await user.click(screen.getByRole('radio', { name: /Nguyễn Văn A/ }));
    expect(within(warnList()).getByText(/Giờ bắt đầu 08:00 không thuộc Ca 2/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Đổi sang Ca/ })).toBeNull();
  });

  test('lọc rỗng → empty state + "Xóa bộ lọc"', async () => {
    const { user } = setup();
    await user.type(screen.getByRole('searchbox', { name: 'Tìm kiếm nhân sự' }), 'không ai tên này');
    expect(screen.getByText('Không có nhân sự phù hợp với bộ lọc.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
    expect(screen.getAllByRole('radio').length).toBeGreaterThan(3);
  });

  test('đổi người (Đang thực hiện): tiêu đề + người hiện tại chọn sẵn, lý do bắt buộc', async () => {
    const { user, onSubmit } = setup({ status: 'in-progress', assignee: 'Trần Bình' });
    expect(screen.getByRole('dialog', { name: 'Đổi người xử lý' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Trần Bình/ })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('radio', { name: /Lê Thị C/ }));
    const ok = screen.getByRole('button', { name: 'Xác nhận đổi người' });
    expect(ok).toHaveAccessibleDescription(/Chưa nhập lý do đổi người xử lý/);
    await user.click(ok);
    expect(onSubmit).not.toHaveBeenCalled();
    await user.type(screen.getByRole('textbox', { name: /Lý do đổi người xử lý/ }), 'Nghỉ phép');
    await user.click(ok);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ assignee: 'Lê Thị C', reason: 'Nghỉ phép' }));
  });

  test('Lưu tạm: không gửi, đóng; mở lại khôi phục; Esc khi đã sửa → hỏi; chưa sửa → đóng ngay', async () => {
    const first = setup();
    await first.user.click(screen.getByRole('radio', { name: /Lê Thị C/ }));
    await first.user.click(screen.getByRole('button', { name: 'Lưu tạm' }));
    expect(first.onSubmit).not.toHaveBeenCalled();
    expect(first.onClose).toHaveBeenCalled();
    expect(JSON.parse(sessionStorage.getItem(DRAFT_KEY)!)).toMatchObject({ assignee: 'Lê Thị C' });
    first.unmount();

    const second = setup();
    expect(screen.getByRole('radio', { name: /Lê Thị C/ })).toHaveAttribute('aria-checked', 'true');
    await second.user.keyboard('{Escape}');
    expect(second.onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Bỏ các thay đổi và xóa bản lưu tạm?')).toBeInTheDocument();
    await second.user.click(screen.getByRole('button', { name: 'Bỏ thay đổi và xóa bản lưu tạm' }));
    expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull();
    second.unmount();

    const third = setup();
    await third.user.keyboard('{Escape}');
    expect(third.onClose).toHaveBeenCalled();
  });

  test('công tắc thông báo: role switch, chỉ giao diện (ghi rõ chưa gửi)', async () => {
    const { user } = setup();
    const sw = screen.getByRole('switch', { name: /Gửi thông báo đẩy và SMS/ });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(sw).toHaveAccessibleDescription(/Chưa gửi được – chờ backend/);
    await user.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'false');
  });
});
