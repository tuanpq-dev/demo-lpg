// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, test } from 'vitest';
import { StatusOptionGroup, type StatusOption } from './StatusOptionCard';

const OPTIONS: StatusOption[] = [
  { id: 'a', label: 'Đang thực hiện' },
  { id: 'b', label: 'Tạm dừng', tone: 'warning' },
  { id: 'c', label: 'Gặp sự cố', tone: 'danger' },
  { id: 'd', label: 'Hoàn thành', disabled: true, disabledHint: 'bắt đầu trước' },
];

function Harness() {
  const [v, setV] = useState('a');
  return <StatusOptionGroup label="Trạng thái công việc" options={OPTIONS} value={v} onChange={setV} />;
}

describe('StatusOptionGroup – radiogroup', () => {
  test('role radiogroup + radio, aria-checked, chỉ ô được chọn có tabindex 0', () => {
    render(<Harness />);
    expect(screen.getByRole('radiogroup', { name: 'Trạng thái công việc' })).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(4);
    expect(screen.getByRole('radio', { name: 'Đang thực hiện' })).toHaveAttribute('aria-checked', 'true');
    expect(radios.filter((r) => r.getAttribute('tabindex') === '0')).toHaveLength(1);
  });

  test('mũi tên chuyển + chọn luôn, bỏ qua ô disabled, xoay vòng', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole('radio', { name: 'Đang thực hiện' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Tạm dừng' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Tạm dừng' })).toHaveFocus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    // "Hoàn thành" disabled → bỏ qua, quay về đầu
    expect(screen.getByRole('radio', { name: 'Đang thực hiện' })).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{End}');
    expect(screen.getByRole('radio', { name: 'Gặp sự cố' })).toHaveAttribute('aria-checked', 'true');
  });

  test('ô disabled: aria-disabled + lý do trong tên, bấm không chọn', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const done = screen.getByRole('radio', { name: /Hoàn thành – bắt đầu trước/ });
    expect(done).toHaveAttribute('aria-disabled', 'true');
    await user.click(done);
    expect(done).toHaveAttribute('aria-checked', 'false');
  });
});
