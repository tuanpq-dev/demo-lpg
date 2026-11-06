// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ToastHost } from '@/app/ToastHost';
import { resetToasts } from '@/lib/toast';
import { NotesThread } from './NotesThread';

const announced = vi.hoisted(() => [] as string[]);
vi.mock('@/lib/announce', () => ({ announce: (m: string) => announced.push(m) }));

beforeEach(() => {
  announced.length = 0;
});

describe('NotesThread', () => {
  test('thêm ghi chú: nút tắt khi trống, gửi nội dung đã trim, ô nhập trống lại', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<NotesThread notes={[{ id: 'n1', author: 'Nguyễn Văn A', time: 'Hôm nay 10:50', text: 'Bắt đầu siêu âm.' }]} onAdd={onAdd} />);
    expect(screen.getByRole('list', { name: 'Ghi chú kỹ thuật' })).toHaveTextContent('Bắt đầu siêu âm.');
    const btn = screen.getByRole('button', { name: 'Thêm ghi chú' });
    expect(btn).toBeDisabled();
    const box = screen.getByRole('textbox', { name: 'Ghi chú mới' });
    await user.type(box, '   ');
    expect(btn).toBeDisabled();
    await user.type(box, ' Đã xong ');
    await user.click(btn);
    expect(onAdd).toHaveBeenCalledWith('Đã xong');
    expect(box).toHaveValue('');
  });
  test('Ctrl+Enter gửi; không có onAdd → không có ô nhập', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const { rerender } = render(<NotesThread notes={[]} onAdd={onAdd} />);
    expect(screen.getByText('Chưa có ghi chú.')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Ghi chú mới' }), 'abc{Control>}{Enter}{/Control}');
    expect(onAdd).toHaveBeenCalledWith('abc');
    rerender(<NotesThread notes={[]} />);
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  // Đổi có chủ đích (06/11/2026): onAdd async – chỉ xoá ô nhập + báo "Đã thêm ghi chú" khi lưu thành công; lỗi → giữ nội
  // dung + toast lỗi (trước: luôn xoá + báo thành công, kể cả khi lưu thất bại).
  test('lưu lỗi → giữ nội dung ô nhập, toast lỗi, không báo "Đã thêm ghi chú"; thử lại thành công → xoá + báo', async () => {
    resetToasts();
    const user = userEvent.setup();
    let fail = true;
    const onAdd = vi.fn(async () => {
      if (fail) throw new Error('lỗi mạng');
    });
    render(
      <>
        <NotesThread notes={[]} onAdd={onAdd} />
        <ToastHost />
      </>,
    );
    const box = screen.getByRole('textbox', { name: 'Ghi chú mới' });
    await user.type(box, 'Đo lại áp suất');
    await user.click(screen.getByRole('button', { name: 'Thêm ghi chú' }));
    expect((await screen.findAllByText('Không thực hiện được thao tác: lỗi mạng')).length).toBeGreaterThan(0);
    expect(box).toHaveValue('Đo lại áp suất');
    expect(announced).not.toContain('Đã thêm ghi chú');

    fail = false;
    await user.click(screen.getByRole('button', { name: 'Thêm ghi chú' }));
    await waitFor(() => expect(box).toHaveValue(''));
    expect(announced).toContain('Đã thêm ghi chú');
    expect(onAdd).toHaveBeenCalledTimes(2);
  });

  test('đang lưu → nút khoá, không gửi lặp; xong mới xoá ô nhập', async () => {
    const user = userEvent.setup();
    let done!: () => void;
    const onAdd = vi.fn(() => new Promise<void>((r) => (done = r)));
    render(<NotesThread notes={[]} onAdd={onAdd} />);
    const box = screen.getByRole('textbox', { name: 'Ghi chú mới' });
    await user.type(box, 'abc');
    await user.click(screen.getByRole('button', { name: 'Thêm ghi chú' }));
    expect(box).toHaveValue('abc');
    expect(screen.getByRole('button', { name: 'Thêm ghi chú' })).toBeDisabled();
    await user.type(box, '{Control>}{Enter}{/Control}');
    expect(onAdd).toHaveBeenCalledTimes(1);
    await act(async () => done());
    expect(box).toHaveValue('');
  });
});
