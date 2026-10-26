// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { MaintenanceRecord } from '@/data/maintenance';
import { ProgressUpdateModal } from './ProgressUpdateModal';

const record: MaintenanceRecord = {
  id: 'MT-77',
  code: 'MT-77',
  title: 'Kiểm tra van an toàn',
  device: 'V-101',
  area: 'Khu bồn LPG',
  type: 'inspection',
  priority: 'critical',
  status: 'in-progress',
  assignee: 'Nguyễn Văn A',
  createdAt: '2026-10-26',
  dueAt: '2099-10-26T16:00',
  completedAt: null,
  progress: 33,
  checklist: [
    { id: 'a', text: 'A', done: true },
    { id: 'b', text: 'B', done: false },
    { id: 'c', text: 'C', done: false },
  ],
  attachments: [{ id: 'f1', name: 'bao-cao.pdf', size: 1000, kind: 'document' }],
};

const DRAFT_KEY = 'demo-lpg:mt-progress-draft:MT-77';

function setup(overrides: Partial<Parameters<typeof ProgressUpdateModal>[0]> = {}) {
  const props = { record, onClose: vi.fn(), onSubmit: vi.fn(async () => {}), onOpenChecklist: vi.fn(), ...overrides };
  const utils = render(<ProgressUpdateModal {...props} />);
  return { ...props, ...utils, user: userEvent.setup() };
}

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('ProgressUpdateModal', () => {
  test('tiêu đề, 5 ô thông tin, chọn sẵn "Đang thực hiện", thanh trượt = tiến độ checklist làm tròn 5', () => {
    setup();
    const dialog = screen.getByRole('dialog', { name: 'Cập nhật tiến độ bảo trì' });
    for (const t of ['Mã số', 'Thiết bị', 'Nhân sự', 'Tiến độ', 'Hạn chót']) expect(within(dialog).getByText(t)).toBeInTheDocument();
    expect(within(dialog).getByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Đang thực hiện' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('slider', { name: 'Tiến độ hoàn thành' })).toHaveAttribute('aria-valuenow', '35');
    expect(screen.getByText('Checklist 1/3')).toBeInTheDocument();
  });

  test('Tạm dừng không có lý do → lỗi, không gửi, focus ô nội dung', async () => {
    const { user, onSubmit } = setup();
    await user.click(screen.getByRole('radio', { name: 'Tạm dừng' }));
    await user.click(screen.getByRole('button', { name: 'Cập nhật tiến độ' }));
    expect(screen.getByText('Nhập lý do tạm dừng.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: /Lý do tạm dừng/ })).toHaveFocus();
  });

  test('Gặp sự cố + mô tả + kéo bằng bàn phím → gửi đúng dữ liệu, xoá nháp', async () => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ state: 'working', progress: 40, text: '', savedAt: '' }));
    const { user, onSubmit } = setup();
    await user.click(screen.getByRole('radio', { name: 'Gặp sự cố' }));
    screen.getByRole('slider').focus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    await user.type(screen.getByRole('textbox', { name: /Mô tả sự cố/ }), 'Kẹt bu-lông mặt bích');
    await user.click(screen.getByRole('button', { name: 'Cập nhật tiến độ' }));
    expect(onSubmit).toHaveBeenCalledWith({ state: 'blocked', progress: 50, text: 'Kẹt bu-lông mặt bích', files: [] });
    expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  test('chọn "Hoàn thành" → thanh trượt 100 % + cảnh báo checklist chưa xong', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('radio', { name: 'Hoàn thành' }));
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText(/Checklist chưa xong hết/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Nội dung đã hoàn thành/ })).toBeRequired();
  });

  test('Lưu nháp: không gửi (không đổi trạng thái), đóng modal; mở lại khôi phục nháp', async () => {
    const first = setup();
    await first.user.click(screen.getByRole('radio', { name: 'Tạm dừng' }));
    await first.user.type(screen.getByRole('textbox', { name: /Lý do tạm dừng/ }), 'Chờ vật tư');
    await first.user.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    expect(first.onSubmit).not.toHaveBeenCalled();
    expect(first.onClose).toHaveBeenCalled();
    expect(JSON.parse(sessionStorage.getItem(DRAFT_KEY)!)).toMatchObject({ state: 'paused', progress: 35, text: 'Chờ vật tư' });
    first.unmount();

    setup();
    expect(screen.getByText('Bản nháp')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Tạm dừng' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('textbox', { name: /Lý do tạm dừng/ })).toHaveValue('Chờ vật tư');
  });

  test('Hủy khi chưa sửa → đóng ngay; đã sửa → hỏi, "Tiếp tục sửa" giữ, "Bỏ thay đổi" xoá nháp + đóng', async () => {
    const clean = setup();
    await clean.user.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(clean.onClose).toHaveBeenCalledTimes(1);
    clean.unmount();

    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ state: 'paused', progress: 35, text: 'x', savedAt: '' }));
    const { user, onClose } = setup();
    await user.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Bỏ các thay đổi và xóa bản nháp đã lưu?');
    expect(screen.getByRole('button', { name: 'Tiếp tục sửa' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Tiếp tục sửa' }));
    expect(screen.getByRole('button', { name: 'Cập nhật tiến độ' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Bỏ thay đổi và xóa nháp' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  test('tải tệp: loại sai bị từ chối; tệp hợp lệ hiện "Chưa tải lên máy chủ"; URL xem trước bị thu hồi khi bỏ tệp / đóng modal', async () => {
    const create = vi.fn((_: Blob) => `blob:mock/${create.mock.calls.length}`);
    const revoke = vi.fn();
    URL.createObjectURL = create as typeof URL.createObjectURL;
    URL.revokeObjectURL = revoke;
    const { user, unmount, onSubmit } = setup();
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [new File(['x'], 'virus.exe')] } });
    expect(screen.getByRole('alert')).toHaveTextContent('virus.exe: không đúng loại tệp cho phép');
    fireEvent.change(input, { target: { files: [new File(['x'], 'anh.png', { type: 'image/png' }), new File(['y'], 'bb.pdf')] } });
    expect(create).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText('Chưa tải lên máy chủ')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Bỏ tệp bb.pdf' }));
    expect(revoke).toHaveBeenCalledWith('blob:mock/2');
    await user.click(screen.getByRole('button', { name: 'Cập nhật tiến độ' }));
    expect(onSubmit).toHaveBeenCalledWith({ state: 'working', progress: 35, text: '', files: [{ name: 'anh.png', size: 1, kind: 'image' }] });
    unmount();
    expect(revoke).toHaveBeenCalledWith('blob:mock/1');
  });

  test('"Mở checklist" lưu nháp khi đang sửa rồi gọi onOpenChecklist', async () => {
    const { user, onOpenChecklist } = setup();
    screen.getByRole('slider').focus();
    await user.keyboard('{ArrowRight}');
    await user.click(screen.getByRole('button', { name: 'Mở checklist' }));
    expect(onOpenChecklist).toHaveBeenCalled();
    expect(JSON.parse(sessionStorage.getItem(DRAFT_KEY)!)).toMatchObject({ progress: 40 });
  });

  test('nháp hỏng trong sessionStorage → bỏ qua', () => {
    sessionStorage.setItem(DRAFT_KEY, '{không phải json');
    setup();
    expect(screen.queryByText('Bản nháp')).toBeNull();
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '35');
  });
});
