// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { liveSimulator } from '@/data/live';
import type { AlertUpdateInput, AlertUpdateResult, UpdateCheck } from '@/features/alerts/update';
import { alertRecords } from '@/mocks/alerts';
import AlertUpdateModal from './AlertUpdateModal';

/*
 * Hành vi của modal "Cập nhật xử lý" (khung chung) mà các test drawer chưa phủ: thẻ đầu, Tạm dừng / Cần hỗ trợ,
 * tệp tạm, vấn đề phát sinh, theo dõi sau xử lý, dữ liệu gửi đi, lỗi khi lưu. Viết trước khi tách modal thành
 * các khối (06/11/2026) – giữ nguyên để chặn đổi hành vi. Luồng mở từ drawer: AlertPressureUpdate.test.tsx.
 */

const MODAL = 'Cập nhật xử lý cảnh báo áp suất';
const LONG = { timeout: 6000 };
const rec = {
  ...alertRecords.find((x) => x.id === 'ALT-00128')!,
  status: 'in-progress' as const,
  phase: 'inspecting' as const,
  assignee: 'Nguyễn Văn A',
};
type Submit = (input: AlertUpdateInput, check: UpdateCheck) => Promise<AlertUpdateResult> | AlertUpdateResult;

function open(onSubmit: Submit = () => ({ ok: true, record: rec }), onClose = vi.fn()) {
  render(<AlertUpdateModal alert={rec} actor="Vận hành A" onClose={onClose} onSubmit={onSubmit} />);
  return { m: screen.getByRole('dialog', { name: MODAL }), onClose };
}
const radio = (m: HTMLElement, name: string) => within(m).getByRole('radio', { name: new RegExp(`^${name}`) });
const save = (m: HTMLElement) => within(m).getByRole('button', { name: 'Lưu cập nhật' });

afterEach(() => {
  liveSimulator.setBase('PT-101', 9.2);
  liveSimulator.restore();
  sessionStorage.clear();
});

describe('AlertUpdateModal – các khối chưa phủ ở test drawer', () => {
  test('thẻ đầu: mã, nội dung, thiết bị, người xử lý, giá trị lúc cảnh báo và ngưỡng', () => {
    const { m } = open();
    expect(within(m).getByText('Ghi nhận kết quả kiểm tra và tình trạng xử lý cảnh báo ALT-00128')).toBeInTheDocument();
    expect(within(m).getByText('Áp suất bồn V-101 vượt ngưỡng')).toBeInTheDocument();
    expect(within(m).getByText('Người xử lý').parentElement).toHaveTextContent('Nguyễn Văn A');
    expect(within(m).getByText('Giá trị lúc cảnh báo').parentElement).toHaveTextContent('11.8 bar');
    expect(within(m).getByText('Ngưỡng cho phép').parentElement).toHaveTextContent('10.5 bar');
  });

  test('Tạm dừng / Cần hỗ trợ: lý do bắt buộc, chọn người hỗ trợ; gửi đúng trạng thái + người + lý do', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<Submit>(() => ({ ok: true, record: rec }));
    const { m } = open(onSubmit);
    expect(within(m).queryByRole('textbox', { name: /Lý do/ })).toBeNull();

    await user.click(radio(m, 'Tạm dừng'));
    expect(within(m).getByRole('textbox', { name: /Lý do tạm dừng/ })).toBeRequired();
    expect(within(m).queryByRole('radiogroup', { name: 'Người / bộ phận hỗ trợ' })).toBeNull();

    await user.click(radio(m, 'Cần hỗ trợ'));
    const reason = within(m).getByRole('textbox', { name: /Lý do cần hỗ trợ/ });
    const people = within(m).getByRole('radiogroup', { name: 'Người / bộ phận hỗ trợ' });
    expect(within(m).getByText(/Người được chọn thêm vào danh sách phối hợp/)).toBeInTheDocument();

    // Bấm lưu khi thiếu → chặn, nêu lý do, không gửi
    await user.click(save(m));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(save(m)).toHaveAttribute('aria-disabled', 'true');
    expect(within(m).getByText('Chưa lưu được – còn thiếu:')).toBeInTheDocument();

    const person = within(people).getAllByRole('radio')[0]!;
    await user.click(person);
    await user.type(reason, 'Cần thêm người xả áp');
    await user.click(save(m));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const [input] = onSubmit.mock.calls[0]!;
    expect(input.state).toBe('needs-support');
    expect(input.holdReason).toBe('Cần thêm người xả áp');
    expect(input.supportPeople).toHaveLength(1);
  });

  test('dữ liệu gửi mặc định: 3 dòng thông số, nguồn "Cả hai", theo dõi 30 phút mục tiêu 10, người phụ trách = người xử lý', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<Submit>(() => ({ ok: true, record: rec }));
    const { m } = open(onSubmit);
    await user.click(save(m));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const [input, check] = onSubmit.mock.calls[0]!;
    expect(input.state).toBe('inspecting');
    expect(input.readings.source).toBe('both');
    expect(input.readings.rows.map((r) => r.id)).toEqual(['pressure', 'regulator-out', 'temperature']);
    expect(input.followUp).toMatchObject({ choice: 30, target: 10, owner: 'Nguyễn Văn A', customAt: undefined });
    expect(input.issue).toEqual({ kind: 'none', note: '' });
    expect(input.files).toEqual([]);
    expect(check.unit).toBe('bar');
    expect(check.config.title).toBe(MODAL);
  });

  test('vấn đề phát sinh: "Khác" cần mô tả; "Cần thêm nhân sự" gợi ý chuyển sang Cần hỗ trợ', async () => {
    const user = userEvent.setup();
    const { m } = open();
    expect(within(m).queryByRole('textbox', { name: /Mô tả vấn đề/ })).toBeNull();
    await user.click(radio(m, 'Khác'));
    expect(within(m).getByRole('textbox', { name: /Mô tả vấn đề/ })).toBeRequired();

    await user.click(radio(m, 'Cần thêm nhân sự hỗ trợ'));
    expect(within(m).queryByRole('textbox', { name: /Mô tả vấn đề/ })).toBeNull();
    await user.click(within(m).getByRole('button', { name: 'Chuyển sang Cần hỗ trợ' }));
    expect(radio(m, 'Cần hỗ trợ')).toHaveAttribute('aria-checked', 'true');
    expect(within(m).queryByRole('button', { name: 'Chuyển sang Cần hỗ trợ' })).toBeNull();
  });

  test('theo dõi sau xử lý: khoá khi chưa "Đã xử lý"; Tùy chỉnh → ô chọn ngày giờ', async () => {
    const user = userEvent.setup();
    const { m } = open();
    expect(within(m).getByText(/Áp dụng khi chọn "Đã xử lý"/)).toBeInTheDocument();
    expect(radio(m, 'Tùy chỉnh')).toHaveAttribute('aria-disabled', 'true');
    expect(within(m).getByLabelText(/Giá trị mục tiêu/)).toBeDisabled();
    expect(within(m).getByRole('textbox', { name: /Thời điểm kiểm tra lại/ })).toHaveValue('–');

    await waitFor(() => expect(radio(m, 'Đã xử lý')).not.toHaveAttribute('aria-disabled'), LONG);
    await user.click(radio(m, 'Đã xử lý'));
    expect(within(m).queryByText(/Áp dụng khi chọn "Đã xử lý"/)).toBeNull();
    expect(within(m).getByLabelText(/Giá trị mục tiêu/)).toBeEnabled();
    expect((within(m).getByRole('textbox', { name: /Thời điểm kiểm tra lại/ }) as HTMLInputElement).value).toMatch(/^\d{2}:\d{2}$/);

    await user.click(radio(m, 'Tùy chỉnh'));
    expect(within(m).getByLabelText(/Thời điểm kiểm tra lại/)).toHaveAttribute('type', 'datetime-local');

    await user.click(radio(m, 'Không cần theo dõi thêm'));
    expect(within(m).getByLabelText(/Giá trị mục tiêu/)).toBeDisabled();
  });

  test('tệp tạm: thêm / từ chối sai loại / bỏ; có tệp = đã sửa (Esc hỏi lại)', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { m, onClose } = open();
    const input = m.querySelector<HTMLInputElement>('input[type="file"]')!;
    await user.upload(input, [new File(['x'], 'anh.png', { type: 'image/png' }), new File(['x'], 'virus.exe', { type: 'application/octet-stream' })]);
    expect(within(m).getByRole('alert')).toHaveTextContent('virus.exe: không đúng loại tệp cho phép');
    expect(within(m).getByText('anh.png')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    await user.click(within(m).getByRole('button', { name: 'Tiếp tục sửa' }));

    await user.click(within(m).getByRole('button', { name: 'Bỏ tệp anh.png' }));
    expect(within(m).queryByText('anh.png')).toBeNull();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('lỗi khi lưu: ném lỗi → câu lỗi, modal giữ mở; { ok: false } → lỗi trả về hiện ở danh sách còn thiếu', async () => {
    const user = userEvent.setup();
    let fail: 'throw' | 'reject' = 'throw';
    const onSubmit = vi.fn<Submit>(() => {
      if (fail === 'throw') throw new Error('mất kết nối');
      return { ok: false, errors: { state: 'Trạng thái đã thay đổi ở nơi khác.' } };
    });
    const { m, onClose } = open(onSubmit);
    await user.click(save(m));
    expect(await within(m).findByText('Không thực hiện được thao tác: mất kết nối')).toHaveAttribute('role', 'alert');
    expect(onClose).not.toHaveBeenCalled();

    fail = 'reject';
    await user.click(save(m));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(await within(m).findByText('Trạng thái đã thay đổi ở nơi khác.')).toBeInTheDocument();
    expect(within(m).queryByText('Không thực hiện được thao tác: mất kết nối')).toBeNull();
    expect(save(m)).toHaveAttribute('aria-disabled', 'true');
  });

  test('lỗi trả về lúc lưu ({ ok: false }) chỉ đúng với giá trị lúc đó: sửa một ô → lỗi biến mất, nút lưu hết khoá', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<Submit>(() => ({ ok: false, errors: { state: 'Trạng thái đã thay đổi ở nơi khác.' } }));
    const { m } = open(onSubmit);
    await user.click(save(m));
    expect(await within(m).findByText('Trạng thái đã thay đổi ở nơi khác.')).toBeInTheDocument();
    expect(save(m)).toHaveAttribute('aria-disabled', 'true');

    await user.type(within(m).getByRole('textbox', { name: /Nguyên nhân xử lý/ }), 'x');
    expect(within(m).queryByText('Trạng thái đã thay đổi ở nơi khác.')).toBeNull();
    expect(within(m).queryByText('Chưa lưu được – còn thiếu:')).toBeNull();
    expect(save(m)).not.toHaveAttribute('aria-disabled');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  // Đổi có chủ đích (06/11/2026, quyết định sản phẩm): lỗi mạng / máy chủ khi lưu cũng tự xoá khi người dùng sửa một ô
  // (trước: giữ tới lần bấm lưu kế tiếp).
  test('lỗi mạng khi lưu: sửa một ô (ô chữ, ô chọn, hạng mục kiểm tra) → câu lỗi biến mất', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<Submit>(() => {
      throw new Error('mất kết nối');
    });
    const { m } = open(onSubmit);
    const ERR = 'Không thực hiện được thao tác: mất kết nối';

    await user.click(save(m));
    expect(await within(m).findByText(ERR)).toBeInTheDocument();
    await user.type(within(m).getByRole('textbox', { name: /Nguyên nhân xử lý/ }), 'x');
    expect(within(m).queryByText(ERR)).toBeNull();

    await user.click(save(m));
    expect(await within(m).findByText(ERR)).toBeInTheDocument();
    await user.click(radio(m, 'Khác'));
    expect(within(m).queryByText(ERR)).toBeNull();

    await user.click(save(m));
    await user.type(within(m).getByRole('textbox', { name: /Mô tả vấn đề/ }), 'Rò');
    await user.click(save(m));
    expect(await within(m).findByText(ERR)).toBeInTheDocument();
    await user.type(within(m).getByRole('textbox', { name: 'Ghi chú: Kiểm tra bộ điều áp PR-101' }), 'a');
    expect(within(m).queryByText(ERR)).toBeNull();
  });
});
