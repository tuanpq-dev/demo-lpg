// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { NotesThread } from './NotesThread';

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
});
