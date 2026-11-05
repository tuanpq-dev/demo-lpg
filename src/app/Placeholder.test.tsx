// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { Button } from '@/components';
import { PageError } from './Placeholder';

describe('PageError', () => {
  test('tiêu đề + thông điệp lỗi + "Thử lại" gọi onRetry', async () => {
    const onRetry = vi.fn();
    render(<PageError title="Không tải được tài sản" error={new Error('Máy chủ lỗi 500')} onRetry={onRetry} />);
    expect(screen.getByText('Không tải được tài sản')).toBeInTheDocument();
    expect(screen.getByText('Máy chủ lỗi 500').tagName).toBe('P');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('nút phụ đứng sau "Thử lại"; preformatted → <pre> giữ xuống dòng', () => {
    render(<PageError title="Không tải được cảnh 3D" error={new Error('a: sai\nb: thiếu')} onRetry={vi.fn()} preformatted actions={<Button>Về bản đồ 2.5D</Button>} />);
    const buttons = screen.getAllByRole('button').map((b) => b.textContent);
    expect(buttons).toEqual(['Thử lại', 'Về bản đồ 2.5D']);
    expect(screen.getByText(/a: sai/).tagName).toBe('PRE');
  });
});
