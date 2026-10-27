// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import type { MaintenanceRecord } from '@/data/maintenance';
import { ReviewModal } from './ReviewModal';

const record = (patch: Partial<MaintenanceRecord> = {}): MaintenanceRecord => ({
  id: 'MT-99',
  code: 'MT-99',
  title: 'Kiểm tra van an toàn PSV-101',
  device: 'P-999',
  area: 'Khu bồn LPG',
  type: 'inspection',
  priority: 'critical',
  status: 'review',
  assignee: 'Nguyễn Văn A',
  createdAt: '2026-10-26',
  dueAt: '2099-10-26T16:00',
  completedAt: null,
  progress: 100,
  submission: {
    summary: 'Đã kiểm tra',
    cause: 'Trễ tín hiệu cảm biến hành trình',
    remedy: 'Vệ sinh tiếp điểm cảm biến',
    deviceCondition: 'normal',
    readings: { pressure: { tag: 'PT-101', value: 9.8, warn: 10.5 }, temperature: { tag: 'TT-101', value: 29.4, warn: 40 }, at: '2026-10-26T14:30' },
    sensorStatus: 'normal',
    valveStatus: 'stable',
    reviewer: 'Trần Hoàng Nam',
    submittedBy: 'Nguyễn Văn A',
    submittedAt: '2026-10-26T14:30',
  },
  ...patch,
});

function setup(props: Partial<Parameters<typeof ReviewModal>[0]> = {}) {
  const p = { record: record(), reviewer: 'Trần Hoàng Nam', onClose: vi.fn(), onSubmit: vi.fn(async () => {}), ...props };
  render(
    <MemoryRouter>
      <ReviewModal {...p} />
    </MemoryRouter>,
  );
  return { ...p, user: userEvent.setup() };
}

describe('ReviewModal', () => {
  test('hồ sơ gửi: nguyên nhân, biện pháp, số đã chụp + ngưỡng (không dấu chấm thừa), trạng thái van; người nghiệm thu chỉ đọc', () => {
    setup();
    const d = screen.getByRole('dialog', { name: 'Nghiệm thu yêu cầu bảo trì' });
    expect(within(d).getByText('Trễ tín hiệu cảm biến hành trình')).toBeInTheDocument();
    expect(within(d).getByText('Vệ sinh tiếp điểm cảm biến')).toBeInTheDocument();
    expect(within(d).getByText('9.8')).toBeInTheDocument();
    expect(within(d).getByText('29.4')).toBeInTheDocument();
    expect(within(d).getByText('Ngưỡng: 10.5')).toBeInTheDocument();
    expect(within(d).getByText('Ngưỡng: 40')).toBeInTheDocument();
    expect(within(d).getByText('Ổn định')).toBeInTheDocument();
    const who = within(d).getByRole('textbox', { name: /Người nghiệm thu/ });
    expect(who).toHaveValue('Trần Hoàng Nam (Quản lý vận hành)');
    expect(who).toHaveAttribute('readonly');
  });

  test('3 kết quả trong radiogroup có nhãn; nhãn nút đổi theo kết quả; ý kiến bắt buộc khi Cần bổ sung / Không đạt', async () => {
    const { user, onSubmit } = setup();
    const group = screen.getByRole('radiogroup', { name: 'Kết quả nghiệm thu' });
    expect(within(group).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Đạt yêu cầu', 'Cần bổ sung', 'Không đạt']);
    expect(within(group).getByRole('radio', { name: 'Đạt yêu cầu' })).toHaveAttribute('aria-checked', 'true');
    // phím mũi tên chuyển + chọn
    within(group).getByRole('radio', { name: 'Đạt yêu cầu' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(within(group).getByRole('radio', { name: 'Cần bổ sung' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('button', { name: 'Yêu cầu bổ sung' }));
    expect(screen.getByText('Nhập nội dung cần bổ sung.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Ý kiến đánh giá/ })).toHaveFocus();
    await user.click(within(group).getByRole('radio', { name: 'Không đạt' }));
    await user.type(screen.getByRole('textbox', { name: /Ý kiến đánh giá/ }), 'Còn rò rỉ');
    await user.click(screen.getByRole('button', { name: 'Xác nhận không đạt' }));
    expect(onSubmit).toHaveBeenCalledWith({ result: 'fail', reviewer: 'Trần Hoàng Nam', comment: 'Còn rò rỉ', followUpHours: undefined });
  });

  test('Đạt: thời gian theo dõi mặc định 2 giờ; đổi kết quả khác → ô theo dõi bị khoá', async () => {
    const { user, onSubmit } = setup();
    await user.click(screen.getByRole('button', { name: 'Xác nhận hoàn thành' }));
    expect(onSubmit).toHaveBeenCalledWith({ result: 'pass', reviewer: 'Trần Hoàng Nam', comment: '', followUpHours: 2 });
    await user.click(screen.getByRole('radio', { name: 'Cần bổ sung' }));
    expect(screen.getByRole('button', { name: /Thời gian theo dõi thêm/ })).toBeDisabled();
  });

  test('chặn tự nghiệm thu: nút khoá (vẫn focus được), lý do đọc được, bấm không gửi', async () => {
    const { user, onSubmit } = setup({ reviewer: 'Nguyễn Văn A' });
    const ok = screen.getByRole('button', { name: 'Xác nhận hoàn thành' });
    expect(ok).toHaveAttribute('aria-disabled', 'true');
    expect(ok).toHaveAccessibleDescription(/Người thực hiện không được tự nghiệm thu/);
    await user.click(ok);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('hồ sơ cũ (không có submission) → thông báo; Esc khi chưa sửa → đóng', async () => {
    const { user, onClose } = setup({ record: record({ submission: undefined }) });
    expect(screen.getByText(/chuyển nghiệm thu trước khi có biểu mẫu/)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
