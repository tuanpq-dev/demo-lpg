// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { ScheduleList } from './ScheduleList';

const items = [{ id: 'w', date: '2026-06-26', weekday: 'T6', day: '26', title: 'Báo cáo tuần 4 - Tháng 6', meta: 'Hạn chót: 17:00', dateLabel: 'Thứ 6, 26/06/2026' }];

describe('ScheduleList', () => {
  test('danh sách có <time dateTime>, ô ngày rút gọn được thay bằng nhãn đầy đủ cho trình đọc màn hình', () => {
    render(<ScheduleList items={items} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(document.querySelector('time')).toHaveAttribute('dateTime', '2026-06-26');
    expect(screen.getByText('T6')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Thứ 6, 26/06/2026')).toHaveClass('sr-only');
  });

  test('onItemClick → mỗi mục là nút', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ScheduleList items={items} onItemClick={onClick} />);
    await user.click(screen.getByRole('button', { name: /Báo cáo tuần 4/ }));
    expect(onClick).toHaveBeenCalledWith('w');
  });

  test('rỗng → câu thông báo', () => {
    render(<ScheduleList items={[]} emptyState="Không có lịch." />);
    expect(screen.getByText('Không có lịch.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
