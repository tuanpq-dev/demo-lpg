// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { Checklist, checklistSummary, type ChecklistItemView } from './Checklist';

const items: ChecklistItemView[] = [
  { id: 'a', text: 'Chuẩn bị PTW', done: true, time: '10:15' },
  { id: 'b', text: 'Siêu âm seat', done: false, active: true },
  { id: 'c', text: 'Ký đóng PTW', done: false, na: true },
];
const progress = { done: 1, total: 2, percent: 50 };

describe('Checklist', () => {
  test('checkbox thật có nhãn hiển thị; N/A luôn khoá; tick → onToggle(id)', async () => {
    const onToggle = vi.fn();
    render(<Checklist items={items} progress={progress} onToggle={onToggle} />);
    expect(screen.getByRole('checkbox', { name: 'Chuẩn bị PTW' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Ký đóng PTW' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Siêu âm seat' })).toHaveAccessibleDescription('Đang làm');
    expect(screen.getByRole('checkbox', { name: 'Chuẩn bị PTW' })).toHaveAccessibleDescription('Hoàn thành lúc 10:15');
    await userEvent.click(screen.getByText('Siêu âm seat'));
    expect(onToggle).toHaveBeenCalledWith('b');
    expect(screen.getByRole('progressbar', { name: 'Tiến độ checklist' })).toHaveAttribute('aria-valuenow', '50');
  });
  test('lockHint → mọi ô khoá + gợi ý được đọc kèm', () => {
    render(<Checklist items={items} progress={progress} onToggle={() => {}} lockHint="Tiếp nhận yêu cầu trước" />);
    for (const cb of screen.getAllByRole('checkbox')) expect(cb).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Siêu âm seat' })).toHaveAccessibleDescription('Đang làm Tiếp nhận yêu cầu trước');
  });
  test('không có onToggle → chỉ đọc', () => {
    render(<Checklist items={items} progress={progress} />);
    for (const cb of screen.getAllByRole('checkbox')) expect(cb).toBeDisabled();
  });
  test('checklistSummary', () => {
    expect(checklistSummary({ done: 2, total: 6, percent: 33 })).toBe('2/6 công việc hoàn thành · 33%');
  });

  test('plain: checkbox thật quanh vòng tròn, tick bằng nhãn, khoá + gợi ý', async () => {
    const onToggle = vi.fn();
    const items = [
      { id: 'a', text: 'Kiểm tra đồng hồ', done: false },
      { id: 'b', text: 'Xác minh van', done: true, time: '10:58' },
    ];
    const { rerender } = render(<Checklist variant="plain" items={items} progress={{ done: 1, total: 2, percent: 50 }} onToggle={onToggle} />);
    expect(screen.queryByRole('progressbar')).toBeNull();
    await userEvent.click(screen.getByText('Kiểm tra đồng hồ'));
    expect(onToggle).toHaveBeenCalledWith('a');
    expect(screen.getByRole('checkbox', { name: 'Xác minh van' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Xác minh van' })).toHaveAccessibleDescription('Đã làm lúc 10:58');
    rerender(
      <Checklist
        variant="plain"
        items={items}
        progress={{ done: 1, total: 2, percent: 50 }}
        onToggle={onToggle}
        lockHint="Xác nhận cảnh báo để bắt đầu xử lý."
      />,
    );
    onToggle.mockClear();
    const cb = screen.getByRole('checkbox', { name: 'Kiểm tra đồng hồ' });
    // aria-disabled (không disabled): vẫn focus được, đọc được gợi ý, nhưng click/Space không tick.
    expect(cb).toHaveAttribute('aria-disabled', 'true');
    expect(cb).not.toBeDisabled();
    expect(cb).toHaveAccessibleDescription('Xác nhận cảnh báo để bắt đầu xử lý.');
    await userEvent.click(screen.getByText('Kiểm tra đồng hồ'));
    cb.focus();
    await userEvent.keyboard(' ');
    expect(cb).toHaveFocus();
    expect(cb).not.toBeChecked();
    expect(onToggle).not.toHaveBeenCalled();
  });
});
