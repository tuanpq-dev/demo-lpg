// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { NewMaintenanceInput } from '@/data/maintenance';
import { alertRecords } from '@/mocks/alerts';
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

/*
 * Hành vi trước khi tách modal thành khối + useCreateMaintenanceForm (06/11/2026): điền sẵn từ cảnh báo, tự điền theo
 * thiết bị / giờ bắt đầu, góp ý AI ↔ checklist, nháp (lưu / khôi phục / bỏ), dữ liệu gửi đi, lỗi khi tạo, thanh tổng quan.
 */
const DEVICES = [
  { device: 'V-101', area: 'Khu bồn' },
  { device: 'GS-04', area: 'Khu nạp' },
];
const DRAFT_KEY = 'demo-lpg:maintenance-draft';
type Submit = (input: NewMaintenanceInput) => Promise<unknown>;
const steps = () => screen.queryAllByRole('textbox', { name: /^Bước \d+$/ }).map((x) => (x as HTMLInputElement).value);
const overview = () => screen.getByLabelText('Tổng quan yêu cầu');

describe('CreateMaintenanceModal – điền sẵn, tự điền, nháp, gửi', () => {
  beforeEach(() => localStorage.clear());

  test('từ cảnh báo áp suất: dải liên kết, tên / mô tả / mức độ / nguồn / mã tham chiếu / checklist mẫu; gửi kèm sourceAlertId', async () => {
    const user = userEvent.setup();
    const alert = { ...alertRecords.find((a) => a.id === 'ALT-00128')!, assignee: 'Nguyễn Văn A' };
    const onSubmit = vi.fn<Submit>(async () => undefined);
    render(
      <MemoryRouter>
        <CreateMaintenanceModal open onClose={() => {}} devices={DEVICES} alert={alert} onSubmit={onSubmit} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Liên kết với cảnh báo/)).toHaveTextContent('ALT-00128');
    expect(screen.getByRole('link', { name: /Xem cảnh báo/ })).toHaveAttribute('href', '/alerts?alert=ALT-00128');
    expect(screen.getByLabelText(/Tên yêu cầu/)).toHaveValue('Kiểm tra và khắc phục: áp suất bồn V-101 vượt ngưỡng');
    expect(screen.getByLabelText('Mã tham chiếu / Cảnh báo')).toHaveValue('ALT-00128');
    expect(steps()[0]).toBe('Kiểm tra trực quan van V-101');
    expect(steps()).toHaveLength(5);
    expect(screen.getByRole('heading', { name: /Góp ý từ AI/ })).toBeInTheDocument();
    expect(overview()).toHaveTextContent('1 Thiết bị • 5 Bước thực hiện');
    expect(overview()).toHaveTextContent('! Nghiêm trọng');
    expect(overview()).toHaveTextContent('4 giờ');

    await user.click(screen.getByRole('button', { name: 'Tạo yêu cầu' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      device: 'V-101',
      area: 'Khu bồn',
      priority: 'critical',
      source: 'alert',
      referenceCode: 'ALT-00128',
      assignee: 'Nguyễn Văn A',
      sourceAlertId: 'ALT-00128',
      department: 'Bảo trì Cơ khí',
    });
  });

  test('chọn thiết bị → khu vực + phòng ban + checklist mẫu theo thiết bị; đổi giờ bắt đầu → ca theo giờ; thời lượng ở tổng quan', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<Submit>(async () => undefined);
    render(<CreateMaintenanceModal open onClose={() => {}} devices={DEVICES} onSubmit={onSubmit} />);
    await user.click(screen.getByRole('combobox', { name: /Thiết bị/ }));
    await user.click(screen.getByRole('option', { name: /GS-04/ }));
    expect(screen.getByLabelText('Khu vực')).toHaveValue('Khu vực Khu nạp');
    expect(steps()[0]).toBe('Khoanh vùng & thông gió khu vực');

    const start = screen.getByLabelText(/Thời gian bắt đầu/) as HTMLInputElement;
    const day = start.value.slice(0, 10);
    await user.clear(start);
    await user.type(start, `${day}T15:00`);
    const due = screen.getByLabelText(/Hạn hoàn thành/);
    await user.clear(due);
    await user.type(due, `${day}T18:00`);
    await user.type(screen.getByLabelText(/Tên yêu cầu/), 'Hiệu chuẩn GS-04');
    await user.click(screen.getByRole('button', { name: 'Tạo yêu cầu' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      device: 'GS-04',
      area: 'Khu nạp',
      department: 'Đo lường – Tự động hóa',
      shift: 'shift-2',
      source: 'manual',
    });
    expect(overview()).toHaveTextContent('3 giờ');
  });

  test('góp ý AI: bấm gợi ý → thêm vào checklist (aria-pressed); bấm lại → bỏ', async () => {
    const user = userEvent.setup();
    render(<CreateMaintenanceModal open onClose={() => {}} devices={DEVICES} defaultDevice="V-101" onSubmit={vi.fn()} />);
    const tip = screen.getByRole('button', { name: /Kiểm tra ngoại quan & rò rỉ/ });
    expect(tip).toHaveAttribute('aria-pressed', 'false');
    await user.click(tip);
    expect(tip).toHaveAttribute('aria-pressed', 'true');
    expect(steps()).toContain('Kiểm tra ngoại quan & rò rỉ');
    await user.click(tip);
    expect(steps()).not.toContain('Kiểm tra ngoại quan & rò rỉ');
  });

  test('Lưu nháp → localStorage + onDraftSaved; mở lại → khôi phục; "Bỏ nháp" → form trống, xoá nháp', async () => {
    const user = userEvent.setup();
    const onDraftSaved = vi.fn();
    const first = render(<CreateMaintenanceModal open onClose={() => {}} devices={DEVICES} onSubmit={vi.fn()} onDraftSaved={onDraftSaved} />);
    await user.type(screen.getByLabelText(/Tên yêu cầu/), 'Nháp kiểm tra bơm');
    await user.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    expect(onDraftSaved).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(DRAFT_KEY)).toContain('Nháp kiểm tra bơm');
    first.unmount();

    render(<CreateMaintenanceModal open onClose={() => {}} devices={DEVICES} onSubmit={vi.fn()} />);
    expect(screen.getByText(/Đã khôi phục bản nháp lưu lúc/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tên yêu cầu/)).toHaveValue('Nháp kiểm tra bơm');
    await user.click(screen.getByRole('button', { name: 'Bỏ nháp' }));
    expect(screen.queryByText(/Đã khôi phục bản nháp/)).toBeNull();
    expect(screen.getByLabelText(/Tên yêu cầu/)).toHaveValue('');
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  test('có nháp nhưng mở với thiết bị điền sẵn → không khôi phục nháp', () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: new Date().toISOString(), draft: { title: 'Nháp cũ' } }));
    render(<CreateMaintenanceModal open onClose={() => {}} devices={DEVICES} defaultDevice="V-101" onSubmit={vi.fn()} />);
    expect(screen.queryByText(/Đã khôi phục bản nháp/)).toBeNull();
    expect(screen.getByLabelText(/Tên yêu cầu/)).toHaveValue('');
  });

  test('tạo lỗi → câu lỗi, nháp còn; tạo được → xoá nháp; PTW hiện ở tổng quan', async () => {
    const user = userEvent.setup();
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: new Date().toISOString(), draft: { title: 'Kiểm tra van V-101', device: 'V-101' } }));
    let fail = true;
    const onSubmit = vi.fn<Submit>(async () => {
      if (fail) throw new Error('máy chủ bận');
    });
    render(<CreateMaintenanceModal open onClose={() => {}} devices={DEVICES} onSubmit={onSubmit} />);
    await user.click(screen.getByRole('checkbox', { name: /Permit to Work/ }));
    expect(overview()).toHaveTextContent('Cần PTW');
    await user.click(screen.getByRole('button', { name: 'Tạo yêu cầu' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thực hiện được thao tác: máy chủ bận');
    expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull();

    fail = false;
    await user.click(screen.getByRole('button', { name: 'Tạo yêu cầu' }));
    await waitFor(() => expect(localStorage.getItem(DRAFT_KEY)).toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onSubmit.mock.calls[1]![0]).toMatchObject({ title: 'Kiểm tra van V-101', requiresPermit: true });
  });

  test('sửa ô đang lỗi → lỗi của ô đó biến mất', async () => {
    const user = userEvent.setup();
    render(<CreateMaintenanceModal open onClose={() => {}} devices={DEVICES} defaultDevice="V-101" onSubmit={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Tạo yêu cầu' }));
    expect(screen.getByText('Nhập tên yêu cầu (ít nhất 5 ký tự).')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Tên yêu cầu/), 'K');
    expect(screen.queryByText('Nhập tên yêu cầu (ít nhất 5 ký tự).')).toBeNull();
  });
});
