// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { ActionItemList } from './ActionItemList';

const items = [
  { id: 'a1', tone: 'danger' as const, subject: 'BCVH-N-24062026', message: 'Thiếu mốc 18:00' },
  { id: 'a3', tone: 'warning' as const, subject: 'Dữ liệu 14:00', message: 'Cần xác minh' },
];

describe('ActionItemList', () => {
  test('nút hành động: tên bắt đầu bằng chữ hiển thị (label in name) + mã → phân biệt từng nút', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<ActionItemList items={items} onAction={onAction} />);
    await user.click(screen.getByRole('button', { name: 'Xử lý ngay – Dữ liệu 14:00' }));
    expect(onAction).toHaveBeenCalledWith('a3');
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  test('mức độ đọc được bằng chữ ẩn, không chỉ bằng màu', () => {
    render(<ActionItemList items={items} />);
    expect(screen.getByText('Khẩn:')).toHaveClass('sr-only');
    expect(screen.getByText('Lưu ý:')).toHaveClass('sr-only');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('rỗng → câu thông báo', () => {
    render(<ActionItemList items={[]} emptyState="Không có việc." />);
    expect(screen.getByText('Không có việc.')).toBeInTheDocument();
  });
});
