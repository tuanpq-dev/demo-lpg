// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { CreateMaintenanceModal } from './CreateMaintenanceModal';

const devices = [{ device: 'V-101', area: 'Khu bồn' }];

describe('CreateMaintenanceModal – validate bắt buộc', () => {
  test('gửi form trống (xoá cả hạn điền sẵn) → lỗi tên/thiết bị/hạn, không gọi onSubmit, focus vào ô lỗi đầu tiên', async () => {
    localStorage.clear();
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    render(<CreateMaintenanceModal open onClose={() => {}} devices={devices} onSubmit={onSubmit} />);
    await user.clear(screen.getByLabelText(/Hạn hoàn thành/));
    await user.click(screen.getByRole('button', { name: 'Tạo yêu cầu' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Nhập tên yêu cầu (ít nhất 5 ký tự).')).toBeInTheDocument();
    expect(screen.getByText('Chọn thiết bị.')).toBeInTheDocument();
    expect(screen.getByText('Chọn hạn hoàn thành.')).toBeInTheDocument();
    expect(document.activeElement).toHaveAttribute('aria-invalid', 'true');
  });

  test('hạn trước thời gian bắt đầu → lỗi', async () => {
    localStorage.clear();
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    render(<CreateMaintenanceModal open onClose={() => {}} devices={devices} defaultDevice="V-101" onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/Tên yêu cầu/), 'Kiểm tra van an toàn');
    const start = (screen.getByLabelText(/Thời gian bắt đầu/) as HTMLInputElement).value;
    const due = screen.getByLabelText(/Hạn hoàn thành/);
    await user.clear(due);
    await user.type(due, start);
    await user.click(screen.getByRole('button', { name: 'Tạo yêu cầu' }));
    expect(screen.getByText('Hạn hoàn thành phải sau thời gian bắt đầu.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('dialog có tên truy cập, Esc gọi onClose', async () => {
    localStorage.clear();
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CreateMaintenanceModal open onClose={onClose} devices={devices} onSubmit={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Tạo yêu cầu bảo trì' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
