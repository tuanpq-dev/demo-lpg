// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { NumberField } from './NumberField';

describe('NumberField – chỉ chốt khi người dùng đã gõ', () => {
  test('Tab qua ô (không gõ) không gọi onChange, kể cả khi số hiển thị đã làm tròn (9.22 → "9.2")', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NumberField label="Áp suất" value={9.22} precision={1} onChange={onChange} />);
    const box = screen.getByRole('textbox', { name: 'Áp suất' });
    expect(box).toHaveValue('9.2');
    await user.click(box);
    await user.tab();
    await user.click(box);
    await user.keyboard('{Enter}');
    expect(onChange).not.toHaveBeenCalled();
  });
  test('gõ rồi rời ô / Enter → chốt (dấu phẩy thập phân, kẹp min); ↑ chốt ngay; Esc huỷ', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NumberField label="Áp suất" value={9.2} precision={1} min={0} onChange={onChange} />);
    const box = screen.getByRole('textbox', { name: 'Áp suất' });
    await user.clear(box);
    await user.type(box, '9,6');
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith(9.6);
    await user.clear(box);
    await user.type(box, '-3{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(0);
    await user.keyboard('{ArrowUp}');
    expect(onChange).toHaveBeenCalledTimes(3);
    onChange.mockClear();
    await user.type(box, '5{Escape}');
    await user.click(box);
    await user.tab();
    expect(onChange).not.toHaveBeenCalled();
  });
});
