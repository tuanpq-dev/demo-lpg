// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { AlertItem } from './AlertItem';

describe('AlertItem layout="bar"', () => {
  test('tên gồm mã ẩn + nội dung, dòng phụ "giờ - trạng thái", vạch theo tone, bấm gọi id', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<AlertItem layout="bar" id="A1" code="ALT-1" message="Nhiệt độ thấp" time="08:45" severity="high" statusLabel="Chưa xác nhận" tone="success" onClick={onClick} />);
    const btn = screen.getByRole('button', { name: /ALT-1: Nhiệt độ thấp/ });
    expect(btn).toHaveTextContent('08:45 - Chưa xác nhận');
    expect(btn).toHaveClass('border-l-success');
    await user.click(btn);
    expect(onClick).toHaveBeenCalledWith('A1');
  });
  test('không onClick → không phải nút; tone mặc định theo severity', () => {
    const { container } = render(<AlertItem layout="bar" id="A2" code="ALT-2" message="Rò rỉ" time="Hôm qua" severity="critical" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.firstChild).toHaveClass('border-l-danger');
    expect(container).toHaveTextContent('Hôm qua');
  });
});
