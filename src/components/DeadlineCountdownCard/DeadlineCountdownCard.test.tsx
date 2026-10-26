// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import * as live from '@/lib/announce';
import { DeadlineCountdownCard } from './DeadlineCountdownCard';

afterEach(() => vi.restoreAllMocks());

describe('DeadlineCountdownCard', () => {
  test('đồng hồ ẩn khỏi trình đọc; câu theo phút trong role="timer"', () => {
    render(<DeadlineCountdownCard countdown={{ clock: '04:15:00', overdue: false, speech: 'Còn 4 giờ 15 phút' }} dueText="16:00 Hôm nay" />);
    expect(screen.getByRole('region', { name: 'Hạn chót xử lý' })).toBeInTheDocument();
    const timer = screen.getByRole('timer');
    expect(timer).toHaveAttribute('aria-live', 'off');
    expect(timer).toHaveTextContent('Còn 4 giờ 15 phút');
    expect(screen.getByText('04:15:00')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('16:00 Hôm nay')).toBeInTheDocument();
  });
  test('chuyển sang quá hạn → báo đúng một lần; mở trang khi đã quá hạn → không báo', () => {
    const spy = vi.spyOn(live, 'announce');
    const ok = { clock: '00:00:01', overdue: false, speech: 'Còn dưới 1 phút' };
    const late = { clock: '00:00:00', overdue: true, speech: 'Quá hạn dưới 1 phút' };
    const { rerender, unmount } = render(<DeadlineCountdownCard countdown={ok} dueText="16:00 Hôm nay" />);
    rerender(<DeadlineCountdownCard countdown={late} dueText="16:00 Hôm nay" />);
    rerender(<DeadlineCountdownCard countdown={{ ...late, clock: '00:00:01' }} dueText="16:00 Hôm nay" />);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Quá hạn 00:00:01')).toBeInTheDocument();
    unmount();
    spy.mockClear();
    render(<DeadlineCountdownCard countdown={late} dueText="16:00 Hôm nay" />);
    expect(spy).not.toHaveBeenCalled();
  });
  test('không đếm → closedText', () => {
    render(<DeadlineCountdownCard countdown={null} dueText="16:00 Hôm nay" closedText="Đã hủy" />);
    expect(screen.getByText('Đã hủy')).toBeInTheDocument();
    expect(screen.queryByRole('timer')).toBeNull();
  });
});
