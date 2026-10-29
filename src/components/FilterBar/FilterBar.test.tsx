// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { FilterBar } from './FilterBar';

const filters = [{ id: 'status', label: 'Trạng thái hoàn thành', allLabel: 'Tất cả', options: [{ value: 'done', label: 'Hoàn thành' }] }];
const base = { search: '', onSearchChange: () => {}, filters, onValuesChange: () => {} };

describe('FilterBar', () => {
  test('split (mặc định): ô lọc chưa chọn hiện "Nhãn ( Tất cả )" như cũ', () => {
    render(<FilterBar {...base} values={{}} />);
    expect(screen.getByRole('button', { name: /Trạng thái hoàn thành \( Tất cả \)/ })).toBeInTheDocument();
  });

  test('inline: ô lọc chưa chọn chỉ hiện nhãn; có ô chèn `leading`', () => {
    render(<FilterBar {...base} layout="inline" values={{}} leading={<input aria-label="Ngày báo cáo" />} />);
    expect(screen.getByText('Trạng thái hoàn thành')).toBeInTheDocument();
    expect(screen.queryByText(/\( Tất cả \)/)).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Ngày báo cáo' })).toBeInTheDocument();
  });

  test('"Xóa bộ lọc": tắt khi không có bộ lọc, bật thì gọi onClear', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    const { rerender } = render(<FilterBar {...base} layout="inline" values={{}} onClear={onClear} clearDisabled />);
    expect(screen.getByRole('button', { name: 'Xóa bộ lọc' })).toBeDisabled();
    rerender(<FilterBar {...base} layout="inline" values={{ status: 'done' }} onClear={onClear} />);
    await user.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});
