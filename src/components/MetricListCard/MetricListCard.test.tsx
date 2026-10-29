// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { MetricListCard } from './MetricListCard';

describe('MetricListCard', () => {
  test('tiêu đề, chip đếm có chữ ẩn, cặp nhãn–số trong <dl>, link gọi callback', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <MetricListCard
        title="Chờ xác nhận"
        count={{ value: 6, tone: 'warning', label: 'báo cáo chờ xác nhận' }}
        rows={[
          { id: 'i', label: 'Người kiểm tra (Inspector)', value: 2 },
          { id: 'a', label: 'Người duyệt (Approver)', value: 3 },
        ]}
        action={{ label: 'Xem tất cả', onClick }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Chờ xác nhận' })).toBeInTheDocument();
    expect(screen.getByText('báo cáo chờ xác nhận')).toHaveClass('sr-only');
    const term = screen.getByText('Người duyệt (Approver)');
    expect(term.tagName).toBe('DT');
    expect(within(term.parentElement!).getByText('3').tagName).toBe('DD');
    await user.click(screen.getByRole('button', { name: 'Xem tất cả' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  test('thanh tiến độ: tên truy cập + % làm tròn; max = 0 không chia cho 0', () => {
    const { rerender } = render(<MetricListCard title="Tiến độ" progress={{ label: 'Hoàn thành', value: 19, max: 24, valueText: '19/24 ngày' }} rows={[]} />);
    expect(screen.getByRole('progressbar', { name: 'Hoàn thành' })).toBeInTheDocument();
    expect(screen.getByText('79%')).toBeInTheDocument();
    rerender(<MetricListCard title="Tiến độ" progress={{ label: 'Hoàn thành', value: 0, max: 0, valueText: '0/0 ngày' }} rows={[]} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});
