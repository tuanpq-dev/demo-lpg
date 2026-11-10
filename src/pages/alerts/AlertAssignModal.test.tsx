// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { AlertRecord } from '@/features/alerts/types';
import { AlertAssignModal } from './AlertAssignModal';

/** 10:45 giờ nhà máy – Ca 1 đang làm; Nguyễn Văn A / Lê Thị C / Hoàng Minh E (Ca 2), Võ Thị F (Ca 3) Ngoài ca. */
const NOW = new Date('2026-10-27T10:45:00+07:00');

const alert = (patch: Partial<AlertRecord> = {}): AlertRecord => ({
  id: 'ALT-00128',
  code: 'ALT-00128',
  daysAgo: 0,
  time: '10:45:22',
  severity: 'critical',
  message: 'Áp suất bồn V-101 vượt ngưỡng',
  device: 'V-101',
  area: 'Khu bồn LPG',
  value: '11.8',
  threshold: '10.5',
  unit: 'bar',
  status: 'unacknowledged',
  assignee: null,
  kind: 'tank-overpressure',
  tag: 'PT-101',
  ...patch,
});

function setup(alerts: AlertRecord[], allAlerts: AlertRecord[] = alerts) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  const user = userEvent.setup();
  const view = render(<AlertAssignModal alerts={alerts} allAlerts={allAlerts} onClose={onClose} onConfirm={onConfirm} now={NOW} />);
  const dialog = screen.getByRole('dialog');
  return { user, onConfirm, onClose, dialog, view };
}

afterEach(() => sessionStorage.clear());

describe('AlertAssignModal – một cảnh báo', () => {
  test('thẻ đầu theo ảnh: "Lúc cảnh báo" (không "Giá trị hiện tại"); ô thông báo tick sẵn khi Nghiêm trọng; gợi ý + Ngoài ca', async () => {
    const { user, dialog, onConfirm } = setup([alert()]);
    expect(dialog).toHaveAccessibleName('Phân công xử lý cảnh báo');
    expect(dialog).toHaveTextContent('ALT-00128: Áp suất bồn V-101 vượt ngưỡng');
    expect(dialog).toHaveTextContent('Lúc cảnh báo:11.8 bar, ngưỡng / 10.5 bar');
    expect(dialog).not.toHaveTextContent('Giá trị hiện tại');
    expect(within(dialog).getByRole('checkbox', { name: 'Gửi thông báo khẩn cấp ngay' })).toBeChecked();
    expect(dialog).toHaveTextContent('Chưa gửi được – chờ backend');

    const group = within(dialog).getByRole('radiogroup', { name: 'Chọn nhân sự' });
    const radios = within(group).getAllByRole('radio');
    // Cùng khu / đúng chuyên môn trước (Sẵn sàng → Ngoài ca), rồi người khác.
    expect(radios.map((r) => r.textContent?.split(/(?=Cùng khu|Đúng chuyên môn)/)[0]?.slice(2)).slice(0, 4)).toEqual([
      'Trần Bình',
      'Trần Văn B',
      'Hoàng Minh E',
      'Nguyễn Văn A',
    ]);
    expect(radios.every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true);

    const nva = within(group).getByRole('radio', { name: /Nguyễn Văn A/ });
    expect(nva).toHaveAccessibleDescription(/Ngoài ca/);
    const confirm = within(dialog).getByRole('button', { name: 'Xác nhận phân công' });
    expect(confirm).toHaveAttribute('aria-disabled', 'true');
    expect(confirm).toHaveAccessibleDescription(/Chưa chọn người phụ trách/);

    // Người Ngoài ca VẪN chọn được, kèm cảnh báo (aria-live polite).
    await user.click(nva);
    expect(nva).toHaveAttribute('aria-checked', 'true');
    expect(dialog.querySelector('[aria-live="polite"]')).toHaveTextContent('Nguyễn Văn A đang Ngoài ca (Ca 2, 14:00 - 22:00)');
    expect(confirm).not.toHaveAttribute('aria-disabled');
    await user.type(within(dialog).getByRole('textbox', { name: 'Ghi chú chỉ đạo' }), 'Kiểm tra PSV-101');
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith({ assignee: 'Nguyễn Văn A', collaborators: [], note: 'Kiểm tra PSV-101', notify: true, reason: '' });
  });

  test('tải việc tính từ danh sách cảnh báo → Bận + cảnh báo nghiêm trọng khác (không chặn)', async () => {
    const mine = alert({ severity: 'high' });
    const others = [
      alert({ id: 'X1', code: 'X1', assignee: 'Trần Bình', severity: 'critical' }),
      alert({ id: 'X2', code: 'X2', assignee: 'Trần Bình', status: 'in-progress', severity: 'medium' }),
      alert({ id: 'X3', code: 'X3', assignee: 'Trần Bình', severity: 'low' }),
      alert({ id: 'X4', code: 'X4', assignee: 'Trần Bình', status: 'done' }),
    ];
    const { user, dialog } = setup([mine], [mine, ...others]);
    expect(within(dialog).getByRole('checkbox', { name: 'Gửi thông báo khẩn cấp ngay' })).not.toBeChecked();
    const tb = within(dialog).getByRole('radio', { name: /Trần Bình/ });
    expect(tb).toHaveTextContent('3 cảnh báo đang xử lý (1 nghiêm trọng)');
    expect(tb).toHaveTextContent('Bận');
    await user.click(tb);
    const live = dialog.querySelector('[aria-live="polite"]')!;
    expect(live).toHaveTextContent('Trần Bình đang Bận');
    expect(live).toHaveTextContent('Trần Bình đang phụ trách cảnh báo nghiêm trọng khác: X1');
    expect(within(dialog).getByRole('button', { name: 'Xác nhận phân công' })).not.toHaveAttribute('aria-disabled');
  });

  test('loại không có giá trị số (mất tín hiệu) → ẩn ô "Lúc cảnh báo"', () => {
    const { dialog } = setup([alert({ kind: 'sensor-signal-lost', value: '0', threshold: '1' })]);
    expect(dialog).not.toHaveTextContent('Lúc cảnh báo');
    expect(dialog).toHaveTextContent('Thời gian phát hiện:10:45 hôm nay');
  });
});

describe('AlertAssignModal – đổi người', () => {
  test('chọn sẵn người hiện tại; đổi người khác cần lý do', async () => {
    const { user, dialog, onConfirm } = setup([alert({ severity: 'high', assignee: 'Lê Thị C', status: 'in-progress' })]);
    expect(dialog).toHaveAccessibleName('Đổi người xử lý');
    expect(within(dialog).getByRole('radio', { name: /Lê Thị C/ })).toHaveAttribute('aria-checked', 'true');
    expect(within(dialog).queryByRole('textbox', { name: /Lý do/ })).toBeNull();
    await user.click(within(dialog).getByRole('radio', { name: /Trần Bình/ }));
    const confirm = within(dialog).getByRole('button', { name: 'Xác nhận đổi người' });
    expect(confirm).toHaveAttribute('aria-disabled', 'true');
    await user.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
    await user.type(within(dialog).getByRole('textbox', { name: /Lý do đổi người xử lý/ }), 'Lê Thị C hết ca');
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ assignee: 'Trần Bình', reason: 'Lê Thị C hết ca' }));
  });

  test('giữ nguyên người, thêm ghi chú → "Cập nhật phân công", không bắt lý do; chưa đổi gì → chặn', async () => {
    const { user, dialog, onConfirm } = setup([alert({ assignee: 'Lê Thị C' })]);
    expect(within(dialog).getByRole('button', { name: 'Xác nhận phân công' })).toHaveAccessibleDescription(/Chưa có thay đổi/);
    await user.type(within(dialog).getByRole('textbox', { name: 'Ghi chú chỉ đạo' }), 'Ưu tiên kiểm tra van');
    const update = within(dialog).getByRole('button', { name: 'Cập nhật phân công' });
    expect(update).not.toHaveAttribute('aria-disabled');
    expect(within(dialog).queryByRole('textbox', { name: /Lý do/ })).toBeNull();
    await user.click(update);
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ assignee: 'Lê Thị C', note: 'Ưu tiên kiểm tra van', reason: '' }));
  });
});

describe('AlertAssignModal – nháp + Hủy', () => {
  test('Nháp lưu sessionStorage (không gọi xác nhận), mở lại khôi phục; Hủy khi đã sửa thì hỏi', async () => {
    const first = setup([alert()]);
    await first.user.click(within(first.dialog).getByRole('radio', { name: /Trần Bình/ }));
    await first.user.click(within(first.dialog).getByRole('button', { name: 'Nháp' }));
    expect(first.onClose).toHaveBeenCalled();
    expect(first.onConfirm).not.toHaveBeenCalled();
    expect(JSON.parse(sessionStorage.getItem('demo-lpg:alert-assign-draft:ALT-00128')!)).toMatchObject({ assignee: 'Trần Bình' });
    first.view.unmount();

    const again = setup([alert()]);
    expect(again.dialog).toHaveTextContent('Đang mở bản nháp đã lưu.');
    expect(within(again.dialog).getByRole('radio', { name: /Trần Bình/ })).toHaveAttribute('aria-checked', 'true');
    await again.user.click(within(again.dialog).getByRole('button', { name: 'Hủy' }));
    expect(again.onClose).not.toHaveBeenCalled();
    expect(within(again.dialog).getByRole('alert')).toHaveTextContent('Bỏ các thay đổi và xóa nháp?');
    await again.user.click(within(again.dialog).getByRole('button', { name: 'Bỏ thay đổi và xóa nháp' }));
    expect(again.onClose).toHaveBeenCalled();
    expect(sessionStorage.getItem('demo-lpg:alert-assign-draft:ALT-00128')).toBeNull();
  });

  test('chưa sửa gì → Hủy đóng ngay', async () => {
    const { user, dialog, onClose } = setup([alert()]);
    await user.click(within(dialog).getByRole('button', { name: 'Hủy' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('AlertAssignModal – hàng loạt', () => {
  test('thẻ "Đã chọn N", không có Nháp; tick thông báo khi có ≥ 1 Nghiêm trọng; lọc "chỉ người trong ca"', async () => {
    const { user, dialog } = setup([alert({ id: 'a', code: 'ALT-a', severity: 'low' }), alert({ id: 'b', code: 'ALT-b', severity: 'critical' })]);
    expect(dialog).toHaveTextContent('Đã chọn 2 cảnh báo');
    expect(within(dialog).getByRole('list', { name: 'Mã cảnh báo' })).toHaveTextContent('ALT-aALT-b');
    expect(within(dialog).queryByRole('button', { name: 'Nháp' })).toBeNull();
    expect(within(dialog).getByRole('checkbox', { name: 'Gửi thông báo khẩn cấp ngay' })).toBeChecked();

    const filter = within(dialog).getByRole('button', { name: 'Bộ lọc nhân sự' });
    expect(filter).toHaveAttribute('aria-expanded', 'false');
    await user.click(filter);
    expect(filter).toHaveAttribute('aria-expanded', 'true');
    await user.click(within(dialog).getByRole('switch', { name: 'Chỉ người đang trong ca' }));
    expect(within(dialog).queryByRole('radio', { name: /Nguyễn Văn A/ })).toBeNull();
    expect(within(dialog).getByRole('radio', { name: /Trần Bình/ })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Bộ lọc nhân sự (1 đang bật)' })).toBeInTheDocument();
  });
});
