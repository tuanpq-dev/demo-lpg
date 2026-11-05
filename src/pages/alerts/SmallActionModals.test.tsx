// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { alertRecords } from '@/mocks/alerts';
import { maintenanceRecords } from '@/mocks/maintenance';
import { CancelMaintenanceModal } from '../maintenance/MaintenanceDetailDialogs';
import { AlertBulkCloseModal } from './AlertBulkCloseModal';
import { SupportRequestModal } from './SupportRequestModal';

// Các modal nhỏ gọi thao tác ghi: lỗi máy chủ phải hiện trong modal (role="alert"), không lọt thành unhandled rejection.
const fail = () => vi.fn(async () => Promise.reject(new Error('Mất kết nối máy chủ')));
const ERROR_TEXT = 'Không thực hiện được thao tác: Mất kết nối máy chủ';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('AlertBulkCloseModal', () => {
  test('đóng thành công → gọi onConfirm với ghi chú, không có lỗi', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn(async () => {});
    render(<AlertBulkCloseModal eligible={2} skippedText={null} onClose={vi.fn()} onConfirm={onConfirm} />);
    await user.type(screen.getByRole('textbox', { name: /Ghi chú kết luận/ }), 'Đã ổn định');
    await user.click(screen.getByRole('button', { name: 'Đóng 2 cảnh báo' }));
    expect(onConfirm).toHaveBeenCalledWith('Đã ổn định');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('đóng thất bại → báo lỗi trong modal', async () => {
    const user = userEvent.setup();
    render(<AlertBulkCloseModal eligible={1} skippedText={null} onClose={vi.fn()} onConfirm={fail()} />);
    await user.type(screen.getByRole('textbox', { name: /Ghi chú kết luận/ }), 'x');
    await user.click(screen.getByRole('button', { name: 'Đóng 1 cảnh báo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(ERROR_TEXT);
  });
});

describe('SupportRequestModal', () => {
  test('gửi thất bại → báo lỗi trong modal, modal vẫn mở', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SupportRequestModal alert={alertRecords[0]!} onClose={onClose} onConfirm={fail()} />);
    await user.click(screen.getAllByRole('radio')[0]!);
    await user.type(screen.getByRole('textbox', { name: /Lý do/ }), 'Cần hỗ trợ');
    await user.click(screen.getByRole('button', { name: 'Gửi yêu cầu hỗ trợ' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(ERROR_TEXT);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('CancelMaintenanceModal', () => {
  test('hủy thất bại → báo lỗi trong modal', async () => {
    const user = userEvent.setup();
    render(<CancelMaintenanceModal record={maintenanceRecords[0]!} onClose={vi.fn()} onConfirm={fail()} />);
    await user.click(screen.getByRole('button', { name: 'Xác nhận hủy' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(ERROR_TEXT);
  });
});
